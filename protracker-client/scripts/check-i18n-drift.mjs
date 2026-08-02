#!/usr/bin/env node
// i18n drift gate: en.json is the reference locale. Every other locale must have
// exactly the same key set (no missing, no extra) and identical {{interpolation}}
// placeholder sets per key. Prints the missing/extra/interpolation counts per locale
// and exits 1 if any locale drifts — this is the "0/0/0" number from the pre-ship
// checklist, now machine-enforced.
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const localesDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'i18n', 'locales');
const REFERENCE = 'en.json';

function flatten(obj, prefix = '', out = new Map()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object') flatten(v, key, out);
    else out.set(key, String(v));
  }
  return out;
}

const placeholders = (s) =>
  [...s.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)].map((m) => m[1]).sort().join('|');

const files = readdirSync(localesDir).filter((f) => f.endsWith('.json'));
if (!files.includes(REFERENCE)) {
  console.error(`Reference locale ${REFERENCE} not found in ${localesDir}`);
  process.exit(1);
}

const ref = flatten(JSON.parse(readFileSync(join(localesDir, REFERENCE), 'utf8')));
let failed = false;

for (const file of files.filter((f) => f !== REFERENCE).sort()) {
  const loc = flatten(JSON.parse(readFileSync(join(localesDir, file), 'utf8')));
  const missing = [...ref.keys()].filter((k) => !loc.has(k));
  const extra = [...loc.keys()].filter((k) => !ref.has(k));
  const interp = [...ref.keys()].filter(
    (k) => loc.has(k) && placeholders(ref.get(k)) !== placeholders(loc.get(k))
  );

  console.log(`${file}: ${missing.length}/${extra.length}/${interp.length} (missing/extra/interpolation)`);
  for (const k of missing.slice(0, 20)) console.log(`  missing: ${k}`);
  for (const k of extra.slice(0, 20)) console.log(`  extra: ${k}`);
  for (const k of interp.slice(0, 20))
    console.log(`  interpolation: ${k}  en={{${placeholders(ref.get(k))}}} vs {{${placeholders(loc.get(k))}}}`);
  if (missing.length || extra.length || interp.length) failed = true;
}

console.log(`reference: ${REFERENCE}, ${ref.size} keys, ${files.length - 1} compared locales`);
process.exit(failed ? 1 : 0);
