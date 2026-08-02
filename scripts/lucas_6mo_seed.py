#!/usr/bin/env python3
"""Seed a realistic 6-month progression (Feb-Jul 2026) for Lucas Ward (player 5,
City FC U18) on production, via the authenticated REST API wherever the API accepts
backdated dates, plus scoped SQL for the two server-dated tables (wellbeing, journal)
and timestamp fix-ups the API cannot set.

HONESTY CONTRACT (mirrors the approved plan):
  - Raw inputs only; EvidenceBasedScores come from POST /evidence-scores/calculate.
  - Coach-authored rows are written with the coach's token, Lucas-authored rows with
    Lucas's token — provenance fields are server-stamped from the caller.
  - No existing row is modified except: progress/milestones added to Lucas's own four
    active goals (their CurrentValue moves, snapshot kept in the manifest).

Usage:
  python3 scripts/lucas_6mo_seed.py --dry-run     # print write plan + SQL, no writes
  PROD_DB_URL=postgres://... python3 scripts/lucas_6mo_seed.py   # real run

The real run writes scripts/lucas_6mo_seed.manifest.json (input for the teardown).
The dry run writes scripts/lucas_6mo_seed.manifest.projected.json (ids = null).
"""
import argparse
import json
import os
import subprocess
import sys
import urllib.request
import urllib.error
from datetime import date, timedelta

BASE = os.environ.get("PT_BASE", "https://protracker-production.up.railway.app/api")
PASSWORD = os.environ.get("PT_PASSWORD", "SeedCoach123!")
COACH_EMAIL = "coach.soccer@protracker.seed"
LUCAS_EMAIL = "lucas.ward@protracker.seed"
PLAYER_ID = 5
TEAM_ID = 1
SPORT_ID = 1
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# ---------------------------------------------------------------- HTTP helpers

def api(method, path, token=None, body=None):
    req = urllib.request.Request(f"{BASE}{path}", method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    data = json.dumps(body).encode() if body is not None else None
    try:
        with urllib.request.urlopen(req, data=data, timeout=120) as r:
            raw = r.read().decode()
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"{method} {path} -> {e.code}: {e.read().decode()[:400]}") from e
    if not raw:
        return None
    payload = json.loads(raw)
    return payload.get("data") if isinstance(payload, dict) and "data" in payload else payload


def login(email):
    d = api("POST", "/auth/login", body={"email": email, "password": PASSWORD})
    return d["accessToken"], d["user"]

# ---------------------------------------------------------------- date helpers

def iso(y, m, d, hh=10, mm=0):
    return f"2026-{m:02d}-{d:02d}T{hh:02d}:{mm:02d}:00Z" if y == 2026 else f"{y}-{m:02d}-{d:02d}T{hh:02d}:{mm:02d}:00Z"


def q(s):
    """SQL single-quote escape."""
    return s.replace("'", "''")

# ============================================================ THE 6-MONTH ARC
# Injury: hamstring strain Apr 13 -> FullyRecovered May 8. Dips everywhere in between.

# --- 1. Objective tests (coach). Values verified to clear computeTrend gates
#        (slope>=+0.25/30d, R2>=0.3) against the live Semi-Professional anchors,
#        INCLUDING the existing rows they blend with.
OBJECTIVE_TESTS = {
    # metric name -> [(month, day, value, note-or-None)]
    "Speed": [(2, 7, 4.45, "30m sprint - timing gates"), (3, 7, 4.36, None),
              (4, 4, 4.28, None), (4, 25, 4.34, "first sprints since hamstring"),
              (5, 23, 4.18, None), (6, 13, 4.12, None), (7, 25, 4.00, "season best")],
    "Agility": [(2, 7, 5.05, "5-10-5 shuttle"), (3, 7, 4.95, None), (4, 4, 4.85, None),
                (4, 25, 4.95, None), (5, 23, 4.75, None), (6, 13, 4.65, None),
                (7, 18, 4.55, None)],
    "Stamina": [(2, 7, 2650, "yo-yo test"), (3, 7, 2780, None), (4, 4, 2900, None),
                (4, 25, 2750, "return fitness check"), (5, 23, 3000, None),
                (7, 18, 3260, None)],
    "Passing": [(2, 7, 76, "passing gates drill"), (3, 7, 79, None), (4, 4, 82, None),
                (5, 9, 80, None), (5, 30, 85, None), (6, 20, 89, None)],
    "Shooting": [(2, 7, 55, "finishing circuit"), (3, 7, 60, None), (4, 4, 64, None),
                 (5, 9, 60, None), (5, 30, 70, None), (6, 20, 77, None)],
    "Ball Control": [(2, 7, 48, "juggling test"), (3, 7, 55, None), (4, 4, 62, None),
                     (5, 9, 58, None), (5, 30, 70, None), (6, 27, 78, None),
                     (7, 18, 85, None)],
    "Defending": [(2, 14, 50, "1v1 duel drill"), (3, 14, 54, None), (4, 11, 57, None),
                  (5, 16, 56, None), (6, 6, 61, None), (7, 18, 66, None)],
    "Dribbling": [(2, 14, 55, "slalom course"), (3, 14, 58, None), (4, 11, 62, None),
                  (5, 16, 60, None), (6, 6, 66, None), (7, 18, 71, None)],
}

# --- 2. Matches (coach; Lucas-only ratings; auto-import + auto-recalc pipeline)
MATCHES = [
    # (month, day, opponent, isHome, ourScore, oppScore, competition, rating, stats)
    (2, 14, "Riverside United", True, 2, 1, "League", 6.9,
     dict(goals=0, assists=1, shots=2, shotsOnTarget=1, passes=28, passAccuracy=74,
          dribbles=2, tackles=1, interceptions=1, distanceKm=9.8, minutesPlayed=90)),
    (2, 28, "Harbor Town FC", False, 1, 1, "League", 7.1,
     dict(goals=1, assists=0, shots=3, shotsOnTarget=2, passes=26, passAccuracy=76,
          dribbles=3, tackles=1, interceptions=1, distanceKm=10.1, minutesPlayed=90)),
    (3, 14, "Oakfield Rangers", True, 3, 0, "League", 7.6,
     dict(goals=1, assists=1, shots=4, shotsOnTarget=2, passes=31, passAccuracy=79,
          dribbles=4, tackles=1, interceptions=1, distanceKm=10.4, minutesPlayed=90)),
    (3, 28, "Millbrook Athletic", False, 0, 2, "League", 6.8,
     dict(goals=0, assists=0, shots=2, shotsOnTarget=1, passes=24, passAccuracy=72,
          dribbles=2, tackles=2, interceptions=1, distanceKm=10.0, minutesPlayed=90)),
    (4, 11, "Stonebridge FC", True, 2, 2, "League", 7.4,
     dict(goals=1, assists=0, shots=3, shotsOnTarget=2, passes=29, passAccuracy=78,
          dribbles=3, tackles=1, interceptions=1, distanceKm=10.6, minutesPlayed=90)),
    # hamstring Apr 13 -> May 8: no matches
    (5, 16, "Riverside United", False, 1, 0, "Friendly", 7.0,
     dict(goals=0, assists=0, shots=1, shotsOnTarget=1, passes=18, passAccuracy=77,
          dribbles=1, tackles=1, interceptions=1, distanceKm=6.2, minutesPlayed=58)),
    (5, 30, "Harbor Town FC", True, 4, 1, "League", 8.3,
     dict(goals=2, assists=0, shots=5, shotsOnTarget=4, passes=30, passAccuracy=81,
          dribbles=4, tackles=1, interceptions=1, distanceKm=10.9, minutesPlayed=90)),
]

# --- 3. Coach evaluations (direct endpoint; monthly rounds + July gap-fill)
COACH_EVAL_METRICS = ["Speed", "Stamina", "Passing", "Shooting", "Defending",
                      "Ball Control", "Agility", "Tactical Awareness"]
COACH_EVALS = [
    (2, 10, dict(zip(COACH_EVAL_METRICS, [6.0, 6.0, 6.5, 6.5, 5.5, 6.5, 6.0, 6.0])), None),
    (3, 10, dict(zip(COACH_EVAL_METRICS, [6.5, 6.5, 7.0, 7.0, 6.0, 7.0, 6.5, 6.5])), None),
    (4, 24, dict(zip(COACH_EVAL_METRICS, [6.0, 6.0, 7.0, 6.5, 6.0, 7.0, 6.0, 6.5])),
     "Assessed during hamstring rehab - physical scores held down"),
    (5, 20, dict(zip(COACH_EVAL_METRICS, [7.0, 7.0, 7.5, 7.5, 6.5, 7.5, 7.0, 7.0])), None),
    # July: metrics with no slider category, needed in-window for confidence
    (7, 20, {"Dribbling": 7.5, "Positioning": 7.5, "Weak Foot": 6.5}, None),
]

# --- 4. Self-assessments (Lucas)
SELF_METRICS = ["Speed", "Stamina", "Passing", "Shooting", "Agility", "Ball Control"]
SELF_ASSESSMENTS = [
    (2, 12, dict(zip(SELF_METRICS, [5.5, 6.0, 6.0, 6.5, 5.5, 6.0])), None),
    (3, 12, dict(zip(SELF_METRICS, [6.0, 6.5, 6.5, 7.0, 6.0, 6.5])), None),
    (4, 20, {"Stamina": 5.0, "Passing": 6.0, "Shooting": 6.0},
     "Hard to judge myself while injured"),
    (5, 22, dict(zip(SELF_METRICS, [6.5, 6.5, 7.0, 7.0, 6.5, 7.0])), None),
    (6, 22, dict(zip(SELF_METRICS, [7.0, 7.0, 7.5, 7.5, 7.0, 7.5])), None),
    (7, 20, {"Tactical Awareness": 8.0, "Positioning": 7.0, "Weak Foot": 6.0,
             "Dribbling": 7.5, "Defending": 6.5, "Speed": 7.0}, None),
]

# --- 5. Injury + recovery arc
INJURY = dict(playerId=PLAYER_ID, injuryDate=iso(2026, 4, 13), injuryType="Hamstring strain",
              bodyPart="Hamstring", severity="Moderate", recoveryStatus="Active",
              notes="Felt it go on the last sprint of Tuesday training.",
              treatmentPlan="Physio 2x/week, progressive loading, return-to-run protocol.",
              expectedReturnDate=iso(2026, 5, 11))
INJURY_RECOVERED = "2026-05-08T09:00:00Z"
PLAN_CREATED = "2026-04-14T09:00:00Z"
# exercises/milestones completed across the rehab window (SQL re-date, spread evenly)
REHAB_DONE_START = date(2026, 4, 15)
REHAB_DONE_END = date(2026, 5, 6)

# --- 6. Wellbeing (SQL: API cannot backdate). Mon/Wed/Fri + alternate Sat, Feb 2-Jul 3.
def wellbeing_rows():
    rows = []
    d = date(2026, 2, 2)
    sat_toggle = False
    while d <= date(2026, 7, 3):
        take = d.weekday() in (0, 2, 4)
        if d.weekday() == 5:
            sat_toggle = not sat_toggle
            take = sat_toggle
        if take:
            n = d.toordinal()
            if date(2026, 4, 13) <= d <= date(2026, 4, 27):        # acute injury
                f, e, s = 1 + n % 2, 2, 2 + n % 2
                pain = (True, "Hamstring",
                        "Sharp when walking downstairs" if d <= date(2026, 4, 17) else None)
            elif date(2026, 4, 28) <= d <= date(2026, 5, 8):       # late rehab
                f, e, s = 2 + n % 2, 2 + n % 2, 3
                pain = (d <= date(2026, 5, 4), "Hamstring" if d <= date(2026, 5, 4) else None, None)
            elif date(2026, 5, 9) <= d <= date(2026, 5, 22):       # return
                f, e, s = 3, 3 + n % 2, 3 + n % 2
                pain = (False, None, None)
            else:                                                   # normal, mild noise
                f, e, s = 3 + n % 2, 3 + (n // 3) % 2, 3 + n % 3
                pain = (False, None, None)
            note = None
            if d == date(2026, 4, 13):
                note = "Hamstring went in training"
            if d == date(2026, 5, 16):
                note = "First match back today"
            rows.append((d, f, e, s) + pain + (note,))
        d += timedelta(days=1)
    return rows

# --- 7. Journal (SQL). Mood ints: Great=0 Good=1 Okay=2 Tough=3 Rough=4.
MOOD = {"Great": 0, "Good": 1, "Okay": 2, "Tough": 3, "Rough": 4}
JOURNAL = [
    # (month, day, private, mood, energy, trainingRating, content, keyLearning, tomorrowFocus, tags)
    (2, 3, False, "Good", 4, 4, "First week of the new training block. Coach wants more runs in behind.", None, "Time my runs off Dylan's touches", "preseason"),
    (2, 21, False, "Good", 4, None, "Assist against Riverside last week, and the gates drill finally clicked.", "Head up before the first touch", None, None),
    (3, 8, False, "Okay", 3, 3, "Legs heavy all week. Sleep has been bad.", None, "Earlier nights", None),
    (3, 25, False, "Good", 4, 4, "Best month so far. Passing test numbers keep climbing.", None, None, None),
    (4, 14, True, "Rough", 2, None, "Hamstring went on the last sprint yesterday. Scan on Monday. Gutted.", None, None, "injury"),
    (4, 22, True, "Tough", 2, None, "Rehab is boring and I hate watching from the side. Physio says week 4 if I do the work. Trusting the plan.", "Do the boring work", None, "rehab"),
    (5, 2, False, "Okay", 3, None, "Ran pain-free today for the first time in three weeks.", None, "Keep to the return-to-run plan", "rehab"),
    (5, 17, False, "Good", 4, 3, "58 minutes back at Riverside. Legs felt fine, timing was off.", "Match sharpness only comes from matches", None, "comeback"),
    (5, 31, False, "Great", 5, 5, "Two goals against Harbor Town. Best I have felt all season.", None, None, None),
    (6, 10, False, "Good", 4, 4, "New assessment block started. Coach says the numbers back up the eye test.", None, None, None),
    (6, 21, False, "Good", 4, 4, "Passing and shooting tests both season-bests this week.", None, None, None),
    (7, 1, False, "Good", 4, 3, "Solid month. Want the sprint time under 4.05 before August.", None, "Sprint mechanics session", None),
]

# --- 8. Goals
GOAL_A = dict(playerId=PLAYER_ID, title="Come back stronger from the hamstring strain",
              description="Complete every rehab session, return pain-free, and win my place back.",
              category="Fitness", targetValue=100, currentValue=0, unit="%",
              startDate=iso(2026, 4, 14), targetDate=iso(2026, 5, 15), priority="High",
              isPrivate=False,
              milestones=[{"title": "Jog 20 minutes pain-free", "targetValue": None, "targetDate": iso(2026, 4, 28)},
                          {"title": "Full sprints with the group", "targetValue": None, "targetDate": iso(2026, 5, 8)},
                          {"title": "First match minutes", "targetValue": None, "targetDate": iso(2026, 5, 16)}])
GOAL_A_PROGRESS = [(iso(2026, 4, 20), 25, "Week 1 rehab done, isometrics pain-free"),
                   (iso(2026, 4, 28), 50, "Jogged 20 min, no reaction next morning"),
                   (iso(2026, 5, 6), 75, "Full training with the group"),
                   (iso(2026, 5, 12), 100, "Started and finished the comeback friendly plan")]
GOAL_A_MILESTONE_DATES = ["2026-04-28T18:00:00Z", "2026-05-06T18:00:00Z", "2026-05-16T21:00:00Z"]
GOAL_A_ACHIEVED = "2026-05-12T18:00:00Z"
GOAL_A_CREATED = "2026-04-14T18:00:00Z"

GOAL_B = dict(playerId=PLAYER_ID, title="Break 4.05s on the 30m sprint",
              description="Get the timed 30m under 4.05 seconds by mid-season.",
              category="Fitness", targetValue=4.05, currentValue=4.45, unit="seconds",
              startDate=iso(2026, 2, 10), targetDate=iso(2026, 6, 30), priority="Medium",
              isPrivate=False,
              milestones=[{"title": "Consistently under 4.20", "targetValue": None, "targetDate": iso(2026, 5, 31)},
                          {"title": "Timed run at 4.05 or better", "targetValue": None, "targetDate": iso(2026, 6, 30)}])
GOAL_B_PROGRESS = [(iso(2026, 3, 7), 4.36, "Monthly gates test"),
                   (iso(2026, 4, 4), 4.28, "Monthly gates test"),
                   (iso(2026, 5, 23), 4.18, "First timed run after the hamstring"),
                   (iso(2026, 6, 13), 4.12, None),
                   (iso(2026, 7, 11), 4.05, "Matched the target in testing")]
GOAL_B_MILESTONE_DATES = ["2026-05-23T18:00:00Z", "2026-07-11T18:00:00Z"]
GOAL_B_ACHIEVED = "2026-07-11T18:00:00Z"
GOAL_B_CREATED = "2026-02-10T18:00:00Z"

# Existing four active goals (matched by title): add milestones + July progress.
EXISTING_GOAL_ADDONS = {
    "Enhance Shooting Conversion to 9.5": dict(
        milestones=[("Hit 8.5 in an assessment", True, "2026-07-15T18:00:00Z"),
                    ("Shooting test above 85%", False, None)],
        progress=[(iso(2026, 7, 18), 8.2, "Finishing circuit 77% - trending up"),
                  (iso(2026, 7, 28), 8.4, None)]),
    "Advance Passing Accuracy to 9.5": dict(
        milestones=[("90%+ in a passing test", True, "2026-07-18T18:00:00Z")],
        progress=[(iso(2026, 7, 18), 8.3, None), (iso(2026, 7, 30), 8.5, None)]),
    "Optimize Agility and Change of Direction to 9.5": dict(
        milestones=[("Sub-4.6s shuttle", True, "2026-07-18T18:00:00Z"),
                    ("Sub-4.5s shuttle", False, None)],
        progress=[(iso(2026, 7, 20), 8.2, "Shuttle down to 4.55")]),
    "Elevate Match Performance to 9.0": dict(
        milestones=[("Match rating 8.5+", False, None)],
        progress=[(iso(2026, 7, 12), 7.5, "8.6 rating vs Northern FC")]),
}

# --- 9. Tasks (create as coach, complete as Lucas, SQL re-date Created/CompletedAt)
TASKS = [
    # (title, category, priority, due(m,d), completed?, completedNote)
    ("Finishing drills: 50 shots after training", "Training", "Medium", (2, 20), True, "Felt sharp by the end of the week"),
    ("Watch derby footage and note pressing triggers", "Tactical", "Medium", (3, 5), True, None),
    ("Gym: lower-body strength block", "Physical", "High", (3, 19), True, "New PB on single-leg press"),
    ("Book hamstring physio assessment", "Recovery", "High", (4, 16), True, "Booked for Thursday"),
    ("Daily rehab band routine - week 1", "Recovery", "High", (4, 24), True, "No pain by Friday"),
    ("Daily rehab band routine - week 2", "Recovery", "High", (5, 1), True, None),
    ("Return-to-run progression with physio", "Recovery", "High", (5, 8), True, "Cleared for team training"),
    ("First-touch wall work, 15 min daily", "Training", "Medium", (5, 28), True, None),
    ("Weak-foot finishing session", "Training", "Medium", (6, 11), False, None),
    ("Sprint mechanics video review with coach", "Physical", "Low", (6, 24), True, None),
]

# --- 10. Training attendance (coach; Tue/Fri Feb 3 - Jun 12; per-player rows only)
def training_rows():
    rows = []
    d = date(2026, 2, 3)
    while d <= date(2026, 6, 12):
        if d.weekday() in (1, 4):
            status = "Present"
            if d == date(2026, 2, 27):
                status = "Absent"        # illness
            elif d == date(2026, 3, 17):
                status = "Late"
            elif date(2026, 4, 14) <= d <= date(2026, 4, 24):
                status = "Excused"       # acute injury phase
            rows.append((d, status))
        d += timedelta(days=1)
    return rows

# --- 11. Nutrition profile items (Lucas)
NUTRITION_ITEMS = [
    dict(preferenceType="SoftPreference", category="Custom",
         specificItem="High-protein breakfast options", severity="Soft",
         notes="Trying to hit 30g protein before morning sessions"),
    dict(preferenceType="Lifestyle", category="Custom",
         specificItem="No caffeine after 6pm", severity="Lifestyle", notes=None),
]

# Post-seed confidence targets (asserted after recalc)
CONFIDENCE_TARGETS = {
    "Passing": "VeryHigh", "Shooting": "VeryHigh", "Stamina": "VeryHigh",
    "Dribbling": "VeryHigh", "Defending": "VeryHigh",
    "Speed": "High", "Agility": "High", "Ball Control": "High",
    "Tactical Awareness": "High", "Positioning": "High", "Weak Foot": "High",
}
TREND_METRICS = list(OBJECTIVE_TESTS.keys())

# ================================================================ execution

class Runner:
    def __init__(self, dry):
        self.dry = dry
        self.plan_lines = []
        self.sql_literal = []      # fully-literal SQL, runnable as-is
        self.sql_templated = []    # SQL with {placeholders} resolved from created ids
        self.manifest = {"seededAt": None, "playerId": PLAYER_ID, "baseline": {},
                         "created": {}, "sql": {}}
        self.coach_token = None
        self.lucas_token = None
        self.lucas_user_id = None

    def note(self, line):
        self.plan_lines.append(line)
        print(line)

    def do(self, actor, method, path, body, natural_key, skip):
        """Plan (dry) or execute (real) one API write. Returns response data or None."""
        tag = "SKIP(exists)" if skip else ("PLAN" if self.dry else "WRITE")
        self.note(f"  [{tag}] {actor} {method} {path}  «{natural_key}»")
        if skip or self.dry:
            return None
        token = self.coach_token if actor == "coach" else self.lucas_token
        return api(method, path, token, body)

    # -------------------------------------------------- phases (see plan doc)
    def run(self):
        self.login_and_reference()
        self.snapshot_baseline()
        self.phase_objective_tests()
        self.phase_matches()
        self.phase_coach_evals()
        self.phase_injury()
        self.phase_tasks()
        self.phase_training()
        self.relogin()
        self.phase_self_assessments()
        self.phase_goals()
        self.phase_nutrition_items()
        self.build_sql()
        if not self.dry:
            self.run_sql()
        self.phase_ai_plan()
        self.finalize()

    def login_and_reference(self):
        self.coach_token, _ = login(COACH_EMAIL)
        self.lucas_token, lucas = login(LUCAS_EMAIL)
        self.lucas_user_id = lucas["id"]
        metrics = api("GET", f"/sport-metrics/{SPORT_ID}", self.coach_token)
        self.metric_id = {m["name"]: m["id"] for m in metrics}
        self.metric_unit = {m["name"]: m.get("unit") for m in metrics}
        missing = [n for n in set(list(OBJECTIVE_TESTS) + COACH_EVAL_METRICS +
                                  [k for _, _, r, _ in SELF_ASSESSMENTS for k in r])
                   if n not in self.metric_id]
        if missing:
            raise SystemExit(f"metric names not found on server: {missing}")

    def relogin(self):
        """Access tokens live 15 min; refresh both before the athlete phase."""
        if not self.dry:
            self.coach_token, _ = login(COACH_EMAIL)
            self.lucas_token, _ = login(LUCAS_EMAIL)

    def snapshot_baseline(self):
        g = lambda p: api("GET", p, self.coach_token)
        scores = g(f"/players/{PLAYER_ID}/evidence-scores")
        self.baseline_goal_values = {x["title"]: x["currentValue"]
                                     for x in g(f"/players/{PLAYER_ID}/goals")}
        self.manifest["baseline"] = {
            "objectiveTests": len(g(f"/players/{PLAYER_ID}/objective-tests")),
            "matchStats": len(g(f"/players/{PLAYER_ID}/match-stats")),
            "coachEvals": len(g(f"/players/{PLAYER_ID}/coach-evaluations")),
            "selfAssessments": len(g(f"/players/{PLAYER_ID}/self-assessments")),
            "evidenceScores": {s["metricName"]: s["confidence"] for s in scores},
            "wellbeing": len(g(f"/players/{PLAYER_ID}/wellbeing")["checkins"]),
            "goals": len(self.baseline_goal_values),
            "goalCurrentValues": self.baseline_goal_values,
            "matches": len(g(f"/teams/{TEAM_ID}/matches")),
            "injuries": len(g(f"/injury-records/player/{PLAYER_ID}")),
            "tasks": len(g(f"/tasks?playerId={PLAYER_ID}")),
            "trainingSessions": len(g(f"/training-sessions/player/{PLAYER_ID}")),
            "nutritionItems": len(g(f"/nutrition-profile/player/{PLAYER_ID}")),
        }
        self.note(f"baseline counts: { {k: v for k, v in self.manifest['baseline'].items() if isinstance(v, int)} }")

    def phase_objective_tests(self):
        self.note("\n== PHASE 1: objective tests (coach) ==")
        existing = api("GET", f"/players/{PLAYER_ID}/objective-tests", self.coach_token)
        have = {(t["metricDefinitionId"], t["testedAt"][:10]) for t in existing}
        out = []
        for metric, series in OBJECTIVE_TESTS.items():
            mid = self.metric_id[metric]
            for m, d, val, note in series:
                key = (mid, f"2026-{m:02d}-{d:02d}")
                body = dict(playerId=PLAYER_ID, metricDefinitionId=mid, value=val,
                            unit=self.metric_unit[metric], notes=note,
                            testedAt=iso(2026, m, d))
                r = self.do("coach", "POST", "/objective-tests", body,
                            f"{metric} {key[1]} = {val}", key in have)
                out.append({"id": r["id"] if r else None, "metric": metric,
                            "testedAt": key[1], "value": val})
        self.manifest["created"]["objectiveTests"] = out

    def phase_matches(self):
        self.note("\n== PHASE 2: matches + Lucas-only ratings (coach) ==")
        existing = api("GET", f"/teams/{TEAM_ID}/matches", self.coach_token)
        have = {(x["matchDate"][:10], x["opponentName"]) for x in existing}
        out = []
        for m, d, opp, home, us, them, comp, rating, stats in MATCHES:
            key = (f"2026-{m:02d}-{d:02d}", opp)
            body = dict(opponentName=opp, matchDate=iso(2026, m, d, 15), isHome=home,
                        homeScore=us if home else them, awayScore=them if home else us,
                        competition=comp, venue=None, notes=None)
            r = self.do("coach", "POST", f"/teams/{TEAM_ID}/matches", body,
                        f"{key[0]} vs {opp} ({'W' if us > them else 'D' if us == them else 'L'})",
                        key in have)
            match_id = r["id"] if r else None
            if match_id is not None:
                self.do("coach", "POST", f"/matches/{match_id}/ratings",
                        {"ratings": [dict(playerId=PLAYER_ID, rating=rating,
                                          statJson=json.dumps(stats),
                                          goals=stats["goals"], assists=stats["assists"],
                                          yellowCards=0, redCards=0,
                                          minutesPlayed=stats["minutesPlayed"], notes=None)]},
                        f"rating {rating} for Lucas (auto-import + recalc)", False)
            elif not self.dry:
                self.note("    (match existed; ratings left untouched)")
            else:
                self.do("coach", "POST", "/matches/{new}/ratings", None,
                        f"rating {rating} for Lucas (auto-import + recalc)", key in have)
            out.append({"id": match_id, "date": key[0], "opponent": opp})
        self.manifest["created"]["matches"] = out

    def phase_coach_evals(self):
        self.note("\n== PHASE 3: coach evaluations (coach, direct endpoint) ==")
        existing = api("GET", f"/players/{PLAYER_ID}/coach-evaluations", self.coach_token)
        have = {(e["metricDefinitionId"], e["evalDate"][:10]) for e in existing}
        out = []
        for m, d, ratings, note in COACH_EVALS:
            for metric, val in ratings.items():
                mid = self.metric_id[metric]
                key = (mid, f"2026-{m:02d}-{d:02d}")
                r = self.do("coach", "POST", "/coach-evaluations",
                            dict(playerId=PLAYER_ID, metricDefinitionId=mid, rating=val,
                                 evalDate=iso(2026, m, d), notes=note),
                            f"{metric} {key[1]} = {val}", key in have)
                out.append({"id": r["id"] if r else None, "metric": metric, "date": key[1]})
        self.manifest["created"]["coachEvals"] = out

    def phase_injury(self):
        self.note("\n== PHASE 4: injury + recovery arc (coach) ==")
        existing = api("GET", f"/injury-records/player/{PLAYER_ID}", self.coach_token)
        prior = next((x for x in existing if x["injuryDate"][:10] == "2026-04-13"
                      and x["injuryType"] == "Hamstring strain"), None)
        r = self.do("coach", "POST", "/injury-records", INJURY,
                    "Hamstring strain 2026-04-13 -> recovered 2026-05-08", prior is not None)
        injury_id = (r or prior or {}).get("id")
        self.manifest["created"]["injury"] = {"id": injury_id}
        if self.dry:
            self.do("coach", "POST", "/injuries/{new}/recovery-plan/from-template/{hamstring}",
                    None, "plan from 'Hamstring Strain' template (4w)", False)
            self.do("coach", "PATCH", "/recovery-exercises/{each}/complete", None,
                    "complete every exercise (SQL re-dates spread Apr 15-May 6)", False)
            self.do("coach", "PATCH", "/recovery-milestones/{each}/achieve", None,
                    "achieve every milestone (SQL re-dates)", False)
            self.do("coach", "PUT", "/recovery-plans/{new}", None,
                    "currentWeek=4 status=Completed", False)
            self.do("coach", "PATCH", "/injuries/{new}/recover", None,
                    "FullyRecovered (SQL re-dates RecoveredDate -> 2026-05-08)", False)
            return
        templates = api("GET", "/recovery-templates", self.coach_token)
        tpl = next(t for t in templates if "Hamstring" in t["name"])
        try:
            plan = api("POST", f"/injuries/{injury_id}/recovery-plan/from-template/{tpl['id']}",
                       self.coach_token, {})
        except RuntimeError as e:
            if "already exists" not in str(e):
                raise
            plan = api("GET", f"/injuries/{injury_id}/recovery-plan", self.coach_token)
        plan = api("GET", f"/injuries/{injury_id}/recovery-plan", self.coach_token)
        ex_ids, ms_ids = [], []
        for ex in plan.get("exercises", []):
            if not ex.get("isCompleted"):
                api("PATCH", f"/recovery-exercises/{ex['id']}/complete", self.coach_token, {})
            ex_ids.append(ex["id"])
        for ms in plan.get("milestones", []) or []:
            if not ms.get("isAchieved"):
                api("PATCH", f"/recovery-milestones/{ms['id']}/achieve", self.coach_token, {})
            ms_ids.append(ms["id"])
        api("PUT", f"/recovery-plans/{plan['id']}", self.coach_token,
            dict(title=plan["title"], estimatedWeeks=plan["estimatedWeeks"],
                 currentWeek=plan["estimatedWeeks"], status="Completed", notes=plan.get("notes")))
        cur = api("GET", f"/injury-records/player/{PLAYER_ID}", self.coach_token)
        me = next(x for x in cur if x["id"] == injury_id)
        if not me["isRecovered"]:
            api("PATCH", f"/injuries/{injury_id}/recover", self.coach_token, {})
        self.manifest["created"]["injury"].update(
            {"planId": plan["id"], "exerciseIds": ex_ids, "milestoneIds": ms_ids})

    def phase_tasks(self):
        self.note("\n== PHASE 5: tasks (create as coach; Lucas completes) ==")
        existing = api("GET", f"/tasks?playerId={PLAYER_ID}", self.coach_token)
        have = {(t["title"], (t.get("dueDate") or "")[:10]) for t in existing}
        out = []
        for title, cat, prio, (m, d), completed, cnote in TASKS:
            key = (title, f"2026-{m:02d}-{d:02d}")
            body = dict(playerId=PLAYER_ID, title=title, description=None,
                        category=cat, priority=prio, dueDate=iso(2026, m, d))
            r = self.do("coach", "POST", "/tasks", body, f"{key[1]} {title}", key in have)
            tid = r["id"] if r else None
            if completed:
                if tid is not None:
                    api("PATCH", f"/tasks/{tid}/complete", self.lucas_token,
                        {"completedNote": cnote})
                    self.note(f"    lucas PATCH /tasks/{tid}/complete")
                elif self.dry:
                    self.do("lucas", "PATCH", "/tasks/{new}/complete",
                            {"completedNote": cnote}, "complete (SQL re-dates timestamps)", False)
            out.append({"id": tid, "title": title, "due": key[1], "completed": completed,
                        "createdAt": (date(2026, m, d) - timedelta(days=6)).isoformat(),
                        "completedAt": (date(2026, m, d) - timedelta(days=1)).isoformat()
                        if completed else None})
        self.manifest["created"]["tasks"] = out

    def phase_training(self):
        self.note("\n== PHASE 6: training attendance (coach) ==")
        existing = api("GET", f"/training-sessions/player/{PLAYER_ID}", self.coach_token)
        have = {t["date"][:10] for t in existing}
        out = []
        for d, status in training_rows():
            key = d.isoformat()
            r = self.do("coach", "POST", "/training-sessions",
                        dict(playerId=PLAYER_ID, teamId=TEAM_ID, date=f"{key}T18:00:00Z",
                             durationMinutes=90, notes=None, attendanceStatus=status),
                        f"{key} {status}", key in have)
            out.append({"id": r["id"] if r else None, "date": key})
        self.manifest["created"]["trainingSessions"] = out

    def phase_self_assessments(self):
        self.note("\n== PHASE 7: self-assessments (Lucas) ==")
        existing = api("GET", f"/players/{PLAYER_ID}/self-assessments", self.lucas_token)
        have = {(e["metricDefinitionId"], e["evalDate"][:10]) for e in existing}
        out = []
        for m, d, ratings, note in SELF_ASSESSMENTS:
            for metric, val in ratings.items():
                mid = self.metric_id[metric]
                key = (mid, f"2026-{m:02d}-{d:02d}")
                r = self.do("lucas", "POST", "/self-assessments/evidence",
                            dict(metricDefinitionId=mid, rating=val,
                                 evalDate=iso(2026, m, d), notes=note, guidedAnswers=None),
                            f"{metric} {key[1]} = {val}", key in have)
                out.append({"id": r["id"] if r else None, "metric": metric, "date": key[1]})
        self.manifest["created"]["selfAssessments"] = out

    def phase_goals(self):
        self.note("\n== PHASE 8: goals (Lucas) ==")
        existing = api("GET", "/goals", self.lucas_token)
        by_title = {g["title"]: g for g in existing}
        created = {}
        for goal, progress, achieved in ((GOAL_A, GOAL_A_PROGRESS, True),
                                         (GOAL_B, GOAL_B_PROGRESS, True)):
            prior = by_title.get(goal["title"])
            r = self.do("lucas", "POST", "/goals", goal, goal["title"], prior is not None)
            gid = (r or prior or {}).get("id")
            created[goal["title"]] = {"id": gid, "new": True}
            if gid is not None:
                for when, val, note in progress:
                    api("POST", f"/goals/{gid}/progress", self.lucas_token,
                        dict(value=val, note=note, recordedAt=when))
                self.note(f"    lucas POST /goals/{gid}/progress x{len(progress)} (backdated recordedAt)")
                g = api("GET", "/goals", self.lucas_token)
                me = next(x for x in g if x["id"] == gid)
                for ms in me.get("milestones", []) or []:
                    if not ms.get("isAchieved"):
                        api("PATCH", f"/goals/{gid}/milestones/{ms['id']}/achieve",
                            self.lucas_token, {})
                if achieved and me["status"] != "Achieved":
                    api("PATCH", f"/goals/{gid}/achieve", self.lucas_token, {})
                self.note(f"    lucas PATCH milestones+achieve (SQL re-dates stamps)")
            elif self.dry:
                self.do("lucas", "POST", "/goals/{new}/progress", None,
                        f"{len(progress)} backdated progress logs", False)
                self.do("lucas", "PATCH", "/goals/{new}/milestones/{each}/achieve + /achieve",
                        None, "achieve milestones + goal (SQL re-dates)", False)
        addons = {}
        for title, spec in EXISTING_GOAL_ADDONS.items():
            g = by_title.get(title)
            if g is None:
                self.note(f"  [WARN] existing goal not found: {title}")
                continue
            have_ms = {m["title"] for m in g.get("milestones", []) or []}
            ms_created = []
            for ms_title, ach, ach_date in spec["milestones"]:
                skip = ms_title in have_ms
                r = self.do("lucas", "POST", f"/goals/{g['id']}/milestones",
                            {"title": ms_title, "targetValue": None, "targetDate": None},
                            f"{title} :: {ms_title}", skip)
                mid = r["id"] if r else None
                if ach and mid is not None:
                    api("PATCH", f"/goals/{g['id']}/milestones/{mid}/achieve",
                        self.lucas_token, {})
                ms_created.append({"id": mid, "title": ms_title,
                                   "achievedAt": ach_date if ach else None})
            prog_created = []
            for when, val, note in spec["progress"]:
                r = self.do("lucas", "POST", f"/goals/{g['id']}/progress",
                            dict(value=val, note=note, recordedAt=when),
                            f"{title} progress {val} @ {when[:10]}", False)
                prog_created.append({"id": (r or {}).get("id"), "recordedAt": when})
            addons[title] = {"goalId": g["id"], "milestones": ms_created,
                             "progress": prog_created,
                             "priorCurrentValue": g["currentValue"]}
        self.manifest["created"]["goals"] = {"new": created, "existingAddons": addons}

    def phase_nutrition_items(self):
        self.note("\n== PHASE 9: nutrition profile items (Lucas) ==")
        existing = api("GET", f"/nutrition-profile/player/{PLAYER_ID}", self.lucas_token)
        have = {(x["category"], x.get("specificItem")) for x in existing}
        out = []
        for item in NUTRITION_ITEMS:
            key = (item["category"], item["specificItem"])
            r = self.do("lucas", "POST", f"/nutrition-profile/player/{PLAYER_ID}", item,
                        f"{item['specificItem']}", key in have)
            out.append({"id": r["id"] if r else None, "specificItem": item["specificItem"]})
        self.manifest["created"]["nutritionItems"] = out

    # ------------------------------------------------------------------ SQL
    def build_sql(self):
        self.note("\n== PHASE 10: SQL (wellbeing + journal inserts; timestamp fix-ups) ==")
        # Manifest lists only dates that do NOT already have a row: ON CONFLICT
        # DO NOTHING skips pre-existing days, and the teardown must never delete
        # a row the seed didn't create.
        wb_have = {c["date"][:10] for c in
                   api("GET", f"/players/{PLAYER_ID}/wellbeing?days=365",
                       self.coach_token)["checkins"]}
        jr_have = {e["entryDate"][:10] for e in
                   api("GET", "/journal?days=365", self.lucas_token)}
        self.manifest["sql"] = {
            "wellbeingDates": [str(r[0]) for r in wellbeing_rows()
                               if str(r[0]) not in wb_have],
            "journalDates": [d for d in
                             (f"2026-{m:02d}-{d:02d}" for m, d, *_ in JOURNAL)
                             if d not in jr_have],
        }
        skipped = (len(wellbeing_rows()) - len(self.manifest["sql"]["wellbeingDates"]),
                   len(JOURNAL) - len(self.manifest["sql"]["journalDates"]))
        if any(skipped):
            self.note(f"  note: {skipped[0]} wellbeing / {skipped[1]} journal dates already "
                      "exist - inserts will no-op and teardown will not touch them")
        lit = self.sql_literal
        lit.append("-- ===== wellbeing check-ins (API is server-dated by design; rows are")
        lit.append("-- ===== player-reported data keyed to PlayerId=5 - honest provenance)")
        for d, f, e, s, pain, area, pnote, note in wellbeing_rows():
            lit.append(
                f'INSERT INTO "WellbeingCheckins" ("PlayerId","Date","Feeling","Energy","Sleep",'
                f'"HasPain","PainArea","PainNote","Notes","CreatedAt") VALUES '
                f"({PLAYER_ID},'{d}T00:00:00Z',{f},{e},{s},{str(pain).lower()},"
                f"{('NULL' if not area else chr(39) + q(area) + chr(39))},"
                f"{('NULL' if not pnote else chr(39) + q(pnote) + chr(39))},"
                f"{('NULL' if not note else chr(39) + q(note) + chr(39))},'{d}T20:00:00Z') "
                f'ON CONFLICT ("PlayerId","Date") DO NOTHING;')
        lit.append("-- ===== journal entries (as Lucas: UserId is his ApplicationUser id)")
        for m, d, private, mood, energy, tr, content, kl, tf, tags in JOURNAL:
            day = f"2026-{m:02d}-{d:02d}"
            lit.append(
                f'INSERT INTO "JournalEntries" ("PlayerId","UserId","EntryDate","Title","Content",'
                f'"Mood","EnergyLevel","TrainingRating","KeyLearning","TomorrowFocus","Tags",'
                f'"IsPrivate","CreatedAt") VALUES '
                f"({PLAYER_ID},'{{LUCAS_USER_ID}}','{day}T00:00:00Z',NULL,'{q(content)}',"
                f"{MOOD[mood]},{energy},{tr if tr is not None else 'NULL'},"
                f"{('NULL' if not kl else chr(39) + q(kl) + chr(39))},"
                f"{('NULL' if not tf else chr(39) + q(tf) + chr(39))},"
                f"{('NULL' if not tags else chr(39) + q(tags) + chr(39))},"
                f"{str(private).lower()},'{day}T21:00:00Z') "
                f'ON CONFLICT ("PlayerId","EntryDate") DO NOTHING;')

        t = self.sql_templated
        t.append("-- ===== timestamp fix-ups (ids resolved from the manifest at run time)")
        t.append("-- injury arc")
        t.append(f'UPDATE "InjuryRecords" SET "RecoveredDate"=\'{INJURY_RECOVERED}\' '
                 f'WHERE "Id"={{injury.id}} AND "PlayerId"={PLAYER_ID};')
        t.append(f'UPDATE "InjuryRecoveryPlans" SET "CreatedAt"=\'{PLAN_CREATED}\' '
                 f'WHERE "Id"={{injury.planId}};')
        t.append(f'-- exercises: CompletedAt spread evenly {REHAB_DONE_START} .. {REHAB_DONE_END}')
        t.append('UPDATE "RecoveryExercises" SET "CompletedAt"=\'{spread}\' WHERE "Id"={each exerciseId};')
        t.append('UPDATE "RecoveryMilestones" SET "AchievedAt"=\'{spread}\' WHERE "Id"={each milestoneId};')
        t.append("-- tasks: CreatedAt = due-6d, CompletedAt = due-1d (completed only)")
        t.append(f'UPDATE "PlayerTasks" SET "CreatedAt"=\'{{task.createdAt}}T09:00:00Z\', '
                 f'"CompletedAt"=\'{{task.completedAt}}T19:00:00Z\' '
                 f'WHERE "Id"={{task.id}} AND "PlayerId"={PLAYER_ID};')
        t.append("-- task notifications: re-date to task creation (feed reads lived-in)")
        t.append(f'UPDATE "Notifications" SET "CreatedAt"=\'{{task.createdAt}}T09:00:00Z\' '
                 f"WHERE \"UserId\"='{{LUCAS_USER_ID}}' AND \"RelatedEntityType\"='PlayerTask' "
                 f'AND "RelatedEntityId"={{task.id}};')
        t.append("-- goals A and B: CreatedAt/AchievedAt + milestone stamps")
        t.append(f'UPDATE "PersonalGoals" SET "CreatedAt"=\'{GOAL_A_CREATED}\', '
                 f'"AchievedAt"=\'{GOAL_A_ACHIEVED}\' WHERE "Id"={{goalA.id}} AND "PlayerId"={PLAYER_ID};')
        t.append(f'UPDATE "PersonalGoals" SET "CreatedAt"=\'{GOAL_B_CREATED}\', '
                 f'"AchievedAt"=\'{GOAL_B_ACHIEVED}\' WHERE "Id"={{goalB.id}} AND "PlayerId"={PLAYER_ID};')
        t.append('UPDATE "GoalMilestones" SET "AchievedAt"=\'{per-milestone date}\' '
                 'WHERE "Id"={each new milestoneId} AND "IsAchieved"=true;')

    def run_sql(self):
        db = os.environ.get("PROD_DB_URL")
        if not db:
            raise SystemExit("PROD_DB_URL not set - refusing to run the SQL phase")
        resolved = [s.replace("{LUCAS_USER_ID}", self.lucas_user_id) for s in self.sql_literal]
        inj = self.manifest["created"]["injury"]
        resolved.append(f'UPDATE "InjuryRecords" SET "RecoveredDate"=\'{INJURY_RECOVERED}\' '
                        f'WHERE "Id"={inj["id"]} AND "PlayerId"={PLAYER_ID};')
        resolved.append(f'UPDATE "InjuryRecoveryPlans" SET "CreatedAt"=\'{PLAN_CREATED}\' '
                        f'WHERE "Id"={inj["planId"]};')
        span = (REHAB_DONE_END - REHAB_DONE_START).days
        ex_ids, ms_ids = inj.get("exerciseIds", []), inj.get("milestoneIds", [])
        for i, ex in enumerate(ex_ids):
            when = REHAB_DONE_START + timedelta(days=round(i * span / max(1, len(ex_ids) - 1)))
            resolved.append(f'UPDATE "RecoveryExercises" SET "CompletedAt"=\'{when}T18:00:00Z\' '
                            f'WHERE "Id"={ex};')
        for i, ms in enumerate(ms_ids):
            when = REHAB_DONE_START + timedelta(days=round((i + 1) * span / max(1, len(ms_ids))))
            resolved.append(f'UPDATE "RecoveryMilestones" SET "AchievedAt"=\'{when}T18:00:00Z\' '
                            f'WHERE "Id"={ms};')
        for tk in self.manifest["created"]["tasks"]:
            if tk["id"] is None:
                continue
            comp = (f'"CompletedAt"=\'{tk["completedAt"]}T19:00:00Z\''
                    if tk["completedAt"] else '"CompletedAt"=NULL')
            resolved.append(f'UPDATE "PlayerTasks" SET "CreatedAt"=\'{tk["createdAt"]}T09:00:00Z\', {comp} '
                            f'WHERE "Id"={tk["id"]} AND "PlayerId"={PLAYER_ID};')
            resolved.append(f'UPDATE "Notifications" SET "CreatedAt"=\'{tk["createdAt"]}T09:00:00Z\' '
                            f"WHERE \"UserId\"='{self.lucas_user_id}' "
                            f"AND \"RelatedEntityType\"='PlayerTask' AND \"RelatedEntityId\"={tk['id']};")
        goals = self.manifest["created"]["goals"]["new"]
        ga, gb = goals[GOAL_A["title"]]["id"], goals[GOAL_B["title"]]["id"]
        if ga:
            resolved.append(f'UPDATE "PersonalGoals" SET "CreatedAt"=\'{GOAL_A_CREATED}\', '
                            f'"AchievedAt"=\'{GOAL_A_ACHIEVED}\' WHERE "Id"={ga} AND "PlayerId"={PLAYER_ID};')
        if gb:
            resolved.append(f'UPDATE "PersonalGoals" SET "CreatedAt"=\'{GOAL_B_CREATED}\', '
                            f'"AchievedAt"=\'{GOAL_B_ACHIEVED}\' WHERE "Id"={gb} AND "PlayerId"={PLAYER_ID};')
        # milestone stamps: read ids live, pair with configured dates
        all_goals = api("GET", "/goals", self.lucas_token)
        for gid, dates in ((ga, GOAL_A_MILESTONE_DATES), (gb, GOAL_B_MILESTONE_DATES)):
            if not gid:
                continue
            me = next((x for x in all_goals if x["id"] == gid), None)
            for msrow, when in zip((me or {}).get("milestones", []) or [], dates):
                resolved.append(f'UPDATE "GoalMilestones" SET "AchievedAt"=\'{when}\' '
                                f'WHERE "Id"={msrow["id"]} AND "IsAchieved"=true;')
        for title, addon in self.manifest["created"]["goals"]["existingAddons"].items():
            for ms in addon["milestones"]:
                if ms["achievedAt"] and ms["id"]:
                    resolved.append(f'UPDATE "GoalMilestones" SET "AchievedAt"=\'{ms["achievedAt"]}\' '
                                    f'WHERE "Id"={ms["id"]} AND "IsAchieved"=true;')
        sql_path = os.path.join(SCRIPT_DIR, "lucas_6mo_seed.generated.sql")
        with open(sql_path, "w") as fh:
            fh.write("BEGIN;\n" + "\n".join(resolved) + "\nCOMMIT;\n")
        self.note(f"  running {len(resolved)} SQL statements via psql (single transaction)")
        subprocess.run(["psql", db, "-v", "ON_ERROR_STOP=1", "-q", "-f", sql_path], check=True)

    def phase_ai_plan(self):
        self.note("\n== PHASE 11: weekly AI nutrition plan (coach; one real Claude call) ==")
        try:
            existing = api("GET", f"/players/{PLAYER_ID}/weekly-nutrition-plan", self.coach_token)
        except RuntimeError:
            existing = None
        if existing:
            self.note("  [SKIP(exists)] a weekly plan already exists")
            self.manifest["created"]["weeklyNutritionPlan"] = {"id": existing.get("id"),
                                                              "preExisting": True}
            return
        if self.dry:
            self.note("  [PLAN] coach POST /ai/weekly-nutrition-plan/5 (current week by design)")
            self.manifest["created"]["weeklyNutritionPlan"] = {"id": None, "preExisting": False}
            return
        r = api("POST", f"/ai/weekly-nutrition-plan/{PLAYER_ID}", self.coach_token, {})
        self.manifest["created"]["weeklyNutritionPlan"] = {"id": (r or {}).get("id"),
                                                          "preExisting": False}

    # ------------------------------------------------------------- finalize
    def finalize(self):
        self.note("\n== PHASE 12: recalculate evidence + assertions ==")
        if self.dry:
            self.note("  [PLAN] POST /evidence-scores/calculate/5 then assert:")
            self.note(f"    - confidence targets: {CONFIDENCE_TARGETS}")
            self.note(f"    - computeTrend == IMPROVING for: {TREND_METRICS}")
            self.note("    - goals A+B Achieved; injury recovered 2026-05-08; wellbeing spans Feb 2+")
            out = os.path.join(SCRIPT_DIR, "lucas_6mo_seed.manifest.projected.json")
        else:
            api("POST", f"/evidence-scores/calculate/{PLAYER_ID}", self.coach_token, {})
            self.assertions()
            from datetime import datetime, timezone
            self.manifest["seededAt"] = datetime.now(timezone.utc).isoformat()
            out = os.path.join(SCRIPT_DIR, "lucas_6mo_seed.manifest.json")
        with open(out, "w") as fh:
            json.dump(self.manifest, fh, indent=1)
        self.note(f"\nmanifest -> {out}")
        if self.dry:
            print("\n" + "=" * 78)
            print("VERBATIM SQL - literal statements (run exactly as printed, in one txn):")
            print("=" * 78)
            print("\n".join(self.sql_literal))
            print("\n" + "=" * 78)
            print("TEMPLATED SQL - {placeholders} resolved from created ids at run time:")
            print("=" * 78)
            print("\n".join(self.sql_templated))

    def assertions(self):
        self.note("  -- assertion pass --")
        failures = []
        scores = api("GET", f"/players/{PLAYER_ID}/evidence-scores", self.coach_token)
        conf = {s["metricName"]: s["confidence"] for s in scores}
        for metric, want in CONFIDENCE_TARGETS.items():
            got = conf.get(metric)
            (failures.append(f"confidence {metric}: want {want} got {got}")
             if got != want else self.note(f"  ok confidence {metric} = {want}"))
        tests = api("GET", f"/players/{PLAYER_ID}/objective-tests", self.coach_token)
        for metric in TREND_METRICS:
            pts = sorted((t["testedAt"][:10], t["normalizedScore"]) for t in tests
                         if t["metricName"] == metric)
            days0 = date.fromisoformat(pts[0][0]).toordinal()
            xy = [(date.fromisoformat(p[0]).toordinal() - days0, p[1]) for p in pts]
            n = len(xy)
            mx = sum(x for x, _ in xy) / n
            my = sum(y for _, y in xy) / n
            sxx = sum((x - mx) ** 2 for x, _ in xy)
            syy = sum((y - my) ** 2 for _, y in xy)
            sxy = sum((x - mx) * (y - my) for x, y in xy)
            slope30 = (sxy / sxx) * 30 if sxx else 0
            r2 = (sxy * sxy) / (sxx * syy) if sxx and syy else 1.0
            verdict = ("improving" if n >= 3 and r2 >= 0.3 and slope30 >= 0.25 else
                       f"NOT improving (n={n} r2={r2:.2f} slope30={slope30:.2f})")
            (self.note(f"  ok trend {metric}: improving (n={n} r2={r2:.2f} slope30={slope30:.2f})")
             if verdict == "improving" else failures.append(f"trend {metric}: {verdict}"))
        goals = api("GET", "/goals", self.lucas_token)
        for title in (GOAL_A["title"], GOAL_B["title"]):
            g = next((x for x in goals if x["title"] == title), None)
            (failures.append(f"goal not Achieved: {title}")
             if not g or g["status"] != "Achieved" else self.note(f"  ok goal Achieved: {title}"))
        inj = api("GET", f"/injury-records/player/{PLAYER_ID}", self.coach_token)
        arc = next((x for x in inj if x["injuryType"] == "Hamstring strain"
                    and x["injuryDate"][:10] == "2026-04-13"), None)
        if not arc or not arc["isRecovered"] or (arc.get("recoveredDate") or "")[:10] != "2026-05-08":
            failures.append(f"injury arc wrong: {arc}")
        else:
            self.note("  ok injury: recovered 2026-05-08")
        wb = api("GET", f"/players/{PLAYER_ID}/wellbeing?days=365", self.coach_token)["checkins"]
        first = min(c["date"][:10] for c in wb)
        (failures.append(f"wellbeing starts {first}, want 2026-02-02")
         if first != "2026-02-02" else self.note("  ok wellbeing spans from 2026-02-02"))
        if failures:
            self.note("\nASSERTION FAILURES:")
            for f in failures:
                self.note(f"  !! {f}")
            raise SystemExit(1)
        self.note("  ALL ASSERTIONS PASSED")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    print(f"{'DRY RUN - no writes' if args.dry_run else 'REAL RUN'} against {BASE}\n")
    Runner(args.dry_run).run()


if __name__ == "__main__":
    main()
