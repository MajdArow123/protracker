#!/usr/bin/env node
// Bundle budget guard (Phase 8 §2) — machine-enforces the Phase 7b pinned rule:
// the @react-pdf stack must NEVER load eagerly. Run after `npm run build`.
//
// Two gates, both hard failures:
//  1. PDF isolation: the chunk(s) containing the PDF engine (identified by the
//     "%PDF-" content marker — filename greps false-positive on importers, which
//     reference the chunk name inside dynamic import strings) must not appear in
//     the static-import closure of the entry, nor of any route-level chunk the
//     entry dynamically imports. Reaching PDF must always cross a dynamic-import
//     edge below the route level (the on-click export path).
//  2. Total eager JS ceiling (entry + its static closure — what index.html
//     modulepreloads, plus the entry itself): BUDGET_BYTES, set ~9% above the
//     post-7b baseline of 1,102,974 B so drift trips early. (The "904 KB" figure
//     in CLAUDE.md is this same state counting only the modulepreload links.)
//
// Import-graph parsing relies on rolldown's emitted syntax: static imports are
// `from"./x.js"` / `import"./x.js"`; dynamic imports are `import(`...`)` with a
// paren, so the static regex cannot match them.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const distDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const assetsDir = join(distDir, 'assets');
const BUDGET_BYTES = 1_200_000;
const PDF_MARKER = '%PDF-';

const fail = (msg) => { console.error(`\nBUNDLE GUARD FAIL: ${msg}`); process.exit(1); };

if (!existsSync(join(distDir, 'index.html'))) fail('dist/index.html not found — run the build first');

const jsFiles = readdirSync(assetsDir).filter((f) => f.endsWith('.js'));
const source = new Map(jsFiles.map((f) => [f, readFileSync(join(assetsDir, f), 'utf8')]));
const size = (f) => statSync(join(assetsDir, f)).size;

// --- import graph -----------------------------------------------------------
const CHUNK_REF = /([\w][\w.-]*\.js)/; // trailing filename inside a specifier like ./x.js
const staticImports = new Map();
const dynamicImports = new Map();
for (const [file, code] of source) {
  const stat = new Set();
  const dyn = new Set();
  // static: `from"./x.js"` or side-effect `import"./x.js"` (any quote style)
  for (const m of code.matchAll(/\b(?:from|import)\s*[`"']([^`"']+\.js)[`"']/g)) {
    const ref = m[1].match(CHUNK_REF)?.[1];
    if (ref && source.has(ref)) stat.add(ref);
  }
  // dynamic: import("./x.js") / import(`./x.js`)
  for (const m of code.matchAll(/\bimport\(\s*[`"']([^`"']+\.js)[`"']\s*\)/g)) {
    const ref = m[1].match(CHUNK_REF)?.[1];
    if (ref && source.has(ref)) dyn.add(ref);
  }
  staticImports.set(file, stat);
  dynamicImports.set(file, dyn);
}

const staticClosure = (start) => {
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length) {
    for (const next of staticImports.get(queue.pop()) ?? []) {
      if (!seen.has(next)) { seen.add(next); queue.push(next); }
    }
  }
  return seen;
};

// --- identify the pieces ----------------------------------------------------
const html = readFileSync(join(distDir, 'index.html'), 'utf8');
const entry = html.match(/<script[^>]+src="\/assets\/([^"]+\.js)"/)?.[1];
if (!entry || !source.has(entry)) fail('could not identify the entry chunk from dist/index.html');

const pdfChunks = jsFiles.filter((f) => source.get(f).includes(PDF_MARKER));
// The marker doubles as the guard's own self-test: if the PDF stack ever stops
// matching, the guard must fail loudly rather than silently gate nothing.
if (pdfChunks.length === 0) fail(`no chunk contains the "${PDF_MARKER}" marker — PDF stack missing or marker rotted; update PDF_MARKER`);

// --- gate 1: PDF isolation --------------------------------------------------
const entryClosure = staticClosure(entry);
const preloadListed = [...html.matchAll(/rel="modulepreload"[^>]+href="\/assets\/([^"]+\.js)"/g)].map((m) => m[1]);
const eagerSet = new Set([...entryClosure, ...preloadListed]); // closure ∪ what index.html actually preloads

const eagerPdf = pdfChunks.filter((f) => eagerSet.has(f));
if (eagerPdf.length) fail(`PDF chunk(s) in the eager/preload graph: ${eagerPdf.join(', ')}`);

const routeChunks = [...eagerSet].flatMap((f) => [...(dynamicImports.get(f) ?? [])]);
for (const route of new Set(routeChunks)) {
  const hit = pdfChunks.filter((f) => staticClosure(route).has(f));
  if (hit.length) fail(`route chunk ${route} statically pulls PDF chunk(s): ${hit.join(', ')}`);
}

// --- gate 2: eager size budget ----------------------------------------------
const eagerBytes = [...eagerSet].reduce((sum, f) => sum + size(f), 0);
console.log(`eager JS (entry + static closure/preloads): ${[...eagerSet].length} chunks, ${eagerBytes.toLocaleString()} B (${(eagerBytes / 1024).toFixed(0)} KiB)`);
console.log(`budget: ${BUDGET_BYTES.toLocaleString()} B — ${eagerBytes <= BUDGET_BYTES ? 'OK' : 'EXCEEDED'}`);
console.log(`pdf chunks (lazy-only, verified): ${pdfChunks.map((f) => `${f} (${(size(f) / 1024).toFixed(0)} KiB)`).join(', ')}`);
console.log(`route chunks checked for static PDF pull: ${new Set(routeChunks).size}`);
if (eagerBytes > BUDGET_BYTES) fail(`eager JS ${eagerBytes.toLocaleString()} B exceeds budget ${BUDGET_BYTES.toLocaleString()} B`);
console.log('bundle guard: PASS');
