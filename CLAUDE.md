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

**Phase A — Solo Athlete Mode complete (latest).** All 9 sections above are
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
