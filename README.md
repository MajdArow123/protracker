# ProTracker

**Sports performance tracking for coaches and athletes — assessments, improvement plans, and nutrition guidance in one place.**

[![.NET](https://img.shields.io/badge/.NET-8.0-512BD4?logo=dotnet)](https://dotnet.microsoft.com/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![SQLite](https://img.shields.io/badge/SQLite-003B57?logo=sqlite&logoColor=white)](https://sqlite.org/)
[![Tests](https://img.shields.io/badge/tests-34%20passing-brightgreen)](/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

ProTracker is a full-stack sports performance platform built for coaches and athletes. Coaches manage teams, record assessments across configurable stat categories per sport, and generate improvement and nutrition plans for each player. Athletes get a personalized dashboard with a radar chart of their latest stats, progress over time, and structured guidance from their coach — all behind a JWT-authenticated REST API with a React frontend.

## 🔑 Seed Accounts

The database seeds automatically on first run. Use any of these to explore both roles:

| Role | Email | Password |
|---|---|---|
| Coach | `coach.basketball@protracker.seed` | `SeedCoach123!` |
| Coach | `coach.soccer@protracker.seed` | `SeedCoach123!` |
| Athlete | `marcus.bell@protracker.seed` | `SeedCoach123!` |
| Athlete | `aisha.torres@protracker.seed` | `SeedCoach123!` |
| Athlete | `james.chen@protracker.seed` | `SeedCoach123!` |

> Log in as a Coach to see the team management and player assessment views. Log in as an Athlete to see the personal dashboard, radar chart, nutrition guidance, and improvement plan.

## ✨ Key Features

- 🏆 **Role-based dashboards** — entirely separate views and navigation for Coach and Athlete roles
- 📊 **Player assessments** — record stat scores per assessment period; Recharts radar and line charts visualize progress
- 📈 **Improvement plans** — weekly goals, drills, position focus, and coach notes (AI-ready structure)
- 🥗 **Nutrition guidance** — dietary preferences, meal suggestions, hydration and recovery tips per player
- 🔒 **JWT auth via HttpOnly cookies** — tokens never touch localStorage; React AuthContext handles role-redirect on login
- 🌗 **Dark / light mode** — full theme toggle, persisted via Tailwind class strategy
- ✨ **Animated UI** — Framer Motion page transitions and sidebar open/close animations
- 🧪 **34 backend integration tests** — full REST API coverage with xUnit and EF Core InMemory

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Backend framework | ASP.NET Core 8 Web API (C# 12) |
| Database | SQLite via Entity Framework Core 8 |
| Auth | JWT Bearer tokens stored in HttpOnly cookies |
| Backend testing | xUnit + EF Core InMemory (34 tests) |
| Frontend framework | React 19 + Vite 8 + TypeScript (strict) |
| Styling | Tailwind CSS v4 |
| Server state | TanStack Query v5 |
| Routing | React Router v6 |
| HTTP client | Axios with `withCredentials: true` |
| Charts | Recharts (Line, Radar, Bar) |
| Animation | Framer Motion |
| Frontend testing | Vitest + React Testing Library |

## 📸 Screenshots

| Login | Coach Dashboard |
|---|---|
| ![Login](docs/screenshots/login.png) | ![Coach Dashboard](docs/screenshots/coach-dashboard.png) |

| Players | Player Profile |
|---|---|
| ![Players](docs/screenshots/players.png) | ![Player Profile](docs/screenshots/player-detail.png) |

| Athlete Dashboard — Radar Chart + Recent Assessments |
|---|
| ![Athlete Dashboard](docs/screenshots/athlete-dashboard.png) |

## 💻 How to Run Locally

**Prerequisites:** .NET 8 SDK, Node.js 20+

```bash
git clone https://github.com/MajdArow123/ProTracker.git
cd ProTracker
```

Start the backend API (seeds the database automatically on first run):

```bash
dotnet restore
dotnet run
# API running at http://localhost:8080
```

Start the React frontend:

```bash
cd protracker-client
npm install
npm run dev
# App running at http://localhost:5173
```

Run the backend test suite:

```bash
dotnet test
# 34/34 passing
```

## License

Released under the [MIT License](LICENSE).

## Author

Majd Arow
