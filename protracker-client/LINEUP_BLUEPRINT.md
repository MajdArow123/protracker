# ProTracker — Lineup Management Implementation Blueprint

> A repository-specific roadmap for evolving the current lineup view into a full,
> FC-quality squad-management workspace **without fabricating a single number**.
> Written against the real ProTracker architecture and the completed audit.
> Hand any single phase back to me to execute; each phase is self-contained,
> verified, and reversible.

---

## 0. How to use this document

- Phases run **easiest → hardest** and **safest → riskiest**. Do them in order; each builds on the last.
- Every phase follows the house loop already proven this project: **plan → backend-first (if a migration) → checkpoint → frontend → verify → checkpoint → commit → sequenced deploy**.
- Nothing here is built until its phase is explicitly started. This is a map, not a mandate to code.
- The single rule that overrides all others: **if a value cannot be measured, it is never displayed as a number.** It is labeled, omitted, or shown as "Not tracked."

---

## 1. Non-negotiable principles

1. **No fabricated player data — ever.** This is ProTracker's core differentiator and the spine of every feature already shipped (evidence trends, benchmark standing, squad coverage, lineup ratings). A workspace that shows an invented "Readiness 84%" would undo all of it.
2. **Reuse before rebuild.** The lineup domain already has a tested pure-logic layer, a transactional upsert, an authz gate, per-sport layout configs, and an honesty-aware rating chip. Extend these; do not re-architect them.
3. **Preserve every existing feature.** The read-only lineup view (pitch/court/ladder across five sports), tap-swap, keyboard editing, and the batch evidence endpoint all stay working at every step.
4. **Verify with pure functions.** Every rule (suitability, remap, swap, warning generation) lands as an exported pure function with a vitest suite *first* — the established verification anchor (`computeTrend`, `coverageLevel`, `computeStanding`, `moveOrSwap`).
5. **Additive, reversible migrations only**, verified up **and** down on **both** providers (Postgres prod + the SQLite test rig).
6. **Honesty is typed, not remembered.** See §2 — data provenance becomes a first-class value so the UI cannot accidentally present the wrong kind of number.

---

## 2. The Data-Honesty Taxonomy (the intellectual core)

Every value the lineup surfaces belongs to exactly one of five sources. Make this a **typed, first-class concept** so provenance travels with the data and the UI badges it consistently.

```ts
// Proposed shared type — every displayed metric carries its origin.
type DataSource =
  | 'recorded'      // objective, system-captured (test results, match stat entries)
  | 'coach-entered' // a coach typed/selected it (roles, captain, preferred foot, fitnessLevel-if-set)
  | 'player-reported' // the athlete self-submitted it (wellbeing check-in, self-assessment)
  | 'calculated'    // derived from the above, with a stated method (evidence FinalScore, trend, position fit)
  | 'not-tracked';  // the app does not measure this — render an explicit empty state, NEVER a default number
```

A `<SourceBadge source={...} />` (or a prop on the existing `RatingChip`) makes the distinction visible and prevents the classic failure: a coach-entered guess or a calculated proxy silently reading as a recorded fact.

### Classification of every lineup-relevant attribute

| Attribute | Source | Where it lives today | Display rule |
|---|---|---|---|
| Objective test results | recorded | `ObjectiveTestResult` | real value + `testedAt` |
| Match stat entries | recorded | `MatchStatEntry` | real, sport-correct |
| Coach match ratings | recorded | `PlayerMatchRating` | gated ≥3 rated matches (like `computeTrend`) |
| Evidence FinalScore / overall rating | calculated | `EvidenceBasedScore` | confidence ladder; muted when thin; `—` at zero |
| Category breakdown | calculated | `categoryBreakdown` | `—` per empty category |
| Development trend | calculated | S4 `computeTrend` | ≥3 tests, R² gate, "Too varied to call" |
| Benchmark standing | calculated | S5 `computeStanding` | band + raw gap, no percentile |
| Squad coverage / confidence | calculated | S6 `coverageLevel` | denominator always shown |
| Injuries (type, severity, return date) | recorded | injury entity | real; "return date not set" when null |
| Player status (Suspended/Inactive) | recorded | `PlayerStatus` | "Suspended — no end date tracked" |
| Fitness level | coach-entered | `Player.FitnessLevel` (**int? 1–10, nullable since Phase 3** `35c2d47` — null = "Not recorded"; registration no longer fabricates 5; pre-existing values were kept, so a legacy default 5 is indistinguishable from a coach-set 5) | labeled "coach-set" when a value exists; null renders the true "Not recorded" state |
| Form | **not-tracked** | **no `Player.form` field exists** (the only `form` in the codebase is league-standing form "WWDLL") | "Not tracked" until a coach-entered field ships (Phase 3 candidate) |
| Wellbeing: Energy / Feeling | player-reported | wellbeing check-in | keep real names + "self-reported, {date}"; **Energy ≠ fatigue, Feeling ≠ morale** |
| Position (primary) | coach-entered | `Player.position` (single string) | as-is |
| Preferred foot | coach-entered | **new field (Phase 3)** | "Not set" until entered |
| Secondary positions | coach-entered | **new field (Phase 3)** | sharpen OOP hint only |
| Position fit / suitability | calculated | **Phase 4**, from position + secondary + evidence | "position fit", explained; never a fabricated familiarity % |
| Roles / individual instructions | coach-entered | **new (Phase 3)** | "Not set" default |
| Captain / set pieces | coach-entered | **new (Phase 3)** | eligible-from-XI only |
| Co-appearance ("rated together in N matches") | calculated | derivable from `PlayerMatchRating` | a **count**, never a chemistry score or link weight |
| **Fatigue, morale, readiness (composite), injury risk, training load, position familiarity %, chemistry/cohesion score, minutes-together** | **not-tracked** | — | **omit or "Not tracked"** until a real measurement feature exists (§4, §5) |

---

## 3. The foundation to build on (do NOT rebuild)

From the audit — this is the existing lineup infrastructure the whole program extends:

- **Models:** `Lineup` (`TeamId`, nullable `MatchResultId`, `Formation`, audit fields; one-per-key via the transactional self-healing upsert in `LineupService`) + `LineupSlot` (`SlotKey`, `PlayerId`, player-delete cascade). FluentValidation already enforces ≤11 slots, unique keys/players, match-belongs-to-team, players-belong-to-team.
- **Authz:** controller `Coach,Admin`; real write gate `EnsureTeamPermissionAsync(CanManageTeam)`; frontend mirror `useMyCoachPermissions().canManage`.
- **Config:** `lineupLayouts.ts` (per-sport surfaces) + `lineupFormations.ts` (`FormationSlot {key,x,y,naturalPositionIds,lineId}`). Data-driven already.
- **Pure logic (extend this layer):** `lineupLogic.ts` (rating ladder, 3-pass assignment + rescue, ladder gate) + `lineupEditLogic.ts` (`Assignments`, `moveOrSwap`, roster-keyed `hydrateAssignments`, `remapFormation`, `validateLineup`, `sameLineup`) — 47 vitest cases.
- **State:** local `useState` draft in `LineupBoard`; TanStack Query for server state; batch `['evidence','teamScores',teamId]` primes per-player caches in one request.
- **Interaction:** tap-to-select-then-place, fully keyboard-accessible (`<button>` slots, Enter/Esc, `aria-pressed`). SVG surfaces with `dir="ltr"` wrappers (RTL chart convention).
- **Tokens/components:** Tailwind + clsx; `scoreTone`/`SCORE_TONE_HEX`, `CONFIDENCE_COLORS`; `Modal`/`ConfirmModal`/`Skeleton`/`EmptyState`/`PlayerAvatar`; the `RatingChip` honesty ladder.
- **DnD:** none installed. `framer-motion` present but unused for drag → hand-roll (see §7-challenge-4).

---

## 4. Permanently omitted (cannot be measured honestly — do not build as numbers)

These stay off the roadmap **at every phase**, by design:

- **Injury risk** — a predictive claim, not a measurement. Never.
- **Chemistry / cohesion score** — a composite of unmeasured social/tactical factors. The honest ceiling is a labeled **co-appearance count** ("rated together in N matches"); never a score or weighted link.
- **Morale** — not measured. The nearest real signal is the player-reported wellbeing "Feeling", which must keep that name.
- **Composite "readiness" number** — the panel of real facts (injury, status, wellbeing, recent ratings) *is* the readiness view. Synthesis stays with the coach; no single blended %.
- **Fatigue / training load** — not measured until per-session RPE exists (§5). Energy check-in is the proxy and keeps its real name.

These are permanent unless and until a corresponding measurement feature (§5) makes them genuinely recorded.

---

## 5. Recommended new data

### 5a. New entities/fields for THIS program (coach-entered → zero fabrication)

- `Player.PreferredFoot` — nullable enum (soccer-relevant).
- `Player.SecondaryPositionIds` — structured optional list; feeds OOP accuracy, not speculation.
- `Lineup.CaptainPlayerId`, `Lineup.ViceCaptainPlayerId` — nullable; must be in the XI; roster-keyed drop to null when the player departs (mirrors slot behavior).
- `Lineup.Notes` and presentation-only tactical labels (small enum/string set — explicitly *not* a simulation).
- `Lineup.Status` (`Draft` | `Published`), `Lineup.Version` (int) — for draft/publish + optimistic concurrency.
- `LineupSlot.Role` (nullable preset label per sport) + optional `Instructions` (coach metadata).
- `SetPieceAssignment` (`lineupId`, `type`, `playerId`) — sport-aware taker types.
- `TacticalPreset` (`teamId`, `name`, `settings` JSON, `isSystem`) — reusable, editable, never auto-applied without a diff.
- `LineupChangeAudit` (`lineupId`, `version`, `changedBy`, `summary`, `createdAt`) — **lightweight audit first** (see §7-challenge-3), not full snapshots.

### 5b. Future measurement unlocks (SEPARATE projects — each turns a "not-tracked" attribute into "recorded")

Each is its own scoped effort, not part of this build. Priority order by leverage:

1. **Per-player match minutes / participation** *(highest leverage)* — unlocks real minutes-together, position familiarity, and honest form weighting. **Prerequisite:** a scheduled-vs-played match concept (already flagged as the upcoming-fixtures thread).
2. **Per-player session attendance** — unlocks trained-together counts.
3. **Per-session RPE** — upgrades wellbeing proxies into a real training-load measurement (would make "fatigue/load" honestly displayable).
4. **Suspension end dates / games-banned** — turns "no end date tracked" into real availability windows.

---

## 6. Architecture & conventions this program must follow

- **Extend the pure-logic layer.** New rules (`positionFit`, `remapWithRoles`, `buildWarnings`, `autoBuildWeighted`, `versionDiff`) go in the `lineup*Logic.ts` family as exported, unit-tested functions. UI components stay thin.
- **State:** one predictable draft store. Current draft in local reducer state (extend the `LineupBoard` pattern to a `useReducer` for undo/redo history — original snapshot + present + past/future stacks). Server state stays in TanStack Query with the existing keys; add `['lineup', teamId, matchId]` invalidation on save.
- **Persistence discipline (already established):** optimistic local update, mark dirty, persist on explicit Save / debounced autosave / on-leave confirm — never per-pointer-move. Rollback on failure.
- **i18n:** every string in all 5 locales (en/ar/he/fr/es) with key-set + interpolation validation; formation names are numeric strings (no translation).
- **RTL:** control chrome mirrors; the pitch/court/ladder **surface stays `dir="ltr"`** (a left-back is a left-back regardless of reading direction — the chart/standing-bar precedent).
- **Migrations:** additive + reversible; verify up/down on Postgres and SQLite; **backend-first, sequenced deploy** (push backend, confirm the migration applied — endpoint returns data not 500 — then push frontend).
- **Deploy:** dual-target (Railway + Vercel); with any migration, sequence and verify before the frontend ships.
- **CLAUDE.md:** each phase adds a phase-log entry (design, honesty rules, the pure functions as the verification anchor, migration + teardown notes).

---

## 7. Challenges to the original spec (what I'm changing, and why)

The original spec is an excellent *vision*; several parts optimize for feature-count over honesty or maintainability. Changes:

1. **Rich attribute model (readiness, chemistry, injury risk, morale, fatigue, familiarity %) → reframed via the §2 taxonomy.** These are `not-tracked`. Building them as numbers is fabrication. Replaced with honest panels, labeled proxies, and the §5b measurement roadmap. *Why:* it's the whole point of the platform.
2. **Real-time multi-editor conflict resolution → optimistic version check.** A coaching tool does not need CRDT-style live collaboration. Use `Lineup.Version`: on save, if the server version moved, show "This lineup was edited elsewhere — reload or overwrite," never a silent clobber. *Why:* 90% of the safety at 10% of the complexity and maintenance surface.
3. **Full version-history snapshots → lightweight change audit first.** Start with `LineupChangeAudit` (who/when/one-line summary) and *defer* full snapshot storage + restore + version-compare until there's real demand. Full snapshots per save bloat storage and add a whole diff/restore surface to maintain. *Why:* maintainability over speculative feature depth; the audit covers the real need ("who changed the XI").
4. **New DnD library → hand-rolled pointer drag on `moveOrSwap`.** Targets are ≤11 fixed slots + a bench at known % coords inside one `dir="ltr"` container — no sortable/virtualized lists, which is the only terrain where `@dnd-kit` earns its weight. `moveOrSwap` already *is* the drop handler; keyboard/tap already solve a11y. `@dnd-kit/core` (core only) is the documented fallback if iOS touch-drag fights back — and since the commit layer is `moveOrSwap`, switching later is architecturally free. *Why:* no dependency for a small fixed surface.
5. **Per-player individual instructions (16-item lists) → optional, late, coach-metadata only.** Keep them as nullable coach-entered labels; do **not** let them drive the data model or block earlier phases. *Why:* low ROI relative to their surface area; they're polish.
6. **Auto-build "best lineup" → explained recommendation, never "optimal".** Weighted only over real inputs (evidence score, position fit, injury/availability), with a per-selection explanation. *Why:* same over-claim discipline as the trend chip.
7. **Chemistry overlay → opt-in co-appearance counts only**, labeled, no connecting-line "weights." *Why:* honesty ceiling.
8. **Formations in DB → keep as client config** (`lineupFormations.ts`) unless coach-authored custom formations become a requirement. *Why:* avoid an unnecessary entity + migration for static data.

---

## 8. The phased roadmap (easiest → hardest)

Each phase lists: **why it exists · what it builds · data sources · migration risk · tests · perf · a11y · done-when.** Phases 0–2 ship real value with **no migration**; risk rises with each backend phase.

### Phase 0 — Honesty primitives (tiny, no migration)
- **Why:** make every later phase honest by construction instead of by vigilance.
- **Builds:** the `DataSource` type, a `SourceBadge`/`RatingChip` provenance prop, and reusable "Not tracked" / "Not set" / "Not recorded" empty states.
- **Sources:** n/a (infrastructure).
- **Migration risk:** none.
- **Tests:** snapshot/props tests for the badge + empty states.
- **Perf/a11y:** negligible; ensure the badge is not color-only (icon + text).
- **Done:** the taxonomy is importable and used by the existing rating chip.

### Phase 1 — Interactive workspace shell + drag-and-drop (frontend-only, no migration)
- **Why:** the "FC-feel" interaction quality is the headline, and it's fully buildable on existing state with zero new data — highest impact, lowest risk.
- **Builds:** the workspace layout (top action bar, collapsible left panel as drawer on mobile), hand-rolled pointer drag over `moveOrSwap` (pitch↔slot↔bench, valid/invalid target highlight, drag overlay), the formation selector with miniature preview + apply-with-change-summary (reusing `remapFormation`), and **undo/redo** via a draft reducer (past/present/future).
- **Sources:** all existing (recorded/calculated ratings render exactly as today).
- **Migration risk:** none.
- **Tests:** `remapFormation` change-summary, undo/redo reducer, drag→drop commit equals tap-swap commit, "never silently drops a player."
- **Perf:** hit-test on `pointerup` only (not per-move); memoize suitability/rating derivations; no full-page reload.
- **a11y:** keyboard/tap stays the primary path (drag is progressive enhancement); `touch-action: none` on cards + drag-vs-tap threshold so tap-swap still fires; ARIA live announcements ("X moved to Y").
- **Done:** a coach can drag, swap, bench, change formation, and undo/redo — all on real data, on desktop + touch + keyboard.

### Phase 2 — Player Inspector on real data (frontend, no/low migration)
- **Why:** this is where the taxonomy becomes visible; a coach inspects any player without leaving the page, seeing only true data.
- **Builds:** the contextual right panel: evidence rating + confidence, S4 trend, S5 standing, category strengths/weaknesses, injuries, goals, tasks, wellbeing (labeled player-reported + date), `fitnessLevel`/`form` when present else "Not recorded"; deep-link to full profile; open on select, update instantly.
- **Sources:** recorded + calculated + player-reported + coach-entered — each badged.
- **Migration risk:** none (reads existing data via the batch endpoint).
- **Tests:** the inspector renders each source correctly incl. all-empty; no fabricated fallback.
- **Perf:** data already primed by the batch endpoint; lazy-load the panel body.
- **a11y:** panel is a labeled region; focus moves into it on open; Esc closes.
- **Done:** selecting any player shows a complete, honest dossier with visible provenance.

### Phase 3 — Coach-authored tactical layer (first migration — W1)
- **Why:** unlocks captain, roles, set pieces, and sharper OOP hints — all coach-entered, so zero fabrication; the first schema growth.
- **Builds:** the §5a migration (captain/vice, notes, tactical labels, `SetPieceAssignment`, `LineupSlot.Role`, `Player.PreferredFoot`, `Player.SecondaryPositionIds`), CRUD, validation (captain ∈ XI; roster-keyed drop), and the UI (role selector, set-piece manager, captain picker, secondary-position editor).
- **Sources:** coach-entered.
- **Migration risk:** **moderate** — first multi-table growth. Additive only; verify up/down on both providers; sequence the deploy. Cascade/roster-drop for captain + takers.
- **Tests:** captain-in-XI validation, roster-keyed drop, set-piece eligibility, both-provider migration up/down.
- **Perf:** trivial.
- **a11y:** role/instruction selectors are accessible listboxes.
- **Done:** roles, captain, set pieces persist and survive roster changes without ghosts.

### Phase 4 — Honest position suitability + explained auto-build (frontend + pure logic)
- **Why:** with secondary positions now real (Phase 3), a *labeled* position-fit becomes honest; auto-build gets a real, explainable basis.
- **Builds:** `positionFit(player, slot)` (pure) from primary/secondary position + evidence + availability — presented as **"position fit," explained, never a fabricated familiarity %**; and `autoBuildWeighted` over real inputs with per-pick explanations ("selected over X: +position fit, available, higher evidence with confidence").
- **Sources:** calculated (from coach-entered + recorded), clearly labeled.
- **Migration risk:** none.
- **Tests:** `positionFit` boundary cases, auto-build weighting + explanation, "recommendation not optimal" framing.
- **Perf:** memoize per-player-per-slot fit; recompute only on roster/formation change.
- **a11y:** suitability shown with text + icon, not color alone.
- **Done:** a coach sees why a player fits (or doesn't) a slot, and auto-build explains every pick.

### Phase 5 — Squad analysis drawer + player comparison (frontend + pure logic)
- **Why:** aggregate the honest data into actionable coaching views.
- **Builds:** `buildWarnings` (no backup GK, no natural left-sided defender, players out of position, low-evidence starters, bench coverage gaps — each with an action) + comparison of 2–4 players over real attributes with a labeled "recommended for this slot" + explanation.
- **Sources:** calculated over recorded/coach-entered; co-appearance is a labeled count.
- **Migration risk:** none.
- **Tests:** each warning's trigger + suppression; comparison highlights meaningful diffs only.
- **Perf:** compute warnings once per draft change; lazy-load the comparison drawer.
- **a11y:** warnings are a live region; each action is a real focusable control.
- **Done:** the analysis drawer surfaces real, actionable gaps; comparison never fabricates.

### Phase 6 — Presets, draft/publish, permissions, change audit (backend migration)
- **Why:** the management workflow — multiple lineups, safe publishing, and who-changed-what.
- **Builds:** multiple saved lineups (already keyed default/match), `Status` draft/published (publish gated tighter than edit), `TacticalPreset` CRUD with apply-diff, optimistic version check (§7-challenge-2), `LineupChangeAudit` (lightweight, §7-challenge-3), and per-role permissions enforced **server-side** (head coach publish; assistant draft-only; analyst notes; medical availability; player/viewer read).
- **Sources:** coach-entered + calculated.
- **Migration risk:** **moderate-high** — status/version/preset/audit tables + permission enforcement. Additive; both-provider; sequence deploy; back the version check with the existing transactional upsert.
- **Tests:** publish-vs-edit authz matrix, version-conflict path, preset apply-diff, audit entries, both-provider migration.
- **Perf:** audit writes are cheap; presets cached.
- **a11y:** conflict + publish dialogs are accessible modals (reuse `ConfirmModal`).
- **Done:** drafts and published lineups are distinct, concurrent edits can't silently clobber, and permissions hold on the server.

### Phase 7 — Match context + final polish (backend; depends on the scheduled-match unlock)
- **Why:** connect lineups to real fixtures and finish the experience.
- **Builds:** honest match attachment (date-labeled; "the lineup for this match" until the scheduled-vs-played concept exists), build-from-match-page, plus the cross-cutting polish pass (animation timings 150–300ms + `prefers-reduced-motion`, performance hardening, accessibility audit, design tokens finalized).
- **Sources:** recorded (matches) + coach-entered.
- **Migration risk:** low here, but the *upcoming-fixtures* prerequisite is its own project (§5b #1).
- **Tests:** match-attach round-trip; reduced-motion; full a11y sweep; existing routes intact.
- **Perf:** lazy-load heavy drawers; loading skeletons; no layout shift.
- **a11y:** WCAG 2.2 AA sweep — focus order, contrast, live announcements, high-contrast, scalable text.
- **Done:** lineups attach to matches honestly, and the workspace is premium, accessible, and performant.

---

## 9. Cross-cutting concerns

**Migration risk (whole program):** every migration additive + reversible, verified up/down on Postgres **and** SQLite, deployed backend-first with the "endpoint returns data not 500" confirmation before the frontend ships. Never touch existing tables destructively. The one schema smell to avoid: a filtered/partial unique index (untested on the SQLite rig) — enforce one-per-key in the service layer with a transaction, as `LineupService` already does.

**Testing:** pure logic first, always (`positionFit`, `remapWithRoles`, `buildWarnings`, `autoBuildWeighted`, undo/redo reducer, `versionDiff`) with vitest; backend validator + integration + both-provider migration tests; component tests for selectors/markers/save-states; an e2e happy path (create → formation change → drag → swap → captain → preset → save draft → publish → conflict → keyboard-only).

**Performance:** hit-test on `pointerup`, not per-move; memoize suitability/rating; lazy-load comparison/analysis drawers; the batch evidence endpoint stays the one-request primer; loading skeletons + honest empty/error states; no full-page reload; support large rosters.

**Accessibility (WCAG 2.2 AA target):** keyboard/tap is the *primary* interaction (drag is enhancement); visible focus; ARIA live announcements for every move ("Costa moved from substitutes to right wing"); status never by color alone (icon + text + the source badge); reduced-motion; high-contrast; scalable text; accessible dialogs/menus (reuse `Modal`/`ConfirmModal`).

**Multi-sport extensibility:** the design already generalizes — `lineupLayouts.ts`/`lineupFormations.ts` are per-sport config, the pure-logic layer is sport-agnostic, and the surface renders pitch/court/ladder. A new sport = a new layout config + role/set-piece vocabulary; **no core change**. Rules to preserve: soccer gets formations + full set-pieces; court sports get fixed layouts (+ rotations where meaningful); tennis stays a non-editable ladder. Any new sport inherits the honesty taxonomy and the "not-tracked" discipline for free.

---

## 10. Execution protocol (per phase)

1. I present a short phase plan (files, pure functions, migration if any) → you approve.
2. If a migration: **backend first** — model + migration + endpoints + tests, migration verified up/down on both providers, authz/validation matrix → **checkpoint to you** with the migration diff before any frontend or prod write.
3. Frontend built on the verified backend; build + oxlint + vitest (+ dotnet) green; in-browser verification incl. **Hebrew RTL + mobile**; screenshots.
4. **Checkpoint to you** with the diff before commit.
5. Commit (atomic; two commits when backend+frontend, like the shipped Phase 2); **sequenced deploy** for migrations; prod smoke-check.
6. CLAUDE.md phase-log entry + "still open" notes.
7. Nothing proceeds to the next phase until the current one is signed off.

---

*End of blueprint. Start any phase by handing me its section; I'll produce the phase plan and we run the loop.*
