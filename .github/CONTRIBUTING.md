# Contributing to ProTracker

Thanks for your interest in improving ProTracker! This guide covers the workflow and conventions.

## Getting set up

Follow the [Getting Started](../README.md#-getting-started) steps in the README to run the backend (ASP.NET Core 9 + PostgreSQL) and frontend (React + Vite) locally.

## Workflow

1. **Fork** the repo and create a branch off `main`:
   ```bash
   git checkout -b feature/short-description
   ```
2. Make your change, keeping commits focused and descriptive.
3. **Verify before pushing:**
   ```bash
   # Frontend — authoritative type-check + build
   cd protracker-client && npm run build && npx oxlint src

   # Backend — build + tests
   cd .. && dotnet build && dotnet test
   ```
4. Open a pull request against `main` and fill in the PR template.

## Conventions

- **Backend** — controllers stay thin; business logic lives in `Services/`. All ownership
  checks go through `IAccessControlService` (never re-implement them). New entities need an EF
  migration (`dotnet ef migrations add <Name>`).
- **Frontend** — API calls in `src/api/`, server state via TanStack Query hooks in `src/hooks/`,
  shared types in `src/types/`. Match the surrounding Tailwind + Framer Motion style.
- **Type-check with `npm run build`**, not `tsc --noEmit -p tsconfig.json` (that root config is a
  no-op solution file).
- Prefer small, reviewable PRs. Include a screenshot for UI changes.

## Reporting bugs

Open an [issue](https://github.com/MajdArow123/protracker/issues) with steps to reproduce,
expected vs. actual behavior, and your environment. Security concerns: please report privately
rather than in a public issue.

## Code of Conduct

Be respectful and constructive. We want ProTracker to be a welcoming project for everyone.
