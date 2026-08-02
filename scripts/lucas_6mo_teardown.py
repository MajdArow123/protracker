#!/usr/bin/env python3
"""Tear down everything lucas_6mo_seed.py created, scoped strictly to the manifest
plus PlayerId=5 guards. API deletes where endpoints exist; SQL for the delete-less
tables. Ends with an evidence recalc and a counts-vs-baseline report.

Usage:
  python3 scripts/lucas_6mo_teardown.py --dry-run [--manifest scripts/lucas_6mo_seed.manifest.projected.json]
  PROD_DB_URL=postgres://... python3 scripts/lucas_6mo_teardown.py
"""
import argparse
import json
import os
import subprocess
import sys
import urllib.request
import urllib.error

BASE = os.environ.get("PT_BASE", "https://protracker-production.up.railway.app/api")
PASSWORD = os.environ.get("PT_PASSWORD", "SeedCoach123!")
COACH_EMAIL = "coach.soccer@protracker.seed"
LUCAS_EMAIL = "lucas.ward@protracker.seed"
PLAYER_ID = 5
TEAM_ID = 1
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))


def api(method, path, token=None, body=None, ok404=False):
    req = urllib.request.Request(f"{BASE}{path}", method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    data = json.dumps(body).encode() if body is not None else None
    try:
        with urllib.request.urlopen(req, data=data, timeout=120) as r:
            raw = r.read().decode()
    except urllib.error.HTTPError as e:
        if ok404 and e.code == 404:
            return None
        raise RuntimeError(f"{method} {path} -> {e.code}: {e.read().decode()[:300]}") from e
    if not raw:
        return None
    payload = json.loads(raw)
    return payload.get("data") if isinstance(payload, dict) and "data" in payload else payload


def login(email):
    d = api("POST", "/auth/login", body={"email": email, "password": PASSWORD})
    return d["accessToken"], d["user"]


def fmt_id(v):
    return "{id-from-real-manifest}" if v is None else str(v)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--manifest",
                    default=os.path.join(SCRIPT_DIR, "lucas_6mo_seed.manifest.json"))
    args = ap.parse_args()
    with open(args.manifest) as fh:
        man = json.load(fh)
    assert man["playerId"] == PLAYER_ID, "manifest is not for player 5 - refusing"
    dry = args.dry_run
    created = man["created"]
    print(f"{'DRY RUN - no deletes' if dry else 'REAL TEARDOWN'} against {BASE}")
    print(f"manifest: {args.manifest}\n")

    coach_token = lucas_token = None
    lucas_user_id = "{LUCAS_USER_ID}"
    if not dry:
        coach_token, _ = login(COACH_EMAIL)
        lucas_token, lucas = login(LUCAS_EMAIL)
        lucas_user_id = lucas["id"]

    api_deletes = []   # (actor, path, label)
    for t in created.get("tasks", []):
        api_deletes.append(("coach", f"/tasks/{fmt_id(t['id'])}", f"task «{t['title']}»"))
    for m in created.get("matches", []):
        api_deletes.append(("coach", f"/matches/{fmt_id(m['id'])}",
                            f"match {m['date']} vs {m['opponent']} (ratings cascade)"))
    for s in created.get("trainingSessions", []):
        api_deletes.append(("coach", f"/training-sessions/{fmt_id(s['id'])}",
                            f"attendance {s['date']}"))
    inj = created.get("injury", {})
    if inj:
        api_deletes.append(("coach", f"/injury-records/{fmt_id(inj.get('id'))}",
                            "hamstring injury (recovery plan + exercises + milestones cascade)"))
    for title, g in created.get("goals", {}).get("new", {}).items():
        api_deletes.append(("lucas", f"/goals/{fmt_id(g['id'])}",
                            f"goal «{title}» (milestones + progress cascade)"))
    for n in created.get("nutritionItems", []):
        api_deletes.append(("lucas", f"/nutrition-profile/player/{PLAYER_ID}/{fmt_id(n['id'])}",
                            f"nutrition item «{n['specificItem']}»"))

    print(f"== API deletes ({len(api_deletes)}) ==")
    for actor, path, label in api_deletes:
        print(f"  [{'PLAN' if dry else 'DELETE'}] {actor} DELETE {path}  -- {label}")
        if not dry:
            token = coach_token if actor == "coach" else lucas_token
            api("DELETE", path, token, ok404=True)

    # ------------------------------------------------------------------ SQL
    sql = []
    ids = lambda rows: ",".join(fmt_id(r["id"]) for r in rows) or "NULL"
    ot = created.get("objectiveTests", [])
    ce = created.get("coachEvals", [])
    sa = created.get("selfAssessments", [])
    sql.append(f'DELETE FROM "ObjectiveTestResults" WHERE "PlayerId"={PLAYER_ID} AND "Id" IN ({ids(ot)});')
    sql.append(f'DELETE FROM "CoachEvaluations" WHERE "PlayerId"={PLAYER_ID} AND "Id" IN ({ids(ce)});')
    sql.append(f'DELETE FROM "SelfAssessmentEntries" WHERE "PlayerId"={PLAYER_ID} AND "Id" IN ({ids(sa)});')
    match_dates = ",".join(f"'{m['date']}'" for m in created.get("matches", []))
    if match_dates:
        sql.append(f'DELETE FROM "MatchStatEntries" WHERE "PlayerId"={PLAYER_ID} '
                   f'AND "IsAutoImported"=true AND "StatDate"::date IN ({match_dates});'
                   "  -- auto-imports survive match deletion (FK set-null)")
    wb = man.get("sql", {}).get("wellbeingDates") or []
    jr = man.get("sql", {}).get("journalDates") or []
    if wb:
        sql.append(f'DELETE FROM "WellbeingCheckins" WHERE "PlayerId"={PLAYER_ID} '
                   f'AND "Date"::date IN ({",".join(chr(39) + d + chr(39) for d in wb)});')
    if jr:
        sql.append(f'DELETE FROM "JournalEntries" WHERE "PlayerId"={PLAYER_ID} '
                   f'AND "EntryDate"::date IN ({",".join(chr(39) + d + chr(39) for d in jr)});')
    for title, addon in created.get("goals", {}).get("existingAddons", {}).items():
        ms_ids = ",".join(fmt_id(m["id"]) for m in addon["milestones"]) or "NULL"
        sql.append(f'DELETE FROM "GoalMilestones" WHERE "PersonalGoalId"={addon["goalId"]} '
                   f'AND "Id" IN ({ms_ids});  -- «{title}»')
        pr = addon.get("progress", [])
        if pr and all(p.get("id") for p in pr):
            pr_ids = ",".join(str(p["id"]) for p in pr)
            sql.append(f'DELETE FROM "GoalProgress" WHERE "PersonalGoalId"={addon["goalId"]} '
                       f'AND "Id" IN ({pr_ids});')
        else:
            dates = ",".join(f"'{p['recordedAt']}'" for p in pr) or "NULL"
            sql.append(f'DELETE FROM "GoalProgress" WHERE "PersonalGoalId"={addon["goalId"]} '
                       f"AND \"Source\"=0 AND \"RecordedAt\" IN ({dates});")
        prior = addon.get("priorCurrentValue")
        if prior is not None:
            sql.append(f'UPDATE "PersonalGoals" SET "CurrentValue"={prior} '
                       f'WHERE "Id"={addon["goalId"]} AND "PlayerId"={PLAYER_ID};'
                       "  -- restore pre-seed CurrentValue")
    task_ids = ",".join(fmt_id(t["id"]) for t in created.get("tasks", [])) or "NULL"
    sql.append(f'DELETE FROM "Notifications" WHERE "UserId"=\'{lucas_user_id}\' '
               f"AND \"RelatedEntityType\"='PlayerTask' AND \"RelatedEntityId\" IN ({task_ids});")
    plan = created.get("weeklyNutritionPlan") or {}
    if plan.get("id") is not None and not plan.get("preExisting"):
        pid = plan["id"]
        sql.append(f'DELETE FROM "PlannedMealItems" WHERE "PlannedMealId" IN '
                   f'(SELECT pm."Id" FROM "PlannedMeals" pm JOIN "DailyMealPlans" dmp '
                   f'ON pm."DailyMealPlanId"=dmp."Id" WHERE dmp."WeeklyNutritionPlanId"={pid});')
        sql.append(f'DELETE FROM "PlannedMeals" WHERE "DailyMealPlanId" IN '
                   f'(SELECT "Id" FROM "DailyMealPlans" WHERE "WeeklyNutritionPlanId"={pid});')
        sql.append(f'DELETE FROM "DailyMealPlans" WHERE "WeeklyNutritionPlanId"={pid};')
        sql.append(f'DELETE FROM "WeeklyNutritionPlans" WHERE "Id"={pid} AND "PlayerId"={PLAYER_ID};')
    elif dry and plan.get("id") is None and not plan.get("preExisting"):
        sql.append('-- weekly nutrition plan tree: PlannedMealItems -> PlannedMeals -> '
                   'DailyMealPlans -> WeeklyNutritionPlans WHERE "Id"={plan-id-from-real-manifest};')
    sql.append(f'DELETE FROM "EvidenceBasedScores" WHERE "PlayerId"={PLAYER_ID} '
               'AND "AssessmentId" IS NULL;  -- recalc below regenerates from remaining evidence')

    print(f"\n== SQL ({len(sql)} statements, one transaction) ==")
    for s in sql:
        print(f"  {s}")
    if not dry:
        db = os.environ.get("PROD_DB_URL")
        if not db:
            raise SystemExit("PROD_DB_URL not set - refusing to run the SQL phase")
        path = os.path.join(SCRIPT_DIR, "lucas_6mo_teardown.generated.sql")
        with open(path, "w") as fh:
            fh.write("BEGIN;\n" + "\n".join(sql) + "\nCOMMIT;\n")
        subprocess.run(["psql", db, "-v", "ON_ERROR_STOP=1", "-q", "-f", path], check=True)

    print("\n== finalize ==")
    if dry:
        print("  [PLAN] POST /evidence-scores/calculate/5 (regenerate from remaining evidence)")
        print("  [PLAN] re-count every section and diff against manifest.baseline")
        return
    api("POST", f"/evidence-scores/calculate/{PLAYER_ID}", coach_token, {})
    g = lambda p: api("GET", p, coach_token)
    now = {
        "objectiveTests": len(g(f"/players/{PLAYER_ID}/objective-tests")),
        "matchStats": len(g(f"/players/{PLAYER_ID}/match-stats")),
        "coachEvals": len(g(f"/players/{PLAYER_ID}/coach-evaluations")),
        "selfAssessments": len(g(f"/players/{PLAYER_ID}/self-assessments")),
        "wellbeing": len(g(f"/players/{PLAYER_ID}/wellbeing?days=365")["checkins"]),
        "goals": len(g(f"/players/{PLAYER_ID}/goals")),
        "matches": len(g(f"/teams/{TEAM_ID}/matches")),
        "injuries": len(g(f"/injury-records/player/{PLAYER_ID}")),
        "tasks": len(g(f"/tasks?playerId={PLAYER_ID}")),
        "trainingSessions": len(g(f"/training-sessions/player/{PLAYER_ID}")),
        "nutritionItems": len(g(f"/nutrition-profile/player/{PLAYER_ID}")),
    }
    base = man["baseline"]
    bad = False
    for k, v in now.items():
        want = base.get(k)
        mark = "ok" if want == v else "MISMATCH"
        bad = bad or want != v
        print(f"  [{mark}] {k}: baseline={want} now={v}")
    conf = {s["metricName"]: s["confidence"]
            for s in g(f"/players/{PLAYER_ID}/evidence-scores")}
    print(f"  evidence confidence now: {conf}")
    print(f"  evidence confidence was: {base.get('evidenceScores')}")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
