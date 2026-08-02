# ProTracker — Session Memory

Sports performance tracking platform for coaches and athletes: assessments, nutrition
planning (AI-generated), injury/training tracking, and reports — built across many
iterative sessions with Claude Code. This file keeps the durable conventions, pinned
rulings, and open items; full per-phase detail lives in git history and
`protracker-client/LINEUP_BLUEPRINT.md`.

## URLs

- **Production frontend (Vercel)**: https://protracker-iota.vercel.app
- **Preview frontend (Vercel, tracks `main`)**: https://protracker-git-main-pro-tracker.vercel.app
- **Production backend (Railway)**: https://protracker-production.up.railway.app
- **GitHub**: https://github.com/MajdArow123/protracker (repo was renamed/moved — `git push`
  may print a "repository moved" notice; it still succeeds against the old remote URL)

## Local paths & commands

- Project root (backend): `~/Desktop/ProTracker`
- Frontend: `~/Desktop/ProTracker/protracker-client`

```bash
# Backend (from project root)
dotnet run --urls http://localhost:8080          # requires ASPNETCORE_ENVIRONMENT=Development for appsettings.Development.json
dotnet test ProTracker.Tests/ProTracker.Tests.csproj

# Frontend (from protracker-client/)
npm run dev            # vite dev server, localhost:5173
npm run build           # tsc -b && vite build — THE authoritative type-check, see gotcha below
npx oxlint src           # lint
npx vitest run           # frontend unit tests (src/test/*.test.ts[x], jsdom) — RUN BEFORE
                          # SHIPPING frontend changes; build+oxlint alone once let a commit
                          # land that broke LoginPage tests (placeholder→label markup change)

# EF Core migrations (from project root)
dotnet ef migrations add <Name> --project ProTracker.csproj --startup-project ProTracker.csproj -o Data/Migrations
dotnet ef database update --project ProTracker.csproj --startup-project ProTracker.csproj
```

### Local Postgres (dev)

Local dev runs against Postgres, not SQLite. Homebrew Postgres@16 on a non-standard
port/socket to avoid colliding with any system Postgres:

```bash
/opt/homebrew/opt/postgresql@16/bin/postgres -D /opt/homebrew/var/postgresql@16 -p 5544 -k /tmp/pgsock16 -c listen_addresses='localhost'
```

Connection string lives in the **gitignored** `appsettings.Development.json`:
`Host=127.0.0.1;Port=5544;Database=protracker_dev;Username=<macos-user>`.
The `/tmp/pgsock16` socket dir is wiped on macOS restart — `mkdir` it before starting.

## Tech stack

- **Backend**: .NET 9 Web API (C#), EF Core 9 + Npgsql (Postgres), ASP.NET Identity,
  JWT bearer auth (access token in HttpOnly cookie + refresh token flow), FluentValidation.
- **Frontend**: React 19 + TypeScript + Vite, Tailwind CSS v4, TanStack Query v5,
  React Router v6, Recharts, Framer Motion, lucide-react icons, clsx.
- **AI**: Anthropic Claude (Haiku for weekly nutrition plans — speed matters there;
  Sonnet for insights/reports). Called from `Services/AIService.cs` / `Controllers/Api/AIController.cs`.
- **Deploy**: Vercel (frontend, auto-deploy on push to `main`), Railway (backend +
  Postgres, auto-deploy on push to `main`).

## Seed accounts (password for all: `SeedCoach123!`)

Coaches (one per sport): `coach.soccer@protracker.seed` (Coach Daniels, City FC U18),
`coach.basketball@protracker.seed` (Coach Reyes), `coach.volleyball@protracker.seed`
(Coach Whitfield), `coach.beachvolley@protracker.seed` (Coach Santos),
`coach.tennis@protracker.seed` (Coach Williams).

Athletes: `lucas.ward@protracker.seed` (Lucas Ward, multi-week assessment history —
good for trends/history views), `marcus.bell@protracker.seed`,
`carlos.santos@protracker.seed`, `alex.williams@protracker.seed`, and more per sport.
Demo-showcase accounts: `athlete.<first>.<last>@protracker.seed` (2 per team),
`parent.<name>@protracker.seed`, `solo.demo@protracker.seed` (Riley Chen, solo athlete).

`Data/DemoDataSeeder.cs` runs on every backend startup (idempotent — `GetOrCreate*`
pattern). It does **not** seed weekly AI nutrition plans (runtime-generated).

## Verification & deploy discipline (pinned conventions)

- Pre-ship every change: `npm run build` (the authoritative typecheck), `npx oxlint src`,
  `npx vitest run`, backend `dotnet test`. One feature per commit.
- Browser-verify as **both coach and athlete** (and solo/parent where relevant). UI work
  also gets a **Hebrew RTL** pass and a **390px mobile** pass.
- All new user-facing strings wrapped in `t('key', 'English fallback')` and translated
  into **all 5 locales** (en/ar/he/fr/es); validate key-set equality + interpolation
  drift = 0/0/0. "ProTracker" stays English in every locale.
- framer-motion `ease` values are **always strings**, never arrays (enforced rule).
- EF migrations auto-apply on Railway startup. Migration up/down must be proven on
  **both Npgsql and the SQLite test rig** (pin permanently in a `*MigrationTests` class).
- Dual-target deploys are **sequenced backend-first**: push backend, probe Railway
  (e.g. 404→401→200 with real data) BEFORE trusting the Vercel frontend.
- Prod smokes leave prod pristine: create → verify → delete, then confirm restored
  state (e.g. lineup GET `{data:null}` before AND after).
- Vercel deploy status: probe **GitHub's deployments API**, not the domain — aggressive
  curl-polling the Vercel domain triggers a Security Checkpoint. Vercel has also missed
  a push webhook entirely (`aefb526`) — an empty retrigger commit fixes it.
- Local curl gotcha: the sandbox doesn't flush the `-c` cookie jar before the next `-b`
  read in the same bash block — `sync; sleep 1` after login in multi-request scripts
  (single calls fine; browser `fetch` with session cookies is the reliable alternative).

## Feature history (condensed — full detail in git history)

- **Phases 1–8 + improvement round + infra**: auth, players/teams/assessments CRUD, JWT
  REST API + integration tests, reports/charts, UI/UX overhaul, AI insights & nutrition,
  weekly AI plans + food swap; slider UX, kg/lb-cm/ft toggles, chart overhaul, teams
  redesign; SQLite→Postgres migration, stale-token redirect + TanStack stale-cache fixes.
- **Phase 9 (7 commits)**: coach tasks (`PlayerTask` — legacy `TaskItem` under
  `TrainingPlan` is unrelated), injury tracking (extended existing `InjuryRecord`),
  match results (`MatchResult`+`PlayerMatchRating`, `Rating` decimal(3,1) — distinct from
  per-player `MatchPerformance`), session planner (`ScheduledSession` — distinct from the
  attendance-based `TrainingSession`), coach-private notes (**`CoachNotesController` is
  `[Authorize(Roles="Coach,Admin")]` — athletes can NEVER read notes**; distinct from the
  free-text `Player.CoachNotes` field), derived notifications, team announcements.
  Several controllers use `[Route("api")]` with absolute sub-routes. `CoachNote`/
  `TeamAnnouncement` store denormalized `CoachName`. Athlete "mine" endpoints scope via
  `IAccessControlService.GetAccessibleTeamIdsAsync`.
- **Post-Phase-9 (5)**: `CoachNote.IsPrivate` sharing; direct messaging (`Message`,
  `ConversationId = BuildConversationId` sorted pair, `/api/messages`, polling);
  localStorage notification read-state (`utils/seenNotifications.ts` — now used ONLY for
  the coach-dashboard injury-card dismissal); AI injury recovery plans; tasks UI overhaul.
- **Latest round (5)**: sport-aware match score formats (`src/utils/matchSport.ts`);
  `WellbeingCheckin` (one row/player/day upsert, score = avg of 3 scales ×2,
  pain-during-recovery alert); AI task suggestions; 10 recovery templates
  (`RecoveryTemplateSeeder`, idempotent insert-when-empty); task analytics
  (`/tasks/analytics` uses Recharts directly — shared chart wrappers are hardcoded to a
  0-10 Y domain).
- **Phase 10 polish (7)**: `React.lazy` all routes + vendor `manualChunks` (**function
  form only** — rolldown-vite rejects the object form); mobile `BottomNav` + bottom-sheet
  modals; skeletons/`ErrorState`; animations; `ErrorBoundary`/404/offline; PDF export
  (**dynamically imported on click** — the 1.4 MB `pdf-vendor` chunk never loads eagerly);
  meta/favicon.
- **Password reset**: own `PasswordResetToken` table (1h expiry, 3 tokens/user/hour,
  generic response — no email enumeration). `EmailService` (MailKit) falls back to
  logging the reset URL when SMTP isn't configured (prod logs `[PasswordReset] ...` to
  Railway). Env: `FRONTEND_URL`, `SMTP_*`, `EMAIL_FROM`.
- **Self-enrollment & profile (4, `bf8f909`/`b4e1354`/`7f6b75f`/`857fbd9`)**:
  `TeamJoinCode` (8-char, no 0/O/1/I, one active/team — regenerating retires old ones),
  `/join/{code}` wizard, `register-athlete`; profile redesign (`ImageService` crops to
  400x400 JPEG **base64 data URLs in the DB**); athlete onboarding modal; jersey/
  `PlayerStatus` (explicit coach-set, null in update DTO = unchanged)/team founded-year+
  description + client-side W–D–L chips.
- **Phase A — Solo Athlete Mode (9 commits `e9db7f9`…`d9369d6`)**: `SoloAthlete` role
  does everything a coach does for exactly one player (themselves). `Player.IsSolo`/
  `SoloUserId`; **`Player.TeamId` became nullable** (see gotchas);
  `AssessmentPeriod`/`ScheduledSession`/`MatchResult` are team-scoped XOR player-scoped.
  `/register/solo` wizard, solo dashboard/assessment/nutrition/training/matches/recovery/
  tasks pages reuse coach surfaces via `self`/`solo` props (`NutritionManager`,
  `TasksPage`, `TeamScheduleSection`, `RecoveryPlanModal isCoach`). Connect-to-coach:
  role flips to Athlete, history preserved, self-assigned tasks handed to the coach.
  Authorization centralized in `AccessControlService`. Solo self-assessment auto-creates
  a "Personal Training" player-scoped period (`assessmentPeriodId: 0`).
- **Phase B — Goals & journal (4)**: `PersonalGoal` (+`LinkedStatCategoryId` so
  assessment auto-link is exact — `AssessmentService.CreateAssessmentAsync` →
  `SyncFromAssessmentAsync` logs Assessment-sourced progress + milestone auto-achieve;
  **coach never sees `IsPrivate` goals, 403s even for own player; a coach-set IsPrivate
  is silently downgraded — only the owning athlete can make a goal private**);
  `JournalEntry` (one/player/day upsert, `IsPrivate` default true, **coach 403 on
  mutate — journal is athlete-owned**); `PublicProfile` (unique immutable slug,
  anonymous rate-limited `GET /api/public/{slug}` **double-filters** `IsPrivate` + the
  per-section `Show*` flags); dashboard cards + coach `goals/overview`. AI goal
  suggestions live on `AIController` → Coach/Admin/SoloAthlete only (team athletes have
  no AI access by architecture). Query-key roots: `['goals']`/`['journal']`/`['publicProfile']`.
- **Phase C — Drill library (4)**: `Drill` (comma-separated `SportIds` — **sport filter
  evaluated in memory**, not SQL-translatable; built-ins immutable; custom drills visible
  to creator only), `DrillSeeder` 60 drills (insert-when-empty), `PagedResult<T>` 20/page,
  favorites, drill→task assign (`PlayerTask.DrillId`, category via `DrillService.MapCategory`),
  non-AI + AI recommendations (weakest assessment areas), goals→drills→tasks wiring,
  drill usage stats + coach analytics.
- **Phase D — Team management (5, `cf9f380`/`8f4ef13`/`41b78d1`/`88ee3c1`/`771dc76`)**:
  bulk assessment (transaction, rollback on any failure; localStorage autosave
  `pd_bulk_${teamId}`); assessment templates (sport-matched apply, coach-owned);
  **assistant coaches** — reuse the `Coach` ASP.NET role + `CoachTeamScope` plus a
  `TeamCoachRole` with `CoachPermissions` JSON (CanAssessPlayers/CanAssignTasks/
  CanViewPrivateNotes/CanManagePlayers/CanManageTeam); head coach = `Team.CoachId`
  (implicitly all perms); enforcement centralized in `AccessControlService`
  (`EnsureTeamPermissionAsync` etc.); invite-accept for an **existing account requires
  password verification** (leaked token ≠ login); session feedback (one/player/session
  upsert, must be a team/solo member and session started); athlete personal notes
  (**`AthleteNotesController` is `[Authorize(Roles="Athlete,SoloAthlete")]` — coach 403
  on every verb**; cross-athlete access 404s, no leak).
- **Phase E — Coach marketplace (5, `c66800f`/`67075de`/`0398b1b`/`e76d9ee`/`70ccc26`)**:
  `CoachPublicProfile` (keyed by `CoachUserId`, lazy get-or-create, unique slug); public
  marketplace `/coaches` (public GETs are `[AllowAnonymous]` + `join-validate` rate limit
  and still read `User` when a token is present to personalize); connection requests
  (one pending per athlete/coach, **5/day per-athlete limit**; **decline reason stored as
  coach note, never exposed in the athlete DTO**; accept issues a join code only when the
  athlete is teamless + sport-matched); reviews (**IsVerified when reviewer has a player
  on the coach's teams**, coach responds to own only); analytics (`CoachProfileView` with
  **SHA-256-hashed IP**, deduped per IP/day, self-views excluded, recording never throws).
  **`GET /api/sports` is `[AllowAnonymous]`**. Shared `utils/sportColors`.
- **Phase F — Leagues + i18n (4, `bb2736e`/`5b0dfcd`/`dd14afc`/`ce31ed3`)**: `League`/
  `LeagueTeam`/`LeagueMatch` (**FKs to LeagueTeam, `DeleteBehavior.Restrict` ×2** —
  avoids multiple cascade paths)/`LeagueStanding`; round-robin via circle method;
  **standings recalculated after every score change** (Points → GD → GF; last-5 Form);
  organizer auto-approved, others Pending, sport-match + capacity guards. i18n:
  i18next + lazy locale chunks; `applyLanguageToDocument` sets `<html>` dir/lang, `.rtl`
  class, Noto Sans Arabic/Hebrew fonts; `LanguageSwitcher` works pre-login. In files
  where `t` is already a local variable, **alias useTranslation's to `tr`**.
- **Pre-G fixes (4, `f047be6`/`fd8fc47`/`5cf4f1b`/`7abcef2`)**: full translations
  (2595 keys × 31 namespaces; `useLocaleFormat` Intl formatters + `useDynamicLabels`
  enum translator; **known gaps: `components/pdf/*` and some `matchSport.ts`/
  `leagueMeta.ts` abbreviations are still English-sourced**); RTL perfection
  (`src/styles/rtl.css` mirrors directional lucide icons, flips physical alignments;
  **charts stay LTR by design**; `useIsRtl` for JS-driven layout); league browse
  auto-scoped to the viewer's sport; **persistent notifications** (DB `Notification`
  model; **`NotificationService.CreateAsync` persists on an isolated
  `IServiceScopeFactory` scope so it never touches the caller's transaction, then fires
  SignalR `"Notification"` + web-push — best-effort, never throws**; 90-day prune;
  `NotificationDto.Type` is the enum **name**; titles/messages are backend-generated
  English data, not i18n; SignalR listener in `ChatRealtimeContext` reuses ChatHub).

## Phase G — Evidence-based assessment (condensed)

- **G S1–S5 (`4a993f4`…`d360724`)**: models (`SportMetricDefinition` — 54 metrics seeded
  by `MetricDefinitionSeeder` insert-when-empty, nullable `SportStatCategoryId` links to
  slider categories; `ObjectiveTestResult`; `MatchStatEntry` flat `StatsJson`;
  `CoachEvaluation`; `SelfAssessmentEntry`; `EvidenceBasedScore` — one "current" row per
  player+metric, AssessmentId snapshots separate); `EvidenceScoringEngine` (3-anchor
  normalization Low→3/Mid→5/High→10 working in both directions, proportional weight
  redistribution, confidence ladder, 90-day `EvidenceWindowDays`, code-level per-sport
  `MatchStatRules` mapping — `HasMatchStatRule` drives `SupportsMatchStats`; pure math is
  public statics, unit-tested without DB); evidence collection UI (`components/evidence/`,
  `EvidencePanel` under sliders via `ScoreSlider` `footer` slot, "Apply X to the slider");
  AI evidence context injected into improvement-plan/insights/task-suggestion prompts
  (**prompts unchanged when a player has no evidence**) + `POST /api/ai/evidence-analysis/
  {playerId}`; reporting/trends (`TestResultsSection`, `MatchStatsSection`, team Evidence
  tab + `GET /api/teams/{id}/evidence-status`); quick entry (`QuickTestEntryModal`,
  `TestDayModal`, `GET /api/evidence-reminders` — only for players who already have
  evidence scores). Slider assessments auto-capture evidence (coach→CoachEvaluation,
  athlete/solo→SelfAssessmentEntry; best-effort, can never break the assessment).
- **G accuracy round (`686f73d`/`dabf849`/`e10c82e`/`cf4537b`)**: auto-import match stats
  on rating save (zero-valued % stats stripped, all-zero rows skipped, manual entries
  never clobbered, de-rated players' auto entries removed; rating-form `STAT_FIELDS`
  expanded to evidence-aligned sets); **benchmark profiles** (`BenchmarkProfile`/`Value`,
  `Team.BenchmarkProfileId` SetNull; 5 system profiles/sport; engine takes benchmark
  overrides — same 4.1s sprint = 7.0 Amateur / 3.0 Professional / 10.0 Youth); test
  protocol guides (all 33 testable metrics; **seeder backfills existing DBs idempotently**
  — fills only null TestSetup; printable Test Day checklist PDF); **recency-gated
  confidence** (`ObjectiveFreshDays = 60`: VeryHigh = all 4 sources + fresh test; High =
  fresh test + ≥1 other; Medium = any 2 incl. expired-test combos; Low = 1 source or no
  test on IsObjectiveRequired; **rating-only metrics (InputType Rating) still reach High
  with 2 subjective sources** — objective testing impossible by design; freshness fields
  derived at read time from `LastObjectiveTestAt`).
- **G continuation S4 (`dd426df`)**: longitudinal progress in `TestResultsSection` —
  default "Progress" view plots `normalizedScore` over time (direction-safe), raw-value
  chart behind a toggle; `MetricTrendSummary` strip; **`computeTrend` is pure/exported
  (the verification anchor, 9 vitest cases)** with honesty gates: directional chip needs
  ≥3 tests; R²<0.3 or same-day → "Too varied to call"; identical scores → flat; 1 test =
  dot no line; 0 tests = EmptyState (never null-render). Benchmark anchor lines are
  deliberately neutral gray (they share the 0-10 axis with score bands — don't recolor).
- **G continuation S5 (`cf282bd`)**: `BenchmarkStandingBar` — **recomputes from the LIVE
  anchors via pure `computeStanding`, NOT the stored `normalizedScore`** (stored scores
  drift when a profile is edited/reassigned — observed live). One function drives marker
  position, tick geometry, band text AND color so they can never disagree. Honesty
  contract: **band + raw-unit gap only, NO percentiles**; degenerate anchors → render
  nothing; no profile assigned → geometry vs app defaults with explicit chip but **band
  sentence suppressed** (no cohort claim without a chosen cohort). Bar stays LTR in RTL.
- **G continuation S6 (`d7d98d0` backend + `037d63e` frontend)**: `GET /api/teams/{id}/
  evidence-performance` + `SquadPerformanceCard` on the team Evidence tab (weakest
  average first, unscored metrics shown as honest gaps, outlier chips deep-link to
  `/players/{id}?tab=evidence` — PlayerDetailPage validated `?tab=` init). stdDev is
  sample (n-1), **null under 4 scored**; outliers ≥1.5 from team avg, max 2/side,
  suppressed under 3 scored (named constants in `TeamPerformanceMath`, pure statics).
  **`coverageLevel(scored, squad)`** (`teamCoverage.ts`, pure, tested) is the honesty
  anchor: absolute floor — **<3 scored is always thin** — plus 50%/80% ratio bands; thin
  averages render muted + amber, never confident.

**Phase G pinned rules:**

- **Evidence sources are role-honest**: solo athletes never write CoachEvaluations; team
  athletes never write match stats. Don't widen those role gates.
- Frontend `matchStatFields.ts` keys MUST stay in sync with backend `MatchStatRules`.
- Seeders are insert-when-empty — metric/benchmark tweaks don't propagate to existing DBs.
- **CALIBRATION RULING**: coach-eval and self-assessment components are raw 1-10 (the
  engine clamps without anchor normalization), so blended `FinalScore == 5.0` is the app
  scale's average, NOT the benchmark Average anchor. Field/wording is
  **`BelowAverageCount` ("below average, score < 5"), never "below benchmark"**.
  (Objective-only anchor-relative count = documented possible future refinement.)
- `useEvidence` mutations recalculate immediately and `setQueryData` the fresh score.
- Evidence i18n lives in the `evidence` namespace. Score-band thresholds (<5/<7) mirror
  `scoreTone`/chartColors — keep in sync.
- **FINDING-009 discipline (app-wide): never confidently wrong** — loading skeletons,
  error + Retry (a load failure is never a "no data" claim), honest empty states.
- Prod demo note: 3 seeded Speed tests for City FC players are permanent (tests/scores
  have no DELETE endpoints) — disclosed, kept as demo enrichment.
- **Still open**: trending the composite `EvidenceBasedScore` over time — per-assessment
  snapshot rows already exist (AssessmentId-linked), so it's an endpoint + chart, not a
  new table.
- **Evidence-form buttons must be `type="button"`** — shared `Button` defaults to submit
  and the evidence panel lives inside the assessment `<form>`.

## Final Design Sprint (`46564cd`…`f6dde23`, 7 commits — condensed)

Shipped: chart system (`src/components/charts/`), glass dashboards (`StatCard`), player
cards (`PlayerAvatar`), reports redesign (`AIInsightsList`), micro-interactions, mobile
final pass (**`viewport-fit=cover` in index.html — bottom-nav safe-area padding was
silently 0 before**), landing redesign (How-it-works / evidence showcase / pricing / footer).

**Design pinned rules:**

- `chartColors.ts` is the color source of truth. The categorical palette is
  **CVD-validated** — the spec's original palette FAILED colorblind validation and was
  substituted; **don't "restore" it**. Run the dataviz palette validator before changing
  chart colors.
- `CONFIDENCE_COLORS`: Low gray / Medium amber / High blue / VeryHigh green.
- Recharts custom tooltips use the shared `TooltipContent` with **`bg-slate-900`**.
- `StatCard`/`PlayerAvatar`/`AIInsightsList`/`Sparkline`/`MiniRadar` are the shared
  primitives — extend them, don't hand-roll card/avatar markup.
- Phone dashboard card rows are snap carousels relying on the `.scrollbar-none` utility
  in index.css. `size="xl"` modals go full-screen (100dvh) on phones.
- Report DTO `sportName` is null — fall back via `sportNameById(sportId)`.
- Landing pricing mirrors the real billing plans (Free $0 / Pro $19 / Team $49 from
  `PlanLimits`) — keep in sync if plans change.
- `ConfidenceChart` re-derives the backend confidence rules client-side
  (`chartUtils.buildConfidenceTimeline`) — keep in sync with `EvidenceScoringEngine`.
- Line charts: dashed segments for Low/Medium-confidence series; gradient fill under the
  focused line only. Radar: per-point confidence dots, dashed until all verified.

## Landing localization (`aefb526` + retrigger `3e0180d` — condensed)

Landing fully localized (+79 keys × 5 locales). Language switcher is **flag-free**
(flags denote countries, not languages) — `short` codes on the trigger, native names as
aria-labels. Deliberate-English tokens (tech-stack items, demo credentials) wrapped
`dir="ltr"`; feature-card badge uses `end-4` (RTL-safe). **OPEN: design-audit finding
#10 (fabricated testimonials + README-style About content)** — this pass translated
that content, it did not remove it.

## Demo showcase seeder (live on production — condensed)

Code: `Data/Showcase/{DemoShowcaseSeeder,ShowcaseRng,ShowcasePools}.cs` +
`DemoShowcaseController`; tests in `DemoShowcaseSeederTests.cs`. On-demand +
token-gated, NOT a startup seeder (`DemoDataSeeder` baseline untouched). Seeded to prod
(~130 players / 10 real teams + 6 shell opponent clubs, all 5 sports, full feature
graph incl. leagues with independently-verified standings, marketplace profiles/reviews,
parents, solo demo Riley Chen) and verified across all four roles; gap-fill `08760b5`.

**Pinned operational contract:**

- `POST /api/admin/demo-showcase` body `{"phase","dryRun"}` (phases
  `soccer|basketball|volleyball|beach|tennis|extras|all`) + `/teardown`; `X-Seed-Token`
  header must equal the `SEED_ADMIN_TOKEN` env var. **The env var is REMOVED from
  Railway — the endpoint is dead (403s). To re-seed/tear down: set a fresh token
  (`railway variables --set "SEED_ADMIN_TOKEN=$(openssl rand -hex 24)"`), call, then
  remove the variable again.** Controller returns raw `StatusCode(403)`, never
  `Forbid()` (which 302s into the login flow).
- **Safety contract (do not weaken)**: GUARDED — only touches teams owned by the five
  `@protracker.seed` coaches, throws otherwise. IDEMPOTENT — natural-key get-or-create +
  deterministic `ShowcaseRng`, with **all randomness drawn BEFORE existence checks**
  (violating this caused real drift twice); **injuries must seed BEFORE wellbeing — the
  order is load-bearing**. DRY-RUN — whole run in a rolled-back transaction with
  would-create counts. REMOVABLE — teardown deletes the demo graph, keeps the 5 coaches,
  the 4 baseline `firstname.lastname` logins, and reference data.
- Coaches are on the **Team** billing plan (parent-portal gate). Pending connection
  request Riley → Coach Daniels is safe to accept (only issues a join code).
- By-design empties: Notifications ("all caught up" — seeder writes DB rows directly, no
  NotificationService events), solo "My Leagues", adult Parents tab. Known cosmetics:
  standings show "(you)" on shell clubs (seed coach owns them), nutrition header shows
  the seeding-week date, player-detail Training/Matches tabs render raw ISO dates
  (pre-existing product formatting, not seed data).

## Lucas Ward 6-month demo arc (live on production)

Lucas Ward (player 5, City FC U18) carries a seeded 6-month progression
(Feb 3–Aug 1 2026): ~50 objective tests across 8 metrics, 7 backdated matches
(Lucas-only ratings → real auto-import + recalc), monthly coach evals + self-
assessments, a hamstring-strain arc (Apr 13 → FullyRecovered May 8, completed
template recovery plan), ~70 wellbeing check-ins, 12 journal entries, 2 achieved
goals + milestones/progress on the 4 active ones, 10 tasks (8 completed), 38
attendance rows. Result (engine-computed, never written directly): 11/11 metrics
scored — VeryHigh on Passing/Shooting/Stamina/Dribbling/Defending, High on the
rest; all 8 tested metrics read "Improving"; lineup chip 7.5 confident.

- **Scripts**: `scripts/lucas_6mo_seed.py` (idempotent — natural-key pre-checks +
  `ON CONFLICT DO NOTHING`; `--dry-run` prints the full write plan + verbatim SQL)
  and `scripts/lucas_6mo_teardown.py` (consumes
  `scripts/lucas_6mo_seed.manifest.json`, restores the baseline recorded inside it;
  has `--dry-run`). Both need `PROD_DB_URL` (Railway Postgres service
  `DATABASE_PUBLIC_URL`) for their SQL phase — API writes use Bearer tokens for
  coach.soccer / lucas.ward (provenance is server-stamped from the caller).
- **Mechanism ruling**: evidence tables/matches/assessments/injuries/goals-progress/
  training sessions accept backdated dates via the API; `WellbeingCheckin.Date` and
  `JournalEntry.EntryDate` are server-stamped (journal's DTO `EntryDate` is dead
  code) → SQL inserts; task/goal/recovery timestamps + `InjuryRecord.RecoveredDate`
  → SQL fix-ups. Evidence writes do NOT auto-recalc (except match-rating save) —
  always finish with `POST /api/evidence-scores/calculate/{playerId}`.
- **Untouched**: every pre-existing row (incl. the 3.75s Speed outlier — combined
  trend still clears R²≥0.3 → "Improving"), the 2 open July injuries, other
  players. Team-visible side effects (accepted): 7 historical matches on the
  Matches tab / W-D-L chips, only Lucas rated, fictional opponents.
- Team-1 squad card now shows Weak Foot/Positioning as "Thin data · 1/24" (only
  Lucas has them) — honest by design, not a bug.

## Lineup program

**`protracker-client/LINEUP_BLUEPRINT.md` is the authoritative roadmap** (note: lives in
the CLIENT folder, not repo root); when it conflicts with any older FC-style spec, the
blueprint wins.

History (one line each; full detail in git history + blueprint):

- **Team lineup view Phase 1** (`3f79125`): read-only sport-aware Lineup tab on
  TeamDetailPage (`components/teams/lineup/`); layouts keyed to seeded positionIds 1-23
  (`lineupLayouts.ts`); tennis = ranked ladder, not a court; `?tab=` deep-linking + tab
  bar `overflow-x-auto`.
- **Team lineup view Phase 2** (`f14d972` backend + `7d612c7` frontend): `Lineup`/
  `LineupSlot` (migration `AddLineups`), **one lineup per (TeamId, MatchResultId)** —
  null = team default XI — via `LineupService`'s transactional self-healing upsert
  (service-layer uniqueness per codebase convention, NO filtered index); batch
  `GET /api/teams/{id}/evidence-scores` (1 call, primes per-player caches); edit mode
  with tap-to-select-then-tap-to-place + 6-formation soccer picker
  (`lineupFormations.ts`); pure logic in `lineupEditLogic.ts`.
- **Program Phase 0**: honesty primitives — `DataSource`/`MissingReason`/`Sourced<T>`
  types, `sourceMeta`/`missingReasonMeta` (`utils/dataSource.ts`), `SourceBadge` +
  `MissingValue` components.
- **Program Phase 1**: drag-and-drop as an enhancement over tap/keyboard —
  `lineupDraftReducer` (undo/redo, 50-step cap), `lineupDragLogic` (`dragCommit` →
  `moveOrSwap` verbatim), `useLineupDrag` DOM shell, desktop bench panel.
- **Program Phase 2**: view-mode **Player Inspector** (desktop side panel /
  mobile Modal sheet, one `PlayerInspectorBody`) built entirely from real data via
  existing hooks, queries gated on `open`; `inspectorLogic.ts` (`wellbeingRecency`,
  `topTrends`).
- **Program Phase 3** (`35c2d47` backend + `070517d` frontend, migration
  `AddTacticalLayer`): tactical layer — `FitnessLevel` int→**int?**, `PreferredFoot`,
  `SecondaryPositionIds`; lineup captain/vice (**FK ON DELETE SET NULL** — deliberately
  unlike the slot cascade), Notes/TacticalLabels, `LineupSlot.Role`/`Instructions`,
  `SetPieceAssignments`; **Down() is hand-edited** (backfills `FitnessLevel = 5` before
  the NOT NULL restore, quoted SQL valid on both providers); `TacticsPanel`/
  `TacticsSummary`, `tacticalCatalog.ts`, optional fitness slider + foot + secondary
  positions on the player form; `lineupTacticalLogic.ts`.
- **Program Phase 4** (`82ae6ff`): categorical position-fit chips (`lineupFitLogic.ts`
  `assessFit`, memoized `fitMatrix`) + explained auto-build (`explainSuggestion` over an
  optional engine trace; `WhyPicksPanel`; `FitChip`).
- **Program Phase 5** (`dcbf0fa`): `SquadAnalysisPanel` (`buildWarnings`, 8 typed codes)
  + `ComparePlayersModal` (2-4 columns, slot-context or inspector entry;
  `recommendForSlot`, `coAppearanceCount`) — `lineupAnalysisLogic.ts`.
- **Program Phase 6 BACKEND** (`49a6122` backend + `69fb3d1` permission plumbing,
  migration `AddLineupWorkflow`): draft/publish workflow (`LineupStatus`, `PublishedAt`),
  optimistic `Version` (EF concurrency token), named lineups, `TacticalPreset` +
  `TacticalPresetsController`, `LineupChangeAudit` + `LineupDiffSummarizer`,
  `CanPublishLineup`, `ConflictApiException` → 409. Existing rows backfill
  Status=Draft/Version=1 (migration default, both-provider proven incl. down-leg,
  pinned in `LineupWorkflowMigrationTests`). NOTE: this work was found 11 days stale
  and uncommitted in the lineup-phase5 worktree (a parallel session started it without
  a checkpoint), was audited against the approved spec, completed, and landed.
- **Program Phase 6 FRONTEND** (BaseVersion echo `1cf4442` + workflow UI `1b9f8a3`):
  publish/unpublish with confirm dialogs + Draft/Published status chips ("Published —
  unpublish to edit" locked edit button); named-lineup picker (native select: Default
  XI / named / recent matches) + save-as-named in `SaveLineupModal` (three-target
  choice, 10-cap counter); `LineupAuditPanel` "Lineup history" (collapsible, renders
  backend `LineupDiffSummarizer` summaries verbatim); `PresetManager` (save current /
  apply with client-side diff preview modal / edit / delete, honest scope note);
  BaseVersion echoed on every save; 409 → reload-vs-overwrite conflict UX.

**Lineup pinned contracts (rulings — do not violate):**

- **RatingChip honesty ladder** (regression net: `RatingChip.test.tsx`): zero evidence =
  "—" **never 0.0**; **"?" is reserved for load failures** ("—" for absent data —
  app-wide via `MissingValue`); thin (Low confidence OR <3 scored metrics — same floor
  as `coverageLevel`) = muted gray + dashed border, never bold; confident
  (High/VeryHigh, ≥3 metrics) = bold band color.
- **Value-first `compareByRating`** (explicit ruling): rating value first; confidence
  only breaks exact ties; **thin data is flagged, never demoted**.
- **Ladder ranking gate**: <3 scored metrics can never rank — below a "Not enough data
  to rank" divider, unranked sort alphabetically, never by unreliable values.
- `assignToSlots`: pass-3 "rescue" never benches a higher-rated player; an empty
  keeper-type line shrinks capacity (no GK → 10 outfielders, never a faked position).
  Formation chip is line counts only ("implied by positions"); auto-arranged surfaces
  always say "Auto-arranged by rating — not a saved lineup".
- Surfaces are `dir="ltr"` spatial diagrams (chart convention); charts/pitch stay LTR in
  RTL locales while surrounding text mirrors.
- **Tennis stays a read-only ladder — no edit, no save** (untouched by construction; the
  panel/board never mount for it).
- **Saves are full write-through, NO merge** — a save without tactical fields CLEARS
  them; `SaveLineupInput` requires every tactical field (compiler-enforced) and
  `buildSaveInput` is the only sanctioned payload builder (test-pinned: fields present
  when set AND present-as-null/empty when not).
- **Departed-player contract**: GET passes stored captain/taker ids through; the
  frontend drops roster-keyed; the next save re-validates and 400s.
- **Hydration is roster-keyed**: saved slot players missing from the live roster,
  unknown slot keys, and duplicates all drop to empty slots — never a ghost or crash.
  `hydrateTactical` is defensive against pre-tactical wire data (missing array hydrates
  empty). `pruneTactical` re-establishes captain/vice/takers ∈ XI after every
  assignments/formation change and returns the same object when unchanged (reducer no-op
  detection depends on it).
- **`tacticalCatalog.ts` keys are stable API data — never rename, only add.**
  TacticalLabels / SlotKey / set-piece Type are opaque to the server (frontend owns the
  per-sport catalogs).
- **Fitness ruling**: register flows create null fitness (no fabricated 5); existing
  rows kept their values (a coach-set 7 and a legacy default 5 are indistinguishable —
  nulling nothing was the approved ruling); a seeded value must never wear a
  coach-entered badge; `fitnessNotRecorded` caveat fires **only when null** (a set value
  is a fact, never a selection input); AI prompts use `FitnessText(p)` → `"7/10"` or
  `"not recorded"`.
- **Validation split**: payload shape in FluentValidation (set-piece types unique
  case-insensitive ≤10, labels ≤6/≤40/no-comma, secondary positions ≤3/distinct/
  ≠primary); XI-membership in `LineupService.UpsertAsync` (captain/vice/takers ∈ XI,
  captain ≠ vice); sport-membership of secondary positions in `PlayerService`.
  `ParseFoot` 400s on invalid input (deliberately NOT ParseStatus's silent-ignore).
  Lineup reads = team access; **writes = `EnsureTeamPermissionAsync(CanManageTeam)`**.
- **Fit is CATEGORICAL, never a %** (natural | secondary | outOfPosition | cantAssess —
  unknown primary says so out loud, "?" per ruling; test asserts the assessment contains
  NO number). Preferred foot is a supplementary stated fact (soccer wide slots only,
  from slot geometry x≤35/x≥65) that never changes the category. Fit and rating render
  as separate claims.
- **Explained auto-build introduces NO new weighting** — trace reports what the engine
  DID (byte-identical output with trace off, test-pinned). **Reason-code separation
  (test-pinned)**: `selectedOver` fires ONLY on a genuine head-to-head vs a benched
  eligible runner-up; pass-3 displacements are `rescued`/`movedForRescue`, never phrased
  as wins; `noEligible` = "left empty, never faked". Caveats (thinData/noEvidence/
  injured/fitnessNotRecorded) are stated, never hidden. **"optimal"/"best" never
  appear**; the panel says "the call is yours". `WhyPicksPanel` hides the moment the
  arrangement diverges from the explained snapshot (undo back re-shows); explanations
  are never retro-fitted onto manual edits.
- **Wording ruling (retroactive to Phase 4)**: `runnerUpNoEvidence` reads as absence of
  information ("Selected while less is recorded about {{name}} — there was no evidence
  to compare"), never a quality verdict. EN fallbacks live in exported
  `PICK_DETAIL_EN`/`WARNING_EN` maps consumed by BOTH WhyPicksPanel and the comparison;
  the absence-framing vs permitted measured-superiority (higherValue) distinction is
  pinned by test.
- **SquadAnalysisPanel rulings**: ONE deterministic sort — severity → catalog code order
  → first slot key — pinned incl. recompute stability AND roster-input-order
  independence (**the panel must never reshuffle**). Every warning is a recorded/
  coach-entered fact or a DATA-absence claim, never a quality verdict
  (`lowEvidenceStarters` = "ratings may be unreliable", wording-pinned). Keeper
  detection is per-sport config (`KEEPER_POSITION_IDS`, only soccer) — layout flags
  can't infer it; keeper line excluded from the generic noBenchCover sweep;
  coach-entered secondary positions count as cover; Suspended/Inactive never do.
  `footMismatch` fires only on a coach-entered foot; `captainNotSet` is edit-mode-only.
  Info rows are visually subordinate and always after warnings; zero warnings renders an
  explicit "No gaps detected". Collapsible panel, not a drawer (ruling); it has its OWN
  aria-live region (never stomps the board's move announcements).
- **`coAppearanceCount` is a labeled COUNT, never a chemistry score** (blueprint §4
  ceiling — form/readiness/chemistry/familiarity/minutes appear NOWHERE).
- `recommendForSlot` uses primary-position eligibility only (the engine never places by
  secondary, so recommendations don't either), `compareByRating` order, Phase 4
  `headToHead` verbatim; none eligible → null (no suggestion is the honest answer).
- **Board/undo rulings**: formation change = apply immediately + summary toast naming
  benched players when ≤3 (count otherwise) + one-step undo — **no confirm dialog**.
  **No mobile bench drawer** (stacked bench stays). Every mutation = exactly one undo
  step; notes commit on BLUR. `dirty` derives from `sameLineup(present, baseline)` —
  undo back to baseline clears it. Drag commits ONLY through `moveOrSwap`
  (release-outside can never silently drop a player, by construction); tap/keyboard is
  the primary path.
- **(C)-split ruling**: the compact pitch marker is NOT badged (constant source ×11 =
  clutter); `RatingChip` declares provenance via `title` ("Calculated from N evidence
  metrics — {confidence} confidence"); the first visible `SourceBadge` sits in
  `StatPopover`.
- **Inspector rulings**: view-mode only (`startEdit` closes it). Absence semantics
  (encoded in `inspectorLogic.ts`, asserted in tests): an empty task/goal/injury list is
  a fact rendered as plain text; a missing periodic measurement is `not-recorded`; each
  query section fails independently to typed `load-failed` — never masquerading as "no
  data". The all-empty no-fabrication dossier test locks: zero data → zero invented
  values. Form = `not-tracked` (stated, not faked). `computeTrend` reused verbatim (all
  S4 gates apply); standing band sentence only when a benchmark profile is assigned (S5
  no-cohort-claim ruling).
- **Phase 6 workflow contracts**: Published = locked — upsert/DELETE on a Published
  lineup → 409; unpublish is an explicit, `CanPublishLineup`-gated, audited act.
  `CanPublishLineup` is gated TIGHTER than editing (`CanManageTeam`); head coach
  implicit via `All()`; pre-Phase-6 assistants deserialize to false. Version check is
  STRICT: stale, missing-on-existing-row, or set-against-a-deleted-row `BaseVersion`
  all 409 (never a silent clobber or re-create); true write races are caught by the
  EF concurrency token on `Lineup.Version` → same 409. Named-lineup keys:
  (team, match) and (team, normalized name, case-insensitive) — Name forbidden on
  match lineups, both null = default XI, service-enforced, cap 10 named/team.
  Audit rows are written IN the change's transaction, summaries come only from
  `LineupDiffSummarizer` real diffs (an identical re-save bumps Version but writes NO
  audit row — never "updated lineup"); audits outlive their lineup (LineupId SET NULL,
  denormalized KeyLabel/ChangedByName). `TacticalPreset` stores NO player ids
  (captain/vice/takers are player-bound; presets are cross-team reusable) and
  **apply-diff is client-side by design** — no server apply endpoint; sport fixed
  after create; name unique per (coach, sport); cap 20/coach. All caps + the
  deleted-elsewhere 409 were explicitly signed off.

- **Program Phase 7a — match context on scheduled-vs-played** (`5b0cb58` backend +
  `f986d19` frontend, migration `AddMatchScheduling`): resolved the fixtures honesty
  gate with option (a) — `MatchResult.Status` (`Played=0` default / `Scheduled=1`) +
  coach-entered `OpponentFormation`/`ScoutingNotes` (3 additive columns, drop-only
  Down, both-provider-pinned in `MatchSchedulingMigrationTests`). **A Scheduled
  fixture has NO score: DB keeps non-nullable 0-0 dead data, the DTO masks
  `result`/`homeScore`/`awayScore`/`ourScore`/`opponentScore`/`scoreDisplay`/
  `setScores` to null at read — a future match can never render as a 0-0 Draw.**
  Guards: rating a Scheduled match → 400 (also blocks evidence auto-import by
  construction — public profiles can't leak fixtures since they derive from
  ratings); Played→Scheduled with ratings → 409 (ratings are evidence of play);
  legacy no-`status` payloads unchanged (a REAL played 0-0 is still honestly a
  Draw). Frontend: Record-result/Schedule-fixture form toggle (schedule hides
  scores), "—"+Upcoming chip rows (Record-result action replaces Rate/stats),
  solo same treatment (solo "Matches" tile counts Played only), lineup
  `MatchContextPanel` (recorded facts + previous meetings DERIVED from Played
  history only via pure `previousMeetings` + badged coach plan), picker splits
  Upcoming fixtures/Recent results (`groupMatchesForPicker`), "Lineup for this
  match" row action + `?matchId=` deep link (read once on mount, server
  re-validates), published roster-drift banner (`publishedRosterDrift` — a
  published lineup never silently changes). Scorelines got `dir="ltr"` (bidi
  rendered "0 - 1" as "1 - 0" in RTL — pre-existing, caught in the Hebrew pass).

**Phase 7a pinned rules:**
- **Previous meetings** count only `status === 'Played'` rows vs the same
  normalized opponent name, dated ≤ the reference match, excluding it — a
  Scheduled row is never a meeting; zero history renders an explicit empty line.
- **Opponent plan is coach-entered**: always rendered with the coach-entered
  `SourceBadge`, never as recorded fact. Visible to the team (opponent prep, not
  player-private notes).
- W-D-L chips/records everywhere must exclude Scheduled (they filter on
  `result === 'Win'|'Draw'|'Loss'`, null-safe by construction — keep it that way).

**Still open (lineup):**
- Per-match lineup surfacing could go deeper (row action + deep link shipped in
  7a; a lineup-status chip per match row is a possible follow-on).
- Per-slot **Instructions UI** (column + DTO shipped in Phase 3, UI deferred per ruling).
- Real-finger long-press drag untested (CDP synthesizes mouse only) — run a
  device/emulator mobile pass (the Phase 0 deploy note is still pending);
  `@dnd-kit/core` is the documented fallback if iOS touch-drag fights back (the commit
  layer makes the swap architecturally free).
- Bench-collapse state is session-only. Board announcements use slot keys — revisit if
  Phase 6 roles add friendlier labels.

## Architecture decisions & gotchas (read before touching related code)

- **Git-worktree backend runs ignore appsettings*.json** (hit during Phase 5): a
  `dotnet run` from a worktree under `.claude/worktrees/` started with the correct
  Development environment, content root and file contents, yet loaded NEITHER
  `appsettings.json` nor `appsettings.Development.json` ("Connection string not
  found", zero-length JWT key) — same code + files work fine from the main
  checkout; root cause never identified (not user-secrets, not env vars, not
  cwd). Workaround that just works: pass the needed config as env vars —
  `PORT`, `ASPNETCORE_ENVIRONMENT=Development`,
  `ConnectionStrings__DefaultConnection=...`, `Jwt__SigningKey/Issuer/Audience/
  AccessTokenMinutes/RefreshTokenDays` (values from appsettings.json), plus
  `Cors__AllowedOrigins__0=http://localhost:<vite-port>` when the frontend runs
  on a non-default port. Don't burn time re-diagnosing. **This hits `dotnet test`
  too** (Phase 6: WebApplicationFactory host dies with "Connection string
  'DefaultConnection' not found") — same env-var workaround fixes it.
- **`Player.TeamId` is nullable** (since Solo Athlete Mode). Any new query filtering
  players by team must null-guard (`p.TeamId != null && teamIds.Contains(p.TeamId.Value)`).
  Same for `AssessmentPeriod`/`ScheduledSession`/`MatchResult`, which are team-scoped
  XOR player-scoped (`PlayerId` set = a solo athlete's personal record; ownership
  checks branch accordingly).
- **SoloAthlete bypasses the AI billing gate** (`BillingService.EnsureAiAllowedAsync`
  returns early for the role): coach plan limits don't map onto a market-of-one
  athlete and AI is the core of the solo product. Revisit if a paid solo tier ships.
  Everything else billing-related stays coach-scoped. (A Stripe billing system —
  CoachSubscription, Free/Pro/Team plans, BillingController — exists from an
  undocumented session; solo work integrates with it.)
- **Coach task boards only show tasks the coach owns** (`CoachId` = creator). Solo
  athletes self-assign (CoachId = their own user id); on connect-coach those tasks'
  CoachId is reassigned to the team's coach so they surface for the coach.
- **Deleting a solo account deletes the solo player** (cascade wipes their data);
  managed athletes still only get unlinked (coach keeps history) — see
  `ProfileService.DeleteAccountAsync`.
- **`register-solo` and `register-athlete` both set `HasCompletedOnboarding=true`**
  (wizards collect everything); only coach-created athletes see the first-login
  OnboardingModal (shown when completion < 50%).
- **SixLabors.ImageSharp is pinned to 3.1.12.** Version 4.x fails the build outright
  without a paid license key. Don't `dotnet add package SixLabors.ImageSharp` without a
  version — it'll pull 4.x and break the build.
- **Profile/team images are base64 data URLs in the DB** (400x400 JPEG, ~4-60KB), not
  files — Railway containers have no persistent disk. Avatars use the string as `img src`.
- **Join codes are compared normalized-uppercase**, generated from a 0/O/1/I-free
  alphabet; only one code per team is active (`JoinCodeService.GenerateAsync` retires
  previous actives). Public validate/register endpoints sit behind the "join-validate"
  fixed-window rate limiter (20/min/IP) — registered in `Program.cs`,
  `app.UseRateLimiter()` after `UseRouting`.
- **Nutrition-profile mutations allow role Athlete** (not just Coach/Admin) — the
  service's `EnsureCanAccessPlayerAsync` scopes athletes to their own player. Don't
  "fix" the controller attribute back to coach-only.
- **Athlete profile edits write through to the Player row** (`ProfileService.UpdateAsync`:
  height/weight/DOB→Age/jersey + FullName). New athlete-editable fields must follow
  that pattern or coach views go stale.
- **Identity password rules set explicitly** in `Program.cs`: min 8, one uppercase, one
  digit — lowercase/non-alphanumeric NOT required. Matches the frontend strength meter.
  Changing options doesn't invalidate existing hashes.
- **Prod secrets live ONLY in Railway env vars** — `appsettings.json` values are
  placeholders/empty and must never be the effective prod value. The dangerous case is
  a WORKING placeholder (the old JWT DEV-ONLY key), not an empty one: empty fails
  loudly, a working default fails SILENTLY. Anything security-load-bearing (signing
  keys) must fail-fast on boot if it's still the placeholder in Production — the
  `Program.cs` JWT guard (`6a2e495`) is the pattern; extend it to any future such
  secret. Testing a Production-only boot guard requires `dotnet run
  --no-launch-profile` (`launchSettings.json` forces Development and masks the guard).
- **`npx tsc --noEmit -p tsconfig.json` is a SILENT NO-OP.** Root `tsconfig.json` is a
  solution file (`"files": []`). Always verify with **`npm run build`** or
  `npx tsc -p tsconfig.app.json --noEmit`.
- **Database is Postgres, not SQLite** (Railway's SQLite file had no persistent volume —
  every redeploy silently wiped runtime data). `Program.cs`'s `ResolveConnectionString`
  reads Railway's `DATABASE_URL` (postgres:// URI) and converts to Npgsql keyword form;
  falls back to `DefaultConnection` locally.
- **`ApplicationDbContext.ConfigureConventions`** globally coerces every `DateTime(?)`
  to `Kind=Utc` via a value converter — Npgsql rejects `Kind=Unspecified` for
  `timestamp with time zone`. Don't remove without re-auditing every DateTime-setting
  code path.
- **`PlayerStatScore.Score` is `decimal(3,1)`, not `int`** (0.5-step sliders). Never
  reintroduce an `int` DTO field for stat scores (breaks JSON deserialization of `7.0`).
- **`ProTracker.Tests` uses SQLite internally** even though production is Postgres:
  `ProTrackerWebApplicationFactory` swaps in per-test-class SQLite via an isolated
  internal service provider (`UseInternalServiceProvider`) — the app registers Npgsql
  unconditionally and EF throws if two providers share one DI container. Tests suppress
  `PendingModelChangesWarning` (migrations are Npgsql-authored).
- **Axios interceptor** (`src/api/axiosInstance.ts`) auto-unwraps the `{success, data}`
  envelope and wraps errors with a `.status` property (query `retry` callbacks branch on
  HTTP status — don't discard it).
- **`queryClient.clear()`** runs on login/register/logout (`AuthContext.tsx`) — some
  query keys aren't user-scoped; without it, account switching shows stale data.
- **AI-generation mutations should `setQueryData` with the response**, not just
  `invalidateQueries` — invalidate-then-refetch leaves the UI empty too long.
- **Don't touch `src/pages/LandingPage.tsx`** unless explicitly asked — the user likes
  it as-is, including its `whileInView` scroll-reveal animations.
- **Unit preference** (cm/ft-in, kg/lb) lives in `src/utils/units.ts`
  (localStorage-backed). Values are always *stored* cm/kg; only display honors the
  toggle. New pages import `formatHeight`/`formatWeight`, never hardcode "cm"/"kg".
- **Sport-gradient color maps are duplicated** across `TeamsPage.tsx`,
  `TeamDetailPage.tsx`, and elsewhere (same values, different names).
  `utils/sportColors` exists for public pages — worth consolidating if touched again.

## Current status

- **Latest: Phase 7b final polish shipped** (4 commits `638a631`/`46c2837`/
  `cca03a3`/`7b785e0`): global `MotionConfig reducedMotion="user"` + CSS
  reduced-motion sweep + interaction timings verified in the 150–300ms band
  (2 outliers clamped; entrances/progress fills/bell wiggle deliberately
  exempt; LandingPage untouched). **Deep-link fade root-caused with numbers**:
  (1) the manual `pdf-vendor` chunk made rolldown hoist a shared jsx-runtime
  helper into it → the whole 1.4 MB PDF stack was in the entry's modulepreload
  on EVERY page load (pinned rule violated silently) — manual rule removed,
  rolldown auto-isolates the dynamic-only stack, eager preload 2.3 MB→904 KB,
  live-verified pdf never loads; (2) `warmRouteChunk(pathname)` at lazyPages
  module scope — deep-linked route chunk downloads in parallel with auth/me
  instead of after it (measured: route chunk 1389ms-after-auth → starts before
  auth/me). Modal gained dialog semantics (role/aria-modal/labelledby) + focus
  trap + focus restore (app-wide, every dialog inherits). COSMETIC-7 fixed
  (sport-matched `TaskTitlesFor(sportId)` pools; determinism preserved —
  one rng draw per task); COSMETIC-6 left documented (the "(you)" chip is
  truthful). 390px pass done live on prod (matches rows, lineup board,
  context panel). **Still user-assisted: the real-device iOS touch-drag
  long-press check** (CDP synthesizes mouse only); `@dnd-kit/core` remains
  the documented fallback.
- **Lineup program Phase 7a COMPLETE and deployed** (`5b0cb58` backend →
  Railway probe → `f986d19` frontend → Vercel success via GitHub deployments
  API). Migration checkpoint honored (diff + both-provider up/down + guard tests
  presented before any commit; user signed off). Railway probed BOTH ways:
  scheduled fixture → all score fields null (never a Draw) → delete pristine
  (14/14, zero remnants), AND existing played rows byte-identical on real prod
  data (City FC W-D-L 5-4-5 intact, real draws still Draw; basketball
  spot-checked). Prod-smoked in browser as coach on City FC U18: schedule
  fixture → "—"+Upcoming (never 0-0 Draw) → Lineup-from-match → context panel
  showed the REAL 3-3 Jul 11 previous meeting + badged scouting note → deleted,
  matches 14 before/after, statuses all Played, lineup GET null. Hebrew RTL pass
  done on form/rows/context panel (found+fixed the pre-existing RTL scoreline
  reversal). Gates: dotnet 194/194, vitest 285/285, build + oxlint clean, i18n
  drift 0/0/0. **Phase 7b (final polish) is next**: reduced-motion global
  MotionConfig, 150–300ms timing audit, deep-link route-fade profiling, WCAG
  2.2 AA sweep, real-device mobile pass, COSMETIC-7 pool strings (fix) /
  COSMETIC-6 shell-club "(you)" (leave, documented).
- **Lucas Ward 6-month demo arc seeded on production** (see its section
  above) — raw inputs via authenticated API as coach + Lucas plus scoped SQL,
  engine recomputed everything, script assertion pass green (11/11 confidence
  targets, 8/8 "Improving" trends), browser-verified in both roles with
  screenshots; scripts + manifest committed, teardown documented and dry-run
  proven BEFORE seeding.
- Lineup program Phase 6 COMPLETE end-to-end — frontend workflow UI
  deployed (`1b9f8a3`, after BaseVersion echo `1cf4442`): Vercel deploy success via
  GitHub deployments API, prod-smoked on City FC U18 as coach (draft save v1 →
  publish confirm → Published chip + "unpublish to edit" locked edit + DELETE 409
  server-verified → unpublish → 4-4-2 named lineup "Probe Rotation" via three-target
  SaveLineupModal → picker lists Default XI/named/matches → audit panel rendered all
  real diff summaries → preset saved/applied with client-side diff preview modal
  "Formation 4-4-2 → 4-3-3"). All probe artifacts removed (lineups + preset DELETE
  204s, probe audit rows — incl. 3 leftovers from a Jul 31 §1 probe — SQL-deleted via
  Railway public DB URL; final counts lineups/presets/audits 0/0/0; lineup GET
  `{data:null}` before AND after). **The BaseVersion live-inconsistency (UI saving
  without BaseVersion → unexplained 409s) is CLOSED** — every save echoes it now.
  Pre-ship gates: build + oxlint clean, vitest 271/271, i18n drift 0/0/0; dotnet
  172/172 re-confirmed post-ship. Hebrew RTL pass done on the workflow chrome
  (picker/chips/save-modal/audit panel mirror; pitch stays LTR; audit summaries
  backend-English by design; probe draft deleted + audit rows SQL-cleaned after —
  counts 0/0/0). 390px browser pass blocked (fullscreen window won't resize) —
  covered by the still-open device/emulator mobile pass.
- **Post-Phase-6 QA round** (`7a4e50c` + `1380b62`, both prod-verified): CountUp
  animation-latch fix — the start latch was a component-lifetime ref, freezing stat
  cards at 0/0.0 whenever `value` changed after the first animation (StrictMode dev,
  cached-then-refetch prod); latch now per-effect-run, re-animates from the shown
  number; 3 regression tests drive the real rAF/IO path (all fail on old code);
  blast radius = every CountUp consumer. Verified live as Lucas Ward (6/9.7/10.0
  matching Latest Scores; the QA-reported "best 10.0" was REAL data — top of scale).
  Real singular forms ("1 test", "1 player has…", "1 role · 1 label") ×5 locales via
  the manual One/Other convention — **i18next `_one`/`_other` suffix keys return RAW
  KEYS for ar counts 0/2/3+ and he count 2 (no `_other` fallback, verified against
  v26) — don't use them**; verified live ("1 player has no match stats recorded" on
  the team Evidence tab). Stale Phase-3-probe notification deleted via API (204,
  list 0/0). QA's "radar axis shows category key" NOT reproducible: every radar
  (Player/Team/Compare/Public/Parent) feeds `SportStatCategory.Name` display names
  and the ComparePlayers series set `name=`; needs the exact screen to act on.
- Lineup program Phase 6 BACKEND deployed earlier (`49a6122` +
  plumbing `69fb3d1`) — signed off at the migration checkpoint, sequenced backend-first:
  Railway ran `AddLineupWorkflow` (deploy success via GitHub deployments API, health
  200), prod-verified live: schema present (SQL sweep — zero pre-existing lineups, so
  the Draft backfill had nothing to touch; contract pinned by both-provider tests),
  full gate probe as coach + a real invited no-publish assistant (draft save v1→v2 by
  assistant, assistant publish 403, publish v3, edit/delete on Published both 409,
  unpublish v4, delete 204, GET `{data:null}`), then ALL probe artifacts removed
  (assistant role 204, account self-deleted → login 401, audit + invite rows
  SQL-deleted via Railway public DB URL; final counts lineups/presets/audits 0/0/0).
  Post-merge suites: dotnet 172/172, vitest 243/243, build + oxlint clean.
- Lineup program Phase 5 COMPLETE and deployed (`dcbf0fa`) — squad analysis
  panel + player comparison; built in a worktree, signed off at checkpoint, Vercel
  deploy verified via GitHub's deployments API, prod-smoked on City FC U18 (pinned
  warning order, live suppression, real co-appearance counts, GK recommendation with
  Calculated badge, Hebrew RTL + 390px); lineup GET `{data:null}` before AND after —
  nothing saved. vitest 243/243.
- Lineup program Phases 0–4 and team lineup view Phases 1–2: complete, deployed,
  prod-smoked (see history + pinned contracts above). Phase 3 backend `35c2d47`
  probe-verified 5/5 with all probe artifacts cleaned.
- Demo showcase dataset live on production; `SEED_ADMIN_TOKEN` removed from Railway
  (endpoint 403s — re-enable procedure above).
- Landing localization deployed (`aefb526` + `3e0180d`); design-audit finding #10
  (fabricated testimonials/About) still open.
- Phase G complete end-to-end: S1–S5, accuracy round, continuations S4 (`dd426df` —
  real 3-test history correctly gated "Too varied to call"), S5 (`cf282bd` —
  marker-on-tick geometry DOM-asserted), S6 (`d7d98d0`+`037d63e` — Railway
  probe-verified before trusting Vercel). Composite-score trending remains the open
  follow-up.
- Final Design Sprint (7 commits), Phases A–F, pre-G fixes, Phases 9–10, password
  reset, self-enrollment round, and all earlier rounds: complete, deployed, and
  verified on production as both roles (each with curl + browser passes at the time;
  details in git history).
- The app is feature-complete and production-ready.
