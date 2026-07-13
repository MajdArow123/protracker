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
npx vitest run           # frontend unit tests (src/test/*.test.ts[x], jsdom) — RUN BEFORE
                          # SHIPPING frontend changes; build+oxlint alone once let a commit
                          # land that broke LoginPage tests (placeholder→label markup change)

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

## Phase F — League/Tournament Mode + Multi-language (COMPLETE, deployed) — 4 sections

Final phase: a league/tournament system (all 5 sports) and full i18n (English, Arabic,
Hebrew, French, Spanish with RTL). 4 commits, each curl-/browser-verified.

- **Section 1 — League data model** (commit `bb2736e`, migration `AddLeagueTournament`).
  `League` (Type League/Tournament/Cup, Format RoundRobin/Knockout/GroupStageKnockout/Swiss,
  Status Draft/Registration/Active/Completed/Cancelled, configurable points 3/1/0, IsPublic,
  location/rules/prize, OrganizerId) + `LeagueTeam` (Pending/Approved/Rejected registration) +
  `LeagueMatch` (**FKs to LeagueTeam not Team**, sport-aware SetScores, Round/Group) +
  `LeagueStanding` (P/W/D/L, GF/GA, Points, Form, Position). `LeagueService`: organizer-only
  CRUD; team registration (**organizer auto-approved, others Pending; sport-match + capacity
  guards**); approve/reject; match CRUD + score update; **standings recalculation after every
  score change** (Points → goal-difference → goals-for; last-5 Form "WWDLL"; positions);
  **round-robin generation via the circle method** (each team plays every other once,
  home/away alternated by round), knockout first-round pairing. Score format from the sport
  (`MatchResult.FormatForSport`: Goals/Points/Sets/GamesAndSets), exposed on the detail DTO.
  `LeaguesController` (`[Route("api")]`, Coach/Admin mutations, any role browses/views): GET
  `/api/leagues`(+filters)/`mine`/`{id}`, POST/PUT/DELETE, team register + `{id}/teams/{ltId}/
  approve|reject`, `{id}/matches` list/create, `PUT /api/league-matches/{id}/score`, DELETE,
  `POST /api/leagues/{id}/generate-schedule`, `GET /api/leagues/{id}/standings`. **Two FKs to
  LeagueTeam use `DeleteBehavior.Restrict`** (avoid multiple cascade paths; League cascade
  wipes matches/standings directly).
- **Section 2 — League UI** (commit `5b0dfcd`). `leaguesApi` + `useLeagues` hooks; shared
  `utils/leagueMeta`. `LeaguesPage` (`/leagues`, My/Browse tabs + sport/search filters + Create
  button). `CreateLeagueModal` (**doubles as edit** via optional `editLeague`; type/format
  cards, sport defaults to coach's). `LeagueDetailPage` (`/leagues/:id`): sport-gradient hero +
  Register-My-Team + Edit/Delete (organizer), **4 tabs** — Standings (classic table with
  sport-aware column labels, colored W/D/L form pills, top-3 medal rows, own-team highlight),
  Fixtures (grouped by round, score/"vs", organizer Add-Match/Update-Score/delete), Teams
  (Approve/Reject), Rules — + a Generate-Schedule banner. `RegisterTeamModal` (sport-filtered),
  `AddMatchModal`, `UpdateScoreModal` (sport-aware set-scores). **Leagues sidebar item for
  coach/athlete/solo; routes at AppLayout level (all roles — athlete/solo read-only)**;
  `MyLeaguesCard` on athlete + solo dashboards.
- **Section 3 — i18n infrastructure** (commit `dd14afc`). i18next + react-i18next +
  browser-languagedetector + **resources-to-backend for lazy-loaded locale chunks** (dynamic
  `import()`; only the active language is fetched — 5 separate ~5KB chunks). `src/i18n/index.ts`
  (localStorage detection/persistence key `protracker_lang`, English fallback, navigator
  auto-detect), `src/i18n/languages.ts` (registry + `isRtl` + `applyLanguageToDocument` sets
  `<html>` dir/lang, toggles `.rtl` class, swaps Noto Sans Arabic/Hebrew font — wired to
  i18next's `languageChanged`). 5 locale files (en/ar/he/fr/es) by feature; **"ProTracker"
  stays English in every locale**. Noto Sans Arabic/Hebrew Google Fonts in `index.html`. `t()`
  applied to the Sidebar (all nav) + Login page.
- **Section 4 — Language switcher + RTL** (commit `ce31ed3`). `LanguageSwitcher` (Globe +
  flag, dropdown of all 5; persists + applies immediately, **no reload**) in the app navbar +
  landing nav (`variant="dark"`), so all 5 are selectable **before login**. RTL CSS in
  `index.css`: **mirror directional lucide icons** (chevron/arrow/corner-down-right/move) when
  `.rtl` is set; keep Recharts LTR internally. **Landing page fully translated** (nav, buttons,
  hero badge/title/description, 3 role cards + CTAs).

Cross-cutting i18n gotchas: use `t()` from `useTranslation()`; in files that already use `t`
as a local variable (e.g. LoginPage's tab map), **alias to `tr`** to avoid shadowing. `dir="rtl"`
on `<html>` handles flex/grid/text mirroring automatically; only directional icons + a few
absolute left/right positions need manual attention. New pages should wrap text in `t('key',
'English fallback')` so untranslated keys still render English.

## Pre-Phase-G critical fixes (COMPLETE, deployed) — 4 fixes

Four fixes done one at a time, each its own commit, `npm run build` + `oxlint` + backend
`dotnet test` (34/34) clean, browser-verified.

- **Fix 1 — Complete translations for all 5 languages** (commit `f047be6`). Every visible
  string across all 57 pages + 110 components is now wrapped in `t()` with an English
  fallback (was only the sidebar/login/landing before). **2595 keys across 31 namespaces**,
  fully translated into ar/he/fr/es (validated: 0 missing / 0 extra / 0 interpolation drift
  vs en.json; "ProTracker" stays English). New hooks: **`useLocaleFormat`** (Intl-based
  `formatDate/formatDateTime/formatTime/formatNumber/formatPercent/formatRelativeTime` bound
  to the active language) and **`useDynamicLabels`** (`src/i18n/dynamicLabels.ts`) — translates
  enum values (sport/status/priority/category/difficulty/mood/sessionType) + localized
  `dayNames()`/`monthNames()`. Dynamic DB values (stat category names, custom drills) stay as
  data. Known small gaps: PDF export components (`components/pdf/*`) and a few sport-score
  abbreviations in `utils/matchSport.ts`/`leagueMeta.ts` are still English-sourced.
- **Fix 2 — RTL layout perfection** (commit `fd8fc47`). Arabic/Hebrew fully mirror, not just
  text. `src/styles/rtl.css` (scoped under `.rtl`, imported in `main.tsx`): mirror directional
  lucide icons, flip physical `text-left/right` + accent-border widths (priority stripes move
  to the inline-start edge keeping colour), keep Recharts LTR, anchor toasts left. `useIsRtl`
  hook for JS-driven layout (framer-motion drawer offset). Desktop sidebar mirrors via flexbox +
  `dir=rtl`; mobile drawer opens from the correct edge; dropdowns (bell, template bar) use
  `rtl:` variants; sidebar border uses logical `border-e`. **Charts kept LTR by design** (numeric
  axes stay readable). Also fixed a Fix-1 gap: profile-completion checklist labels (from a util)
  now carry `profile.completion.*` i18n keys. Browser-verified in Hebrew.
- **Fix 3 — League sport auto-filtering** (commit `5cf4f1b`). Browse tab is scoped to the
  viewer's own sport (coach → team sport; solo/team athlete → player sport; derived like
  `DrillLibraryPage`). Pills are replaced with a "Showing {sport} leagues" note; pills remain
  only for admins / multi-sport coaches. League cards drop the redundant sport badge when scoped
  (`hideSport`). Create-League auto-fills the sport read-only (selector hidden) like team creation.
  My Leagues tab unchanged.
- **Fix 4 — Persistent notification system** (commit `7abcef2`, migration `AddNotifications`).
  Replaced the localStorage-derived feed with a DB-backed `Notification` model (17-value
  `NotificationType`; indexed `(UserId,IsRead)` + `(UserId,CreatedAt)`). **`NotificationService`**
  (scoped): `CreateAsync`/`CreateManyAsync` **persist on an isolated `IServiceScopeFactory` scope
  so they never touch the caller's transaction, then fire SignalR `"Notification"` + web-push —
  best-effort, never throws**; plus paged `GetForUserAsync` (+ unread count), MarkRead/MarkAllRead/
  UnreadCount/Delete, and `DeleteOldAsync` (90-day prune at startup). `NotificationsController`
  (`/api/notifications`, all roles, own-user scoped): GET `?page&unreadOnly`, GET `unread-count`,
  PATCH `{id}/read`, PATCH `read-all`, DELETE `{id}`. **Notification creation is wired into the 8
  existing web-push call sites** (message/task/announcement/connection request+accept+decline/
  athlete-joined×2/recovery-plan) + review-received — `CreateAsync` does the web-push now, so the
  raw `IPushService` calls were removed where unused. Frontend: `notificationsApi` + rewritten
  `useNotifications` (infinite feed, polled unread count, mutations); **NotificationBell rebuilt
  (no flicker/auto-mark, loading skeleton, last 5, unread bold+border+dot, relative time, click →
  mark read + navigate, mark-all, view-all)**; new lazy `/notifications` page (all-role: filter
  pills All/Unread/Messages/Tasks/Injuries/System, hover-delete, load more, empty state);
  Notifications sidebar item + unread badge; **SignalR `"Notification"` listener in
  `ChatRealtimeContext` invalidates the feed for real-time updates** (reuses the per-user-group
  ChatHub — no new hub). `NotificationDto.Type` is the enum **name** (frontend switches on it);
  notification title/message are backend-generated English (data, not i18n). Note: the old
  `utils/seenNotifications.ts` remains only for the coach-dashboard injury-card dismissal.

## Phase G — Evidence-Based Assessment System (COMPLETE, deployed) — 5 sections

Transforms scoring from coach guesses to measurement-backed data: slider assessments
keep working unchanged; evidence (objective tests, match stats, coach evaluations,
self-assessments) is an **optional additive layer** that raises confidence and makes AI
insights reference real numbers. 5 commits (`4a993f4`…`d360724`), each curl- +
browser-verified. Multi-sport (54 metric definitions across all 5 sports).

- **Section 1 — Data model & scoring engine** (commit `4a993f4`, migration
  `AddEvidenceBasedAssessments`). Six models: `SportMetricDefinition` (reference data —
  per-sport metrics with `MetricCategory`, `MetricInputType` Timer/Weight/Distance/
  Percentage/Count/Rating/Boolean, 4 source weights, `IsObjectiveRequired`, 3 benchmark
  anchors, **nullable `SportStatCategoryId` linking to the slider category** — the key
  to non-breaking integration), `ObjectiveTestResult`, `MatchStatEntry` (flat numeric
  `StatsJson`, keys per sport), `CoachEvaluation`, `SelfAssessmentEntry`,
  `EvidenceBasedScore` (per-source scores + actual weights + `EvidenceSources` JSON +
  generated `Explanation`; one "current" row per player+metric upserted, AssessmentId
  snapshots separate). `MetricDefinitionSeeder` seeds **54 metrics** (11 soccer, 11
  basketball, 10 volleyball, 10 beach, 12 tennis) — idempotent insert-when-empty, wired
  before `DrillSeeder`. **`EvidenceScoringEngine`**: 3-anchor normalization (BenchmarkLow→3,
  Mid→5, High→10, linear, clamped 1-10, works in both directions — sprint seconds have
  Low>High), proportional weight redistribution over present sources, confidence ladder
  (VeryHigh=all 4; High=objective+coach or 3 sources; Medium=2; Low=1 or
  IsObjectiveRequired-without-objective), 90-day evidence window
  (`EvidenceWindowDays`), plain-English explanations, and a **code-level per-sport
  match-stat mapping table** (`MatchStatRules`, e.g. soccer passAccuracy→Passing,
  basketball turnovers inverted→Decision Making; `HasMatchStatRule` drives the DTO's
  `SupportsMatchStats`). Pure math is public statics (unit-tested without DB).
  `EvidenceController` (`[Route("api")]`): GET `sport-metrics/{sportId}`; POST/GET
  objective-tests (Coach/Admin/SoloAthlete/Athlete via `EnsurePlayerPermissionAsync`
  CanAssessPlayers), match-stats (**Coach/Admin/SoloAthlete only** — team athletes
  can't), coach-evaluations (**Coach/Admin only** — a solo athlete's subjective input is
  always a self-assessment so confidence stays honest), self-assessments/evidence
  (Athlete/SoloAthlete, always own player); GET/POST evidence-scores + calculate
  endpoints. **Slider assessments auto-capture evidence** in
  `AssessmentService.CreateAssessmentAsync` → `CaptureEvidenceFromAssessmentAsync`
  (coach saves → CoachEvaluation rows, athlete/solo saves → SelfAssessmentEntry, per
  linked stat category; best-effort try/catch with change-tracker detach so it can never
  break the assessment). 39 new tests (73 total).
- **Section 2 — Evidence collection UI** (commit `3c99d12`). `components/evidence/`:
  `EvidencePanel` (collapsible per-slider footer via a new `footer` slot on
  `ScoreSlider`; tabs Objective Tests / Match Stats / Guided Questions — tabs hidden
  when inapplicable; `self` mode renames guided tab "Self Evaluation" and posts
  self-assessments; `canEnterMatchStats` gates the match tab for team athletes),
  `ObjectiveTestForm` (benchmark hints, last-test recall), `MatchStatsForm`
  (`matchStatFields.ts` — per-sport field grids whose keys MUST match the backend
  mapping; optional link to a team match), `GuidedQuestionsForm` (`guidedQuestions.ts` —
  3 questions per metric category, 4-option pills → averaged 1-10 rating),
  `ScorePreviewCard` (live preview + confidence + per-source ✓/✗ + **"Apply X to the
  slider"** rounding to 0.5 steps), `EvidenceBreakdownModal` (weighted source bars,
  explanation, merged evidence timeline, missing list, inline entry),
  `EvidenceDashboardTab` (summary strip + metric card grid + Recalculate) — used on the
  coach player-detail **Evidence tab**, athlete **My Stats "My Evidence"** (self mode)
  and solo (via /solo/performance, role-detected). `RadarChartWrapper` gained per-point
  `confidence` (colored dots, dashed line unless all points verified, tooltip + click
  handler); player report gained the Evidence Quality section (coverage line,
  most-reliable / needs-data, clickable table). **Evidence-form buttons must be
  `type="button"`** — the shared `Button` defaults to submit and the panel lives inside
  the assessment `<form>` (this bug was caught in browser verification). 130 i18n keys.
- **Section 3 — AI integration** (commit `b752fee`). `AIController` gained
  `BuildEvidenceContextAsync` (scores w/ confidence + sources, raw test values, per-match
  stat lines, low-confidence list) + `EvidencePromptBlock` — injected into
  improvement-plan, performance-insights and task-suggestions prompts with instructions
  to reference measured values and set quantified targets; **prompts are unchanged when a
  player has no evidence**. Task suggestions rank weak areas by evidence scores (with
  confidence) when ≥3 exist, else slider fallback. New `POST
  /api/ai/evidence-analysis/{playerId}` (Haiku, `{` prefill, one retry) →
  `EvidenceAnalysisDto` (summary, collect-next priorities, position-specific test
  battery, roadmap). Frontend: `AIDataSourcesNote` ("The AI will use: ✓ 3 assessments…")
  on report AI card / improvement page / task-suggestions modal; `EvidenceAnalysisModal`
  + "AI Quality Report" button on the Evidence tab (canUseAI: coach + solo only — AI
  endpoints reject team athletes).
- **Section 4 — Reporting & trends** (commit `510bcd6`). `TestResultsSection` (per-test
  progress chart with Elite/Average `ReferenceLine`s, **reversed Y axis for
  lower-is-better tests**, personal-best gold dot, results timeline) + `MatchStatsSection`
  (clickable season-average tiles, per-stat trend, best-match callout — lower-is-better
  for errors/turnovers) rendered under the Evidence dashboard grid for all roles. New
  `GET /api/teams/{id}/evidence-status` (Coach/Admin) → per-player coverage/confidence/
  test counts + team callout counts, powering a coach-only **team-detail "Evidence" tab**
  (`TeamEvidenceTab`: "N players have no objective test in the last 30 days" etc., "Run
  an Assessment Day" CTA, player rows → player page). Report hero gained a 5th "Evidence
  Quality" card (verified/total) + Test History timeline.
- **Section 5 — Mobile UX & quick entry** (commit `d360724`). `QuickTestEntryModal`
  (flask icon on every player card — cards became keyboard-accessible divs so the nested
  button is valid; objective-required tests sorted first). `MatchStatsQuickEntryModal`:
  after logging a match, closing the ratings modal for a **just-created** match triggers
  an "Add Player Stats?" prompt → per-player stepper (Skip / Save & Next, entries link
  `MatchResultId`); also a per-row BarChart2 button. `TestDayModal` on the team Evidence
  tab (pick test → whole-squad list → save all; sequential posts + one recalc sweep per
  player). `GET /api/evidence-reminders` (Coach/Admin): stale/missing tests **only for
  players who already have evidence scores** (new teams aren't spammed) + one aggregate
  item for players with ≥2 Low-confidence scores → `EvidenceRemindersCard` on the coach
  dashboard (dismiss + Daily/Weekly/Off frequency in localStorage:
  `pt_evidence_reminder_freq`/`pt_evidence_reminder_dismissed`).

Phase G gotchas: **evidence sources & confidence are role-honest** — don't let solo
athletes write CoachEvaluations or team athletes write match stats. The frontend
`matchStatFields.ts` keys and the backend `MatchStatRules` table must stay in sync.
Metric benchmark tweaks in `MetricDefinitionSeeder` don't propagate to existing DBs
(insert-when-empty). `useEvidence` mutations recalculate immediately and return the
fresh score for live previews (setQueryData pattern). Evidence i18n lives in the
`evidence` namespace (~290 keys, all 5 locales).

## Phase G accuracy round (COMPLETE, deployed) — 4 improvements

Four accuracy improvements to the evidence system, each its own commit, curl- +
browser-verified, done before the Final Design Sprint.

- **1 — Auto-import match stats** (commit `686f73d`, migration `AddMatchStatAutoImport`
  adds `MatchStatEntry.IsAutoImported`). `MatchService.SaveRatingsAsync` mirrors every
  rated player into an auto-imported `MatchStatEntry` and recalculates their evidence
  scores (best-effort try/catch). **No new PlayerMatchRating columns** — `StatJson`
  already carries arbitrary sport stats; instead the rating form's `STAT_FIELDS` in
  `utils/matchSport.ts` were expanded to the full evidence-aligned sets per sport.
  Accuracy guards: zero-valued percentage stats are stripped (0% = unfilled form field,
  would normalize to 1.0), all-zero rows skipped (unused subs), manual entries for the
  same match+player never clobbered, de-rated players' auto entries removed (replace
  semantics). Volleyball Attack rule falls back to kills/attempts. Evidence Match Stats
  tab shows "Auto-imported from X rated matches" and hides imported matches from the
  link dropdown; the Section-5 post-rating stats prompt was REMOVED (would double-enter).
- **2 — Benchmark calibration** (commit `dabf849`, migration `AddBenchmarkProfiles`).
  `BenchmarkProfile` + `BenchmarkValue`; `Team.BenchmarkProfileId` (SetNull on delete).
  `BenchmarkProfileSeeder` seeds 5 system profiles per sport (Youth U12-U14 / Junior /
  Amateur Adult = definition defaults / Semi-Pro / Professional) via type-aware
  multipliers (timers shrink with level, quantities grow, percentages capped 99);
  soccer 30m sprint anchors are spec-pinned per level. `BenchmarkService` +
  `BenchmarkProfilesController` (`/api/benchmark-profiles`, team assignment at
  `/api/teams/{id}/benchmark-profile`, per-player resolution at
  `/api/players/{id}/benchmark-profile`). Engine's `NormalizeObjectiveValue` gained a
  benchmark-override param; `GetBenchmarkOverridesAsync(playerId)` resolves the team
  profile (solo/team-less = defaults). UI: `BenchmarkProfileCard` on the team Evidence
  tab (selector recalculates all scored players; live sample line), `BenchmarkProfilesSection`
  ("My Benchmarks") on the coach profile with a custom-profile editor (Low/Mid/Elite grid,
  based-on copy), calibration badge + calibrated hints/chart lines. **Verified: the same
  4.1s sprint = 7.0 Amateur / 3.0 Professional / 10.0 Youth.**
- **3 — Test protocol guides** (commit `e10c82e`, migration `AddTestProtocols`).
  `SportMetricDefinition` gained TestSetup/TestProcedure/CommonMistakes/VideoUrl;
  `Data/TestProtocols.cs` holds protocols for all 33 testable metrics. **Seeder
  backfills existing DBs idempotently** (fills only null TestSetup). `TestProtocolModal`
  (equipment / numbered steps / amber mistakes box / video / "Got it!") via
  "How to measure" links in the test form, quick-test and Test Day modals + "View test
  protocol" in the breakdown. One-time welcome tip on first evidence-panel expansion
  (`pt_evidence_welcome_seen`). "Test Day Checklist" button on the team Evidence tab →
  printable PDF (dynamic @react-pdf import): blank result grid (players × top-5 tests)
  + protocol summaries.
- **4 — High confidence requires a recent objective test** (commit `cf4537b`, migration
  `AddConfidenceTracking` adds `EvidenceBasedScore.LastObjectiveTestAt`). New rules
  (`ObjectiveFreshDays = 60`): VeryHigh = all 4 sources + test ≤60d; High = recent test
  + ≥1 other source; Medium = any 2 sources (incl. expired-test combos); Low = 1 source
  or no test on IsObjectiveRequired metrics. **Rating-only metrics (InputType Rating,
  e.g. Leadership) still reach High with 2 subjective sources** — objective testing is
  impossible there by design. Tests aged 60-90d still contribute to the score but cap
  confidence, with a spec-worded explanation. DTO exposes isObjectiveTestable /
  isObjectiveTestExpired / daysSinceObjectiveTest / nextObjectiveTestDue (derived at
  read time from LastObjectiveTestAt). Frontend: `TestFreshnessBanner` (amber expired /
  blue never-tested) in preview + breakdown, "Why Medium?" tooltips on all confidence
  badges (`confidenceExplanation`), reminders card gained the ExpiredTests aggregate.
  GetConfidenceLevel signature changed to
  `(hasObjective, objectiveIsRecent, hasMatch, hasCoach, hasSelf, objectiveRequired, objectiveTestable)`.

## Final Design Sprint (COMPLETE, deployed) — 7 sections

Visual/UX overhaul across the whole app ("look as good as it works"), 7 commits
(`46564cd`…`f6dde23`), each browser-verified desktop + 400px mobile, `npm run build` +
`oxlint` clean. Rules held throughout: framer-motion `ease` is always a string; all new
strings wrapped in `t()`; new landing strings translated into all 5 locales.

- **S1 — Chart system overhaul.** `src/components/charts/` is the chart system:
  `chartColors.ts` (the color source of truth — **CVD-validated 8-color categorical
  palette** `#3b82f6 #059669 #8b5cf6 #d97706 #ef4444 #0891b2 #ea580c #db2777`; the spec's
  original palette FAILED colorblind validation (lime↔orange ΔE 7 deutan) and was
  substituted — don't "restore" it; also METRIC_COLORS stable per-metric hues,
  SCORE_BANDS, CONFIDENCE_COLORS {Low gray/Medium amber/High blue/VeryHigh green},
  CHART_GRID/AXIS_TICK), `TooltipContent` (shared tooltip — **bg-slate-900** per spec),
  `ConfidenceChart` (confidence-over-time area chart; client-side re-derivation of the
  backend confidence rules in `chartUtils.buildConfidenceTimeline` — keep in sync with
  EvidenceScoringEngine), `ScoreRing` (gradient animated ring; `OverallScoreRing` in
  ScoreWidgets delegates to it), `Sparkline` + `MiniRadar` (pure SVG minis). Line charts:
  dashed segments for Low/Medium-confidence series (`confidenceByKey`), gradient fill
  under the focused line only. Bars: score-band gradients + band-colored value labels.
  Radar: per-point confidence dots, score axis labels, dashed until all verified.
  Evidence confidence colors were realigned (High=blue, VeryHigh=green) in evidenceUtils.
- **S2 — Dashboard redesign.** Shared glass `StatCard`
  (`components/dashboard/StatCard.tsx`: backdrop-blur, gradient glow blob, gradient icon
  chip, CountUp) on all three dashboards; Sparkline on athlete/solo Latest Score (real
  assessment history); MiniRadar on coach team cards (useTeamReport per-card fan-out);
  quick actions became gradient cards; `EmptyState` gained a decorative SVG (radial glow
  + dashed orbit ring).
- **S3 — Player profile & cards.** `PlayerAvatar` (sport-gradient ring + photo/initials)
  on players list, team roster, reports index. Players-list fitness badges carry
  evidence-confidence dots fed by one `evidence-status` request per team via
  `useQueries`. Player-detail hero: **fixed a dead sport-gradient lookup** (was always
  indigo), now real sport gradient + photo + clickable "Evidence: {level}" badge →
  Evidence tab. Recent Assessments = trend timeline (green/red accent border + ±delta
  chip vs previous).
- **S4 — Reports redesign.** Player report hero = sport-gradient banner (**report DTO
  sportName is null — falls back via `sportNameById(sportId)`**); metric rows on both
  reports use glass StatCards + CountUp; shared `AIInsightsList`
  (`components/reports/AIInsightsList.tsx`) renders AI insights as violet-gradient cards
  (used by player + team AI analysis); reports index got sport dots/badges + avatars.
- **S5 — Micro-interactions.** Bell wiggle on unread-count change (reduced-motion aware)
  + spring badge + animated dropdown; springy layout-animated toasts; modal rise
  entrance; sidebar icon hover nudge; drill-grid stagger; **added the missing `fadeIn`
  keyframe** TooltipContent referenced; PageWrapper titles unified to `font-black
  tracking-tight`.
- **S6 — Mobile final pass.** **`viewport-fit=cover` added to index.html** — the bottom
  nav's safe-area padding was silently 0 before this. BottomNav animated active
  indicator (layoutId). Dashboard card rows are **snap carousels on phones**
  (`flex sm:grid` + `snap-x` + `min-w-[~80%]` + `.scrollbar-none` utility). Evidence
  panel tabs = dropdown on mobile. `size="xl"` modals go full-screen (100dvh) on phones.
  Line charts: mobile margins/minTickGap.
- **S7 — Landing final design.** Animated hero (panning gradient bg via
  `.animate-gradient-pan`, drifting blobs, `.gradient-text-animated` headline — all
  no-op under reduced motion). New sections: How-it-works (3 numbered steps),
  Evidence-based-scoring showcase (mock Evidence Summary card mirroring the real UI),
  **Pricing with the real billing plans** (Free $0 / Pro $19 / Team $49 from
  `PlanLimits` — keep in sync if plans change), 4-column footer. ~55 new i18n keys
  added to **all 5 locales** (structure re-validated 0/0).

Design-sprint gotchas: run the dataviz palette validator before changing chart colors;
`StatCard`/`PlayerAvatar`/`AIInsightsList`/`Sparkline`/`MiniRadar` are the shared
primitives — extend them rather than hand-rolling card/avatar markup; carousels rely on
the `.scrollbar-none` utility in index.css.

## Phase G continuation — Section 4: Longitudinal progress tracking (COMPLETE, deployed)

Frontend-only (no backend, no migration): coaches and athletes see whether measured
performance is actually improving, per metric — the payoff of the objective-test data.
One feature commit (`dd426df`) + follow-ups; build/lint/vitest clean; verified in-browser
locally (desktop + Hebrew RTL, before/after screenshots) and on production as both roles.

- **In-place upgrade of `TestResultsSection`** (deliberately NOT a new tab — player
  detail already has 11; the section ships to all three roles for free via the shared
  Evidence surfaces: coach player-detail Evidence tab, athlete My Stats, solo
  /solo/performance). Default view is now **"Progress" — `normalizedScore` (0-10) over
  `testedAt`** (direction-safe: lower-is-better sprints plot upward when improving),
  per-point dots colored by `scoreTone`, raw value + unit + tester in the shared
  `TooltipContent`. Benchmark anchors at normalized 3/5/10 are **deliberately neutral
  gray** dashed lines labeled Low/Average/Elite + a permanent "not score bands" caption
  (they share the 0-10 axis with the red/amber/green score bands — don't recolor them).
  The original raw-value chart (reversed axis, colored Elite/Average lines, gold PB dot)
  is preserved verbatim behind a **"Raw values" toggle**.
- **New `MetricTrendSummary` strip** above the chart: Latest (raw + unit), **Δ since
  first test (raw delta, sign/color from the *normalized* delta** so a sprinter's
  −0.5s reads green), Personal best, and a **trend chip** from a least-squares fit of
  normalizedScore over time (slope per 30 days, thresholds ±0.25).
- **Honesty gates (FINDING-009 discipline — never confidently wrong):** a directional
  improving/flat/declining chip requires **≥3 tests**; exactly 2 shows the Δ plus a
  neutral "Trend needs ≥3 tests" chip; **R² < 0.3** (or all tests same-day, sxx=0)
  renders "Too varied to call"; identical scores (syy=0) are genuinely **flat**; 1 test
  = single dot, no line, "second test starts the trend line" caption; 0 tests = compact
  `EmptyState` (the section used to render `null` — it's now discoverable); loading =
  `SkeletonChart` gated on the tests+metrics queries; query error = message + Retry.
- **`computeTrend` is pure and exported — it's the verification anchor**: 9 vitest
  cases in `src/test/computeTrend.test.ts` (<2→null, 2→needsMore, collinear
  rising/falling, low-R² scatter, same-day, identical scores, sub-threshold drift→flat,
  and the lower-is-better direction-safety contract). Production data validated the
  gate immediately: Lucas's 3 real Speed tests (two same-day, disagreeing) correctly
  show "Too varied to call" (R²≈0.25), not a fake "Improving".
- 23 i18n keys × all 5 locales (key-set equality re-validated 0/0);
  `trending-up/down` added to the rtl.css icon-mirror list (they weren't covered) and
  RTL verified in Hebrew — summary strip mirrors, arrows flip, charts stay LTR by design.
- Follow-up commits in the same push: `6fb22ec` (LoginPage tests query by label —
  FINDING-003 changed placeholder-only markup), `542638d` (SwapModal test: jsdom has no
  i18next instance so `t()` returns defaults **uninterpolated** — title rendered
  literally "Swap {{food}}"; fixed with an interpolating react-i18next mock), `6275bf6`
  (added `npx vitest run` to the verification convention).
- **Scoped out**: trending the composite `EvidenceBasedScore` over time — needs a
  backend endpoint, but note the per-assessment score **snapshot rows already exist**
  (AssessmentId-linked), so the follow-up is an endpoint + chart, not a new table.

## Phase G continuation — Section 5: Benchmark-driven standing (COMPLETE, deployed)

Frontend-only (no backend, no migration): per metric, where the athlete's latest
measured value stands against the benchmark profile in force — band placement + raw
gap to the next anchor. One commit (`cf282bd`); build/oxlint/vitest 61/61 clean;
verified locally (desktop + Hebrew RTL) and on production as coach + athlete in both
profile states (assigned via the prod API, then unassigned to restore pristine state).

- **In-place upgrade of the benchmark meta line** — the old "Elite: X · Average: Y ·
  {profileName}" text row in `TestResultsSection` became **`BenchmarkStandingBar`**:
  a neutral-gray positional scale with Low/Average/Elite ticks carrying the raw anchor
  values (so nothing is rendered twice — the chart's gray anchor *lines* are untouched),
  one athlete marker dot (the ONLY score-band-colored element), a band sentence, gap,
  "as of {test date}", and a profile chip. Ships to all three roles via the shared
  Evidence surfaces; **the bar itself stays LTR in RTL locales** (positional scale under
  the LTR chart), surrounding text translates.
- **Current anchors, NOT the stored `normalizedScore` — this is the key decision.**
  The stored score is calibrated to whatever profile was in force when the test was
  recorded and drifts on profile edit/reassign: observed live during verification —
  assigning the Junior profile made the server recalc Lucas's stored timeline scores
  (e.g. 6.0→7.5 locally, 7.5→9.4 on prod) for the *same* raw values. `computeStanding
  (value, {low, mid, high})` (`benchmarkStanding.ts`, pure/exported) recomputes the
  piecewise Low→3/Mid→5/High→10 mapping from the live anchors and returns `{ band,
  position (0..1), score, gapToNext, lowerIsBetter }` — **one function drives the
  marker position, tick geometry, band text AND scoreTone color**, so they can never
  disagree. Ticks sit at 0.3/0.5/1.0.
- **Honesty contract**: with 3 anchors the only defensible claims are the band
  ('belowLow' | 'lowToAverage' | 'averageToElite' | 'beyondElite', boundary values land
  in the upper band) and the raw-unit gap to the next anchor toward Elite — **no
  percentiles** (fabricated precision). Degenerate anchors (equal or non-monotonic,
  e.g. capped percentage profiles where Average == Elite) → **null, render nothing**.
  No profile assigned (`benchmarkProfileId === null`) → geometry + gap render against
  the app-default anchors with an explicit neutral "App default benchmarks — no profile
  assigned" chip and a coach-only assign hint, but the **band sentence is suppressed**
  (a cohort claim without a chosen cohort). Benchmarks query loading → skeleton;
  error → "Couldn't load benchmarks" + Retry while the chart (real history) still renders.
- **`computeStanding` unit suite** (`benchmarkStanding.test.ts`, 7 tests): per-band
  placement + gaps in both directions (sprint 4.5s between Low 4.8 and Average 4.3 must
  read "0.2 to Average"), linear interpolation points, clamping, degenerate→null, gap
  rounding, and the required **anchor-boundary agreement case** — value exactly at
  Low/Average/Elite asserts position ≈ 0.3/0.5/1.0 (its own tick) AND the upper band,
  both directions. Also DOM-verified: a seeded 4.3s test (== Average anchor) rendered
  `markerLeft: "50%"` on the 50% tick; prod's real 4.05s rendered 75%, matching the
  hand-computed position.

## Phase G continuation — Section 6: Team performance analytics (COMPLETE, deployed)

First continuation section needing backend work. Coach-facing: "where is my squad
strong or weak, and who needs attention". Two commits — backend `d7d98d0`, frontend
`037d63e` — pushed together (dual-target deploy: Railway probe-verified 404→401→200
with data BEFORE trusting the Vercel frontend). No schema migration: read-only
aggregate over existing tables. dotnet 89/89, vitest 66/66.

- **Endpoint** `GET /api/teams/{id}/evidence-performance` (Coach/Admin, existing
  team-access check; `EvidenceController`/`EvidenceService`, same pattern as
  evidence-status): per sport metric — average/min/max of the CURRENT blended
  `FinalScore`s (AssessmentId == null), **sample (n-1) stdDev, null under 4 scored**,
  score-band counts (mirrors `scoreTone` <5/<7 thresholds — keep in sync with
  chartColors.ts), `BelowAverageCount`, and notable outliers (**≥1.5 from the team
  average, max 2/side, suppressed under 3 scored** — named constants in
  `TeamPerformanceMath`, pure statics, DB-free tests). Every stat ships with its
  coverage denominators (`scoredCount` + `verifiedCount` vs top-level `squadSize`);
  **all sport metrics returned including unscored ones** (honest gaps).
- **CALIBRATION RULING (the key finding)**: coach-eval and self-assessment components
  are raw 1-10 ratings — `EvidenceScoringEngine.cs:366-367` clamps without anchor
  normalization — so blended `FinalScore == 5.0` is the app scale's average, NOT the
  benchmark Average anchor. Hence the field is **`BelowAverageCount` ("below average,
  score < 5"), never "below benchmark"**; an objective-only anchor-relative count is
  documented in code comments as a possible future refinement (costs a second
  denominator). Top-level `benchmarkProfileId`/`profileName` (null = app defaults) let
  the FE frame without a cohort claim, S5-consistent.
- **`SquadPerformanceCard`** in `TeamEvidenceTab` (between the coverage callouts and
  the player rows — no new tab): per-metric rows grouped by category, **weakest
  average first**; red/amber/green composition band bar (mirrors naturally in RTL —
  unlike S5's positional scale it has no directional meaning), tone-colored average,
  coverage badge, "below avg" chip (tooltip carries the calibration honesty), expand →
  min/max/stdDev/verified + **outlier chips deep-linking to `/players/{id}?tab=evidence`**
  (PlayerDetailPage gained validated `?tab=` init — first deep-link support on that
  page). Unscored metrics collapse into a muted "No data yet: …" footer.
- **`coverageLevel(scored, squad)`** (`teamCoverage.ts`, pure/exported, 5 tests) is the
  honesty anchor: none / thin / partial / good with an **absolute floor (<3 scored is
  always thin — 2/2 is an anecdote, not an average)** plus 50%/80% ratio bands. Thin
  metrics render the average muted + amber-flagged, never confident. FINDING-009
  gates: skeleton, error + Retry, the coverage list renders independently.
- 21 i18n keys × 5 locales incl. `metricCategory*` labels (no MetricCategory
  translator existed); Hebrew verified locally + on prod.
- Prod-data note: to demonstrate the confident state on prod, 3 realistic Speed
  tests were seeded for City FC players (permanent — tests/scores have no DELETE
  endpoints); disclosed and kept as demo enrichment.

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

## Landing page localization pass (COMPLETE, deployed — commit `aefb526`)

The landing page is now **fully localized** (closes the "PDF/matchSport aside,
landing had hardcoded strings" gap from the Fix-1 known-gaps list): +79 keys × 5
locales (landing namespace 160 keys, key-set equality 0/0), all 10 feature
titles/descs, role-card descs, testimonial quotes/roles, about paragraphs, stats,
contact/find-a-coach/CTA sections. Language switcher is **flag-free** (flags denote
countries, not languages) — `LanguageDef.flag` removed, `short` codes (EN/AR/HE/FR/ES)
on the trigger + uniform start-aligned rows, native names kept as aria-labels. The
feature-card "works" badge moved `right-4` → `end-4` (mirrors away from RTL titles;
badge text now translated). Deliberate-English tokens (tech-stack items, demo
credentials) wrapped `dir="ltr"`. Verified on production in all 5 languages
(20-sentinel bleed sweep clean; badge/title no-overlap geometrically asserted in
AR + HE). NOTE: design-audit **finding #10 (fabricated testimonials + README-style
About content) remains OPEN** — this pass translated that content, it did not
remove it. Ops gotchas from this deploy: aggressive curl-polling of the Vercel
domain triggers a Security Checkpoint (probe GitHub's deployments API instead —
Vercel posts statuses there); Vercel missed the push webhook for `aefb526` entirely
(Railway deployed, Vercel didn't) — an empty retrigger commit (`3e0180d`) fixed it.

## Current status

**Landing localization pass complete (latest).** See section above — `aefb526` +
retrigger `3e0180d`, verified on production in all 5 languages.

**Phase G continuation — Section 6 complete.** Team performance analytics:
aggregate endpoint (`d7d98d0`) + SquadPerformanceCard (`037d63e`) pushed together,
Railway deploy probe-verified before trusting the Vercel frontend, then browser-
verified on production (confident + thin coverage states, weakest-first sort,
app-default framing, outlier deep-link, Hebrew RTL). dotnet 89/89, vitest 66/66.

**Phase G continuation — Section 5 complete.** Benchmark-driven standing
(`cf282bd`) deployed and verified on production as coach + athlete in both profile
states (profile assigned via the prod API for verification, then unassigned — prod
data restored). Marker-on-tick geometry DOM-asserted at an anchor value. Suite 61/61.

**Phase G continuation — Section 4 complete.** Longitudinal progress tracking
shipped as one feature commit (`dd426df`) + test/docs follow-ups, deployed and verified
on production as coach and athlete (real 3-test Speed history correctly gated to "Too
varied to call"). Frontend vitest suite green 54/54 and now part of the pre-ship
convention. Also this session: a /design-review fix loop (findings 001-009, score
7.2 → 7.9 measured) — see the design-audit report in ~/.gstack for details.

**Final Design Sprint complete.** All 7 sections above shipped as 7 commits,
each verified in-browser (desktop + 400px mobile) with build/lint clean; new landing
strings translated into all 5 locales. Production verification after deploy (see that
session's report).

**Phase G accuracy round complete.** All 4 improvements above (auto-import
match stats, benchmark calibration, test protocol guides, recent-objective-test
confidence gate) implemented as 4 commits (migrations `AddMatchStatAutoImport`,
`AddBenchmarkProfiles`, `AddTestProtocols`, `AddConfidenceTracking` auto-applied on
Railway; `BenchmarkProfileSeeder` + protocol backfill run on boot), 80/80 backend
tests, `npm run build` + `oxlint` clean. Verified locally: rating a match auto-creates
evidence entries + instant recalc (Passing 85%→8.8), the 4.1s-sprint calibration triple
(7.0/3.0/10.0), protocol backfill across all 5 sports, checklist PDF (11KB
application/pdf blob), expired-test cap (70d test + coach eval → Medium w/ amber banner
+ ExpiredTests reminder; fresh test → High restored). **Production verification run
after deploy (see that session's report).**

**Phase G — Evidence-Based Assessment System complete.** All 5 sections above
(data model + scoring engine, evidence collection UI, AI integration, reporting & trends,
mobile UX & quick entry) are implemented, pushed to `main` as 5 commits (migration
`AddEvidenceBasedAssessments` auto-applied on Railway; `MetricDefinitionSeeder` seeds 54
metrics on boot), 73/73 backend tests passing (39 new), `npm run build` + `oxlint` clean
throughout. Verified locally section by section — curl: normalization anchors both
directions, weight redistribution (0.4/0.2 → 0.667/0.333), confidence ladder incl.
IsObjectiveRequired override, one match-stat entry fanning into 4 metrics, full 11-metric
recalc in 72ms, slider assessment auto-creating coach evaluations, athlete 403 on
coach-evals / 201 on own self-assessment, team evidence-status counts, reminders
empty→populated after backdating; real-AI: evidence analysis (goalkeeper-specific test
battery), task suggestions ranking evidence weak areas with confidence labels, insights
citing measured values (10.5km, 78% pass accuracy, 4.0s sprint) + weak-evidence insight.
Browser-verified as coach + athlete: evidence panel under sliders (test → 8.0 Low →
guided questions → 7.9 High 67/33 → Apply to slider), Evidence tab + breakdown modal,
radar confidence dots + dashed line, report Evidence Quality + hero card, team Evidence
tab callouts, Test Day (3 results saved, callouts refreshed live), quick test from player
card, post-match "Add Player Stats?" stepper, dashboard Evidence Reminders card with
frequency select. All local test data cleaned up. **Production verification run after
deploy (see that session's report).**

**Phase F — League/Tournament Mode + Multi-language complete.** All 4 sections
above (league data model, league UI, i18n infrastructure, language switcher + RTL) are
implemented, pushed to `main` as 4 commits (migration `AddLeagueTournament` auto-applied
on Railway), 34/34 backend tests passing, `npm run build` + `oxlint` clean. Verified
locally via curl: 4-team round-robin → 6 correct matchups, standings math exact (City FC
3W GD+5 9pts WWW, Points→GD→GF tiebreak, accurate Form), knockout 2 teams → 1 match,
sport-awareness (soccer=Goals, volleyball=Sets), cross-sport registration 400, pending→
approve flow, non-organizer 403. Browser-verified: league detail 4 tabs (standings with
form pills + medal rows, fixtures by round, teams approved, rules), leagues listing with
organizer crown; i18n — sidebar/login/landing translated, language switcher (5 languages)
in navbar + landing, switching to Hebrew/Arabic flips the whole app to RTL instantly
(sidebar on the right, mirrored back-arrows, RTL fonts) with no reload, English restores
LTR cleanly, ProTracker stays English. **Production verification run after deploy (see
below).** All local test data cleaned up.

**Phase E — Coach Discovery Marketplace complete.** All 5 sections above
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
