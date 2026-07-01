# ProTracker — Session Memory

Sports performance tracking platform for coaches and athletes: assessments, nutrition
planning (AI-generated), injury/training tracking, and reports — built across many
iterative sessions with Claude Code.

## URLs

- **Production frontend (Vercel)**: https://protracker-iota.vercel.app
- **Preview frontend (Vercel, tracks `main`)**: https://protracker-git-main-pro-tracker.vercel.app
- **Production backend (Railway)**: https://protracker-production.up.railway.app
- **GitHub**: https://github.com/MajdArow123/protracker (note: repo was renamed/moved at
  some point — `git push` may print a "repository moved" notice pointing here; it still
  succeeds against the old remote URL, but consider updating `origin` if it becomes an issue)

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

# EF Core migrations (from project root)
dotnet ef migrations add <Name> --project ProTracker.csproj --startup-project ProTracker.csproj -o Data/Migrations
dotnet ef database update --project ProTracker.csproj --startup-project ProTracker.csproj
```

### Local Postgres (dev)

Local dev now runs against Postgres, not SQLite. A Homebrew Postgres@16 instance is
typically run on a non-standard port/socket to avoid colliding with any system Postgres:

```bash
/opt/homebrew/opt/postgresql@16/bin/postgres -D /opt/homebrew/var/postgresql@16 -p 5544 -k /tmp/pgsock16 -c listen_addresses='localhost'
```

Connection string lives in the **gitignored** `appsettings.Development.json`:
`Host=127.0.0.1;Port=5544;Database=protracker_dev;Username=<macos-user>`

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

Athletes: `lucas.ward@protracker.seed` (Lucas Ward, has multi-week assessment history —
good for testing trends/history views), `marcus.bell@protracker.seed`,
`carlos.santos@protracker.seed`, `alex.williams@protracker.seed`, and more per sport.

`Data/DemoDataSeeder.cs` runs on every backend startup (idempotent — `GetOrCreate*`
pattern) and seeds coaches, athletes, teams, players, positions, stat categories,
assessments, injuries, nutrition guidance/profiles. It does **not** seed weekly AI
nutrition plans — those are runtime-generated and were the original victim of the
SQLite data-loss bug (see gotchas).

## Completed work (roughly chronological)

- Phases 1–8 (earlier sessions): auth, CRUD for players/teams/assessments, JWT REST
  API + integration tests, reports/charts, UI/UX overhaul, AI-powered insights &
  nutrition guidance.
- Weekly AI nutrition plans (Haiku-based, structured JSON), food-swap flow.
- **"Improvement" round (this session)**:
  1. Assessment sliders UX — gradient (red→amber→green) 0.5-step sliders, live SVG
     score ring, timeline history with colored borders/mini bars/chip-grid expand,
     applied to both `AssessmentPage.tsx` (coach) and `PlayerStatsPage.tsx` (athlete).
  2. Player form kg/lb + cm/ft unit toggles with auto-convert, persisted to
     localStorage (`src/utils/units.ts`), displayed everywhere (`PlayerDetailPage`,
     `TeamDetailPage` roster cards).
  3. Chart overhaul — gradient area fill under focused line (was defined but unused!),
     3-band bar colors (red/amber/green), radar score labels + min 380px height,
     4 gradient-background metric cards on report hero sections.
  4. Teams page redesign — sport-gradient page header + per-card avg score/top
     player/injury count (via `useTeamReport` per card); team detail hero avg-score
     ring badge, "Last Assessment" stat, Assessment Periods list section.
  5. Food swap modal — already mostly built in an earlier session; polished wording
     to match spec exactly (modal title includes food name, "Confirm Swap" label,
     calorie badge styling).
  6. This file.
- **Infra fixes (this session, precede the above)**:
  - Migrated database from SQLite → Postgres (see gotchas — this was a real
    production data-loss bug, not a style choice).
  - Fixed stale-token hard-redirect that bypassed the marketing landing page.
  - Fixed TanStack Query stale-cache bugs (see gotchas).

## Phase 9 (in progress) — new coach/athlete features

Working through 7 features one at a time, committing + deploying after each.

- **Feature 1 — Coach Tasks System (DONE, deployed).** `PlayerTask` model
  (`TaskPriority` Low/Medium/High, `TaskCategory` Training/Nutrition/Recovery/
  Tactical/Physical/Other; migration `AddPlayerTask`). `TasksController` at
  `/api/tasks`: coach GET (filter `?playerId`/`?completed`/`?priority`), athlete
  `GET /mine`, coach POST/PUT/DELETE, athlete `PATCH {id}/complete|incomplete`.
  Frontend: `src/api/tasksApi.ts`, `src/hooks/useTasks.ts`, shared
  `src/components/tasks/{TaskCard,AssignTaskModal,taskUtils}`, coach `/tasks`
  page + athlete `/player-dashboard/tasks` page + a Tasks tab on the coach
  player-detail page. Sidebar gained "Tasks"/"My Tasks" (CheckSquare).
  Note: legacy `TaskItem` (sub-item of a `TrainingPlan`) is unrelated — don't confuse.
- Features 2–7 (Injury tracking, Match results, Training session planner, Player
  notes, Notifications/badges, Team announcements): pending. Note several already
  have partial backend models (`InjuryRecord`, `MatchPerformance`, `TrainingSession`) —
  check before creating new ones.

## Architecture decisions & gotchas (read before touching related code)

- **`npx tsc --noEmit -p tsconfig.json` is a SILENT NO-OP.** Root `tsconfig.json` is a
  solution file (`"files": []`, references `tsconfig.app.json`/`tsconfig.node.json`).
  That command reports zero errors even when the code doesn't compile. Always verify
  with **`npm run build`** (runs `tsc -b && vite build`) or `npx tsc -p tsconfig.app.json --noEmit`.
  This bit us mid-session — several "clean" typecheck results turned out to be checking
  nothing.
- **Database is Postgres, not SQLite** (migrated because Railway's SQLite file had no
  persistent volume — every redeploy wiped the DB and reseeded only static demo data,
  silently deleting anything created at runtime, e.g. AI weekly nutrition plans).
  `Program.cs`'s `ResolveConnectionString` reads Railway's `DATABASE_URL` (a
  `postgres://` URI) when present and converts it to an Npgsql keyword-value string;
  otherwise falls back to the `DefaultConnection` config value for local dev.
- **`ApplicationDbContext.ConfigureConventions`** globally coerces every `DateTime`/
  `DateTime?` property to `Kind=Utc` via a value converter. Npgsql rejects
  `Kind=Unspecified` values for `timestamp with time zone` columns (e.g. a plain
  `<input type="date">` bound straight into a DTO) — this converter means individual
  services never have to think about it. Don't remove it without re-auditing every
  DateTime-setting code path.
- **`PlayerStatScore.Score` is `decimal(3,1)`, not `int`.** Changed to support 0.5-step
  assessment sliders. If you add new code that reads/writes stat scores, don't assume
  whole numbers — and don't reintroduce an `int` DTO field for it (breaks JSON
  deserialization of e.g. `7.0`).
- **`ProTracker.Tests` uses SQLite internally**, even though production uses Postgres.
  `ProTrackerWebApplicationFactory` swaps in a per-test-class SQLite file via an
  *isolated internal service provider* (`UseInternalServiceProvider`) — necessary
  because the app's own `Program.cs` registers Npgsql unconditionally, and EF Core
  throws if two providers' services land in the same DI container. Tests also
  suppress `PendingModelChangesWarning` since migrations are Npgsql-authored.
- **Axios interceptor** (`src/api/axiosInstance.ts`) auto-unwraps the backend's
  `{success, data}` envelope, and wraps errors with a `.status` property (added so
  query `retry` callbacks can branch on HTTP status — a plain `new Error(message)`
  used to discard `error.response` entirely and silently broke 404-retry-skip logic).
- **`queryClient.clear()`** runs on login, register, and logout (`AuthContext.tsx`).
  Some queries (e.g. `['dashboard','coach']`) aren't scoped by user ID, so without
  this, switching accounts in one browser session could show a previous user's
  cached data.
- **AI-generation mutations should `setQueryData` with the response**, not just
  `invalidateQueries`. `useGenerateWeeklyNutritionPlan` learned this the hard way —
  invalidate-then-refetch left the UI showing an empty state for longer than
  expected. Apply the same pattern to any future "generate X" mutation whose result
  should appear immediately.
- **Don't touch `src/pages/LandingPage.tsx`** (the marketing homepage shown at `/`
  before sign-in) unless explicitly asked — the user likes it as-is, including its
  existing `whileInView` scroll-reveal animations.
- **Unit preference** (height cm/ft-in, weight kg/lb) lives in `src/utils/units.ts`,
  backed by localStorage (`protracker_height_unit` / `protracker_weight_unit`).
  Height/weight are always *stored* in cm/kg; only *display* honors the toggle.
  Any new page showing height/weight should import `formatHeight`/`formatWeight`
  from that module rather than hardcoding "cm"/"kg".
- **Sport-gradient color maps are duplicated** across `TeamsPage.tsx`,
  `TeamDetailPage.tsx`, and (as `SPORT_HEADER_COLORS`/`SPORT_GRADIENTS`) elsewhere.
  They use slightly different variable names but the same color values. Worth
  extracting to a shared constant if touched again.
- Recharts custom tooltips use `bg-slate-900` (not `bg-gray-900`) per the current
  design spec — keep new chart tooltips consistent.

## Current status

All 6 "Improvement" items above are implemented, typechecked (`npm run build`),
linted (`oxlint`), and pushed to `main` as 6 separate commits (plus this file as a
7th). Both Vercel (frontend) and Railway (backend, including the decimal-score
migration) redeployed successfully — verified by hitting the live production API
directly and by walking through the assessment/teams/reports/nutrition flows on
https://protracker-iota.vercel.app as both a coach and an athlete. Local Postgres
dev environment is set up and working for future sessions.
