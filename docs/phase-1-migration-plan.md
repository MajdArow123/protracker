# ProTracker Phase 1 — MVC → Web API + React Migration Plan

Status: planning only — no code changed.

## 0. Current State Summary

**Stack:** ASP.NET Core MVC (net9.0), EF Core 9 + SQLite, ASP.NET Core Identity (`AddDefaultIdentity`) with Roles, Razor Views + Bootstrap, deployed to Railway.

**Domain model:**
- `ApplicationUser : IdentityUser` — adds `DisplayName`. Roles: `Coach`, `Athlete` (seeded at startup in `Program.cs`).
- `TrainingPlan` — `Title`, `Goal`, `StartDate`, `EndDate`, `CoachId`, `AthleteId` (both FK to `AspNetUsers.Id`, no navigation properties to `ApplicationUser`), `Tasks` (one-to-many).
- `TaskItem` — `Title`, `Description`, `Status` (enum: `NotStarted`/`InProgress`/`Completed`), `DueDate`, `TrainingPlanId` + navigation.
- No `DbSet` indexes/constraints beyond the FK on `TaskItems.TrainingPlanId`. No unique constraints, no soft delete, no audit columns (created/updated timestamps).

**Controllers (all return Views, all use `_context` directly — no service/repository layer):**
- `HomeController` — `Index` (public landing), `Dashboard` (role-dispatch to Coach/Athlete dashboard, duplicated logic also present in `DashboardController`), `Privacy`, `Error`.
- `DashboardController` — `[Authorize]`, role-gated `CoachDashboard`/`AthleteDashboard`, `Index` redirects to `HomeController.Dashboard`.
- `CoachController` — `[Authorize(Roles="Coach")]`, `AthleteProgress(athleteId)`.
- `TrainingPlansController` — `[Authorize]`, full CRUD restricted by ownership (`CoachId == userId`), `Edit`/`Create` populate athlete `SelectList` via `UserManager.GetUsersInRoleAsync`.
- `TaskItemsController` — `[Authorize]`, CRUD scoped to plan ownership, plus `ToggleStatus` (coach or athlete can cycle status).

**Notable existing issues to carry into the rewrite, not fix silently:**
- `HomeController.Dashboard()` and `DashboardController` duplicate the coach/athlete dashboard logic independently (different ViewBag shapes, different views). This duplication should collapse into one set of API endpoints in Phase 1, not be preserved.
- `Views/Home/AthleteDashboard.cshtml` / `CoachDashboard.cshtml` and `Views/Dashboard/AthleteDashboard.cshtml` / `CoachDashboard.cshtml` are four separate, divergent view files for what's conceptually two screens.
- `TrainingPlan.CoachId`/`AthleteId` have no EF navigation property to `ApplicationUser`, so every controller hand-rolls a `UserManager.FindByIdAsync` + display-name fallback loop. This is exactly the kind of join a Web API + React model layer should do once, server-side, via a DTO.
- `TaskItemsController.Index/Create(GET)` checks plan ownership against `CoachId` only — an athlete cannot list/create tasks for their own plan via this controller (inconsistent with `Details`/`ToggleStatus`, which allow both).
- `RegisterModel.OnPostAsync` trusts a client-submitted `Input.Role` string (`"Coach"` or default `"Athlete"`) with no server-side restriction on who can register as Coach. This is a self-service privilege selection — acceptable for a hobby app, but worth a conscious decision when redesigning auth for the API (see Risk Register).

## 1. Architecture Document

### Target shape
```
ProTracker.Api/        ASP.NET Core Web API (replaces MVC controllers + Identity UI pages)
ProTracker.Api/Data/        EF Core DbContext + migrations (kept, see Database Review)
ProTracker.Api/Models/      Entities (kept largely as-is)
ProTracker.Api/Dtos/        Request/response DTOs (new — replaces ViewBag/View(model) coupling)
ProTracker.Api/Controllers/ [ApiController] endpoints, return Ok()/typed results, no Views
ProTracker.Api/Auth/        JWT issuance, Identity wiring, role policies

protracker-client/          React + Vite SPA (new)
protracker-client/src/api/       typed fetch/axios client
protracker-client/src/features/  coach/, athlete/, auth/ — route-aligned feature folders
protracker-client/src/components/ shared UI
```

### Key architectural decisions
1. **Identity stays server-side**, but the UI moves from Razor Pages (`Areas/Identity`) to API endpoints (`POST /api/auth/register`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`). ASP.NET Core Identity's `SignInManager`/`UserManager` remain; only the transport changes from cookie-auth-redirect-to-Razor-Page to **JSON + bearer token** (or cookie — see Auth Flow Spec for the tradeoff).
2. **Controllers become thin**: ownership checks (`CoachId == userId`) and shaping (display names, completion %) move out of controllers into a small service layer (`ITrainingPlanService`, `IDashboardService`) so the same logic isn't duplicated the way `HomeController`/`DashboardController` duplicate it today. This is the one structural change Phase 1 should make opportunistically while touching every controller anyway.
3. **DTOs replace ViewBag.** Every `ViewBag.AthleteNames`, `ViewBag.TrainingPlanId`, etc. becomes an explicit field on a response DTO (e.g. `TrainingPlanDto { Id, Title, Goal, StartDate, EndDate, Athlete: { Id, DisplayName }, Tasks: [...] }`).
4. **CORS** must be configured for the Vite dev server origin (`http://localhost:5173`) and the eventual production SPA origin.
5. **Static file hosting**: decide whether the API also serves the built SPA (`wwwroot` from Vite build, single Railway deployment) or whether SPA and API deploy separately. Recommendation: keep single-deployment-on-Railway simplicity — API serves the built `dist/` as static files in production, Vite dev server proxies `/api` in development. This avoids introducing a second hosting target in Phase 1.
6. **Validation**: `[Required]` data annotations on entities currently double as both EF constraints and MVC model validation. In a Web API, keep them for EF, but add explicit request DTOs with their own validation (don't bind raw entities from the request body — `TrainingPlansController.Create(TrainingPlan trainingPlan)` binding a full entity from the client is a pattern to retire, not carry forward, since it lets a client set `TrainingPlanId` or rely on `ModelState.Remove` hacks for `CoachId`).

## 2. Migration Checklist

**Backend**
- [ ] Add `Microsoft.AspNetCore.Authentication.JwtBearer` (or decide on cookie-based SPA auth — see Auth Flow Spec) and wire token issuance.
- [ ] Replace `AddControllersWithViews()` with `AddControllers()`; remove `AddRazorPages()`/`MapRazorPages()` once Identity UI is replaced by API endpoints.
- [ ] Create `AuthController`: `POST /register`, `POST /login`, `POST /logout`, `GET /me`. Port `RegisterModel.OnPostAsync` logic (role assignment, `DisplayName` set) — decide and enforce who can self-register as Coach (see Risks).
- [ ] Create `TrainingPlansController` (API): list/detail/create/edit/delete, same ownership rules, returning DTOs.
- [ ] Create `TaskItemsController` (API): CRUD + `PATCH /tasks/{id}/status`, fix the athlete-can't-list-tasks-for-own-plan gap noted above as part of the rewrite (decide intentionally, don't carry the bug forward silently).
- [ ] Create `DashboardController` (API): single `GET /dashboard` endpoint that returns role-appropriate shape, consolidating the `HomeController`/`DashboardController` duplication into one code path.
- [ ] Introduce DTOs for all request/response payloads; stop binding raw entities in `[HttpPost]` actions.
- [ ] Add a thin service layer for ownership checks + display-name resolution, used by all controllers above.
- [ ] Configure CORS for the Vite origin.
- [ ] Remove `Areas/Identity` Razor pages, `Views/`, `wwwroot/lib/*` (bootstrap/jquery), `_ViewImports.cshtml`, `_ViewStart.cshtml` — only after the React equivalents exist and are verified.
- [ ] Update `Program.cs`: drop `UseMigrationsEndPoint`/cookie redirect events tied to Razor Identity UI paths; keep `db.Database.Migrate()` + role-seeding.
- [ ] Move the SMTP credential out of `appsettings.Development.json` into user-secrets / environment variables (see Risk Register — this is currently a committed plaintext secret, unrelated to but uncovered during this audit).

**Frontend**
- [ ] Scaffold Vite + React + TypeScript app (`protracker-client/`).
- [ ] Routing: `/`, `/login`, `/register`, `/dashboard` (role-dispatched), `/plans`, `/plans/:id`, `/plans/:id/tasks`, `/coach/athletes/:athleteId/progress`.
- [ ] Auth state: token storage strategy + axios/fetch interceptor, route guards mirroring `[Authorize]`/`[Authorize(Roles=...)]`.
- [ ] Port each Razor view's data shape to a React page/component 1:1 first (no redesign in Phase 1 — visual redesign is a separate phase):
  - `Home/Index` → landing page
  - `Dashboard/CoachDashboard` + `Home/CoachDashboard` (reconciled into one) → Coach dashboard page
  - `Dashboard/AthleteDashboard` + `Home/AthleteDashboard` (reconciled into one) → Athlete dashboard page
  - `Coach/AthleteProgress` → athlete progress page
  - `TrainingPlans/Index|Details|Create|Edit|Delete` → plans list/detail/form/delete-confirm
  - `TaskItems/Index|Create|Edit|Delete` → tasks list/form/delete-confirm
- [ ] Replace anti-forgery-token form posts with API calls (CSRF strategy depends on auth choice — see Auth Flow Spec).

**Cutover**
- [ ] Run MVC and API+React side by side against the same SQLite DB during development (no schema changes required for Phase 1 — see Database Review).
- [ ] Manual regression pass per role (Coach, Athlete) covering every checklist item above before deleting any Razor/View code.
- [ ] Decide and execute deployment change on Railway (single Node+API image vs. two services).

## 3. Folder Structure Plan

```
ProTracker/                          (existing repo root — becomes API-only)
├── Controllers/                     API controllers only (no Views returned)
├── Dtos/                            new
├── Services/                        new — ownership checks, dashboard aggregation
├── Models/                          unchanged (TrainingPlan, TaskItem, ApplicationUser)
├── Data/                            unchanged (DbContext, Migrations)
├── Auth/                            new — JWT/cookie issuance helpers
├── Program.cs
├── ProTracker.csproj
└── (Areas/, Views/, wwwroot/lib/* removed once React app covers all screens)

protracker-client/                   new, sibling directory at repo root
├── src/
│   ├── api/                         typed client (one module per resource: auth, plans, tasks, dashboard)
│   ├── features/
│   │   ├── auth/                    Login, Register pages + auth context
│   │   ├── dashboard/                Coach/Athlete dashboard pages
│   │   ├── plans/                   list/detail/create/edit/delete
│   │   └── tasks/                    list/create/edit/delete, status toggle
│   ├── components/                  shared (NavBar, ProgressBar, layout)
│   ├── routes/                      route guards by role
│   └── main.tsx
├── index.html
├── vite.config.ts
└── package.json
```

`ProTracker.csproj`'s `wwwroot` reference can later be repointed at `protracker-client/dist` for single-deployment serving, decided at cutover time, not now.

## 4. Database Review

- **No schema changes are required to move from MVC to Web API + React** — the API will speak the same EF Core model. This is purely a transport-layer migration in Phase 1.
- Schema as-is (SQLite, 3 migrations: `CreateIdentitySchema`, `AddPlansAndTasks`, `AddDisplayName`):
  - `AspNetUsers` (Identity) + `DisplayName` column, `AspNetRoles`/`AspNetUserRoles` etc.
  - `TrainingPlans(TrainingPlanId PK, Title, Goal, StartDate, EndDate, CoachId, AthleteId)` — `CoachId`/`AthleteId` are plain `TEXT` columns, **not FK-constrained** to `AspNetUsers.Id`. Referential integrity is enforced only in application code.
  - `TaskItems(TaskItemId PK, Title, Description, Status, DueDate, TrainingPlanId FK→TrainingPlans, cascade delete)`, indexed on `TrainingPlanId`.
- **Gaps worth flagging (not fixing in Phase 1, but worth a decision):**
  - Missing FK constraints `TrainingPlans.CoachId/AthleteId → AspNetUsers.Id` — currently relies on app code never inserting a bad ID. Low risk given small surface, but should become a `Models.TrainingPlan` migration once the API stabilizes.
  - No navigation properties from `TrainingPlan` to `ApplicationUser` (Coach/Athlete) — every read path re-queries `UserManager` per ID. A DTO/service layer (see Architecture) can paper over this without a migration, but adding the navigation properties would simplify EF queries (`Include(p => p.Coach)`) at the cost of a migration + circular-reference handling in JSON serialization.
  - No timestamps (`CreatedAt`/`UpdatedAt`) on `TrainingPlan`/`TaskItem` — fine for now, mention if audit/history features are ever planned.
  - SQLite is fine for continued single-instance Railway deployment; not a blocker for this phase. Revisit only if concurrent-write contention becomes a real problem.

## 5. Auth Flow Specification

**Current:** `AddDefaultIdentity<ApplicationUser>` + cookie auth. `ConfigureApplicationCookie` redirects unauthenticated requests to `/Identity/Account/Login` (a Razor Page from the Identity UI package — note only `Register.cshtml` is scaffolded into the repo; Login/Logout/AccessDenied are served from the default UI Razor Class Library, not customized). Roles (`Coach`/`Athlete`) are claims-based via `RoleManager`/`UserManager`, checked with `[Authorize(Roles="...")]` and `User.IsInRole(...)`.

**Target flow for API + SPA — two viable options, pick one explicitly before implementation:**

| | Cookie-based (recommended) | JWT bearer |
|---|---|---|
| How | Keep `AddDefaultIdentity` + cookie auth; SPA calls API with `credentials: 'include'`, CORS configured with `AllowCredentials` | Add JWT issuance on login; SPA stores token (memory, not localStorage) and sends `Authorization: Bearer` |
| CSRF | Need `SameSite=Strict/Lax` + anti-forgery token endpoint, since cookies are auto-sent | Not needed — token isn't auto-attached by browser |
| Complexity | Lower — reuses existing Identity cookie pipeline almost as-is | Higher — new token issuance/refresh, expiry handling, revocation story |
| Same-origin assumption | Easiest when API serves the SPA's static files (recommended deployment, see Architecture) | Works fine cross-origin too |

**Recommendation:** cookie-based, since Phase 1's deployment plan already favors the API serving the built SPA from the same origin, making CSRF mitigation (anti-forgery token issued via a `/api/auth/csrf` endpoint, sent back in a header) straightforward and avoiding a token-refresh subsystem this app doesn't otherwise need.

**Endpoints to build (`AuthController`):**
- `POST /api/auth/register` — body: `{ displayName, email, password, role }`. **Decision needed:** today any registrant can choose `role=Coach`. Carry forward as-is for Phase 1 unless told otherwise (this is a behavior change vs. an infra migration), but flag explicitly to the user — see Risk Register.
- `POST /api/auth/login` — body: `{ email, password }`, sets auth cookie, returns `{ id, displayName, role }`.
- `POST /api/auth/logout` — clears cookie.
- `GET /api/auth/me` — returns current user + role, used by SPA on load to restore session.
- Role-gated endpoints keep `[Authorize(Roles = "Coach")]` / `[Authorize(Roles = "Athlete")]` exactly as today — no change to the authorization model, only to how the 401/redirect is surfaced (JSON 401 instead of a redirect to a Razor login page).

## 6. Risk Register

| # | Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|---|
| 1 | **Committed plaintext secret**: `appsettings.Development.json` contains what appears to be a live Gmail SMTP app password (`zvez bhyp ffiv cofq`), and the file shows as modified/tracked in `git status`. If it's in git history, it's exposed to anyone with repo access (including this being a public-looking GitHub repo per the README). | High — credential compromise | Confirmed present | Rotate the Gmail app password immediately; move secret to user-secrets/environment variable; if already pushed to a public remote, treat it as already leaked and rotate regardless of removal from history. **This is independent of the API/React migration — recommend doing it now, not deferring to Phase 1 cleanup.** |
| 2 | Self-service Coach role selection at registration (`RegisterModel`/new `AuthController` would carry this forward) | Medium — any user can grant themselves Coach privileges | Confirmed present, by design today | Explicit decision needed: keep as-is (hobby-app trust model), gate behind invite codes, or require admin approval. Not a migration blocker, but should be a conscious choice, not silently ported. |
| 3 | Dual dashboard logic (`HomeController` vs `DashboardController`) diverges silently over time if only one is fixed during migration | Medium — inconsistent behavior between old/new during cutover | High if not consolidated | Consolidate into one `DashboardService` + one API endpoint as part of Phase 1 (already in Migration Checklist), don't port both paths. |
| 4 | Missing FK constraints on `TrainingPlans.CoachId/AthleteId` | Low today, grows with data volume | Low | Defer fix to a later migration; just don't make it worse (continue validating IDs in service layer). |
| 5 | Auth model change (cookie redirect → JSON API) breaks any client expecting MVC-style redirects, including the Identity UI's own external-login/email-confirmation flows if ever enabled | Medium | Low (external login/email confirm not currently enabled — `RequireConfirmedAccount = false`, no external providers configured) | Confirm no dependency on Identity UI's Razor Pages beyond Register before deleting `Areas/Identity`. |
| 6 | SQLite + concurrent writes under a real Web API + SPA (more concurrent requests than a server-rendered app typically sees) | Low for current scale | Low | No action needed now; revisit if usage grows. |
| 7 | Side-by-side MVC + API running against same `app.db` during migration could cause confusing bugs if migrations are applied inconsistently between the two app instances | Medium | Medium during cutover | Only run one app instance against `app.db` at a time during migration; rely on `Database.Migrate()` idempotency already in `Program.cs`. |

---
**Immediate recommendation before any Phase 1 coding begins:** rotate the SMTP credential in `appsettings.Development.json` (Risk #1) — that's a live exposure independent of this migration and shouldn't wait for the API/React work to land.
