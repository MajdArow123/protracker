# ProTracker

**Sports performance tracking for coaches and athletes — assessments, AI insights, and nutrition plans in one place.**

[![.NET](https://img.shields.io/badge/.NET-9.0-512BD4?logo=dotnet)](https://dotnet.microsoft.com/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Claude AI](https://img.shields.io/badge/AI-Claude-D97757?logo=anthropic&logoColor=white)](https://anthropic.com/)
[![Backend on Railway](https://img.shields.io/badge/Backend-Railway-0B0D0E?logo=railway)](https://railway.app/)
[![Frontend on Vercel](https://img.shields.io/badge/Frontend-Vercel-000000?logo=vercel)](https://vercel.com/)
[![Tests](https://img.shields.io/badge/tests-34%20passing-brightgreen)](/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

ProTracker is a full-stack sports performance platform for coaches and athletes. Coaches manage multi-sport teams, record player assessments across sport-specific stat categories, and generate AI-powered improvement plans and structured nutrition meal plans for each athlete. Players get a personal dashboard with a live radar chart, progress trends, injury tracking, and AI-generated insights — all behind a JWT-authenticated REST API and a React + TypeScript frontend.

## 🚀 Live Demo

The app is live — create a free account or log in with a seed account to explore both roles instantly:

| Role | Email | Password |
|---|---|---|
| Coach | `coach.basketball@protracker.seed` | `SeedCoach123!` |
| Coach | `coach.soccer@protracker.seed` | `SeedCoach123!` |
| Athlete | `marcus.bell@protracker.seed` | `SeedCoach123!` |
| Athlete | `aisha.torres@protracker.seed` | `SeedCoach123!` |

> Log in as a **Coach** to manage teams, record assessments, and generate AI plans. Log in as an **Athlete** to see your personal dashboard, radar chart, nutrition guidance, and improvement plan.

## ✨ Key Features

- 🏆 **Multi-sport team management** — support for Football, Basketball, Volleyball, Beach Volleyball, and Tennis, each with sport-specific stat categories and position profiles; coaches are locked to a single sport for consistency
- 📊 **Player assessments** — score every stat category per assessment period with gradient-fill sliders and a live overall score ring; history shown as a timeline with trend arrows
- 🧠 **AI-powered improvement plans** — Claude AI generates weekly goals, position-specific drills, skill targets, and motivational notes from the player's latest assessment data
- 🥗 **Structured nutrition meal plans** — AI returns a full day plan with per-meal food items, portions, calories, and macros (protein/carbs/fats); dietary restrictions (allergies, halal, vegan, etc.) are enforced by the AI prompt
- 📈 **Performance reports** — per-player and per-team reports with Recharts Line, Radar, and Bar charts; improvement trends, match performance history, and AI-generated insights
- 🤕 **Injury management** — track injury type, severity, and recovery status; active injuries surface as warnings in team rosters and reports
- 📏 **Unit toggles** — height in cm or ft/in, weight in kg or lb; preference saved to localStorage with auto-conversion
- 🔒 **JWT auth via HttpOnly cookies** — tokens never touch localStorage; role-based access control for Coach and Athlete routes
- 🌗 **Dark / light mode** — full theme toggle persisted across sessions
- ✨ **Framer Motion UI** — page transitions, staggered card entrances, expandable sections, and animated score rings

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Backend framework | ASP.NET Core 9 Web API (C# 13) |
| Database | SQLite (local) / PostgreSQL (production) via Entity Framework Core 9 |
| Auth | JWT Bearer tokens in HttpOnly cookies + refresh token rotation |
| AI | Anthropic Claude API — improvement plans, nutrition guidance, performance insights |
| Backend tests | xUnit + EF Core InMemory (34 tests) |
| Frontend framework | React 19 + Vite + TypeScript (strict) |
| Styling | Tailwind CSS v4 |
| Server state | TanStack Query v5 |
| Routing | React Router v6 |
| Charts | Recharts (Area, Line, Radar, Bar with gradient fills) |
| Animation | Framer Motion |
| Backend hosting | Railway (Docker) |
| Frontend hosting | Vercel |

## 📸 Screenshots

| Sign In | Coach Dashboard |
|---|---|
| ![Sign In](docs/screenshots/login.png) | ![Coach Dashboard](docs/screenshots/coach-dashboard.png) |

| Players List | Player Profile |
|---|---|
| ![Players](docs/screenshots/players.png) | ![Player Profile](docs/screenshots/player-detail.png) |

| Athlete Dashboard — Radar Chart + Progress |
|---|
| ![Athlete Dashboard](docs/screenshots/athlete-dashboard.png) |

## 💻 How to Run Locally

**Prerequisites:** .NET 9 SDK, Node.js 20+, an Anthropic API key

```bash
git clone https://github.com/MajdArow123/ProTracker.git
cd ProTracker
```

Set your Anthropic API key using .NET User Secrets (never stored in source files):

```bash
dotnet user-secrets set "Anthropic:ApiKey" "sk-ant-..."
```

Start the backend API (creates and seeds the SQLite database automatically on first run):

```bash
dotnet restore
dotnet run
# API running at http://localhost:8080
```

Start the React frontend in a second terminal:

```bash
cd protracker-client
npm install
npm run dev
# App running at http://localhost:5173
```

Run the backend test suite:

```bash
cd ..
dotnet test
# 34/34 passing
```

> AI features (improvement plans, nutrition guidance, performance insights) require billing credits on your Anthropic account. Claude Haiku costs roughly $0.00025 per generation.

## ☁️ Deployment

The backend runs on [Railway](https://railway.app), built from the `Dockerfile` in this repo. The React frontend is deployed to [Vercel](https://vercel.com) via the `protracker-client/vercel.json` config.

**Backend (Railway):**
- `DATABASE_URL` injected by Railway switches EF Core automatically from SQLite to PostgreSQL
- `Anthropic__ApiKey` set as a Railway config variable
- Migrations apply automatically on startup
- Health check at `/api/health` keeps the container alive

**Frontend (Vercel):**
- `VITE_API_URL` points at the Railway backend URL
- `vercel.json` rewrites all routes to `index.html` for client-side routing

To deploy your own copy: create a Railway project, add a PostgreSQL service, set `Anthropic__ApiKey`, and point it at this repo — `railway.json` already configures the health check and restart policy. For the frontend, import the `protracker-client` folder into Vercel and set `VITE_API_URL` to your Railway URL.

## License

Released under the [MIT License](LICENSE).

## Author

Majd Arow
