using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using ProTracker.Models;
using ProTracker.Services;

namespace ProTracker.Data.Showcase;

// On-demand, admin-triggered showcase dataset for the demo environment.
//
// SAFETY CONTRACT (do not weaken):
//  * GUARDED  — only ever touches teams owned by the five @protracker.seed
//               coaches; every account it creates has an @protracker.seed email.
//               It throws rather than touch anything else.
//  * IDEMPOTENT — every entity is get-or-created on a natural key, and all
//               "random" variation comes from ShowcaseRng seeded by stable names,
//               so re-runs produce zero new rows.
//  * DRY-RUN  — the whole run executes inside a transaction; dryRun rolls it
//               back and returns the counts it *would* have written.
//  * REMOVABLE — TeardownAsync deletes exactly the demo graph (see method).
//
// NOT a startup seeder: prod's DemoDataSeeder baseline stays untouched; this is
// invoked via POST /api/admin/demo-showcase with the X-Seed-Token header.
public class DemoShowcaseSeeder
{
    public const string SeedDomain = "@protracker.seed";
    private const string SeedPassword = "SeedCoach123!";

    private readonly ApplicationDbContext _db;
    private readonly UserManager<ApplicationUser> _users;
    private readonly IEvidenceScoringEngine _engine;

    public DemoShowcaseSeeder(ApplicationDbContext db, UserManager<ApplicationUser> users, IEvidenceScoringEngine engine)
    {
        _db = db;
        _users = users;
        _engine = engine;
    }

    public sealed class Report
    {
        public string Phase { get; init; } = "";
        public bool DryRun { get; init; }
        public SortedDictionary<string, int> Created { get; } = new();
        public SortedDictionary<string, int> Existing { get; } = new();
        public List<string> Notes { get; } = new();

        public void Hit(string entity, bool created)
        {
            var d = created ? Created : Existing;
            d[entity] = d.GetValueOrDefault(entity) + 1;
        }
    }

    public async Task<Report> RunAsync(string phase, bool dryRun)
    {
        var report = new Report { Phase = phase, DryRun = dryRun };
        await using var tx = await _db.Database.BeginTransactionAsync();

        switch (phase)
        {
            case "soccer":
                await SeedSoccerAsync(report);
                break;
            case "all":
                await SeedSoccerAsync(report);
                report.Notes.Add("Only implemented phases ran (soccer). Later phases land per the rollout plan.");
                break;
            default:
                throw new InvalidOperationException($"Phase '{phase}' is not implemented yet. Available: soccer, all.");
        }

        if (dryRun)
        {
            await tx.RollbackAsync();
            report.Notes.Add("DRY RUN — transaction rolled back, nothing was written.");
        }
        else
        {
            await tx.CommitAsync();
        }
        return report;
    }

    // ─── Guards ──────────────────────────────────────────────────────────────

    private async Task<ApplicationUser> RequireSeedCoachAsync(string email)
    {
        if (!email.EndsWith(SeedDomain, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException($"Refusing: '{email}' is not a {SeedDomain} account.");
        return await _users.FindByEmailAsync(email)
            ?? throw new InvalidOperationException($"Seed coach '{email}' not found — run the baseline DemoDataSeeder first.");
    }

    private async Task AssertSeedTeamAsync(Team team)
    {
        var owner = await _users.FindByIdAsync(team.CoachId);
        if (owner?.Email == null || !owner.Email.EndsWith(SeedDomain, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException($"Refusing to touch team '{team.Name}' — owner is not a {SeedDomain} coach.");
    }

    // ─── Soccer phase ────────────────────────────────────────────────────────

    private async Task SeedSoccerAsync(Report r)
    {
        var coach = await RequireSeedCoachAsync("coach.soccer" + SeedDomain);
        await EnsurePlanAsync(coach.Id, BillingPlan.Team, r);

        var senior = await GetOrCreateTeamAsync("City FC U18", sportId: 1, coach, r);
        var minor = await GetOrCreateTeamAsync("City FC U15 Academy", sportId: 1, coach, r);

        await AssignBenchmarkAsync(senior, "Semi-Professional", r);
        await AssignBenchmarkAsync(minor, "Junior (U15–U18)", r);

        // Rosters. Senior adopts the 8 baseline players and grows to 24; the minor
        // academy is entirely new, all under 18 with real dates of birth.
        // Position ids (soccer): 1 GK, 2 DEF, 3 MID, 4 WING, 5 ST. Baseline slots
        // 0-7 mirror DemoDataSeeder's canonical positions; the rest balance the squad
        // (3 GK / 7 DEF / 6 MID / 4 WING / 4 ST — no six-goalkeeper rosters).
        int[] seniorPositions = { 1, 2, 3, 4, 5, 3, 2, 5, 2, 3, 1, 2, 4, 3, 2, 5, 2, 3, 1, 4, 2, 3, 4, 5 };
        int[] minorPositions = { 1, 2, 3, 4, 5, 2, 3, 4, 5, 2, 3, 1, 2, 3, 4, 5, 2, 3, 4, 2, 3, 5 };
        var seniorPlayers = await EnsureRosterAsync(senior, ShowcasePools.SoccerSeniorNames, seniorPositions,
            targetSize: 24, ages: (18, 23), minors: false, r);
        var minorPlayers = await EnsureRosterAsync(minor, ShowcasePools.SoccerMinorNames, minorPositions,
            targetSize: 22, ages: (13, 16), minors: true, r);

        // Accounts: keep the 4 baseline athlete logins linked; add 2 logins per team;
        // parents for ~70% of minors (read-only portal, Team plan required).
        // Baseline demo login (firstname.lastname@) relinks to its player by name —
        // never create a duplicate athlete.* account for someone who has one.
        await LinkBaselineLoginAsync("lucas.ward" + SeedDomain, "Lucas Ward", r);

        // Login players chosen by stable name order, never DB row order.
        await EnsureAthleteLoginsAsync(seniorPlayers.OrderBy(p => p.FullName).Take(2), r);
        await EnsureAthleteLoginsAsync(minorPlayers.OrderBy(p => p.FullName).Take(2), r);
        await EnsureParentsAsync(minorPlayers, r);

        foreach (var team in new[] { senior, minor })
        {
            var players = team.Id == senior.Id ? seniorPlayers : minorPlayers;
            await SeedAssessmentLayerAsync(team, players, r);
            await SeedObjectiveTestsAsync(team, players, r);
            await SeedMatchesAsync(team, players, matches: team.Id == senior.Id ? 6 : 4, r);
            await SeedSelfAssessmentsAsync(players, r);
            await SeedInjuriesAsync(coach, players, r);
            await SeedNutritionAsync(players, r);
            await SeedTasksAsync(coach, players, r);
            await SeedGoalsAsync(players, r);
            await SeedWellbeingAsync(players, r);
            await SeedJournalsAsync(players, r);
            await SeedSessionsAsync(team, players, r);
            await SeedAnnouncementsAsync(team, coach, r);
            await SeedNotesAsync(coach, players, r);
        }

        await SeedMessagesAsync(coach, seniorPlayers.Concat(minorPlayers), r);

        // Evidence scores derive from everything above; one engine pass per player.
        foreach (var p in seniorPlayers.Concat(minorPlayers))
        {
            await _engine.RecalculateAllAsync(p.Id);
            r.Hit("EvidenceRecalc(players)", true);
        }
    }

    // ─── Building blocks ─────────────────────────────────────────────────────

    private async Task EnsurePlanAsync(string coachId, BillingPlan plan, Report r)
    {
        var sub = await _db.CoachSubscriptions.FirstOrDefaultAsync(s => s.CoachId == coachId);
        if (sub == null)
        {
            _db.CoachSubscriptions.Add(new CoachSubscription { CoachId = coachId, Plan = plan });
            r.Hit("CoachSubscription", true);
        }
        else if (sub.Plan != plan)
        {
            sub.Plan = plan; // demo coaches showcase every feature (parent portal is Team-gated)
            r.Hit("CoachSubscription(upgraded)", true);
        }
        await _db.SaveChangesAsync();
    }

    private async Task<Team> GetOrCreateTeamAsync(string name, int sportId, ApplicationUser coach, Report r)
    {
        var team = await _db.Teams.FirstOrDefaultAsync(t => t.Name == name);
        if (team == null)
        {
            team = new Team { Name = name, SportId = sportId, CoachId = coach.Id, Description = "Demo team — seeded showcase data." };
            _db.Teams.Add(team);
            await _db.SaveChangesAsync();
            r.Hit("Team", true);
        }
        else r.Hit("Team", false);

        await AssertSeedTeamAsync(team);

        if (!await _db.CoachTeamScopes.AnyAsync(s => s.CoachId == coach.Id && s.TeamId == team.Id))
        {
            _db.CoachTeamScopes.Add(new CoachTeamScope { CoachId = coach.Id, TeamId = team.Id });
            await _db.SaveChangesAsync();
        }
        return team;
    }

    private async Task AssignBenchmarkAsync(Team team, string profileName, Report r)
    {
        var profile = await _db.BenchmarkProfiles
            .FirstOrDefaultAsync(p => p.SportId == team.SportId && p.Name == profileName && p.CoachId == null);
        if (profile == null)
        {
            r.Notes.Add($"Benchmark profile '{profileName}' not found for sport {team.SportId} — team left on defaults.");
            return;
        }
        if (team.BenchmarkProfileId != profile.Id)
        {
            team.BenchmarkProfileId = profile.Id;
            await _db.SaveChangesAsync();
            r.Hit("TeamBenchmarkAssigned", true);
        }
        else r.Hit("TeamBenchmarkAssigned", false);
    }

    private async Task<List<Player>> EnsureRosterAsync(Team team, string[] namePool, int[] positionPool,
        int targetSize, (int Min, int Max) ages, bool minors, Report r)
    {
        var players = await _db.Players.Where(p => p.TeamId == team.Id).OrderBy(p => p.FullName).ToListAsync();
        var usedJerseys = players.Select(p => p.JerseyNumber).Where(j => j != null).Select(j => j!.Value).ToHashSet();

        for (var slot = 0; slot < namePool.Length; slot++)
        {
            var name = namePool[slot];
            if (players.Count >= targetSize) break;
            if (players.Any(p => p.FullName == name)) { r.Hit("Player", false); continue; }

            var rng = new ShowcaseRng($"{team.Name}|{name}");
            var age = rng.Next(ages.Min, ages.Max + 1);
            var jersey = NextFreeJersey(usedJerseys, rng);
            var player = new Player
            {
                FullName = name,
                Age = age,
                DateOfBirth = minors ? DateTime.UtcNow.Date.AddYears(-age).AddDays(-rng.Next(20, 330)) : null,
                Height = minors ? rng.Next(150, 179) : rng.Next(168, 194),
                Weight = minors ? rng.Next(42, 68) : rng.Next(62, 88),
                SportId = team.SportId,
                TeamId = team.Id,
                PositionId = positionPool[slot % positionPool.Length],
                FitnessLevel = rng.Next(5, 10),
                JerseyNumber = jersey,
                Goals = string.Format(rng.Pick(ShowcasePools.GoalTitles), rng.NextDecimal(7.5m, 9.5m, 1)),
                CoachNotes = rng.Pick(ShowcasePools.CoachNoteSnippets),
            };
            _db.Players.Add(player);
            players.Add(player);
            r.Hit("Player", true);
        }
        await _db.SaveChangesAsync();

        // Adopted players (the original 8) count as existing roster members.
        foreach (var p in players.Where(p => !namePool.Contains(p.FullName)))
            r.Hit("Player(adopted)", false);
        return players.OrderBy(p => p.FullName).ToList();
    }

    private static int NextFreeJersey(HashSet<int> used, ShowcaseRng rng)
    {
        for (var attempt = 0; attempt < 60; attempt++)
        {
            var j = rng.Next(1, 40);
            if (used.Add(j)) return j;
        }
        var next = Enumerable.Range(1, 99).First(n => !used.Contains(n));
        used.Add(next);
        return next;
    }

    // Archetype: 0 star · 1 solid · 2 developing · 3 inconsistent · 4 returning.
    private static int ArchetypeOf(Player p) => new ShowcaseRng($"arch|{p.FullName}").Next(0, 5);

    // Quality 0..1 for a player at a moment `w` weeks before today; drives scores,
    // test values and trends consistently per archetype.
    private static double Quality(Player p, int weeksAgo)
    {
        var rng = new ShowcaseRng($"q|{p.FullName}|{weeksAgo}");
        var noise = (rng.Next(0, 100) - 50) / 500.0; // ±0.1
        return Math.Clamp(ArchetypeOf(p) switch
        {
            0 => 0.85 + noise,                          // star
            1 => 0.62 + noise,                          // solid
            2 => 0.42 + (5 - weeksAgo) * 0.05 + noise,  // developing: clear upward trend
            3 => 0.55 + ((weeksAgo % 2 == 0) ? 0.18 : -0.18) + noise, // inconsistent
            _ => weeksAgo >= 3 ? 0.30 + noise : 0.55 + (2 - weeksAgo) * 0.08 + noise, // returning
        }, 0.05, 0.98);
    }

    private async Task SeedAssessmentLayerAsync(Team team, List<Player> players, Report r)
    {
        var cats = await _db.SportStatCategories.Where(c => c.SportId == team.SportId).ToListAsync();
        var metricsByCat = await _db.SportMetricDefinitions
            .Where(m => m.SportId == team.SportId && m.SportStatCategoryId != null)
            .ToDictionaryAsync(m => m.SportStatCategoryId!.Value, m => m.Id);
        var periods = await EnsurePeriodsAsync(team, weeks: 6, r);
        var coachId = team.CoachId;

        foreach (var p in players)
        {
            var pRng = new ShowcaseRng($"assess|{p.FullName}");
            // Fresh players miss the oldest weeks; ~8% of player-periods skipped (real life).
            var startWeek = ArchetypeOf(p) == 4 ? 0 : pRng.Next(0, 2);
            for (var i = startWeek; i < periods.Count; i++)
            {
                var period = periods[i];
                if (pRng.Chance(0.08)) continue;
                var date = period.StartDate.AddDays(2);
                if (await _db.PlayerAssessments.AnyAsync(a => a.PlayerId == p.Id && a.AssessmentPeriodId == period.Id))
                {
                    r.Hit("PlayerAssessment", false);
                    continue;
                }

                var weeksAgo = periods.Count - 1 - i;
                var q = Quality(p, weeksAgo);
                var assessment = new PlayerAssessment
                {
                    PlayerId = p.Id,
                    AssessmentPeriodId = period.Id,
                    DateRecorded = date,
                    Notes = null,
                    StatScores = cats.Select(c => new PlayerStatScore
                    {
                        SportStatCategoryId = c.Id,
                        Score = ScoreFromQuality(q, new ShowcaseRng($"s|{p.FullName}|{c.Id}|{i}")),
                    }).ToList(),
                };
                _db.PlayerAssessments.Add(assessment);
                r.Hit("PlayerAssessment", true);

                // Mirror the app's auto-capture: each slider save produces coach
                // evaluations for metric-linked categories.
                foreach (var s in assessment.StatScores)
                {
                    if (!metricsByCat.TryGetValue(s.SportStatCategoryId, out var metricId)) continue;
                    if (await _db.CoachEvaluations.AnyAsync(e => e.PlayerId == p.Id && e.MetricDefinitionId == metricId && e.EvalDate == date))
                        continue;
                    _db.CoachEvaluations.Add(new CoachEvaluation
                    {
                        PlayerId = p.Id, CoachId = coachId, MetricDefinitionId = metricId,
                        Rating = s.Score, EvalDate = date,
                    });
                    r.Hit("CoachEvaluation", true);
                }
            }
        }
        await _db.SaveChangesAsync();
    }

    private static decimal ScoreFromQuality(double q, ShowcaseRng rng)
    {
        var score = 1 + (decimal)(q * 9) + rng.NextDecimal(-0.8m, 0.8m, 1);
        return Math.Clamp(Math.Round(score * 2) / 2, 1m, 10m); // 0.5 steps like the sliders
    }

    private async Task<List<AssessmentPeriod>> EnsurePeriodsAsync(Team team, int weeks, Report r)
    {
        var result = new List<AssessmentPeriod>();
        var monday = DateTime.UtcNow.Date.AddDays(-(int)DateTime.UtcNow.Date.DayOfWeek + 1);
        for (var i = 0; i < weeks; i++)
        {
            var name = $"Week {i + 1}";
            var period = await _db.AssessmentPeriods.FirstOrDefaultAsync(x => x.TeamId == team.Id && x.Name == name);
            if (period == null)
            {
                var start = monday.AddDays(-7 * (weeks - 1 - i));
                period = new AssessmentPeriod { Name = name, TeamId = team.Id, StartDate = start, EndDate = start.AddDays(6) };
                _db.AssessmentPeriods.Add(period);
                await _db.SaveChangesAsync();
                r.Hit("AssessmentPeriod", true);
            }
            else r.Hit("AssessmentPeriod", false);
            result.Add(period);
        }
        return result.OrderBy(p => p.StartDate).ToList();
    }

    private async Task SeedObjectiveTestsAsync(Team team, List<Player> players, Report r)
    {
        var metrics = await _db.SportMetricDefinitions
            .Where(m => m.SportId == team.SportId && m.InputType != MetricInputType.Rating)
            .OrderBy(m => m.Id)
            .ToListAsync();
        if (metrics.Count == 0) return;
        var top3 = metrics.Take(3).ToList();

        var overrides = team.BenchmarkProfileId == null
            ? new Dictionary<int, (decimal Low, decimal High)>()
            : await _db.BenchmarkValues.Where(v => v.BenchmarkProfileId == team.BenchmarkProfileId)
                .ToDictionaryAsync(v => v.MetricDefinitionId, v => (v.BenchmarkLow, v.BenchmarkHigh));

        foreach (var p in players)
        {
            var rng = new ShowcaseRng($"tests|{p.FullName}");
            var deepTrend = rng.Chance(0.65); // ~65% get a longitudinal history (S4 trends)
            var extraMetrics = metrics.Skip(3).Where(_ => rng.Chance(0.35)).Take(3).ToList();

            foreach (var metric in top3.Concat(extraMetrics))
            {
                var dates = deepTrend && top3.Contains(metric)
                    ? new[] { 70, 49, 28, 7 }.Where(_ => rng.Chance(0.9)).ToArray()
                    : new[] { rng.Next(5, 30) };
                var (low, high) = overrides.TryGetValue(metric.Id, out var o)
                    ? o : (metric.BenchmarkLow, metric.BenchmarkHigh);

                foreach (var daysAgo in dates)
                {
                    var testedAt = DateTime.UtcNow.Date.AddDays(-daysAgo);
                    // IMPORTANT: draw ALL randomness before the existence check — a
                    // conditional draw would shift the RNG sequence on re-runs and
                    // break idempotency (the run-twice test guards this).
                    var q = Quality(p, Math.Min(10, daysAgo / 7));
                    var value = low + (high - low) * (decimal)q
                        + (high - low) * rng.NextDecimal(-0.06m, 0.06m, 3);
                    if (await _db.ObjectiveTestResults.AnyAsync(t =>
                            t.PlayerId == p.Id && t.MetricDefinitionId == metric.Id && t.TestedAt == testedAt))
                    {
                        r.Hit("ObjectiveTest", false);
                        continue;
                    }
                    _db.ObjectiveTestResults.Add(new ObjectiveTestResult
                    {
                        PlayerId = p.Id,
                        MetricDefinitionId = metric.Id,
                        Value = Math.Round(Math.Max(0, value), 2),
                        Unit = metric.Unit ?? "",
                        TestedAt = testedAt,
                        TestedBy = TestedByType.Coach,
                    });
                    r.Hit("ObjectiveTest", true);
                }
            }
        }
        await _db.SaveChangesAsync();
    }

    private async Task SeedMatchesAsync(Team team, List<Player> players, int matches, Report r)
    {
        var rng = new ShowcaseRng($"matches|{team.Name}");
        for (var m = 0; m < matches; m++)
        {
            var date = LastSaturday().AddDays(-7 * m);
            var opponent = ShowcasePools.Opponents[(m + (team.Name.Length % 3)) % ShowcasePools.Opponents.Length];
            // Draws before the existence check (idempotency — see note above).
            var ourGoals = rng.Next(0, 5);
            var theirGoals = rng.Next(0, 4);
            var existing = await _db.MatchResults.FirstOrDefaultAsync(x =>
                x.TeamId == team.Id && x.OpponentName == opponent && x.MatchDate == date);
            if (existing != null) { r.Hit("MatchResult", false); continue; }

            var isHome = m % 2 == 0;
            var match = new MatchResult
            {
                TeamId = team.Id,
                OpponentName = opponent,
                MatchDate = date,
                IsHome = isHome,
                HomeScore = isHome ? ourGoals : theirGoals,
                AwayScore = isHome ? theirGoals : ourGoals,
                ScoreFormat = ScoreFormat.Goals,
                Competition = "League",
            };
            _db.MatchResults.Add(match);
            await _db.SaveChangesAsync();
            r.Hit("MatchResult", true);

            // Ratings + auto-imported evidence stat entries for 11-14 players.
            var squad = players.OrderBy(p => new ShowcaseRng($"lineup|{p.FullName}|{m}").Next(0, 1000))
                .Take(Math.Min(players.Count, rng.Next(11, 15))).ToList();
            var goalsLeft = ourGoals;
            foreach (var p in squad)
            {
                var pr = new ShowcaseRng($"rating|{p.FullName}|{team.Name}|{m}");
                var q = Quality(p, m);
                var goals = goalsLeft > 0 && pr.Chance(q * 0.45) ? 1 : 0;
                goalsLeft -= goals;
                var minutes = pr.Chance(0.8) ? 90 : pr.Next(15, 75);
                var passes = pr.Next(18, 70);
                var passAcc = Math.Clamp((int)(60 + q * 35 + pr.Next(-5, 6)), 40, 97);
                var statJson = System.Text.Json.JsonSerializer.Serialize(new Dictionary<string, object>
                {
                    ["goals"] = goals,
                    ["assists"] = pr.Chance(q * 0.3) ? 1 : 0,
                    ["shots"] = goals + pr.Next(0, 4),
                    ["shotsOnTarget"] = goals + pr.Next(0, 2),
                    ["passes"] = passes,
                    ["passAccuracy"] = passAcc,
                    ["tackles"] = pr.Next(0, 6),
                    ["distanceKm"] = Math.Round(6 + q * 5 + pr.Next(0, 10) / 10.0, 1),
                    ["minutesPlayed"] = minutes,
                });
                match.Ratings.Add(new PlayerMatchRating
                {
                    PlayerId = p.Id,
                    Rating = Math.Clamp(Math.Round((decimal)(4.5 + q * 5) + pr.NextDecimal(-0.5m, 0.5m, 1), 1), 1m, 10m),
                    StatJson = statJson,
                    Goals = goals,
                    MinutesPlayed = minutes,
                });
                _db.MatchStatEntries.Add(new MatchStatEntry
                {
                    PlayerId = p.Id,
                    MatchResult = match,
                    StatDate = date,
                    SportId = team.SportId,
                    StatsJson = statJson,
                    IsAutoImported = true,
                });
                r.Hit("PlayerMatchRating", true);
            }
            await _db.SaveChangesAsync();
        }
    }

    private static DateTime LastSaturday()
    {
        var d = DateTime.UtcNow.Date;
        while (d.DayOfWeek != DayOfWeek.Saturday) d = d.AddDays(-1);
        return d;
    }

    private async Task SeedSelfAssessmentsAsync(List<Player> players, Report r)
    {
        foreach (var p in players)
        {
            var rng = new ShowcaseRng($"self|{p.FullName}");
            if (!rng.Chance(0.7)) continue;
            var metrics = await _db.SportMetricDefinitions
                .Where(m => m.SportId == p.SportId).OrderBy(m => m.Id).Take(4).ToListAsync();
            foreach (var metric in metrics.Where(_ => rng.Chance(0.7)))
            {
                var date = DateTime.UtcNow.Date.AddDays(-rng.Next(2, 21));
                // Athletes rate themselves a touch kinder than the coach does.
                // (Drawn before the existence check — see idempotency note above.)
                var rating = Math.Clamp(ScoreFromQuality(Quality(p, 1), rng) + 0.5m, 1m, 10m);
                if (await _db.SelfAssessmentEntries.AnyAsync(e =>
                        e.PlayerId == p.Id && e.MetricDefinitionId == metric.Id && e.EvalDate == date))
                {
                    r.Hit("SelfAssessment", false);
                    continue;
                }
                _db.SelfAssessmentEntries.Add(new SelfAssessmentEntry
                {
                    PlayerId = p.Id, MetricDefinitionId = metric.Id, Rating = rating, EvalDate = date,
                });
                r.Hit("SelfAssessment", true);
            }
        }
        await _db.SaveChangesAsync();
    }

    private async Task SeedInjuriesAsync(ApplicationUser coach, List<Player> players, Report r)
    {
        var templates = await _db.RecoveryTemplates.Include(t => t.Exercises).Include(t => t.Milestones).ToListAsync();
        foreach (var p in players)
        {
            var rng = new ShowcaseRng($"injury|{p.FullName}");
            var active = rng.Chance(0.15);
            var historical = rng.Chance(0.10);
            if (!active && !historical) continue;

            var (type, bodyPart) = rng.Pick(ShowcasePools.SoccerInjuries);
            if (await _db.InjuryRecords.AnyAsync(i => i.PlayerId == p.Id && i.InjuryType == type))
            {
                r.Hit("InjuryRecord", false);
                continue;
            }
            var daysAgo = active ? rng.Next(3, 21) : rng.Next(40, 120);
            var injury = new InjuryRecord
            {
                PlayerId = p.Id,
                InjuryDate = DateTime.UtcNow.Date.AddDays(-daysAgo),
                InjuryType = type,
                BodyPart = bodyPart,
                Severity = rng.Chance(0.6) ? InjurySeverity.Minor : InjurySeverity.Moderate,
                RecoveryStatus = active
                    ? (rng.Chance(0.5) ? RecoveryStatus.Active : RecoveryStatus.Recovering)
                    : RecoveryStatus.FullyRecovered,
                ExpectedReturnDate = active ? DateTime.UtcNow.Date.AddDays(rng.Next(7, 28)) : null,
                RecoveredDate = active ? null : DateTime.UtcNow.Date.AddDays(-daysAgo + rng.Next(14, 35)),
                TreatmentPlan = active ? "Physio twice a week, gradual return to full sessions." : null,
            };
            _db.InjuryRecords.Add(injury);
            await _db.SaveChangesAsync();
            r.Hit("InjuryRecord", true);

            // Active injuries get a template-based recovery plan (no AI at seed time),
            // with early exercises marked complete.
            var template = templates.FirstOrDefault(t => t.BodyPart == bodyPart) ?? templates.FirstOrDefault();
            if (active && template != null)
            {
                var plan = new InjuryRecoveryPlan
                {
                    InjuryRecordId = injury.Id,
                    PlayerId = p.Id,
                    CoachId = coach.Id,
                    Title = $"{template.Name} — {p.FullName.Split(' ')[0]}",
                    EstimatedWeeks = template.EstimatedWeeks,
                    CurrentWeek = Math.Min(template.EstimatedWeeks, 1 + daysAgo / 7),
                    Status = RecoveryPlanStatus.Active,
                    Exercises = template.Exercises.Select(e => new RecoveryExercise
                    {
                        Title = e.Title, Description = e.Description, Sets = e.Sets, Reps = e.Reps,
                        DurationMinutes = e.DurationMinutes, RestSeconds = e.RestSeconds,
                        Week = e.Week, DayOfWeek = e.DayOfWeek, Category = e.Category,
                        IsCompleted = e.Week <= daysAgo / 7 && rng.Chance(0.7),
                    }).ToList(),
                    Milestones = template.Milestones.Select(ms => new RecoveryMilestone
                    {
                        Title = ms.Title, TargetWeek = ms.TargetWeek,
                        IsAchieved = ms.TargetWeek < 1 + daysAgo / 7,
                    }).ToList(),
                };
                _db.InjuryRecoveryPlans.Add(plan);
                await _db.SaveChangesAsync();
                r.Hit("RecoveryPlan", true);
            }
        }
    }

    private async Task SeedNutritionAsync(List<Player> players, Report r)
    {
        var cats = new[]
        {
            (NutritionCategory.NutAllergy, NutritionPreferenceType.Allergy, NutritionSeverity.Hard),
            (NutritionCategory.Vegetarian, NutritionPreferenceType.Lifestyle, NutritionSeverity.Lifestyle),
            (NutritionCategory.DairyFree, NutritionPreferenceType.SoftPreference, NutritionSeverity.Soft),
            (NutritionCategory.GlutenFree, NutritionPreferenceType.Allergy, NutritionSeverity.Hard),
            (NutritionCategory.NoRedMeat, NutritionPreferenceType.SoftPreference, NutritionSeverity.Soft),
        };
        foreach (var p in players)
        {
            var rng = new ShowcaseRng($"nutri|{p.FullName}");
            if (rng.Chance(0.2) && !await _db.PlayerNutritionProfiles.AnyAsync(x => x.PlayerId == p.Id))
            {
                var (cat, pref, sev) = rng.Pick(cats);
                _db.PlayerNutritionProfiles.Add(new PlayerNutritionProfile
                {
                    PlayerId = p.Id, Category = cat, PreferenceType = pref, Severity = sev,
                });
                r.Hit("NutritionProfile", true);
            }

            // A static weekly plan for stars + linked logins so nutrition pages render.
            var wantsPlan = ArchetypeOf(p) == 0 || p.UserId != null;
            if (wantsPlan && !await _db.WeeklyNutritionPlans.AnyAsync(x => x.PlayerId == p.Id))
            {
                _db.WeeklyNutritionPlans.Add(BuildStaticWeeklyPlan(p, rng));
                r.Hit("WeeklyNutritionPlan", true);
            }
        }
        await _db.SaveChangesAsync();
    }

    private static WeeklyNutritionPlan BuildStaticWeeklyPlan(Player p, ShowcaseRng rng)
    {
        var weekStart = DateTime.UtcNow.Date.AddDays(-(int)DateTime.UtcNow.Date.DayOfWeek + 1);
        var plan = new WeeklyNutritionPlan
        {
            Player = p, CreatedDate = DateTime.UtcNow.Date, WeekStartDate = weekStart, IsAIGenerated = false,
        };
        for (var d = 0; d < 7; d++)
        {
            var day = new DailyMealPlan { DayNumber = d + 1, DayName = ShowcasePools.DayNames[d] };
            int kcal = 0, prot = 0, carb = 0, fat = 0;
            for (var m = 0; m < 4; m++)
            {
                var meal = new PlannedMeal { MealType = ShowcasePools.MealTypes[m], Time = ShowcasePools.MealTimes[m] };
                var items = m == 2 ? 1 : 2 + (rng.Chance(0.4) ? 1 : 0); // snack is lighter
                for (var i = 0; i < items; i++)
                {
                    var f = rng.Pick(ShowcasePools.Foods);
                    meal.PlannedMealItems.Add(new PlannedMealItem
                    {
                        FoodName = f.Food, Portion = f.Portion,
                        Calories = f.Kcal, Protein = f.P, Carbs = f.C, Fats = f.F,
                    });
                    kcal += f.Kcal; prot += f.P; carb += f.C; fat += f.F;
                }
                day.PlannedMeals.Add(meal);
            }
            day.DailyCalories = kcal; day.DailyProtein = prot; day.DailyCarbs = carb; day.DailyFats = fat;
            plan.DailyMealPlans.Add(day);
        }
        return plan;
    }

    private async Task SeedTasksAsync(ApplicationUser coach, List<Player> players, Report r)
    {
        foreach (var p in players)
        {
            var rng = new ShowcaseRng($"tasks|{p.FullName}");
            var count = rng.Next(3, 9);
            var existing = await _db.PlayerTasks.CountAsync(t => t.PlayerId == p.Id);
            for (var i = existing; i < count; i++)
            {
                var done = rng.Chance(0.55);
                var due = DateTime.UtcNow.Date.AddDays(rng.Next(-10, 14));
                _db.PlayerTasks.Add(new PlayerTask
                {
                    CoachId = coach.Id,
                    PlayerId = p.Id,
                    Title = rng.Pick(ShowcasePools.TaskTitles),
                    Priority = (TaskPriority)rng.Next(0, 3),
                    Category = (TaskCategory)rng.Next(0, 6),
                    DueDate = due,
                    IsCompleted = done,
                    CompletedAt = done ? due.AddDays(-rng.Next(0, 3)) : null,
                    CreatedAt = due.AddDays(-rng.Next(5, 15)),
                });
                r.Hit("PlayerTask", true);
            }
        }
        await _db.SaveChangesAsync();
    }

    private async Task SeedGoalsAsync(List<Player> players, Report r)
    {
        foreach (var p in players)
        {
            var rng = new ShowcaseRng($"goals|{p.FullName}");
            if (!rng.Chance(0.6)) continue;
            var count = rng.Next(1, 4);
            var existing = await _db.PersonalGoals.CountAsync(g => g.PlayerId == p.Id);
            for (var i = existing; i < count; i++)
            {
                var target = rng.NextDecimal(7.5m, 9.5m, 1);
                var current = Math.Round(target * rng.NextDecimal(0.55m, 0.95m, 2), 1);
                var achieved = rng.Chance(0.2);
                var goal = new PersonalGoal
                {
                    PlayerId = p.Id,
                    UserId = p.UserId,
                    Title = string.Format(rng.Pick(ShowcasePools.GoalTitles), target),
                    Category = (GoalCategory)rng.Next(0, 6),
                    TargetValue = target,
                    CurrentValue = achieved ? target : current,
                    Unit = "score",
                    StartDate = DateTime.UtcNow.Date.AddDays(-rng.Next(20, 60)),
                    TargetDate = DateTime.UtcNow.Date.AddDays(rng.Next(20, 90)),
                    Status = achieved ? GoalStatus.Achieved : GoalStatus.Active,
                    Priority = (GoalPriority)rng.Next(0, 3),
                    AchievedAt = achieved ? DateTime.UtcNow.Date.AddDays(-rng.Next(1, 10)) : null,
                    Milestones = new List<GoalMilestone>
                    {
                        new() { Title = "Halfway there", TargetValue = Math.Round(target * 0.75m, 1), IsAchieved = achieved || current >= target * 0.75m },
                        new() { Title = "Target hit", TargetValue = target, IsAchieved = achieved },
                    },
                    ProgressEntries = Enumerable.Range(0, 3).Select(j => new GoalProgress
                    {
                        Value = Math.Round(current * (0.7m + 0.15m * j), 1),
                        RecordedAt = DateTime.UtcNow.Date.AddDays(-rng.Next(5, 40) + j * 7),
                        Source = GoalProgressSource.Manual,
                    }).ToList(),
                };
                _db.PersonalGoals.Add(goal);
                r.Hit("PersonalGoal", true);
            }
        }
        await _db.SaveChangesAsync();
    }

    private async Task SeedWellbeingAsync(List<Player> players, Report r)
    {
        foreach (var p in players)
        {
            var rng = new ShowcaseRng($"well|{p.FullName}");
            if (!rng.Chance(0.7)) continue;
            var hasActiveInjury = await _db.InjuryRecords.AnyAsync(i =>
                i.PlayerId == p.Id && i.RecoveryStatus != RecoveryStatus.FullyRecovered);

            for (var d = 0; d < 14; d++)
            {
                if (rng.Chance(0.25)) continue; // nobody checks in every single day
                var date = DateTime.UtcNow.Date.AddDays(-d);
                // Draws before the existence check (idempotency — see note above).
                var q = Quality(p, d / 7);
                var pain = hasActiveInjury && d < 5 && rng.Chance(0.5);
                var feeling = Math.Clamp((int)(q * 5) + rng.Next(0, 2), 1, 5);
                var energy = Math.Clamp((int)(q * 5) + rng.Next(0, 2), 1, 5);
                var sleep = rng.Next(2, 6);
                if (await _db.WellbeingCheckins.AnyAsync(w => w.PlayerId == p.Id && w.Date == date))
                {
                    r.Hit("WellbeingCheckin", false);
                    continue;
                }
                _db.WellbeingCheckins.Add(new WellbeingCheckin
                {
                    PlayerId = p.Id,
                    Date = date,
                    Feeling = feeling,
                    Energy = energy,
                    Sleep = sleep,
                    HasPain = pain,
                    PainArea = pain ? "Hamstring" : null,
                });
                r.Hit("WellbeingCheckin", true);
            }
        }
        await _db.SaveChangesAsync();
    }

    private async Task SeedJournalsAsync(List<Player> players, Report r)
    {
        foreach (var p in players)
        {
            var rng = new ShowcaseRng($"journal|{p.FullName}");
            var isLogin = p.UserId != null;
            if (!isLogin && !rng.Chance(0.3)) continue;
            var days = isLogin ? 10 : 4;
            for (var d = 0; d < days; d++)
            {
                if (rng.Chance(0.3)) continue;
                var date = DateTime.UtcNow.Date.AddDays(-d);
                // Draws before the existence check (idempotency — see note above).
                var q = Quality(p, d / 7);
                var content = rng.Pick(ShowcasePools.JournalSnippets);
                var trainingRating = rng.Chance(0.7) ? rng.Next(2, 6) : (int?)null;
                var isPrivate = rng.Chance(0.6);
                if (await _db.JournalEntries.AnyAsync(j => j.PlayerId == p.Id && j.EntryDate == date))
                {
                    r.Hit("JournalEntry", false);
                    continue;
                }
                _db.JournalEntries.Add(new JournalEntry
                {
                    PlayerId = p.Id,
                    UserId = p.UserId,
                    EntryDate = date,
                    Content = content,
                    Mood = q > 0.7 ? JournalMood.Great : q > 0.5 ? JournalMood.Good : q > 0.35 ? JournalMood.Okay : JournalMood.Tough,
                    EnergyLevel = Math.Clamp((int)(q * 5) + 1, 1, 5),
                    TrainingRating = trainingRating,
                    IsPrivate = isPrivate,
                });
                r.Hit("JournalEntry", true);
            }
        }
        await _db.SaveChangesAsync();
    }

    private async Task SeedSessionsAsync(Team team, List<Player> players, Report r)
    {
        var rng = new ShowcaseRng($"sessions|{team.Name}");
        var sessions = new List<ScheduledSession>();
        for (var w = -4; w <= 2; w++)
        {
            foreach (var (dow, hour, type) in new[]
            {
                (DayOfWeek.Tuesday, 18, SessionType.Training),
                (DayOfWeek.Thursday, 18, SessionType.Tactical),
                (DayOfWeek.Saturday, 10, w % 2 == 0 ? SessionType.MatchPrep : SessionType.Strength),
            })
            {
                var monday = DateTime.UtcNow.Date.AddDays(-(int)DateTime.UtcNow.Date.DayOfWeek + 1).AddDays(w * 7);
                var start = monday.AddDays(((int)dow - 1 + 7) % 7).AddHours(hour);
                var existing = await _db.ScheduledSessions.FirstOrDefaultAsync(s => s.TeamId == team.Id && s.StartTime == start);
                if (existing != null) { sessions.Add(existing); r.Hit("ScheduledSession", false); continue; }
                var s = new ScheduledSession
                {
                    TeamId = team.Id,
                    Title = rng.Pick(ShowcasePools.SessionFocus),
                    SessionType = type,
                    StartTime = start,
                    DurationMinutes = 90,
                    Location = "Main training ground",
                    Focus = rng.Pick(ShowcasePools.SessionFocus),
                };
                _db.ScheduledSessions.Add(s);
                sessions.Add(s);
                r.Hit("ScheduledSession", true);
            }
        }
        await _db.SaveChangesAsync();

        foreach (var s in sessions.Where(s => s.StartTime < DateTime.UtcNow))
        {
            foreach (var p in players)
            {
                var rng2 = new ShowcaseRng($"fb|{p.FullName}|{s.StartTime:yyyyMMdd}");
                if (!rng2.Chance(0.6)) continue;
                if (await _db.SessionFeedbacks.AnyAsync(f => f.ScheduledSessionId == s.Id && f.PlayerId == p.Id))
                {
                    r.Hit("SessionFeedback", false);
                    continue;
                }
                var q = Quality(p, 1);
                _db.SessionFeedbacks.Add(new SessionFeedback
                {
                    ScheduledSessionId = s.Id,
                    PlayerId = p.Id,
                    Rating = Math.Clamp((int)(q * 5) + 1, 1, 5),
                    EnergyBefore = rng2.Next(2, 5),
                    EnergyAfter = rng2.Next(2, 6),
                    Difficulty = rng2.Next(2, 6),
                    SubmittedAt = s.StartTime.AddHours(3),
                });
                r.Hit("SessionFeedback", true);
            }
        }
        await _db.SaveChangesAsync();
    }

    private async Task SeedAnnouncementsAsync(Team team, ApplicationUser coach, Report r)
    {
        for (var i = 0; i < 3; i++)
        {
            var title = ShowcasePools.AnnouncementTitles[i % ShowcasePools.AnnouncementTitles.Length];
            if (await _db.TeamAnnouncements.AnyAsync(a => a.TeamId == team.Id && a.Title == title))
            {
                r.Hit("TeamAnnouncement", false);
                continue;
            }
            _db.TeamAnnouncements.Add(new TeamAnnouncement
            {
                TeamId = team.Id,
                CoachId = coach.Id,
                CoachName = coach.DisplayName ?? "Coach",
                Title = title,
                Content = ShowcasePools.AnnouncementBodies[i % ShowcasePools.AnnouncementBodies.Length],
                Priority = i == 0 ? AnnouncementPriority.Important : AnnouncementPriority.Normal,
                IsPinned = i == 0,
                CreatedAt = DateTime.UtcNow.AddDays(-i * 3),
            });
            r.Hit("TeamAnnouncement", true);
        }
        await _db.SaveChangesAsync();
    }

    private async Task SeedNotesAsync(ApplicationUser coach, List<Player> players, Report r)
    {
        foreach (var p in players)
        {
            var rng = new ShowcaseRng($"notes|{p.FullName}");
            if (rng.Chance(0.4) && !await _db.CoachNotes.AnyAsync(n => n.PlayerId == p.Id))
            {
                _db.CoachNotes.Add(new CoachNote
                {
                    CoachId = coach.Id,
                    CoachName = coach.DisplayName ?? "Coach",
                    PlayerId = p.Id,
                    Content = rng.Pick(ShowcasePools.CoachNoteSnippets),
                    Category = (CoachNoteCategory)rng.Next(0, 6),
                    IsPrivate = rng.Chance(0.5),
                });
                r.Hit("CoachNote", true);
            }
            if (p.UserId != null && !await _db.AthleteNotes.AnyAsync(n => n.PlayerId == p.Id))
            {
                _db.AthleteNotes.Add(new AthleteNote
                {
                    PlayerId = p.Id,
                    UserId = p.UserId,
                    Content = rng.Pick(ShowcasePools.AthleteNoteSnippets),
                    Category = (AthleteNoteCategory)rng.Next(0, 6),
                });
                r.Hit("AthleteNote", true);
            }
        }
        await _db.SaveChangesAsync();
    }

    private async Task LinkBaselineLoginAsync(string email, string playerName, Report r)
    {
        var user = await _users.FindByEmailAsync(email);
        if (user == null) return;
        var player = await _db.Players.FirstOrDefaultAsync(p => p.FullName == playerName && p.UserId == null);
        if (player != null)
        {
            player.UserId = user.Id;
            await _db.SaveChangesAsync();
            r.Hit("BaselineLoginLinked", true);
        }
    }

    private async Task EnsureAthleteLoginsAsync(IEnumerable<Player> players, Report r)
    {
        foreach (var p in players.Where(p => p.UserId == null))
        {
            var email = $"athlete.{Slug(p.FullName)}{SeedDomain}";
            var user = await _users.FindByEmailAsync(email);
            if (user == null)
            {
                user = new ApplicationUser { UserName = email, Email = email, DisplayName = p.FullName, EmailConfirmed = true, HasCompletedOnboarding = true };
                var result = await _users.CreateAsync(user, SeedPassword);
                if (!result.Succeeded)
                    throw new InvalidOperationException($"Could not create athlete login {email}: {string.Join(", ", result.Errors.Select(e => e.Description))}");
                await _users.AddToRoleAsync(user, "Athlete");
                r.Hit("AthleteLogin", true);
            }
            else r.Hit("AthleteLogin", false);
            p.UserId = user.Id;
        }
        await _db.SaveChangesAsync();
    }

    private async Task EnsureParentsAsync(List<Player> minors, Report r)
    {
        var firstNames = new[] { "David", "Sofia", "Peter", "Amina", "Robert", "Elena", "Ahmed", "Karin", "Miguel", "Grace" };
        foreach (var child in minors)
        {
            var rng = new ShowcaseRng($"parent|{child.FullName}");
            if (!rng.Chance(0.7)) continue; // ~70% of minors have a linked guardian

            var surname = child.FullName.Split(' ').Last();
            var parentName = $"{rng.Pick(firstNames)} {surname}";
            var email = $"parent.{Slug(parentName)}{SeedDomain}";
            var user = await _users.FindByEmailAsync(email);
            if (user == null)
            {
                user = new ApplicationUser { UserName = email, Email = email, DisplayName = parentName, EmailConfirmed = true };
                var result = await _users.CreateAsync(user, SeedPassword);
                if (!result.Succeeded)
                    throw new InvalidOperationException($"Could not create parent {email}: {string.Join(", ", result.Errors.Select(e => e.Description))}");
                await _users.AddToRoleAsync(user, "Parent");
                r.Hit("ParentAccount", true);
            }
            else r.Hit("ParentAccount", false);

            if (!await _db.ParentLinks.AnyAsync(l => l.ParentUserId == user.Id && l.PlayerId == child.Id))
            {
                _db.ParentLinks.Add(new ParentLink { ParentUserId = user.Id, PlayerId = child.Id });
                r.Hit("ParentLink", true);
            }
            else r.Hit("ParentLink", false);
        }
        await _db.SaveChangesAsync();
    }

    private async Task SeedMessagesAsync(ApplicationUser coach, IEnumerable<Player> players, Report r)
    {
        foreach (var p in players.Where(p => p.UserId != null))
        {
            var rng = new ShowcaseRng($"msg|{p.FullName}");
            var convo = Message.BuildConversationId(coach.Id, p.UserId!);
            if (await _db.Messages.AnyAsync(m => m.ConversationId == convo))
            {
                r.Hit("MessageThread", false);
                continue;
            }
            var pairs = rng.Next(2, 5);
            var t = DateTime.UtcNow.AddDays(-rng.Next(1, 6));
            for (var i = 0; i < pairs; i++)
            {
                var parts = rng.Pick(ShowcasePools.MessagePairs).Split('|');
                _db.Messages.Add(new Message { SenderId = coach.Id, ReceiverId = p.UserId!, Content = parts[0], ConversationId = convo, SentAt = t, IsRead = true, ReadAt = t.AddMinutes(30) });
                _db.Messages.Add(new Message { SenderId = p.UserId!, ReceiverId = coach.Id, Content = parts[1], ConversationId = convo, SentAt = t.AddMinutes(45), IsRead = i < pairs - 1 });
                t = t.AddHours(rng.Next(3, 30));
            }
            r.Hit("MessageThread", true);
        }
        await _db.SaveChangesAsync();
    }

    // ASCII-only: Identity usernames reject non-ASCII letters (perić → peri).
    private static string Slug(string name) =>
        new(name.ToLowerInvariant().Replace(' ', '.')
            .Where(c => c is >= 'a' and <= 'z' or >= '0' and <= '9' or '.').ToArray());

    // ─── Teardown ────────────────────────────────────────────────────────────

    // Removes the ENTIRE demo graph: every team owned by a @protracker.seed coach
    // (players cascade their child data), leagues they organize, messages/links of
    // .seed users, and the showcase-created accounts (athlete.* / parent.* / solo.*).
    // Keeps: the 5 coach accounts, the 4 original firstname.lastname athlete logins,
    // and all reference data. DemoDataSeeder restores the baseline teams on next
    // boot (and baseline players only if the Players table ends up empty).
    public async Task<Report> TeardownAsync(bool dryRun)
    {
        var report = new Report { Phase = "teardown", DryRun = dryRun };
        await using var tx = await _db.Database.BeginTransactionAsync();

        var seedUsers = await _users.Users.Where(u => u.Email != null && u.Email.EndsWith(SeedDomain)).ToListAsync();
        var seedUserIds = seedUsers.Select(u => u.Id).ToList();
        var coachIds = new HashSet<string>();
        foreach (var u in seedUsers)
            if (await _users.IsInRoleAsync(u, "Coach")) coachIds.Add(u.Id);

        var teams = await _db.Teams.Where(t => coachIds.Contains(t.CoachId)).ToListAsync();
        var teamIds = teams.Select(t => t.Id).ToList();
        var playerIds = await _db.Players.Where(p => p.TeamId != null && teamIds.Contains(p.TeamId.Value)).Select(p => p.Id).ToListAsync();

        async Task Del<T>(IQueryable<T> q, string label) where T : class
        {
            var rows = await q.ToListAsync();
            report.Created[label] = rows.Count; // "Created" doubles as would-delete counts here
            _db.Set<T>().RemoveRange(rows);
            await _db.SaveChangesAsync();
        }

        await Del(_db.Leagues.Where(l => coachIds.Contains(l.OrganizerId)), "Leagues(deleted)");
        await Del(_db.Messages.Where(m => seedUserIds.Contains(m.SenderId) || seedUserIds.Contains(m.ReceiverId)), "Messages(deleted)");
        await Del(_db.ParentLinks.Where(l => playerIds.Contains(l.PlayerId)), "ParentLinks(deleted)");
        await Del(_db.ParentInvites.Where(i => playerIds.Contains(i.PlayerId)), "ParentInvites(deleted)");
        await Del(_db.MatchResults.Where(m => m.TeamId != null && teamIds.Contains(m.TeamId.Value)), "MatchResults(deleted)");
        await Del(_db.ScheduledSessions.Where(s => s.TeamId != null && teamIds.Contains(s.TeamId.Value)), "Sessions(deleted)");
        await Del(_db.TeamAnnouncements.Where(a => teamIds.Contains(a.TeamId)), "Announcements(deleted)");
        await Del(_db.Players.Where(p => playerIds.Contains(p.Id)), "Players(deleted, children cascade)");
        await Del(_db.AssessmentPeriods.Where(p => p.TeamId != null && teamIds.Contains(p.TeamId.Value)), "AssessmentPeriods(deleted)");
        await Del(_db.Teams.Where(t => teamIds.Contains(t.Id)), "Teams(deleted)");

        // Showcase accounts only — coach + original firstname.lastname logins stay.
        var showcaseUsers = seedUsers.Where(u =>
            u.Email!.StartsWith("athlete.") || u.Email.StartsWith("parent.") || u.Email.StartsWith("solo.")).ToList();
        foreach (var u in showcaseUsers)
        {
            report.Created["ShowcaseAccounts(deleted)"] = report.Created.GetValueOrDefault("ShowcaseAccounts(deleted)") + 1;
            await _users.DeleteAsync(u);
        }

        if (dryRun)
        {
            await tx.RollbackAsync();
            report.Notes.Add("DRY RUN — counts show what WOULD be deleted; nothing was.");
        }
        else await tx.CommitAsync();
        return report;
    }
}
