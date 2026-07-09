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

## Phase 9 (COMPLETE, deployed) — new coach/athlete features

All 7 features implemented one at a time, each its own commit, curl-verified against
production and walked through in-browser as both coach and athlete. New models each
got an EF migration (auto-applied on Railway startup).

- **Feature 1 — Coach Tasks System.** `PlayerTask` model
  (`TaskPriority` Low/Medium/High, `TaskCategory` Training/Nutrition/Recovery/
  Tactical/Physical/Other; migration `AddPlayerTask`). `TasksController` at
  `/api/tasks`: coach GET (filter `?playerId`/`?completed`/`?priority`), athlete
  `GET /mine`, coach POST/PUT/DELETE, athlete `PATCH {id}/complete|incomplete`.
  Frontend: `src/api/tasksApi.ts`, `src/hooks/useTasks.ts`, shared
  `src/components/tasks/{TaskCard,AssignTaskModal,taskUtils}`, coach `/tasks`
  page + athlete `/player-dashboard/tasks` page + a Tasks tab on the coach
  player-detail page. Sidebar gained "Tasks"/"My Tasks" (CheckSquare).
  Note: legacy `TaskItem` (sub-item of a `TrainingPlan`) is unrelated — don't confuse.
- **Feature 2 — Injury Tracking.** Extended the existing `InjuryRecord` (added
  `BodyPart`, `TreatmentPlan`, `RecoveredDate`; migration `AddInjuryDetails`) rather
  than a parallel model — kept `/api/injury-records` CRUD, added
  `GET /api/injuries/active` (filters coach's teams + `RecoveryStatus != FullyRecovered`,
  sorted by severity) and `PATCH /api/injuries/{id}/recover`. Injury indicators on
  players list/detail, log-injury modal with body part + treatment, recover action,
  coach-dashboard Active Injuries card.
- **Feature 3 — Match/Game Results.** `MatchResult` (team-level) + `PlayerMatchRating`
  models (migration `AddMatchResults`); `Rating` is `decimal(3,1)`. `MatchesController`:
  `GET/POST /api/teams/{id}/matches`, `PUT/DELETE /api/matches/{id}`,
  `POST /api/matches/{id}/ratings` (replaces all), `GET /api/players/{id}/match-ratings`.
  Backend recomputes ourScore/opponentScore + Win/Draw/Loss from home/away. Matches tab
  on team detail (log match → rate players modals); athlete "My Matches" dashboard card.
  Distinct from the pre-existing per-player `MatchPerformance` — left untouched.
- **Feature 4 — Training Session Planner.** `ScheduledSession` (team-scheduled,
  `SessionType` Training/MatchPrep/Recovery/Strength/Tactical/Other; migration
  `AddScheduledSessions`) — **distinct from the pre-existing per-player, attendance-based
  `TrainingSession`**. `GET/POST /api/teams/{id}/sessions`, `PUT/DELETE /api/sessions/{id}`,
  `GET /api/sessions/mine` (athlete's upcoming). Schedule tab on team detail = Monday-based
  week calendar (`TeamScheduleSection`); athlete "Upcoming Sessions" dashboard card.
- **Feature 5 — Coach-Private Player Notes.** `CoachNote` model (categorized,
  timestamped timeline per player; migration `AddCoachNotes`) — distinct from the single
  free-text `Player.CoachNotes` field. **The entire `CoachNotesController` is
  `[Authorize(Roles="Coach,Admin")]` so athletes can NEVER read notes** (verified: athlete
  gets 403 on read + create); coaches may only edit/delete their own. Coach-only Notes tab
  on player detail (`CoachNotesTab`).
- **Feature 6 — Notifications & badges (no new backend).** `useNotifications` hook
  aggregates existing data role-aware: coaches → overdue assigned tasks + active injuries;
  athletes → own open tasks + sessions in next 48h. `NotificationBell` dropdown in the
  navbar (count badge, severity colors, click-through), sidebar nav badge counts, and an
  "Overdue Tasks" coach-dashboard card (replaced the placeholder "Assessments" card).
- **Feature 7 — Team Announcements.** `TeamAnnouncement` model (`AnnouncementPriority`
  Normal/Important/Urgent, pinning, author; migration `AddTeamAnnouncements`).
  `GET/POST /api/teams/{id}/announcements`, `PUT/DELETE /api/announcements/{id}`,
  `GET /api/announcements/mine`. Pinned-first ordering. Announcements section on team
  detail Overview (`TeamAnnouncementsSection`, coach CRUD); athlete "Team Announcements"
  dashboard card (read-only, top of dashboard).

Cross-feature notes: several controllers use `[Route("api")]` with absolute sub-routes
(matches/sessions/notes/announcements) rather than the older `[Route("api/x")]` prefix
style. `CoachNote`/`TeamAnnouncement` store a denormalized `CoachName` (resolved from
`ApplicationUser.DisplayName` at create time). Athlete "mine"-style endpoints derive
team scope via `IAccessControlService.GetAccessibleTeamIdsAsync`.

## Post-Phase-9 improvements (COMPLETE, deployed)

Five follow-up improvements, each its own commit, curl- + browser-verified on production
as both coach and athlete. **Multi-sport**: every feature is sport-agnostic or passes the
player's sport into the AI prompt; verified against non-soccer coaches (basketball).

- **1 — Coach notes shareable.** Added `IsPrivate` to `CoachNote` (migration
  `AddCoachNoteIsPrivate`; existing notes default private on upgrade). `GET
  /api/players/{id}/notes` returns all notes to coaches, only `IsPrivate==false` to the
  athlete; mutations stay coach-only. Coach note modal has a Private/Share pill + per-note
  badge that toggles on click; athlete gets a read-only "Coach Feedback" dashboard section.
- **2 — Direct messaging.** `Message` model (migration `AddMessages`); `ConversationId =
  Message.BuildConversationId` (sorted participant pair). Endpoints under `/api/messages`:
  conversations, contacts, conversation/{otherUserId}, POST, `.../read`, unread-count.
  Authz: coaches↔athletes on their teams, athletes↔their team's coach only. Shared
  `/messages` split-panel page (`MessagesPage`) with 5s/10s polling; Messages sidebar item
  + unread badge; unread count in the bell; background "new message" toast.
- **3 — Notification read-state.** Derived notifications now track "seen" in localStorage
  via a shared store (`src/utils/seenNotifications.ts`, `useSyncExternalStore` so bell +
  sidebar + dashboard stay in sync). Per-rule keys: overdue tasks reappear next day
  (date-keyed), injuries on new id/worse severity, athlete tasks stay dismissed, sessions
  daily. Bell marks seen after a 1.2s delay + "Mark all as read"; sidebar task badges count
  only unseen; dashboard Active Injuries list has per-item dismiss. Messages stay DB-driven.
- **4 — Injury recovery programs.** `InjuryRecoveryPlan` + `RecoveryExercise` +
  `RecoveryMilestone` (migration `AddRecoveryPlans`). CRUD + athlete exercise-completion
  (note + 1-5 difficulty) + coach milestone toggle. **AI generation** `POST
  /api/ai/recovery-plan/{injuryId}` feeds Claude the injury type/body part/severity **plus
  the player's sport, position, age, fitness** (Haiku, 8000 tokens, one retry on bad JSON).
  `RecoveryPlanModal` (progress bar, milestone timeline, week tabs, category-colored
  exercise cards) opens from each injury card (coach) + an athlete-dashboard Recovery card.
- **5 — Tasks UI/UX overhaul.** Coach `/tasks`: stats line, priority/status pill filters,
  collapsible buckets. `TaskCard` gained a priority-colored left border + full-width Mark
  Complete. Assign modal shows priority cards + live preview. Athlete My Tasks: circular
  progress ring + Action Required/Upcoming/Completed sections. Task categories stay
  sport-agnostic. (`useTasks` hooks gained optional `enabled` for cross-role gating.)

Note: `AILoadingPanel` (cycling messages + progress bar) is reused for the recovery-plan
generation loading state. `Modal` now supports `size="xl"` (max-w-4xl) for the recovery view.

## Latest feature round (COMPLETE, deployed) — 5 features

Five features, each its own commit, curl- + browser-verified as both coach and athlete.

- **Feature 1 — Match Results sport-aware score format** (commit `8eec2f4`, earlier
  session). `ScoreFormat`/`SetScores` on `MatchResult`, `StatJson` on `PlayerMatchRating`
  (sport-specific stats), migration `AddMatchScoreFormat`; sport config centralized in
  `src/utils/matchSport.ts`.
- **Feature 2 — Athlete Wellbeing Check-in.** `WellbeingCheckin` model (1-5 feeling/energy/
  sleep + pain flag, **one row per player per day** via unique index on `PlayerId+Date`,
  upserted; migration `AddWellbeingCheckins`). `WellbeingController` at `/api`: athlete
  `GET wellbeing/mine|today` + `POST wellbeing`; coach `GET players/{id}/wellbeing`
  (30-day trend) + `GET wellbeing/team-summary`. Overall **score = avg of the three scales
  ×2 (0-10)**. **Pain-during-recovery alert**: latest check-in has pain AND player has a
  non-`FullyRecovered` injury. Frontend: step-by-step 5-step `WellbeingCheckinWidget` on the
  athlete dashboard (+ checked-in summary), coach-dashboard `TeamWellbeingCard`, and a
  Wellbeing tab (`WellbeingTrendCard`) on the coach player-detail page.
- **Feature 3 — AI Task Suggestions.** `POST /api/ai/task-suggestions/{playerId}`
  (coach/admin, stateless): analyzes the bottom-4 weakest assessment categories and asks
  **Claude Haiku** for 5 sport/position-specific tasks (prefill `[` + one retry on bad JSON).
  Frontend `AITaskSuggestionsModal` (athlete picker → AILoadingPanel → weak-area pills + 5
  cards with one-click Assign / Assign all / Regenerate), "AI Suggestions" button on `/tasks`.
- **Feature 4 — Recovery Plan Templates.** 10 built-in templates (`RecoveryTemplate` +
  child exercise/milestone models; migration `AddRecoveryTemplates`) seeded by
  `RecoveryTemplateSeeder` (**idempotent — inserts only when the table is empty**, wired in
  `Program.cs` before `DemoDataSeeder`). `GET /api/recovery-templates`; `POST /api/injuries/
  {injuryId}/recovery-plan/from-template/{templateId}` copies a template into a fresh
  editable plan via `RecoveryPlanService.ApplyTemplateAsync` → `SaveGeneratedPlanAsync`.
  Frontend: "Use Template" button + in-modal `TemplatePicker` in `RecoveryPlanModal` (matching
  body part floats to top as "Suggested"; `injuryBodyPart` threaded from the injury card).
- **Feature 5 — Task Completion Analytics.** `GET /api/tasks/analytics` (coach/admin) →
  totals, completion rate, overdue, avg days to complete, per-player + per-category stats,
  8-week assigned-vs-completed trend, and top-performer / needs-attention callouts (players
  with ≥2 tasks). New `/tasks/analytics` page (`TaskAnalyticsPage`) with stat cards, callout
  cards, and three charts. **Recharts is used directly here** because the shared
  `BarChartWrapper`/`LineChartWrapper` are hardcoded to a 0-10 Y domain (unfit for %/counts).
  "Analytics" button on the `/tasks` header.

## Phase 10 — final polish sprint (COMPLETE, deployed)

Production-readiness pass, mostly frontend, in 7 commits (each its own section,
`npm run build` + `oxlint` clean, browser-verified; backend untouched except an
earlier `DELETE /api/messages/{id}`).

- **1 — Performance / code splitting.** Every route is `React.lazy` (`src/routes/
  lazyPages.ts`) behind a `<Suspense>` `PageLoadingSkeleton`; vendor `manualChunks`
  (react/ui/chart/query + a `pdf-vendor`) — **function form only** (rolldown-vite
  rejects the object form). Single 1.3 MB bundle → ~42 KB entry + on-demand chunks.
  `preloadDashboard(role)` warms the dashboard chunk on login.
- **2 — Mobile.** `BottomNav` (role-aware, md:hidden, in-flow flex child so `main`
  shrinks — no overlap); `Modal` is a bottom-sheet on mobile; chart wrappers clamp
  height via `useMediaQuery`/`useIsMobile`; Button 44px min-height on mobile.
  Messages page uses `h-[calc(100dvh-7rem)] md:h-[calc(100vh-3.5rem)]`.
- **3 — Skeletons / errors / empties.** `Skeleton.tsx` (shimmer `.skeleton` class,
  primitives + `DashboardSkeleton`/`ReportSkeleton`/`DetailSkeleton`/`CardListSkeleton`)
  replaced `PageSpinner` across pages; `ErrorState` (AlertCircle + Retry→refetch).
- **4 — Animations.** Route transition = keyed (`pathname`) `motion.div` around
  `<Outlet>`; `CountUp` (reduced-motion aware); sidebar active bg uses `layoutId=
  "sidebar-active"`; Players grid stagger (`src/utils/animations.ts`). **All `ease`
  values are strings** (never arrays — rule enforced).
- **5 — Reliability.** `ErrorBoundary` (class) wraps the app; `NotFoundPage` catch-all
  `*` route; `OfflineBanner` (window online/offline); axios interceptor maps status →
  friendly messages via `friendlyErrorMessage` (keeps backend message + `.status`).
- **6 — PDF export.** `@react-pdf/renderer` → `PlayerReportPDF` / `TeamReportPDF`;
  "Export PDF" buttons; **dynamically imported on click** so the 1.4 MB `pdf-vendor`
  chunk never loads eagerly (`chunkSizeWarningLimit` raised to 1500 for it).
- **7 — Final polish.** `ScrollToTop` (resets `main`, not window) + `scroll-smooth`;
  `RouteProgressBar` (GitHub-style top bar); `@media print` stylesheet; real
  `<title>`/description/OG/Twitter meta + branded "PT" `favicon.svg`; fixed a
  PlayerReportPage keyless-Fragment warning.

## Password reset flow (COMPLETE, deployed)

Forgot-password / reset-password with our own `PasswordResetToken` table (migration
`AddPasswordResetTokens`; URL-safe 32-byte token, 1h expiry, `IsUsed`). `AuthService`:
`ForgotPasswordAsync` (generic response — no email enumeration; **3 tokens/user/hour**
rate limit), `ValidateResetTokenAsync`, `ResetPasswordAsync` (validates the password
**before** `RemovePassword`+`AddPassword`, marks the token used, invalidates the user's
other tokens). Endpoints (all `[AllowAnonymous]`): `POST /api/auth/forgot-password`,
`GET /api/auth/validate-reset-token?token=`, `POST /api/auth/reset-password`.
`EmailService` (MailKit) sends a branded HTML email over SMTP and **falls back to
logging the reset URL** when SMTP isn't configured or send fails — so prod (no email
provider) logs `[PasswordReset] ... Reset link: {url}` to Railway logs. Frontend:
`/forgot-password` + `/reset-password` (validates token on mount; Weak/Fair/Strong
meter; disabled-until-valid) + a "Forgot your password?" link on login. Env vars:
`FRONTEND_URL`, `SMTP_HOST/PORT/USER/PASS`, `EMAIL_FROM`.

## Self-enrollment & profile round (COMPLETE, deployed) — 4 features

Four features, each its own commit, curl-verified locally + browser-verified on
production (coach generating a join code → athlete registering through it).

- **Feature 1 — Team join codes & athlete self-enrollment** (commit `bf8f909`).
  `TeamJoinCode` (8-char team-prefixed codes, e.g. `CTYFX33Z`; no 0/O/1/I; optional
  expiry/max-uses; **one active per team** — regenerating retires old ones) +
  `AthleteInvite` (pending email invites); migration `AddTeamJoinCodes` also added
  `Player.JerseyNumber/DateOfBirth/JoinedViaCodeAt` and ApplicationUser emergency-contact
  fields. `JoinCodesController` (`[Route("api")]` style): coach generate/list/deactivate
  + invite-athlete (emails the join link; SMTP log fallback) + athlete-invites; public
  `GET /api/join-codes/validate/{code}` returns team/sport/coach **plus the sport's
  positions** (so the public wizard needs no authed calls). `POST /api/auth/register-athlete`
  creates user (Athlete role) + Player + dietary `PlayerNutritionProfile` rows in one
  transaction, bumps `UseCount`, marks matching invites accepted, web-pushes the coach,
  returns tokens. **Per-IP rate limiting (20/min, `AddRateLimiter` policy "join-validate")**
  on the two public endpoints. Frontend: `/join/{code}` 6-step wizard (team preview with
  sport gradient → account → physicals with unit toggles + sport positions → dietary →
  emergency contact → review), `/register` code-entry page, coach "Invite & Join" card on
  team detail (QR via `qrcode.react`, copy/share/download-QR, regenerate/deactivate,
  pending invites), athlete-dashboard welcome banner (sessionStorage `pt_welcome`), and a
  coach bell notification "New athlete joined" derived from `JoinedViaCodeAt` (7-day
  window, `joinedKey` in seenNotifications; `usePlayers` gained an `enabled` param).
- **Feature 2 — Profile redesign** (commit `b4e1354`, migration `AddProfileFields`).
  ApplicationUser: `ProfilePictureUrl`, `Bio`, `CoachingExperience`, `Certifications`,
  `Specialization`, `HasCompletedOnboarding`; `Team.PhotoUrl`. `ImageService`
  (**SixLabors.ImageSharp pinned to 3.1.12** — see gotchas) center-crops uploads to
  400x400 JPEG stored as **base64 data URLs in the DB** (Railway has no persistent disk).
  `ProfileController` `/api/profile`: role-aware GET (athletes get linked-player fields),
  PUT (athlete DOB/height/weight/jersey edits sync to the Player row; also keeps
  `Player.FullName` aligned with DisplayName), picture POST/DELETE (mirrored to
  `Player.ProfileImageUrl`), **real** change-password, delete-account (password + typed
  DELETE; coach blocked while owning teams; athlete player row is **unlinked, not
  deleted**). Team photo endpoints on TeamsController. Both profile pages rebuilt:
  `EditableAvatar` (hover overlay, drag & drop, preview-before-save), completion card
  (`utils/profileCompletion.ts`, weighted per role), two-column layout, emergency
  contact, athlete dietary add/remove, sidebar avatar shows the photo, `TeamPhotoBadge`
  in the team hero.
- **Feature 3 — Athlete onboarding** (commit `7f6b75f`). `OnboardingModal` (3 steps:
  photo → physicals → dietary) on the athlete dashboard when `!hasCompletedOnboarding`
  && completion < 50%; finishing OR skipping hits idempotent
  `POST /api/profile/onboarding-complete`. **Join-code registrations set
  `HasCompletedOnboarding=true` up front.** `ProfileCompletionReminder` dashboard card
  (< 80%, dismiss = 7 days via localStorage). Weekly AI plan UI shows a
  `RestrictionsNotice` chip strip ("Generating plan respecting: …") — backend already
  injected restrictions into the prompt; this just surfaces it.
- **Feature 4 — Jersey/status/team details** (commit `857fbd9`, migration
  `AddPlayerStatusTeamDetails`). `PlayerStatus` enum (Active/Injured/Suspended/Inactive)
  on Player — explicit coach-set status, default Active, update DTO treats null as
  "unchanged". `Team.FoundedYear` (1850–now) + `Team.Description` (≤500). Shared
  `PlayerStatusBadge` (hidden while Active on list cards, always on detail hero);
  "#7 Name" on roster/players cards, big `#N` hero badge, jersey in the compare tool;
  Founded/Description on team forms; team hero gained "Est. YYYY" + W–D–L record chips
  (computed client-side from `useTeamMatches`).

## Phase A — Solo Athlete Mode (COMPLETE, deployed) — 9 sections

Opens ProTracker to individual athletes with no coach: a **SoloAthlete** role that can
do everything a coach does, for exactly one player (themselves), with an optional
upgrade path onto a team. 9 commits (`e9db7f9`…`d9369d6`), each section curl- and/or
browser-verified as it landed. NOTE: a Stripe **billing system** (CoachSubscription,
Free/Pro/Team plans, BillingController) exists in the codebase from an undocumented
session — solo work had to integrate with it (see gotchas).

- **S1 — Role, data model, authorization** (migration `AddSoloAthlete`). New seeded
  role `SoloAthlete`. `Player.IsSolo` + `SoloUserId`; **`Player.TeamId` is now
  nullable** (solo players are team-less — every `teamIds.Contains(p.TeamId)` query
  got a null-guard). New `SoloProfile` (SportId, `SkillLevel` Beginner→Elite,
  `TrainingFrequency` Daily→Occasionally, Goals, Motivation, IsPublic). Also made
  `AssessmentPeriod`/`ScheduledSession`/`MatchResult` nullable-TeamId + optional
  `PlayerId` (player-scoped = solo-owned) in the same migration. Authorization is
  centralized: `AccessControlService` treats SoloAthlete like Athlete (own player
  only), gained `IsSoloAthlete()` + `RequireOwnPlayerAsync()`; coaches can never see
  team-less players. Controller role attributes widened (`Coach,Admin,SoloAthlete`)
  across assessments/periods/stat-scores/tasks/injuries/recovery/nutrition/wellbeing/
  AI + `players/me` + shared session/match PUT/DELETE. `POST /api/auth/register-solo`
  ([AllowAnonymous], "join-validate" rate limit) creates user+player+SoloProfile+
  dietary rows in one transaction and auto-logs-in. `SoloController` (`/api/solo`):
  public `GET sports` (sports+positions for the pre-auth wizard), profile GET/PUT,
  personal sessions/matches GET/POST, and `POST connect-coach`.
- **S2 — Registration wizard.** `/register/solo` 7-step wizard (Account → Sport cards
  → Position/Skill/Frequency → Physicals w/ unit toggles → Goals → Dietary → Review),
  modeled on the join-code wizard; entry points on `/register`, login sign-up tab,
  and the landing hero. `Role` type + routing guards know `SoloAthlete`.
- **S3 — Solo dashboard + layout.** "Solo Training" sidebar (Dashboard/My Performance/
  Assessments/Nutrition/Training/Matches/Recovery/Tasks) + mobile bottom nav +
  solo-aware notifications. `/solo-dashboard`: greeting hero with sport/skill badges +
  **activity day-streak** (sessions ∪ matches ∪ check-ins ∪ assessments), stat cards,
  2×2 quick actions, last-5-assessments trend chart, This Week, wellbeing widget,
  inline-editable Goals (syncs to `Player.Goals` for AI prompts).
- **S4 — Self-assessment.** `/solo/assessment` = coach sliders/ring UX for yourself;
  `assessmentPeriodId: 0` → backend auto-creates/reuses a **"Personal Training"**
  player-scoped period. History timeline + summary cards. Slider/ring extracted to
  shared `components/assessments/ScoreWidgets.tsx`. `/solo/performance` reuses the
  athlete My Stats page.
- **S5 — Nutrition.** Coach `NutritionPage` refactored into shell + exported
  **`NutritionManager({playerId, self, title})`** — solo renders it with `self`
  (enables food swap, first-person copy). `WeeklyNutritionPlanView` regenerate button
  keys off `onGenerate` (dropped the `isCoach` prop).
- **S6 — Training & matches.** `TeamScheduleSection` gained a `solo` prop (personal
  calendar, full manage rights, creates via `/api/solo/sessions`). New
  `/solo/matches`: sport-aware score labels, optional **PersonalRating 1-10** stored
  as the athlete's own `PlayerMatchRating`, W-D-L record cards. Solo query keys live
  under the shared `['sessions']`/`['matches']` roots so shared mutations invalidate.
- **S7 — Recovery & tasks.** `/solo/recovery`: own injuries CRUD + `RecoveryPlanModal`
  with `isCoach={true}` (solo = their own coach: manual/template/AI plan + exercise
  completion). `/solo/tasks`: coach `TasksPage` gained a `self` mode (no player
  filter/analytics, both modals `lockedPlayerId`, personal wording).
- **S8 — Connect to coach.** `ConnectCoachModal` (profile card + dismissible dashboard
  banner): code → team preview → join. Sport mismatch blocked client+server. On join:
  role flips to Athlete (fresh tokens stored, hard reload to /player-dashboard), ALL
  history preserved (playerId FKs), self-assigned **tasks are handed to the coach**
  (CoachId reassigned) so they show on the coach's board.
- **S9 — Landing.** Hero = three role cards (Coach → `/login?tab=register` deep link,
  Team Athlete → `/register`, Solo → `/register/solo`); "Works for" chips on feature
  cards (Solo + Team / Teams); solo-athlete testimonial.

## Phase B — Personal Goals & Progress (COMPLETE, deployed) — 4 sections

Personal goal-setting, a reflective journal, public shareable profiles, and dashboard
integration — for **coaches, team athletes, and solo athletes** (multi-sport; AI prompts
always include the player's sport). 4 commits, each curl- + browser-verified.

- **Section 1 — Personal goals** (migration `AddPersonalGoals`). `PersonalGoal`
  (Category Performance/Fitness/Nutrition/Mental/Technical/Tactical/Other, Status Active/
  Achieved/Paused/Abandoned, Priority, TargetValue/CurrentValue/Unit, `IsPrivate`) +
  `GoalMilestone` + `GoalProgress` (Source Manual/Assessment/Match/Auto). Added a nullable
  **`LinkedStatCategoryId`** (not in the original spec) so assessment auto-linking is exact,
  not name-matched. `GoalsController` (`[Route("api")]`): athlete/solo `GET /api/goals`,
  coach/owner `GET /api/players/{id}/goals` (coach sees **non-private only**), POST/PUT/
  DELETE, `PATCH {id}/achieve`, milestones add/toggle, progress log/history, and (S4)
  `GET /api/goals/overview` (coach). **Assessment auto-link**: `AssessmentService.
  CreateAssessmentAsync` calls `IPersonalGoalService.SyncFromAssessmentAsync` — active
  Performance goals whose `LinkedStatCategoryId` matches a saved stat category get an
  `Assessment`-sourced `GoalProgress` + updated `CurrentValue` (+ milestone auto-achieve).
  **Private-goal guard** lives in `PersonalGoalService.LoadAccessibleGoalAsync` (coach 403s
  on a private goal even for their own player; a coach-set `IsPrivate` is silently
  downgraded — only the owning athlete can make a goal private). **AI goal suggestions**
  `POST /api/ai/goal-suggestions/{playerId}` (Haiku, sport/position-aware, links each
  suggestion back to its weak stat category) — **on `AIController`, so Coach/Admin/SoloAthlete
  only; team athletes (`Athlete`) have no AI access by existing architecture.** Frontend:
  shared role-aware `GoalsPage` ("My Goals" / coach "Player Goals" with a player picker),
  `GoalCard` (priority border, colored progress bar, milestone checklist, expandable
  Recharts progress chart with a dashed target line), `GoalFormModal`, `LogProgressModal`,
  `AIGoalSuggestionsModal`. Sidebar + routes for coach `/goals`, athlete
  `/player-dashboard/goals`, solo `/solo/goals`.
- **Section 2 — Progress journal** (migration `AddJournalEntries`). `JournalEntry` — **one
  per player per calendar day** (unique `PlayerId+EntryDate`, upserted), Mood Great/Good/
  Okay/Tough/Rough, energy 1-5, optional training rating, key learning, tomorrow focus,
  normalized+deduped tags, **`IsPrivate` default true**. `JournalController`: athlete/solo
  `GET /api/journal?days=`, `/today`, upsert `POST`, PUT/DELETE; coach `GET /api/players/
  {id}/journal` returns **non-private only** (coach 403s on mutate — journal is athlete-owned,
  never coach-writable). Frontend: `JournalPage` (today banner, **GitHub-style 3-month mood
  heat map** — click a day to scroll to its entry, empty days disabled), `JournalEntryModal`
  (mood-icon selector, energy dots, star rating, rotating **dismissable writing prompts**,
  tag chips, privacy toggle), expandable `JournalEntryCard`, coach read-only **Journal tab**
  on player detail (`CoachJournalTab`). Sidebar (BookOpen) + routes for athlete/solo.
- **Section 3 — Public profile & progress sharing** (migration `AddPublicProfiles`).
  `PublicProfile` — one per player, **unique URL-safe slug** generated from name+sport
  (`lucas-ward-football-soccer`), immutable once created; `IsPublic` + per-section `Show*`
  flags. `PublicProfileController`: athlete/solo `GET/PUT /api/profile/public` (lazy-created
  with a stable slug); **anonymous, rate-limited (`join-validate`) `GET /api/public/{slug}`**
  assembling header + assessment count/latest avg + skills radar + non-private goals +
  non-private journal + match history, **each section gated by its flag** (private goals/
  journal never leak; missing OR non-public slug both 404). Frontend: **dark-themed public
  `/player/:slug` page** (outside `ProtectedRoute`) — hero, stat tiles, radar, goal bars,
  journal, match table, "Connect on ProTracker" CTA, Web-Share/copy. `PublicProfileSettings
  Section` on the athlete/solo profile (public toggle, link, **QR code** via `qrcode.react`,
  per-section checkboxes, preview). `ShareProgressButton` on the athlete + solo dashboard
  heroes (renders only when public). Public link uses `window.location.origin` (works in any
  env).
- **Section 4 — Dashboard integration.** `GET /api/goals/overview` (coach) → per-player
  active-goal counts + avg completion (non-private). Athlete + solo dashboards: `GoalsMiniCard`
  (top active goals w/ bars, "X of Y on track") + `JournalPromptCard` (write-today nudge /
  "Good job writing today!"). Solo also: `ProgressThisMonthCard` (journal streak + goals
  achieved this month). Coach dashboard: `TeamGoalsCard`. Coach player-detail: **Goals tab**
  (`PlayerGoalsTab` — view/add/manage non-private goals + AI suggestions).

Cross-cutting: goal/journal/public-profile privacy is centralized (coaches never see
`IsPrivate` goals or journal entries; the anonymous public view double-filters on both the
`IsPrivate` flag and the per-section `Show*` toggle). Query keys: `['goals']`, `['journal']`,
`['publicProfile']` roots so mutations invalidate broadly.

## Phase C — Drill & Exercise Library (COMPLETE, deployed) — 4 sections

A sport-specific drill/exercise library coaches and solo athletes browse, favorite, create,
and assign as tasks; team athletes browse read-only. Multi-sport; AI prompts always include
the player's sport. 4 commits, each curl- + browser-verified.

- **Section 1 — Model & seeding** (migration `AddDrillLibrary`). `Drill` (multi-sport via a
  comma-separated `SportIds` string; `DrillCategory` WarmUp/Technical/Tactical/Fitness/Strength/
  Speed/Agility/Recovery/Mental/Cooldown — enum name `WarmUp` serialises as "WarmUp", frontend
  label "Warm-up"; `DrillDifficulty` Beginner→Elite; duration/equipment/instructions/videoUrl/
  `TargetStatCategories`; `IsBuiltIn` + nullable `CoachId`) + `DrillFavorite` (unique per
  user+drill). `DrillSeeder` seeds **60 built-in drills** (15 soccer, 15 basketball, 10
  volleyball, 10 beach, 10 tennis) with **real stat-category targets** so recommendations match
  — idempotent (inserts only when no built-in drills exist), wired in `Program.cs` before
  `DemoDataSeeder`. `DrillsController` (`[Route("api/drills")]`): paginated GET (filters sport/
  category/difficulty/search/favorited/mine, **20/page** via a generic `PagedResult<T>`),
  GET `{id}`, coach/solo POST/PUT/DELETE (custom drills; **built-ins immutable**), POST
  `{id}/favorite` toggle, GET `favorites`, POST `{id}/assign` (creates a task — drill category
  mapped to task category via `DrillService.MapCategory`). **Visibility: built-in to everyone,
  custom to their creator only.** Sport filter is evaluated in memory (the comma-separated
  column isn't SQL-translatable).
- **Section 2 — Library UI.** Shared role-aware `DrillLibraryPage` (All/My Drills tabs, search,
  sport pills **defaulting to the user's own sport**, multi-select category pills + difficulty/
  duration/favorites filters, 3-col grid with client-side pagination). `DrillCard`,
  `DrillDetailModal` (numbered instruction steps, target tags, video link, favorite, edit/delete
  own, Assign), `AssignDrillModal` (player picker / locked for solo, priority, due date, note),
  `CreateDrillModal` (multi-sport select, target-tag input). `DrillLibraryModal` reused by a
  "Browse Library" button on the Tasks page. Sidebar "Drill Library" for all three roles;
  dashboard quick-action cards (coach + solo). `useTeams` gained an `enabled` param.
- **Section 3 — Smart recommendations.** Non-AI `GET /api/drills?recommended=true&playerId=X`
  (drills for the player's sport whose targets hit their weakest assessment areas, **weakest
  first**, `recommendTarget` set). AI `POST /api/ai/drill-recommendations/{playerId}` (Haiku,
  sport-aware) picks + explains the top 5 drills, returns full drill data + reasoning + target +
  priority. `DrillService` gained `GetWeakCategoryNamesAsync` + `GetManyAsync`; **`AIController`
  injects `IDrillService`.** Frontend: `RecommendedDrillsSection` at the top of the library
  (coach picks a player, solo/athlete = self; 3 badged cards + AI button), `AIDrillRecommendations
  Modal`, and `GoalRecommendedDrills` wired into `GoalCard` (a goal linked to a stat category
  shows matching drills with one-click Assign — **goals → drills → tasks**). AI is coach/solo
  only; team athletes get the non-AI section read-only.
- **Section 4 — Tracking & analytics** (migration `AddDrillIdToTasks`). `PlayerTask.DrillId`
  set on drill-assign; `PlayerTaskDto` carries `DrillId` + resolved `DrillDifficulty` (batch-
  loaded in the list methods). `GET /api/drills/{id}/stats` (times assigned/completed, rate,
  player count — **scoped to the caller's own tasks**; `GET {id}` also populates `Usage`). `GET
  /api/drills/analytics` (coach) — drill-vs-manual split, most-assigned/most-completed, completion
  rate by category, drill count per player. Frontend: usage row in `DrillDetailModal`; "Drill
  Usage" section on the task analytics page (stat cards + most-used bar, drill-vs-manual donut,
  category bar — Recharts direct); `TaskCard` shows a teal "Drill · {difficulty}" badge; the
  player-detail Tasks tab gains an All / Drill-based / Manual filter.

## Phase D — Team Management Improvements (COMPLETE, deployed) — 5 sections

Five features, each its own commit, curl- + browser-verified. Multi-sport throughout.

- **Section 1 — Bulk Assessment Mode** (commit `cf9f380`). `POST /api/player-assessments/
  bulk` (`[Authorize(Roles="Coach,Admin")]`) → `AssessmentService.BulkCreateAssessmentsAsync`
  wraps a `BeginTransactionAsync`, reuses `CreateAssessmentAsync` per player, rolls back on any
  failure. 3-step `BulkAssessmentPage` wizard at `/teams/:id/bulk-assessment` (pick players →
  score each with the shared `ScoreSlider`/`OverallScoreRing` → review) with localStorage
  auto-save (key `pd_bulk_${teamId}`). "Assess Full Team" button on the team hero.
- **Section 2 — Assessment Templates** (commit `8f4ef13`). `AssessmentTemplate` +
  `AssessmentTemplateScore` (migration `AddAssessmentTemplates`; `DefaultScore` decimal(3,1),
  `Weight` decimal(5,2), `IsRequired`). `AssessmentTemplatesController`
  (`[Route("api/assessment-templates")]`, Coach/Admin): CRUD + `POST {id}/apply/{playerId}`
  (validates `template.SportId==player.SportId`). Coach-owned (`LoadOwnedAsync` checks CoachId).
  Frontend: `AssessmentTemplateBar` dropdown (save current form as template / load one),
  `CreateTemplateModal`, required-category highlight (indigo "Required" pill + ring via a
  `required` prop on `ScoreWidgets`), wired into `AssessmentPage`.
- **Section 3 — Assistant Coach Role** (commit `41b78d1`, migration `AddAssistantCoaches`).
  Assistants reuse the **`Coach` ASP.NET role + a `CoachTeamScope`** (so all existing team
  scoping works) **plus a `TeamCoachRole`** storing per-team permissions (`CoachPermissions`
  JSON: CanAssessPlayers/CanAssignTasks/CanViewPrivateNotes/CanManagePlayers/CanManageTeam).
  Head coach = `Team.CoachId` (implicitly all perms). `AssistantCoachInvite` (emailed URL-safe
  token, 7-day expiry). `TeamCoachService`: list/invite/update-permissions/remove (head-coach-
  only) + public validate/accept (accept **creates or links** the account — **existing accounts
  must verify their password** so a leaked invite token can't grant a login — returns login
  tokens). Enforcement is centralized in `AccessControlService` (`GetTeamPermissionsAsync`,
  `EnsureTeamPermissionAsync`, `EnsurePlayerPermissionAsync`, `CanViewPrivateNotesAsync`) and
  wired into assessments (CanAssessPlayers), tasks (CanAssignTasks), player create/update/delete
  (CanManagePlayers), team edit/delete (CanManageTeam), and coach-note filtering
  (CanViewPrivateNotes hides private notes from assistants without it). Endpoints: `GET
  /api/teams/{id}/coaches`, `GET /api/teams/{id}/my-coach-permissions`, `POST /api/teams/{id}/
  invite-coach`, `PUT /api/team-coaches/{id}/permissions`, `DELETE /api/team-coaches/{id}`,
  public `GET /api/assistant-invites/validate/{token}` + `POST /api/assistant-invites/accept`
  (the accept lives on `AuthController` to reuse `WriteAuthCookies`; both public endpoints are
  `[EnableRateLimiting("join-validate")]`). `SendCoachInviteAsync` email w/ SMTP-log fallback.
  Frontend: `CoachingStaffSection` on the team-detail overview (head-coach card + assistant
  cards with permission chips + invite modal with role presets Assistant/Analyst + permission
  checkboxes + edit/remove), public `/coach-invite/:token` accept page, and team-detail actions
  (Edit/Delete team, Assess Full Team, Add Player, athlete-invite) gated by `useMyCoachPermissions`.
- **Section 4 — Athlete Session Feedback** (commit `88ee3c1`, migration `AddSessionFeedback`).
  `SessionFeedback` (Rating/EnergyBefore/EnergyAfter/Difficulty 1-5 + WhatWentWell/WhatWasHard/
  InjuryNote; **one row per player per session** via unique index, upserted). `SessionFeedback
  Service` + controller: `POST /api/sessions/{id}/feedback` (Athlete/SoloAthlete; validates 1-5
  ranges, that the athlete is a player on the session's team or owns the solo session, and that
  the session has started), `GET /api/sessions/{id}/feedback` (coach team-access / solo own-
  session → responses + summary), `GET /api/players/{id}/session-feedback` (coach history), `GET
  /api/sessions/feedback/mine` (athlete's past sessions + own feedback), `GET /api/teams/{id}/
  session-feedback-analytics` (rating trend, by-type ratings, per-session injury flags). Frontend:
  `SessionFeedbackModal` (star rating + energy-before/after + difficulty dot scales + injury
  field), `SessionsToRateCard` on the athlete dashboard + solo training page, `CoachSession
  FeedbackPanel` on the team-detail Schedule tab (analytics strip + rating-by-type bars +
  per-session rows: avg stars, count rated, injury badge, expand → individual responses).
- **Section 5 — Athlete Personal Notes** (commit `771dc76`, migration `AddAthleteNotes`).
  `AthleteNote` (Title nullable, Content, Category Training/Nutrition/Mental/Personal/Goal/Other).
  **The entire `AthleteNotesController` is `[Authorize(Roles="Athlete,SoloAthlete")]` so a coach
  gets 403 on every verb — coaches can NEVER read athlete notes** (verified). `AthleteNoteService`
  scopes to the caller's own player+userId; `LoadOwnAsync` 404s (no leak) for another athlete's
  note. `GET/POST/PUT/DELETE /api/athlete-notes`. Frontend: `AthleteNoteModal` (optional title,
  category pills, large textarea, **auto-save every 30s**), shared `AthleteNotesPage` at
  `/player-dashboard/notes` + `/solo/notes` (category filter pills, expandable cards, edit/delete),
  `MyNotesCard` dashboard widget (quick-jot + last 3 + view-all) on both dashboards, "My Notes"
  sidebar item for both roles.

## Phase E — Coach Discovery Marketplace (COMPLETE, deployed) — 5 sections

A public marketplace where coaches create opt-in profiles and athletes (solo or team-seeking)
find, connect with, and review coaches by sport/location. 5 commits, each curl- + browser-
verified. Multi-sport (coaches filterable by sport).

- **Section 1 — Coach public profile** (commit `c66800f`, migration `AddCoachPublicProfile`).
  `CoachPublicProfile` (one per coach, unique slug + unique CoachUserId; Bio ≤1000, primary
  SportId, City/Country, YearsCoaching, Certifications, Specialization, IsAcceptingAthletes,
  ContactEmail, IsPublic). DisplayName/photo read from ApplicationUser; stats (TeamCount/
  PlayerCount/AverageTeamScore) derived at query. `CoachPublicProfileService`: lazy get-or-create
  (defaults primary sport to the coach's most common team sport), validated update, public
  paginated listing (20/page; filters sport/city/country/accepting/search), public by-slug (404
  for missing OR non-public). `CoachesController`: public rate-limited GET `/api/coaches` +
  `/api/coaches/{slug}`, coach GET/PUT `/api/profile/coach-public`. Frontend: `CoachPublicProfile
  Section` on the coach profile (public toggle, URL+copy+preview, all fields), dark-themed public
  `/coaches/:slug` page (sport-gradient hero, stats, about, connect, Join CTA). Shared
  `utils/sportColors` (gradient/dot/badge — extracted from the duplicated maps).
- **Section 2 — Coach marketplace page** (commit `67075de`). Added `MinYears`/`MaxYears`/`Sort` to
  the listing query. **`GET /api/sports` is now `[AllowAnonymous]`** so the public marketplace +
  landing get sport pills without a login (rest of SportsController stays authed). Frontend:
  `CoachCard`, `CoachMarketplacePage` at public `/coaches` (hero + URL-synced sport pills, desktop
  filter sidebar / mobile sheet: search/city/country/experience-buckets/accepting, responsive
  3/2/1 grid, Load-more via `useInfiniteQuery`, empty state). Landing page gained a "Find a Coach"
  navbar link + section (sport pills → `/coaches?sport=X`).
- **Section 3 — Connection requests** (commit `0398b1b`, migration `AddCoachConnections`).
  `CoachConnectionRequest` (Pending/Accepted/Declined/Withdrawn; denormalized names+sport;
  CoachNote decline reason; ResultJoinCode). `CoachConnectionService`: send (one pending per
  athlete per coach, **5/day per-athlete rate limit**, pushes coach); coach list/accept/decline;
  athlete list/withdraw. **Accept generates/reuses a join code for a sport-matched coach team only
  when the athlete is teamless**, pushes athlete. `ConnectionRequestsController`: POST
  `/api/coaches/{slug}/request`, coach GET/PATCH `/api/coach/connection-requests[/{id}/accept|
  decline]`, athlete GET/DELETE `/api/athlete/connection-requests[/{id}]`. **Decline reason stored
  as a coach note, never exposed in the athlete DTO.** Frontend: `RequestConnectionModal` (role-
  aware) on the public profile, coach `ConnectionRequestsPage` (`/coach/connection-requests`, tabs
  + accept/decline + join-code display) with a "Requests" sidebar item + pending badge, athlete
  `MyConnectionRequestsSection` on the profile (status badges, withdraw, accepted → join code +
  "Use code" → `/join/{code}`). `useNotifications` integrates connection requests (coach pending;
  athlete accepted/declined); `NotificationBell` gained a connection icon.
- **Section 4 — Coach reviews & ratings** (commit `e76d9ee`, migration `AddCoachReviews`).
  `CoachReview` (Rating 1-5, Title/Content, Sport, IsVerified, IsPublic, CoachResponse; one per
  reviewer per coach). `CoachReviewService`: public GET (avg + count + 1-5 distribution; reads the
  caller if a token is present to flag isMine/hasReviewed/isOwner); submit (**IsVerified when the
  reviewer has a player on one of the coach's teams**); coach respond (own only); reviewer delete
  (own only). `GetRatingsAsync` enriches marketplace cards + profile with AverageRating/ReviewCount;
  `sort=rated` supported. `CoachReviewsController`: public GET `/api/coaches/{slug}/reviews`,
  athlete POST, coach PUT `/api/coach-reviews/{id}/response`, reviewer DELETE. Frontend:
  `CoachReviewsSection` (summary + distribution bars, review cards with Verified badge + indented
  coach response, Write-a-Review for logged-in athletes, inline coach Respond for the owner),
  `WriteReviewModal`; coach cards + hero show `★ X.X (n)`; marketplace gains a Highest-rated sort.
- **Section 5 — Marketplace analytics** (commit `70ccc26`, migration `AddCoachProfileViews`).
  `CoachProfileView` (**SHA-256-hashed IP**, ViewerUserId, Source). Every public profile GET records
  a view via `CoachAnalyticsService.RecordViewAsync` — **deduped per hashed IP per day, self-views
  excluded, never throws**; source from a `?source=` param (marketplace cards link with
  `?source=marketplace`). `GET /api/coach/profile-analytics`: totalViews/week/month, request funnel
  (+ acceptanceRate), review count/avg, **weighted profileCompleteness + per-item checklist**,
  viewsBySource, 30-day daily trend. Frontend: `ProfileAnalyticsPage` (`/coach/profile-analytics` —
  stat cards, Recharts-direct 30-day area chart, source chips, funnel bars, completeness checklist)
  + `ProfileAnalyticsCard` on the coach dashboard (only when the profile is public).

Cross-cutting: the public coach GETs (`/api/coaches`, `/api/coaches/{slug}` + reviews) are
`[AllowAnonymous]` + `[EnableRateLimiting("join-validate")]`; they still read `User` when a token
is present (via the cookie) to personalise isMine/isOwner/self-view. Coach public data lives on
`CoachPublicProfile`, keyed by `CoachUserId` (the ApplicationUser id), not a new profile row.

## Architecture decisions & gotchas (read before touching related code)

- **`Player.TeamId` is nullable** (since Solo Athlete Mode). Any new query filtering
  players by team must null-guard (`p.TeamId != null && teamIds.Contains(p.TeamId.Value)`).
  Same for `AssessmentPeriod`/`ScheduledSession`/`MatchResult`, which are team-scoped
  XOR player-scoped (`PlayerId` set = a solo athlete's personal record; ownership
  checks branch accordingly).
- **SoloAthlete bypasses the AI billing gate** (`BillingService.EnsureAiAllowedAsync`
  returns early for the role): coach plan limits don't map onto a market-of-one
  athlete and AI is the core of the solo product. Revisit if a paid solo tier ships.
  Everything else billing-related stays coach-scoped.
- **Coach task boards only show tasks the coach owns** (`CoachId` = creator). Solo
  athletes self-assign (CoachId = their own user id); on connect-coach those tasks'
  CoachId is reassigned to the team's coach so they surface for the coach.
- **Deleting a solo account deletes the solo player** (cascade wipes their data);
  managed athletes still only get unlinked (coach keeps history) — see
  `ProfileService.DeleteAccountAsync`.
- **`register-solo` sets `HasCompletedOnboarding=true`** (wizard collects everything),
  same as `register-athlete`.

- **SixLabors.ImageSharp is pinned to 3.1.12.** Version 4.x fails the build outright
  without a paid license key (`No Six Labors license found`). 3.x is free under their
  split license for this use. Don't `dotnet add package SixLabors.ImageSharp` without a
  version — it'll pull 4.x and break the build.
- **Profile/team images are base64 data URLs in the DB** (400x400 JPEG, ~4-60KB), not
  files — Railway containers have no persistent disk. Anything rendering an avatar just
  uses the string as `img src`.
- **Join codes are compared normalized-uppercase** and generated from a 0/O/1/I-free
  alphabet. Only one code per team is active; `JoinCodeService.GenerateAsync` retires
  previous actives. The public validate/register endpoints sit behind the
  "join-validate" fixed-window rate limiter (20/min/IP) — registered in `Program.cs`,
  `app.UseRateLimiter()` after `UseRouting`.
- **Nutrition-profile mutations allow role Athlete** (not just Coach/Admin) since the
  profile/onboarding features — the service's `EnsureCanAccessPlayerAsync` scopes
  athletes to their own player (verified 403 otherwise). Don't "fix" the controller
  attribute back to coach-only.
- **Athlete profile edits write through to the Player row** (`ProfileService.UpdateAsync`:
  height/weight/DOB→Age/jersey + FullName). If you add athlete-editable fields, follow
  that pattern or coach views will go stale.
- **`register-athlete` sets `HasCompletedOnboarding=true`**; only coach-created athletes
  see the first-login OnboardingModal (shown when completion < 50%).

- **Identity password rules were set explicitly** in `Program.cs` (`options.Password`):
  **min 8, one uppercase, one digit** — lowercase/non-alphanumeric NOT required. This
  keeps registration + password-reset consistent and matches the frontend strength meter.
  Changing the options does NOT invalidate existing password hashes (login still works);
  it only affects new registrations/resets. Seed password `SeedCoach123!` still satisfies.
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

**Phase E — Coach Discovery Marketplace complete (latest).** All 5 sections above
(coach public profile, marketplace page, connection requests, reviews & ratings,
marketplace analytics) are implemented, pushed to `main` as 5 commits (migrations
`AddCoachPublicProfile`, `AddCoachConnections`, `AddCoachReviews`, `AddCoachProfileViews`
auto-applied on Railway), 34/34 backend tests passing, `npm run build` + `oxlint` clean.
Verified locally section by section via curl: profile lazy-create/go-public/listing+
filters/public-404; marketplace years+accepting+sport filters; connection send/duplicate-
guard/accept(team=no code, solo=valid join code)/decline(reason hidden)/withdraw/cross-
coach-404; reviews verified-vs-unverified/duplicate/distribution/coach-respond(other coach
403)/reviewer-delete(non-owner 403)/sort=rated; analytics view-dedup/source-breakdown/self-
view-excluded(cookie path)/completeness/30-day-trend. Browser-verified: dark public profile
page + reviews (5.0 summary, verified badge, coach response), coach settings section,
marketplace (hero pills, cards with ★ rating, sport/basketball filter, sort dropdown),
landing Find-a-Coach section, coach requests page (accepted → join code) + athlete My
Requests, and the analytics page (30-day chart, funnel, 85% completeness checklist) +
dashboard Marketplace Profile card. **Production verification run after deploy (see below).**
All local test data cleaned up (connection requests, reviews, profile views, solo test
account); the two seed coaches (soccer/basketball) were left with public marketplace
profiles as demo data.

**Phase D — Team Management Improvements complete.** All 5 sections above
(bulk assessment, assessment templates, assistant coach role, athlete session feedback,
athlete personal notes) are implemented, pushed to `main` as 5 commits (migrations
`AddAssessmentTemplates`, `AddAssistantCoaches`, `AddSessionFeedback`, `AddAthleteNotes`
auto-applied on Railway), 34/34 backend tests passing, `npm run build` + `oxlint` clean.
Verified locally section by section via curl: bulk-assessment transaction rollback;
template CRUD + sport-scoped apply; assistant-coach invite→accept (new user + existing-
user password check) with permission enforcement (analyst assess ✅ 201, tasks/player-
mgmt/team-edit 403, private notes hidden, non-head can't manage staff, permission update
unlocks live, removal revokes access); session feedback submit+upsert (no dupes), injury
flag propagation, coach summary/analytics/player-history, authz (future 400, non-team 403,
cross-team coach 403, out-of-range 400); athlete notes create/update/delete + **coach 403
on all four verbs** + cross-athlete 404 (no leak). All test data cleaned up. **Production
verification of all 5 sections run after deploy — see below.**

**Phase C — Drill & Exercise Library complete.** All 4 sections above are
implemented, pushed to `main` as 4 commits (migrations `AddDrillLibrary`, `AddDrillIdToTasks`
auto-applied on Railway; `DrillSeeder` seeds 60 built-in drills on boot), 34/34 backend tests
passing, `npm run build` + `oxlint` clean. Verified locally section by section: 60 drills
seeded (15/15/10/10/10 across the 5 sports), multi-sport filtering (drills only surface for
their sport), pagination, favorites, custom-drill CRUD, drill→task assign (category mapped),
authz (athlete browse/favorite ✅, create/assign 403; coach edit built-in 403), non-AI + real
AI recommendations (weakest-area drills, sport-specific reasoning), goals→drills, assign→
`DrillId`, `{id}/stats`, and `/analytics`. Browser-verified as coach: library page (filters/
detail/assign), "Recommended for you" section + AI modal, goal recommended-drills, the task-
analytics "Drill Usage" charts, and the player-detail Tasks All/Drill-based/Manual filter with
"Drill · {difficulty}" badges. NOTE: a **local curl gotcha** — the sandbox doesn't flush the
`-c` cookie jar before the next `-b` read in the same bash block, so multi-request scripts must
`sync; sleep 1` after login (single calls are fine); the browser `fetch` path (valid session
cookies) is the reliable alternative for verification. Production verification run after deploy
(see that session's report). All local test data cleaned up.

**Phase B — Personal Goals & Progress complete.** All 4 sections above are
implemented, pushed to `main` as 4 commits (migrations `AddPersonalGoals`,
`AddJournalEntries`, `AddPublicProfiles` auto-applied on Railway), 34/34 backend tests
passing, `npm run build` + `oxlint` clean. Verified locally section by section:
goal privacy (coach sees only non-private, 403 on private PUT/progress, coach-set private
downgraded), assessment auto-link (linked Performance goal's CurrentValue updated 8.0→9.3
with an Assessment progress point), milestone auto-achieve, real AI goal suggestions
(sport-aware, linked to weak stat categories); journal upsert (one/day, no dupes), tag
normalization, share→coach visibility + coach 403 on mutate, private-never-leaks; public
profile lazy-create + slug, 404 while private, anonymous fetch with per-flag + non-private
gating (private goal/journal never appear even with the flag on); coach goal-overview
excludes private. Browser-verified as athlete (goal create → 76% amber bar → log progress
7.3 → 86% green + chart with dashed target line; journal entry → heat-map square + coach
Journal tab; public page dark-themed with radar/goals/journal/CTA; dashboard Share button +
My Goals + journal prompt cards, all clean on full reload) and as coach (Player Goals
dashboard card, player-detail Goals tab hiding the private goal). Production verification of
the full journey (both solo and coached athlete) run after deploy — see that session's
report. All local test data cleaned up.

**Phase A — Solo Athlete Mode complete.** All 9 sections above are
implemented, pushed to `main` as 9 commits (migration `AddSoloAthlete` auto-applied on
Railway), 34/34 backend tests passing, `npm run build` + `oxlint` clean throughout.
Verified locally section by section: a 27-check curl authz suite (solo isolation, coach
⇄ solo 403s, role-gate integrity for managed athletes), the full 7-step wizard, solo
dashboard/assessments/nutrition (real AI weekly plan respecting a peanut hard-allergy +
food swap)/training/matches/recovery (real AI recovery program, 5 weeks × 20 exercises)
/tasks (AI suggestions from real weak areas), and the solo→coached conversion twice
(sport-mismatch guard, role flip with fresh tokens, full history + task handoff visible
to the coach). Production verification of the solo journey was run after deploy (see
that session's report). All local test data cleaned up.

**Self-enrollment & profile round complete.** The 4 features above (team join
codes + QR self-enrollment, profile redesign with photo upload, athlete onboarding,
jersey/status/team details) are implemented, `npm run build` + `oxlint` clean, backend
`dotnet test` 34/34, pushed to `main` as 4 commits (migrations `AddTeamJoinCodes`,
`AddProfileFields`, `AddPlayerStatusTeamDetails` auto-applied on Railway). Every endpoint
curl-verified locally (join-code generate/validate/register incl. rate-limit 429s and
authz 403s, profile GET/PUT/picture/change-password, team details validation) and the
full join flow browser-verified on production: coach generated a join code with QR on
the team page, an athlete registered through the /join/{code} wizard on the live site,
landed on the dashboard with the welcome banner, appeared on the coach's roster with
jersey number, and triggered the coach's "New athlete joined" bell notification. Test
data cleaned up (test athlete deleted their own account via the new danger zone; coach
deleted the player + deactivated the code).

**Phase 10 complete — production ready.** The 7-section polish sprint above (code
splitting, mobile/bottom-nav, skeletons + error/empty states, animations, error
boundary + 404 + offline, PDF export, final polish) is implemented, `npm run build`
+ `oxlint` clean, backend `dotnet test` 34/34 passing, and pushed to `main`. Verified
in-browser: lazy routes load with no console errors, mobile bottom nav / bottom-sheet
modals / single-pane messages at 390px, skeletons (delayed-API capture), 404 + offline
banner, count-up + sliding sidebar indicator, and PDF exports downloading valid `%PDF`
files. The app is feature-complete and production-ready.

**Latest feature round complete.** The 5 features above (match score format, wellbeing
check-in, AI task suggestions, recovery templates, task analytics) are implemented,
typechecked (`npm run build`) + linted (`oxlint`), and pushed to `main` as separate
commits (each auto-deploying to Railway + Vercel). New models got EF migrations
(auto-applied on Railway startup); every endpoint was curl-verified locally and each
feature walked through in-browser on the local dev stack as **both coach and athlete** —
including the 5-step wellbeing widget + pain-during-recovery alert on the coach dashboard,
AI task suggestions for soccer vs basketball with one-click assign, the "Use Template"
recovery flow (suggested body-part match), and the analytics page (stat cards, callouts,
3 charts). All test data cleaned up afterward. Local Postgres runs on the non-standard
port/socket (see Local Postgres section); its `/tmp/pgsock16` socket dir is wiped on
macOS restart and must be `mkdir`'d before starting Postgres.

**Post-Phase-9 improvements complete.** The five improvements above (shared notes,
messaging, notification read-state, injury recovery programs, tasks UI overhaul) are
implemented, typechecked (`npm run build`), and pushed to `main` as separate commits.
New models got EF migrations; endpoints were curl-verified on production and walked
through on https://protracker-iota.vercel.app as both coach and athlete — including
private-vs-shared notes (athlete 403 on private), a full coach↔athlete message thread
with unread badges clearing on read, the injury notification disappearing after being
viewed, an AI-generated sport-specific recovery program (soccer vs basketball) with the
athlete completing an exercise, and the redesigned tasks pages (coach pills/sections +
assign-modal preview, athlete progress ring). All test data cleaned up afterward.

**Phase 9 complete.** All 7 features above are implemented, typechecked
(`npm run build`), and pushed to `main` as 7 separate commits. Each feature's new
models got an EF migration (auto-applied on Railway startup); every endpoint was
curl-verified against the live production API (create → verify → delete, leaving prod
data pristine) and every feature was walked through on
https://protracker-iota.vercel.app as **both coach and athlete** — including the
coach-note privacy guard (athlete 403), the notification bell (coach sees the seeded
active injury; athlete "all caught up"), the week-calendar Schedule tab, and the
pinned team announcement showing on the athlete dashboard. Both Vercel and Railway
redeployed cleanly on each push.

Prior work: the 6 "Improvement" items (assessment sliders, unit toggles, chart
overhaul, teams redesign, food-swap polish, this file) were likewise implemented,
linted (`oxlint`), and deployed. Local Postgres dev environment is set up and working.
