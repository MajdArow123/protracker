import { defineConfig } from '@playwright/test';

// E2E harness (Phase 8 §3): drives the REAL stack — local backend + built frontend —
// against a dedicated throwaway database. Never production, never the prod seed accounts;
// every test registers its own users and creates its own data via the API.
//
// DB selection: E2E_DB_CONN env var. Local default targets the dev Postgres@16 instance
// on port 5544 with a separate `protracker_e2e` database (create once:
//   psql -h 127.0.0.1 -p 5544 -d postgres -c "CREATE DATABASE protracker_e2e;"
// ). CI provides a postgres:16 service container instead. Migrations + baseline seeding
// run automatically on backend startup.
//
// The frontend is REBUILT by the webServer command with VITE_API_URL forced to the local
// backend — a plain `npm run build` bakes in the production Railway URL from
// .env.production, so serving a stale dist could silently hit prod. Never "optimize"
// the build out of that command.

const API_URL = 'http://localhost:8080';
const WEB_PORT = 4173; // vite preview default; already in the backend's CORS allowlist

const DB_CONN =
  process.env.E2E_DB_CONN ??
  'Host=127.0.0.1;Port=5544;Database=protracker_e2e;Username=majdarow';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // shared backend + DB; tests isolate by unique accounts, not by DB
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: `dotnet run --project ../ProTracker.csproj --urls ${API_URL}`,
      url: `${API_URL}/api/health`,
      // Never reuse: a dev backend already on 8080 would be wired to protracker_dev,
      // and tests would silently write there. Port-in-use = hard error, by design.
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        ASPNETCORE_ENVIRONMENT: 'Development',
        ConnectionStrings__DefaultConnection: DB_CONN,
      },
    },
    {
      command: `npm run build && npx vite preview --port ${WEB_PORT} --strictPort`,
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: false,
      timeout: 180_000,
      env: { VITE_API_URL: API_URL },
    },
  ],
});
