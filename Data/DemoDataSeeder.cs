using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using ProTracker.Models;

namespace ProTracker.Data;

// Seeds realistic demo teams/players/assessments/nutrition profiles. Static reference data
// (Sports, Positions, SportStatCategories, FoodAlternativesLibrary) is seeded separately via
// EF Core HasData in ApplicationDbContext, since it doesn't depend on runtime-created users.
// This seeder needs real ApplicationUser accounts to own teams, so it runs at app startup instead.
public static class DemoDataSeeder
{
    private const string SeedPassword = "SeedCoach123!";

    public static async Task SeedAsync(IServiceProvider services)
    {
        var context = services.GetRequiredService<ApplicationDbContext>();
        var userManager = services.GetRequiredService<UserManager<ApplicationUser>>();

        // Coaches — always idempotent
        var soccerCoach = await GetOrCreateCoachAsync(userManager, "coach.soccer@protracker.seed", "Coach Daniels");
        var basketballCoach = await GetOrCreateCoachAsync(userManager, "coach.basketball@protracker.seed", "Coach Reyes");
        var volleyballCoach = await GetOrCreateCoachAsync(userManager, "coach.volleyball@protracker.seed", "Coach Whitfield");
        var beachVolleyCoach = await GetOrCreateCoachAsync(userManager, "coach.beachvolley@protracker.seed", "Coach Santos");
        var tennisCoach = await GetOrCreateCoachAsync(userManager, "coach.tennis@protracker.seed", "Coach Williams");

        // Seed coaches get Pro so all demo features (AI, unlimited teams/players) keep working.
        foreach (var coachId in new[] { soccerCoach.Id, basketballCoach.Id, volleyballCoach.Id, beachVolleyCoach.Id, tennisCoach.Id })
            await EnsureCoachPlanAsync(context, coachId, BillingPlan.Pro);

        // Athlete logins — created before the idempotency guard so they always exist
        var lucasWardLogin = await GetOrCreateAthleteAsync(userManager, "lucas.ward@protracker.seed", "Lucas Ward");
        var marcusBellLogin = await GetOrCreateAthleteAsync(userManager, "marcus.bell@protracker.seed", "Marcus Bell");
        var carlosSantosLogin = await GetOrCreateAthleteAsync(userManager, "carlos.santos@protracker.seed", "Carlos Santos Jr");
        var alexWilliamsLogin = await GetOrCreateAthleteAsync(userManager, "alex.williams@protracker.seed", "Alex Williams");

        // Link athletes to their player records if not already linked
        await LinkAthleteToPlayerAsync(context, lucasWardLogin.Id, "Lucas Ward");
        await LinkAthleteToPlayerAsync(context, marcusBellLogin.Id, "Marcus Bell");
        await LinkAthleteToPlayerAsync(context, carlosSantosLogin.Id, "Carlos Santos Jr");
        await LinkAthleteToPlayerAsync(context, alexWilliamsLogin.Id, "Alex Williams");

        var today = DateTime.UtcNow.Date;

        // --- Teams (get-or-create each individually so existing data is preserved) ---
        var soccerTeam = await GetOrCreateTeamAsync(context, "City FC U18", 1, soccerCoach.Id);
        var basketballTeam = await GetOrCreateTeamAsync(context, "Riverside Hawks", 2, basketballCoach.Id);
        var volleyballTeam = await GetOrCreateTeamAsync(context, "Lakeside Spikers", 3, volleyballCoach.Id);
        var beachVolleyTeam = await GetOrCreateTeamAsync(context, "Sand Kings", 4, beachVolleyCoach.Id);
        var tennisTeam = await GetOrCreateTeamAsync(context, "Ace Academy", 5, tennisCoach.Id);

        // Coach-team scopes (idempotent)
        await EnsureCoachScopeAsync(context, soccerCoach.Id, soccerTeam.Id);
        await EnsureCoachScopeAsync(context, basketballCoach.Id, basketballTeam.Id);
        await EnsureCoachScopeAsync(context, volleyballCoach.Id, volleyballTeam.Id);
        await EnsureCoachScopeAsync(context, beachVolleyCoach.Id, beachVolleyTeam.Id);
        await EnsureCoachScopeAsync(context, tennisCoach.Id, tennisTeam.Id);

        // --- Assessment Periods (3 per team, weekly — get-or-create by name+teamId) ---
        var soccerPeriods = await EnsureWeeklyPeriodsAsync(context, soccerTeam.Id, today);
        var basketballPeriods = await EnsureWeeklyPeriodsAsync(context, basketballTeam.Id, today);
        var volleyballPeriods = await EnsureWeeklyPeriodsAsync(context, volleyballTeam.Id, today);
        var beachVolleyPeriods = await EnsureWeeklyPeriodsAsync(context, beachVolleyTeam.Id, today);
        var tennisPeriods = await EnsureWeeklyPeriodsAsync(context, tennisTeam.Id, today);

        // Guard: players + all related data are only seeded once.
        if (await context.Players.AnyAsync())
        {
            await LinkAthleteToPlayerAsync(context, lucasWardLogin.Id, "Lucas Ward");
            await LinkAthleteToPlayerAsync(context, marcusBellLogin.Id, "Marcus Bell");
            await LinkAthleteToPlayerAsync(context, carlosSantosLogin.Id, "Carlos Santos Jr");
            await LinkAthleteToPlayerAsync(context, alexWilliamsLogin.Id, "Alex Williams");
            // These are self-guarded (skip if their tables already have rows), so existing
            // deployments get demo wellbeing check-ins + tasks on the next startup.
            await SeedWellbeingCheckinsAsync(context, today);
            await SeedPlayerTasksAsync(context, today);
            return;
        }

        // --- Players ---
        // Soccer positions: Goalkeeper=1, Defender=2, Midfielder=3, Winger=4, Striker=5
        var soccerPlayers = new[]
        {
            MakePlayer("Liam Carter", 19, 183, 78, 1, soccerTeam.Id, 1, 7,
                "Improve distribution under pressure.", "Strong shot-stopper, needs work on footwork."),
            MakePlayer("Noah Bennett", 20, 180, 75, 1, soccerTeam.Id, 2, 8,
                "Win more aerial duels.", "Solid in the tackle, good concentration."),
            MakePlayer("Ethan Brooks", 18, 176, 70, 1, soccerTeam.Id, 3, 8,
                "Increase passing accuracy in tight spaces.", "Good engine, reads the game well."),
            MakePlayer("Mason Reid", 21, 174, 68, 1, soccerTeam.Id, 4, 9,
                "Add a final ball to pace.", "Quick feet, needs end product.",
                injuryNotes: "Recovering from mild hamstring strain."),
            MakePlayer("Lucas Ward", 19, 179, 74, 1, soccerTeam.Id, 5, 8,
                "Improve finishing with weak foot.", "Top scorer this season."),
            MakePlayer("Oliver Hayes", 22, 181, 77, 1, soccerTeam.Id, 3, 6,
                "Build match fitness back up.", "Returning from injury, ease into full training load."),
            MakePlayer("Jack Turner", 20, 178, 73, 1, soccerTeam.Id, 2, 8,
                "Sharpen positioning for second-ball situations.", "Consistent performer, good in the air."),
            MakePlayer("Dylan Ross", 18, 175, 69, 1, soccerTeam.Id, 5, 7,
                "Develop movement off the ball.", "Promising young striker, needs game time.")
        };

        // Basketball positions: PointGuard=6, ShootingGuard=7, SmallForward=8, PowerForward=9, Center=10
        var basketballPlayers = new[]
        {
            MakePlayer("Marcus Bell", 20, 185, 80, 2, basketballTeam.Id, 6, 8,
                "Cut down turnovers.", "Excellent court vision."),
            MakePlayer("Tyler Grant", 19, 193, 88, 2, basketballTeam.Id, 8, 7,
                "Improve three-point consistency.", "Athletic wing, streaky from deep."),
            MakePlayer("Jordan Pierce", 21, 200, 100, 2, basketballTeam.Id, 10, 7,
                "Increase vertical for rebounding.", "Anchor of the defense."),
            MakePlayer("Caleb Foster", 18, 190, 84, 2, basketballTeam.Id, 9, 8,
                "Add mid-range jumper.", "High-effort player, great on the boards."),
            MakePlayer("Aiden Walsh", 19, 188, 82, 2, basketballTeam.Id, 7, 9,
                "Improve off-ball movement.", "Best shooter on the roster."),
            MakePlayer("Devon Clarke", 20, 183, 79, 2, basketballTeam.Id, 6, 8,
                "Improve pick-and-roll reads.", "Quick hands on defense, solid second PG."),
            MakePlayer("Ryan Thomas", 22, 203, 105, 2, basketballTeam.Id, 10, 6,
                "Develop post footwork.", "Physical presence, needs conditioning work.",
                injuryNotes: "Mild knee soreness being monitored.")
        };

        // Volleyball Indoor positions: Setter=11, OutsideHitter=12, OppositeHitter=13, MiddleBlocker=14, Libero=15
        var volleyballPlayers = new[]
        {
            MakePlayer("Sofia Martin", 20, 178, 65, 3, volleyballTeam.Id, 11, 8,
                "Faster set release.", "Team captain, excellent communication."),
            MakePlayer("Ava Coleman", 19, 184, 70, 3, volleyballTeam.Id, 12, 8,
                "Improve approach timing.", "Powerful swing, consistent in serve-receive."),
            MakePlayer("Grace Mitchell", 21, 187, 72, 3, volleyballTeam.Id, 14, 7,
                "Read blocks earlier.", "Strong at the net.",
                injuryNotes: "Mild shoulder soreness, monitoring load."),
            MakePlayer("Mia Sanders", 18, 170, 60, 3, volleyballTeam.Id, 15, 9,
                "Improve serve-receive consistency.", "Best defensive player on the team."),
            MakePlayer("Emma Reed", 20, 182, 68, 3, volleyballTeam.Id, 12, 8,
                "Add a jump serve to the arsenal.", "Good chemistry with the setter."),
            MakePlayer("Lily Park", 19, 185, 71, 3, volleyballTeam.Id, 13, 7,
                "Improve back-row attack.", "Natural opposite hitter, growing in confidence.")
        };

        // Beach Volleyball positions: Defender=16, Blocker=17, All-Round=18
        var beachVolleyPlayers = new[]
        {
            MakePlayer("Carlos Santos Jr", 22, 188, 82, 4, beachVolleyTeam.Id, 17, 9,
                "Win more one-on-one blocking duels.", "Explosive jumper, reads attackers well."),
            MakePlayer("Diego Vega", 21, 184, 78, 4, beachVolleyTeam.Id, 16, 8,
                "Improve defensive efficiency on deep balls.", "Excellent movement on sand."),
            MakePlayer("Kai Nakamura", 20, 186, 80, 4, beachVolleyTeam.Id, 18, 8,
                "Increase serving consistency on windy days.", "Versatile player, great communication."),
            MakePlayer("Marco Silva", 23, 190, 85, 4, beachVolleyTeam.Id, 17, 7,
                "Develop left-side attack options.", "Experienced, mentor for younger athletes.")
        };

        // Tennis positions: Singles=19, Doubles=20, Baseline=21, Serve-and-Volley=22, All-Court=23
        var tennisPlayers = new[]
        {
            MakePlayer("Alex Williams", 21, 183, 76, 5, tennisTeam.Id, 19, 8,
                "Improve serve consistency under pressure.", "Technically gifted, competitive mindset."),
            MakePlayer("Brooke Summers", 20, 170, 62, 5, tennisTeam.Id, 21, 8,
                "Add more variety to groundstrokes.", "Strong from the baseline, patient rallier."),
            MakePlayer("Finn O'Brien", 22, 185, 79, 5, tennisTeam.Id, 22, 7,
                "Sharpen net-play instincts.", "Classic serve-and-volley style, effective on fast courts."),
            MakePlayer("Nina Petrov", 19, 172, 64, 5, tennisTeam.Id, 23, 9,
                "Develop a go-to shot in deciding sets.", "Exceptional footwork, mentally tough."),
            MakePlayer("Sam Keller", 21, 179, 72, 5, tennisTeam.Id, 20, 7,
                "Improve doubles net positioning.", "Reliable doubles partner, solid return game.")
        };

        var allPlayers = soccerPlayers
            .Concat(basketballPlayers).Concat(volleyballPlayers)
            .Concat(beachVolleyPlayers).Concat(tennisPlayers).ToList();
        context.Players.AddRange(allPlayers);
        await context.SaveChangesAsync();

        // Link athlete accounts to their player rows
        soccerPlayers[4].UserId = lucasWardLogin.Id;         // Lucas Ward
        basketballPlayers[0].UserId = marcusBellLogin.Id;    // Marcus Bell
        beachVolleyPlayers[0].UserId = carlosSantosLogin.Id; // Carlos Santos Jr
        tennisPlayers[0].UserId = alexWilliamsLogin.Id;      // Alex Williams
        await context.SaveChangesAsync();

        // --- Assessments with upward trend per period ---
        await SeedAssessmentsAsync(context, soccerPlayers, (1, 8), soccerPeriods);
        await SeedAssessmentsAsync(context, basketballPlayers, (9, 16), basketballPeriods);
        await SeedAssessmentsAsync(context, volleyballPlayers, (17, 24), volleyballPeriods);
        await SeedAssessmentsAsync(context, beachVolleyPlayers, (25, 32), beachVolleyPeriods);
        await SeedAssessmentsAsync(context, tennisPlayers, (33, 40), tennisPeriods);

        // --- One improvement plan per player ---
        SeedImprovementPlans(context, soccerPlayers, basketballPlayers, volleyballPlayers, beachVolleyPlayers, tennisPlayers);

        // --- Nutrition profiles ---
        SeedNutritionProfiles(context, soccerPlayers, basketballPlayers, volleyballPlayers, beachVolleyPlayers, tennisPlayers);

        // --- Nutrition guidance (one per player) ---
        SeedNutritionGuidance(context, soccerPlayers, basketballPlayers, volleyballPlayers, beachVolleyPlayers, tennisPlayers);

        // --- Injury records (2 active, 3 recovered) ---
        SeedInjuryRecords(context, today, soccerPlayers, basketballPlayers, volleyballPlayers, beachVolleyPlayers, tennisPlayers);

        // --- Training sessions (5 per team) ---
        SeedTrainingSessions(context, today,
            soccerPlayers, soccerTeam.Id,
            basketballPlayers, basketballTeam.Id,
            volleyballPlayers, volleyballTeam.Id,
            beachVolleyPlayers, beachVolleyTeam.Id,
            tennisPlayers, tennisTeam.Id);

        // --- Match performances ---
        SeedMatchPerformances(context, today, soccerPlayers, basketballPlayers, volleyballPlayers, beachVolleyPlayers, tennisPlayers);

        await context.SaveChangesAsync();

        // --- Demo wellbeing check-ins + tasks (so dashboards/analytics look populated) ---
        await SeedWellbeingCheckinsAsync(context, today);
        await SeedPlayerTasksAsync(context, today);
    }

    // ─── Auth helpers ────────────────────────────────────────────────────────

    // Idempotently set a coach's billing plan (creates the row if missing; bumps Free → target).
    private static async Task EnsureCoachPlanAsync(ApplicationDbContext context, string coachId, BillingPlan plan)
    {
        var sub = await context.CoachSubscriptions.FirstOrDefaultAsync(s => s.CoachId == coachId);
        if (sub == null)
        {
            context.CoachSubscriptions.Add(new CoachSubscription { CoachId = coachId, Plan = plan, Status = "seed" });
            await context.SaveChangesAsync();
        }
        else if (sub.Plan < plan)
        {
            sub.Plan = plan;
            await context.SaveChangesAsync();
        }
    }

    private static async Task<ApplicationUser> GetOrCreateCoachAsync(
        UserManager<ApplicationUser> um, string email, string displayName)
    {
        var existing = await um.FindByEmailAsync(email);
        if (existing != null) return existing;
        var user = new ApplicationUser { UserName = email, Email = email, EmailConfirmed = true, DisplayName = displayName };
        var result = await um.CreateAsync(user, SeedPassword);
        if (!result.Succeeded)
            throw new InvalidOperationException($"Failed to create coach {email}: {string.Join(", ", result.Errors.Select(e => e.Description))}");
        await um.AddToRoleAsync(user, "Coach");
        return user;
    }

    private static async Task<ApplicationUser> GetOrCreateAthleteAsync(
        UserManager<ApplicationUser> um, string email, string displayName)
    {
        var existing = await um.FindByEmailAsync(email);
        if (existing != null) return existing;
        var user = new ApplicationUser { UserName = email, Email = email, EmailConfirmed = true, DisplayName = displayName };
        var result = await um.CreateAsync(user, SeedPassword);
        if (!result.Succeeded)
            throw new InvalidOperationException($"Failed to create athlete {email}: {string.Join(", ", result.Errors.Select(e => e.Description))}");
        await um.AddToRoleAsync(user, "Athlete");
        return user;
    }

    private static async Task LinkAthleteToPlayerAsync(ApplicationDbContext context, string userId, string playerName)
    {
        var player = await context.Players.FirstOrDefaultAsync(p => p.FullName == playerName && p.UserId == null);
        if (player == null) return;
        player.UserId = userId;
        await context.SaveChangesAsync();
    }

    // ─── Get-or-create helpers (idempotent for existing Railway DB) ──────────

    private static async Task<Team> GetOrCreateTeamAsync(ApplicationDbContext context, string name, int sportId, string coachId)
    {
        var existing = await context.Teams.FirstOrDefaultAsync(t => t.Name == name);
        if (existing != null) return existing;
        var team = new Team { Name = name, SportId = sportId, CoachId = coachId };
        context.Teams.Add(team);
        await context.SaveChangesAsync();
        return team;
    }

    private static async Task EnsureCoachScopeAsync(ApplicationDbContext context, string coachId, int teamId)
    {
        var exists = await context.CoachTeamScopes.AnyAsync(s => s.CoachId == coachId && s.TeamId == teamId);
        if (!exists)
        {
            context.CoachTeamScopes.Add(new CoachTeamScope { CoachId = coachId, TeamId = teamId });
            await context.SaveChangesAsync();
        }
    }

    private static async Task<List<AssessmentPeriod>> EnsureWeeklyPeriodsAsync(ApplicationDbContext context, int teamId, DateTime today)
    {
        var periods = new List<AssessmentPeriod>();
        var periodDefs = new[]
        {
            ("Week 1", today.AddDays(-21), today.AddDays(-15)),
            ("Week 2", today.AddDays(-14), today.AddDays(-8)),
            ("Week 3", today.AddDays(-7),  today.AddDays(-1)),
        };
        foreach (var (name, start, end) in periodDefs)
        {
            var p = await context.AssessmentPeriods.FirstOrDefaultAsync(ap => ap.Name == name && ap.TeamId == teamId);
            if (p == null)
            {
                p = new AssessmentPeriod { Name = name, TeamId = teamId, StartDate = start, EndDate = end };
                context.AssessmentPeriods.Add(p);
                await context.SaveChangesAsync();
            }
            periods.Add(p);
        }
        return periods;
    }

    // ─── Periods ─────────────────────────────────────────────────────────────

    private static List<AssessmentPeriod> CreateWeeklyPeriods(int teamId, DateTime today) =>
        new()
        {
            new() { Name = "Week 1", TeamId = teamId, StartDate = today.AddDays(-21), EndDate = today.AddDays(-15) },
            new() { Name = "Week 2", TeamId = teamId, StartDate = today.AddDays(-14), EndDate = today.AddDays(-8) },
            new() { Name = "Week 3", TeamId = teamId, StartDate = today.AddDays(-7), EndDate = today.AddDays(-1) }
        };

    // ─── Player factory ───────────────────────────────────────────────────────

    private static Player MakePlayer(
        string fullName, int age, double height, double weight,
        int sportId, int teamId, int positionId, int fitness,
        string? goals = null, string? coachNotes = null, string? injuryNotes = null) =>
        new()
        {
            FullName = fullName, Age = age, Height = height, Weight = weight,
            SportId = sportId, TeamId = teamId, PositionId = positionId,
            FitnessLevel = fitness, Goals = goals, CoachNotes = coachNotes, InjuryNotes = injuryNotes
        };

    // ─── Assessments ─────────────────────────────────────────────────────────

    private static async Task SeedAssessmentsAsync(
        ApplicationDbContext context, IEnumerable<Player> players,
        (int From, int To) categoryRange, List<AssessmentPeriod> periods)
    {
        var categoryIds = Enumerable.Range(categoryRange.From, categoryRange.To - categoryRange.From + 1).ToList();

        foreach (var player in players)
        {
            var rng = new Random(player.Id * 7919); // deterministic per player

            for (int pi = 0; pi < periods.Count; pi++)
            {
                // Upward trend: week 1 → 4–6, week 2 → 5–7, week 3 → 6–9
                int minS = pi == 0 ? 4 : pi == 1 ? 5 : 6;
                int maxExcl = pi == 0 ? 7 : pi == 1 ? 8 : 10;

                var assessment = new PlayerAssessment
                {
                    PlayerId = player.Id,
                    AssessmentPeriodId = periods[pi].Id,
                    DateRecorded = periods[pi].EndDate,
                    Notes = $"Period assessment — {periods[pi].Name}."
                };
                context.PlayerAssessments.Add(assessment);
                await context.SaveChangesAsync();

                foreach (var catId in categoryIds)
                {
                    context.PlayerStatScores.Add(new PlayerStatScore
                    {
                        PlayerAssessmentId = assessment.Id,
                        SportStatCategoryId = catId,
                        Score = rng.Next(minS, maxExcl)
                    });
                }
            }
        }
        await context.SaveChangesAsync();
    }

    // ─── Improvement Plans ────────────────────────────────────────────────────

    private static void SeedImprovementPlans(
        ApplicationDbContext context,
        Player[] sp, Player[] bp, Player[] vp, Player[] bvp, Player[] tp)
    {
        context.ImprovementPlans.AddRange(
            // Soccer
            Plan(sp[0], "Complete 3 extra goalkeeper distribution drills.",
                "Work on foot-pass accuracy from goal kicks.",
                "Accurate distribution to defenders under pressure.",
                "Goal-kick under press, short-pass outlet reps.",
                "Goalkeeper — launching attacks from the back.",
                "Solid week; keep pushing distribution quality."),
            Plan(sp[1], "Win 70% of aerial challenges this week.",
                "Heading and jump timing sessions twice weekly.",
                "Defensive heading and 1v1 ground defending.",
                "Cross delivery and header clearance reps.",
                "Defender — aerial duels and positional discipline.",
                "Consistent performer; fine-tune positioning."),
            Plan(sp[2], "Complete 3 rondo sessions focused on one-touch passing.",
                "Add passing accuracy drills under pressure.",
                "First-touch control and switch-of-play passes.",
                "4v2 rondo, switch-of-play passing ladder.",
                "Midfielder — receiving on the half-turn.",
                "Good progress, keep building game intelligence."),
            Plan(sp[3], "Deliver 5 quality final balls per training session.",
                "Crossing mechanics and decision-making work.",
                "Consistent final delivery from wide positions.",
                "Crossing runs, cut-back delivery, 1v1 beating.",
                "Winger — end product and direct play.",
                "Pace is a weapon; add delivery quality."),
            Plan(sp[4], "Score at least 2 goals with weak foot in training.",
                "Finish with both feet across all shooting reps.",
                "Composure in front of goal; weak foot accuracy.",
                "Finishing drill — both feet, driven shots.",
                "Striker — movement and clinical finishing.",
                "Top scorer; weak foot is the key next step."),
            Plan(sp[5], "Complete full 90-minute sessions without fatigue.",
                "Aerobic conditioning and ball-work intervals.",
                "Match fitness and ball retention under load.",
                "Aerobic intervals mixed with pressing patterns.",
                "Midfielder — press-trigger and game management.",
                "Returning well; manage load carefully."),
            Plan(sp[6], "Win 80% of defensive headers in set-pieces.",
                "Set-piece positioning and communication drill.",
                "Aerial defending and second-ball awareness.",
                "Heading zones, defensive shape in corners.",
                "Defender — set-piece defending and distribution.",
                "Dependable; communication on set pieces needs sharpening."),
            Plan(sp[7], "Make 10 smart runs off the ball per training session.",
                "Movement analysis and off-ball runs video session.",
                "Intelligent movement and goal-side positioning.",
                "Shadow runs, pressing trigger off defensive shape.",
                "Striker — off-ball movement and goal threat.",
                "Raw potential; needs to read defensive lines better."),
            // Basketball
            Plan(bp[0], "Limit turnovers to max 2 per scrimmage.",
                "Ball-security drills and decision-making reps.",
                "Clean ball-handling under defensive pressure.",
                "2-ball dribble, live 2v2 press defense.",
                "Point Guard — pace control and ball security.",
                "Excellent leader; reduce reckless passes."),
            Plan(bp[1], "Hit 40% from three-point range in spot-up drills.",
                "Catch-and-shoot repetitions from five spots.",
                "Three-point release mechanics and rhythm.",
                "Spot-up shooting, pin-down actions.",
                "Small Forward — off-ball movement and shooting.",
                "Streaky; build confidence with volume reps."),
            Plan(bp[2], "Box out on 90% of defensive rebounds this week.",
                "Post footwork and rim-protection positioning.",
                "Rebounding positioning and vertical timing.",
                "Drop step, mikan drill, shot-block timing.",
                "Center — rim protection and post defense.",
                "Anchor of defense; improve conditioning."),
            Plan(bp[3], "Make 5 mid-range jumpers per shooting session.",
                "Mid-range pull-up off the pick-and-roll.",
                "Elbow jumper and face-up post scoring.",
                "Pick-and-roll pull-up, face-up iso.",
                "Power Forward — scoring and rebounding.",
                "High effort; add a reliable mid-range shot."),
            Plan(bp[4], "Create 3 open catch-and-shoot opportunities per scrimmage.",
                "Off-ball screening actions and V-cuts.",
                "Movement without ball to create open looks.",
                "Zipper cuts, stagger screens, spot-up flow.",
                "Shooting Guard — off-ball shooting and movement.",
                "Best shooter on the team; keep moving."),
            Plan(bp[5], "Make the correct pick-and-roll read 80% of the time.",
                "Pick-and-roll film session and live reps.",
                "Decision-making as secondary ball-handler.",
                "2-man game, live pick-and-roll defense.",
                "Point Guard — secondary playmaking and defense.",
                "Solid backup PG; IQ is improving."),
            Plan(bp[6], "Complete all conditioning drills without breaks.",
                "Post footwork and aerobic conditioning.",
                "Post scoring and baseline conditioning.",
                "Drop step, lane slide, conditioning circuit.",
                "Center — post footwork and stamina.",
                "Physical presence; conditioning is the priority."),
            // Volleyball Indoor
            Plan(vp[0], "Release quick sets in under 0.8 seconds.",
                "Rapid-release setting drill with ball machine.",
                "Faster set tempo and back-set accuracy.",
                "Quick set reps, back-set accuracy targets.",
                "Setter — tempo control and distribution.",
                "Captain and engine of the team; speed is the edge."),
            Plan(vp[1], "Land approach jumps 10cm closer to the net.",
                "Approach timing and arm-swing mechanics.",
                "Explosive attack and consistent line/cross choice.",
                "4-step approach reps, arm-swing power drill.",
                "Outside Hitter — approach and attacking.",
                "Powerful hitter; sharpen approach timing."),
            Plan(vp[2], "Read the blocker set before the set is released.",
                "Block-read video session and live reps.",
                "Early block positioning and footwork speed.",
                "Block-step and reach, split-step timing.",
                "Middle Blocker — blocking and transition.",
                "Strong at the net; react to sets earlier."),
            Plan(vp[3], "Pass 85% of serves into zone 3.",
                "Serve-receive accuracy targeting drill.",
                "Platform accuracy and body positioning.",
                "Serve-receive reps from float, top-spin.",
                "Libero — serve-receive and floor defense.",
                "Best defender; serve-receive is the key stat."),
            Plan(vp[4], "Land 5 jump serves per session in the target zone.",
                "Jump serve approach and toss mechanics.",
                "Consistent jump serve with pace and placement.",
                "Jump serve toss reps, target-zone serving.",
                "Outside Hitter — serving and attack variety.",
                "Great teammate; serve needs more consistency."),
            Plan(vp[5], "Execute 3 successful back-row attacks per scrimmage.",
                "Back-row attack approach and timing work.",
                "Back-row attack and transition defense.",
                "Pipe approach, back-row tempo attack.",
                "Opposite Hitter — back-row attack and blocking.",
                "Growing confidence; back-row attack is the focus."),
            // Beach Volleyball
            Plan(bvp[0], "Win 75% of blocking duels in 1v1 drill.",
                "Block reading and hand positioning technique.",
                "Explosive block reach and hand-set accuracy.",
                "1v1 blocking reps, soft-block technique.",
                "Blocker — reading attacks and closing the angle.",
                "Explosive blocker; refine hand positioning."),
            Plan(bvp[1], "Dig 80% of hard-driven balls in the defensive zone.",
                "Low platform and emergency dig drills.",
                "Defensive efficiency and footwork on sand.",
                "Sand shuffle, emergency dig platform.",
                "Defender — coverage and dig efficiency.",
                "Excellent mover; extend range on deep balls."),
            Plan(bvp[2], "Land 80% of serves in the target zone on windy days.",
                "Serving mechanics adjusted for wind drift.",
                "Serving accuracy and shot-selection decisions.",
                "Wind-serve reps, float serve precision.",
                "All-Round Player — serving and tactical decision-making.",
                "Versatile; consistency in wind is the key target."),
            Plan(bvp[3], "Attack 3 left-side balls per game effectively.",
                "Left-side approach mechanics and roll shots.",
                "Left-side attack and strategic shot selection.",
                "Left-side approach, roll shot vs. line.",
                "Blocker — left-side attack and veteran leadership.",
                "Mentor figure; expand attack options."),
            // Tennis
            Plan(tp[0], "Hit 65% first serves in under pressure tiebreak scenarios.",
                "Pressure-serve simulation sets twice weekly.",
                "First serve placement and second serve kick.",
                "Target-serve drill, kick-serve mechanics.",
                "Singles Player — serve dominance and aggression.",
                "Technically sound; stay aggressive under pressure."),
            Plan(tp[1], "Add inside-out forehand to groundstroke repertoire.",
                "Variety drills: inside-out, cross-court, down-the-line.",
                "Cross-court backhand consistency and drop shot.",
                "Cross-court backhand rally, drop shot finish.",
                "Baseline Player — rally depth and variation.",
                "Strong baseline game; add more weapon variety."),
            Plan(tp[2], "Approach the net on 70% of short-ball opportunities.",
                "Net-approach drills and first-volley technique.",
                "Net approach and volley placement.",
                "Approach-volley combo, poach timing.",
                "Serve-and-Volley Player — net instincts and positioning.",
                "Natural net player; trust the instinct more."),
            Plan(tp[3], "Win 3 out of 5 practice tiebreakers per session.",
                "Tiebreak strategy and decisive shot selection.",
                "Deciding-set tactics and mental composure.",
                "Tiebreak simulation, go-to shot identification.",
                "All-Court Player — adaptability and mental toughness.",
                "Elite footwork; mental edge in tiebreaks is the goal."),
            Plan(tp[4], "Call the poach move correctly 3 times per doubles session.",
                "Poach timing and net communication drill.",
                "Net positioning and return-of-serve targets.",
                "Poach drill, I-formation serve returns.",
                "Doubles Player — net play and partner communication.",
                "Reliable partner; sharpen poach instincts.")
        );
    }

    private static ImprovementPlan Plan(Player p,
        string weekly, string training, string skill, string drills, string position, string notes) =>
        new()
        {
            PlayerId = p.Id, WeeklyGoals = weekly, TrainingRecommendations = training,
            SkillTargets = skill, SportSpecificDrills = drills, PositionFocus = position, CoachNotes = notes
        };

    // ─── Nutrition Profiles ───────────────────────────────────────────────────

    private static void SeedNutritionProfiles(
        ApplicationDbContext context,
        Player[] sp, Player[] bp, Player[] vp, Player[] bvp, Player[] tp)
    {
        context.PlayerNutritionProfiles.AddRange(
            NutProfile(sp[2], NutritionPreferenceType.Lifestyle, NutritionCategory.Vegetarian, NutritionSeverity.Lifestyle),
            NutProfile(sp[3], NutritionPreferenceType.Allergy, NutritionCategory.NutAllergy, NutritionSeverity.Hard,
                "peanuts", "Carries an EpiPen at all sessions."),
            NutProfile(sp[5], NutritionPreferenceType.Lifestyle, NutritionCategory.Halal, NutritionSeverity.Lifestyle),
            NutProfile(bp[0], NutritionPreferenceType.Lifestyle, NutritionCategory.Halal, NutritionSeverity.Lifestyle),
            NutProfile(bp[2], NutritionPreferenceType.Allergy, NutritionCategory.DairyFree, NutritionSeverity.Hard,
                "lactose", "Lactose intolerant — causes significant GI distress."),
            NutProfile(bp[5], NutritionPreferenceType.Lifestyle, NutritionCategory.Vegan, NutritionSeverity.Lifestyle),
            NutProfile(vp[0], NutritionPreferenceType.Lifestyle, NutritionCategory.Vegan, NutritionSeverity.Lifestyle),
            NutProfile(vp[2], NutritionPreferenceType.SoftPreference, NutritionCategory.NoFish, NutritionSeverity.Soft,
                "fish", "Dislikes the taste; coach can override if no good alternative."),
            NutProfile(vp[4], NutritionPreferenceType.Allergy, NutritionCategory.GlutenFree, NutritionSeverity.Hard,
                null, "Coeliac disease — strict gluten-free required."),
            NutProfile(bvp[0], NutritionPreferenceType.Lifestyle, NutritionCategory.Halal, NutritionSeverity.Lifestyle),
            NutProfile(bvp[1], NutritionPreferenceType.Lifestyle, NutritionCategory.Vegetarian, NutritionSeverity.Lifestyle),
            NutProfile(tp[3], NutritionPreferenceType.Lifestyle, NutritionCategory.NoRedMeat, NutritionSeverity.Lifestyle),
            NutProfile(tp[4], NutritionPreferenceType.SoftPreference, NutritionCategory.NutAllergy, NutritionSeverity.Soft,
                "tree nuts", "Mild aversion — not a clinical allergy, just prefers to avoid.")
        );
    }

    private static PlayerNutritionProfile NutProfile(
        Player p, NutritionPreferenceType type, NutritionCategory cat,
        NutritionSeverity severity, string? item = null, string? notes = null) =>
        new() { PlayerId = p.Id, PreferenceType = type, Category = cat, Severity = severity, SpecificItem = item, Notes = notes };

    // ─── Nutrition Guidance ───────────────────────────────────────────────────

    private static void SeedNutritionGuidance(
        ApplicationDbContext context,
        Player[] sp, Player[] bp, Player[] vp, Player[] bvp, Player[] tp)
    {
        context.NutritionGuidances.AddRange(
            // Soccer (8 players)
            Guidance(sp[0], "Maintain reflexes and sharp footwork through a 3-match week.",
                "Oatmeal with berries, grilled chicken pasta, vegetable stir-fry with rice.",
                "600ml water 2 hours before training; electrolyte drink on match days.",
                "Protein shake within 30 min post-session; foam roll after matches.",
                "Complex carbs, lean protein, dark leafy greens.",
                "Ultra-processed snacks, heavy meals within 2 hours of training."),
            Guidance(sp[1], "Fuel aerial and physical defending across a double-training week.",
                "Chicken and rice bowls, egg-white omelettes, banana and peanut butter.",
                "500ml water before training; coconut water post-session for electrolytes.",
                "Chocolate milk or protein shake post-session; sleep 8+ hours.",
                "Lean protein, potatoes, oats, bananas.",
                "Fried foods, high-sugar energy drinks."),
            Guidance(sp[2], "Sustain energy for high-pressing midfielder role — vegetarian diet.",
                "Lentil and quinoa bowls, tofu stir-fry, chickpea curry, oats with fruit.",
                "500ml water 2 hours before training; electrolytes on match day.",
                "Plant-protein shake or Greek yogurt within 30 min post-session.",
                "Lentils, quinoa, tofu, chickpeas, leafy greens.",
                "Refined sugar, fried foods, white bread."),
            Guidance(sp[3], "Support winger explosive speed — peanut-free plan.",
                "Sunflower seed butter on rice cakes, turkey wraps, sweet potato and chicken.",
                "700ml water in the 2 hours before training; diluted juice during matches.",
                "Rice cake with turkey slices within 20 min post-session.",
                "Turkey, sweet potato, sunflower seeds, oats, berries.",
                "All peanut products — check labels carefully."),
            Guidance(sp[4], "Maximise striker output across a 3-game week.",
                "Pasta with lean meat sauce, rice and grilled fish, banana smoothie.",
                "500ml pre-training; sports drink during matches.",
                "Recovery shake + stretching within 30 min of final whistle.",
                "Pasta, lean beef, fish, sweet potato, eggs.",
                "Heavy meals within 2 hours of kick-off."),
            Guidance(sp[5], "Rebuild match fitness sustainably — halal-compliant plan.",
                "Halal chicken and rice, lamb kebab bowls, lentil soup.",
                "600ml water pre-training; electrolytes during full sessions.",
                "Halal protein shake or dates with milk post-session.",
                "Halal chicken, lamb, rice, lentils, dates.",
                "Processed meats; products without clear halal certification."),
            Guidance(sp[6], "Support defensive heading and set-piece workload.",
                "Grilled salmon, roasted vegetables, whole-grain pasta, Greek yogurt.",
                "500ml water 2 hours pre-training; water during set-piece sessions.",
                "Protein yogurt or shake within 30 min post-session.",
                "Salmon, whole grains, leafy greens, Greek yogurt.",
                "Alcohol, ultra-processed snacks."),
            Guidance(sp[7], "Fuel developing striker's growth and recovery.",
                "Chicken and rice, eggs on toast, smoothie with oats.",
                "500ml water pre-training; sports drink after sessions over 90 min.",
                "Protein shake within 30 min; 8 hours sleep minimum.",
                "Lean chicken, eggs, oats, milk, fruit.",
                "Fast food, carbonated drinks before training."),
            // Basketball (7 players)
            Guidance(bp[0], "Sustain point guard intensity across back-to-back games — halal plan.",
                "Halal beef stir-fry, chicken and rice, lentil soup.",
                "700ml water pre-game; coconut water during long sessions.",
                "Halal protein shake or chicken strips within 30 min post-game.",
                "Halal lean meats, rice, lentils, dates, bananas.",
                "Processed meats; sports drinks with unlisted additives."),
            Guidance(bp[1], "Fuel small forward explosive movements.",
                "Turkey and sweet potato, pasta bolognese, trail mix.",
                "600ml water pre-session; sports drink at half-time.",
                "Protein bar or shake within 20 min post-session.",
                "Turkey, sweet potato, pasta, mixed nuts, berries.",
                "Heavy meals before games; excessive sugar."),
            Guidance(bp[2], "Support center rebounding and rim protection — dairy-free plan.",
                "Soy-milk protein shakes, rice and chicken, oat porridge with almond milk.",
                "700ml water pre-game; electrolyte tabs post-game.",
                "Soy-milk protein shake within 30 min post-session.",
                "Soy milk, oat milk, lean chicken, rice, oats.",
                "All dairy products — check labels for hidden lactose."),
            Guidance(bp[3], "Fuel power forward physical play and boards.",
                "Steak and rice, eggs and toast, banana and almond butter.",
                "600ml water pre-session; electrolytes mid-session.",
                "Protein shake + banana within 30 min of session end.",
                "Lean red meat, eggs, rice, almonds, bananas.",
                "Fried food, excessive refined carbs pre-game."),
            Guidance(bp[4], "Maximise shooting guard off-ball output.",
                "Chicken and pasta, rice bowls, smoothie with protein powder.",
                "500ml water 2 hours pre-game; water during warm-up.",
                "Chocolate milk or shake within 30 min post-game.",
                "Lean chicken, pasta, rice, fruit, milk.",
                "High-fat meals night before game day."),
            Guidance(bp[5], "Sustain backup PG energy — vegan plan.",
                "Tofu stir-fry, lentil dal with rice, vegan protein smoothies.",
                "600ml water pre-session; electrolyte tabs during doubles.",
                "Vegan protein shake within 30 min; overnight oats for recovery.",
                "Tofu, tempeh, lentils, quinoa, oat milk, leafy greens.",
                "Processed vegan snacks high in sugar or sodium."),
            Guidance(bp[6], "Support center conditioning and post-footwork recovery.",
                "Grilled chicken and sweet potato, rice bowls, peanut butter oats.",
                "700ml water pre-session; electrolytes after every game.",
                "Protein shake + foam roll within 30 min post-session.",
                "Lean chicken, sweet potato, rice, peanut butter, oats.",
                "High-fat fried food; excess red meat."),
            // Volleyball Indoor (6 players)
            Guidance(vp[0], "Keep setter reactive energy high across a tournament week — vegan plan.",
                "Tofu bowls, quinoa salad, vegan overnight oats, smoothies.",
                "500ml water 2 hours pre-match; electrolyte drink during matches.",
                "Vegan protein shake within 30 min; gentle stretch + sleep.",
                "Tofu, quinoa, lentils, oat milk, berries, leafy greens.",
                "Processed vegan foods high in sodium."),
            Guidance(vp[1], "Fuel outside hitter explosive approach jumps.",
                "Grilled chicken, pasta, sweet potato, eggs.",
                "600ml water pre-training; sports drink after long sessions.",
                "Protein shake or chocolate milk within 30 min post-session.",
                "Lean chicken, pasta, eggs, bananas, sweet potato.",
                "Heavy meals within 2 hours of match time."),
            Guidance(vp[2], "Support middle blocker explosive jumps — no-fish preference accommodated.",
                "Chicken rice bowls, lentil soup, egg omelettes, Greek yogurt.",
                "500ml water pre-session; coconut water post-session.",
                "Greek yogurt within 30 min of training end; 8 hours sleep.",
                "Chicken, eggs, lentils, Greek yogurt, sweet potato.",
                "Fish and fish-based sauces."),
            Guidance(vp[3], "Sustain libero defensive intensity — high carb focus.",
                "Pasta and chicken, rice bowls, fruit smoothies, oats.",
                "600ml water pre-match; sports drink during long games.",
                "Protein shake + banana within 20 min of match end.",
                "Pasta, rice, oats, lean chicken, fruit.",
                "Low-carb meals on match days."),
            Guidance(vp[4], "Fuel outside hitter attack and jump serve — gluten-free plan.",
                "Rice and chicken, gluten-free pasta bowls, sweet potato mash.",
                "500ml water 2 hours pre-training; electrolytes post-session.",
                "Gluten-free protein shake within 30 min post-session.",
                "Rice, quinoa, sweet potato, lean chicken, eggs.",
                "All wheat products — check labels carefully for hidden gluten."),
            Guidance(vp[5], "Build opposite hitter power and back-row attack ability.",
                "Steak and rice, protein shakes, fruit and nut mix, oats.",
                "600ml water pre-training; sports drink on game day.",
                "Protein shake + stretching within 30 min post-session.",
                "Lean beef, rice, oats, nuts, berries.",
                "High-fat meals the night before competition."),
            // Beach Volleyball (4 players)
            Guidance(bvp[0], "Sustain blocker explosiveness in hot beach conditions — halal plan.",
                "Halal chicken and rice, grilled lamb, dates, coconut water.",
                "1L water 2 hours pre-match; electrolyte drink every 20 min on court.",
                "Halal protein shake or dates with water within 20 min post-match.",
                "Halal lean meats, rice, dates, bananas, coconut water.",
                "Processed meats; sugary drinks that cause energy crashes."),
            Guidance(bvp[1], "Fuel beach volleyball defender — vegetarian plan.",
                "Lentil and quinoa salads, veggie wraps, tofu bowls, fruit smoothies.",
                "1L water before play; coconut water throughout beach sessions.",
                "Plant protein shake within 30 min; fruit and nuts as recovery snack.",
                "Lentils, quinoa, tofu, Greek yogurt, fruit.",
                "Fried foods; meals high in saturated fat pre-match."),
            Guidance(bvp[2], "Maintain all-round player consistency across a beach tournament.",
                "Chicken and rice, protein bars, bananas, sports drinks.",
                "1L water pre-play; electrolyte tabs every set in hot conditions.",
                "Protein shake + stretching within 30 min of final match.",
                "Lean chicken, rice, oats, bananas, berries.",
                "Alcohol during tournament week; heavy pre-match meals."),
            Guidance(bvp[3], "Support experienced blocker's recovery and longevity.",
                "Grilled salmon, rice, sweet potato, anti-inflammatory smoothie.",
                "1L water pre-match; coconut water during breaks.",
                "Omega-3 supplement post-match; protein shake within 30 min.",
                "Salmon, sweet potato, berries, turmeric, ginger.",
                "Excess red meat; fried foods."),
            // Tennis (5 players)
            Guidance(tp[0], "Sustain singles player intensity across a 3-set match.",
                "Pasta and chicken, banana before warm-up, sports drink on court.",
                "500ml water 2 hours before match; sip water every changeover.",
                "Recovery shake within 30 min; light stretch and cold water immersion.",
                "Pasta, lean chicken, bananas, sports drinks.",
                "High-fat meals night before match."),
            Guidance(tp[1], "Fuel baseline rallier endurance for long matches.",
                "Oats with fruit, rice and chicken bowls, energy bars between sets.",
                "600ml water pre-match; electrolyte drink at changeovers.",
                "Protein shake + banana within 30 min post-match.",
                "Oats, lean chicken, rice, bananas, energy gels.",
                "Ultra-processed snacks; excess caffeine on match days."),
            Guidance(tp[2], "Support net-play explosiveness and serve power.",
                "Grilled fish, chicken, eggs, quinoa bowls, nut butter on toast.",
                "500ml water 2 hours pre-match; sip at every changeover.",
                "Protein shake or eggs within 30 min post-match.",
                "Fish, chicken, eggs, quinoa, mixed nuts.",
                "Heavy meals within 3 hours of a match."),
            Guidance(tp[3], "Sustain all-court player's footwork energy across a 3-hour match.",
                "Pasta and lean chicken, bananas, energy gels mid-match.",
                "700ml water 2 hours pre-match; electrolytes at every changeover.",
                "Recovery shake + ice bath within 30 min of final point.",
                "Pasta, lean protein, bananas, berries, oats.",
                "Fried foods; high-sugar sweets that cause energy crashes."),
            Guidance(tp[4], "Maintain doubles player focus and net-play reactions.",
                "Chicken and rice, oats, sports drink on court, protein bar between sets.",
                "500ml water 2 hours before; sip at every changeover.",
                "Protein shake or chocolate milk within 30 min post-match.",
                "Lean chicken, rice, oats, nuts, milk.",
                "Late-night heavy meals; excessive caffeine.")
        );
    }

    private static NutritionGuidance Guidance(
        Player p, string goal, string meals, string hydration,
        string recovery, string prioritize, string limit) =>
        new()
        {
            PlayerId = p.Id, Goal = goal, MealSuggestions = meals,
            HydrationTips = hydration, RecoveryTips = recovery,
            FoodsToPrioritize = prioritize, FoodsToLimit = limit
        };

    // ─── Injury Records ───────────────────────────────────────────────────────

    private static void SeedInjuryRecords(
        ApplicationDbContext context, DateTime today,
        Player[] sp, Player[] bp, Player[] vp, Player[] bvp, Player[] tp)
    {
        context.InjuryRecords.AddRange(
            // Active (2)
            new InjuryRecord
            {
                PlayerId = sp[3].Id, InjuryDate = today.AddDays(-21),
                InjuryType = "Hamstring strain", Severity = InjurySeverity.Minor,
                RecoveryStatus = RecoveryStatus.Recovering,
                Notes = "Grade 1 strain, responding well to physio.",
                ExpectedReturnDate = today.AddDays(7)
            },
            new InjuryRecord
            {
                PlayerId = vp[2].Id, InjuryDate = today.AddDays(-10),
                InjuryType = "Shoulder soreness", Severity = InjurySeverity.Minor,
                RecoveryStatus = RecoveryStatus.Active,
                Notes = "Load management in effect — no overhead drills this week.",
                ExpectedReturnDate = today.AddDays(5)
            },
            // Recovered (3)
            new InjuryRecord
            {
                PlayerId = bp[6].Id, InjuryDate = today.AddDays(-45),
                InjuryType = "Knee sprain", Severity = InjurySeverity.Moderate,
                RecoveryStatus = RecoveryStatus.FullyRecovered,
                Notes = "Grade 2 MCL sprain. Completed rehab programme.",
                ExpectedReturnDate = today.AddDays(-14)
            },
            new InjuryRecord
            {
                PlayerId = sp[5].Id, InjuryDate = today.AddDays(-60),
                InjuryType = "Adductor strain", Severity = InjurySeverity.Moderate,
                RecoveryStatus = RecoveryStatus.FullyRecovered,
                Notes = "Six-week recovery completed. Cleared for full training.",
                ExpectedReturnDate = today.AddDays(-10)
            },
            new InjuryRecord
            {
                PlayerId = bvp[3].Id, InjuryDate = today.AddDays(-30),
                InjuryType = "Ankle sprain", Severity = InjurySeverity.Minor,
                RecoveryStatus = RecoveryStatus.FullyRecovered,
                Notes = "Grade 1 lateral ankle sprain. Fully recovered.",
                ExpectedReturnDate = today.AddDays(-15)
            }
        );
    }

    // ─── Wellbeing Check-ins ──────────────────────────────────────────────────

    // 14 days of daily check-ins for a handful of athletes. Deterministic (no RNG) so it's
    // reproducible. Idempotent per (player, date): only inserts days that don't already have
    // a check-in, so it never duplicates and never clobbers a real athlete-submitted entry.
    // Mason Reid (a recovering-hamstring soccer player) reports pain today so the coach's
    // Team Wellbeing card shows a pain-during-recovery alert out of the box.
    private static async Task SeedWellbeingCheckinsAsync(ApplicationDbContext context, DateTime today)
    {
        var profiles = new (string Name, int Baseline, bool PainToday, string? PainArea)[]
        {
            ("Lucas Ward",   4, false, null),
            ("Ethan Brooks", 4, false, null),
            ("Noah Bennett", 3, false, null),
            ("Mason Reid",   2, true,  "Hamstring"),
            ("Marcus Bell",  4, false, null),
        };

        var names = profiles.Select(p => p.Name).ToList();
        var idByName = await context.Players
            .Where(p => names.Contains(p.FullName))
            .ToDictionaryAsync(p => p.FullName, p => p.Id);
        var playerIds = idByName.Values.ToList();

        // Existing (player, date) pairs to avoid duplicating / overwriting real entries.
        var existing = (await context.WellbeingCheckins
                .Where(c => playerIds.Contains(c.PlayerId))
                .Select(c => new { c.PlayerId, c.Date })
                .ToListAsync())
            .Select(x => (x.PlayerId, x.Date.Date))
            .ToHashSet();

        var checkins = new List<WellbeingCheckin>();
        foreach (var prof in profiles)
        {
            if (!idByName.TryGetValue(prof.Name, out var playerId)) continue;

            for (var d = 13; d >= 0; d--)
            {
                var date = today.AddDays(-d);
                if (existing.Contains((playerId, date.Date))) continue; // keep real data

                var feeling = Math.Clamp(prof.Baseline + (((d * 3) % 3) - 1), 1, 5);
                var energy  = Math.Clamp(prof.Baseline + (((d + 1) % 3) - 1), 1, 5);
                var sleep   = Math.Clamp(prof.Baseline + (((d + 2) % 3) - 1), 1, 5);
                var pain = prof.PainToday && d == 0;

                checkins.Add(new WellbeingCheckin
                {
                    PlayerId = playerId,
                    Date = date,
                    Feeling = feeling,
                    Energy = energy,
                    Sleep = sleep,
                    HasPain = pain,
                    PainArea = pain ? prof.PainArea : null,
                    PainNote = pain ? "Tightness during sprints — easing off today." : null,
                    CreatedAt = date,
                });
            }
        }

        if (checkins.Count > 0)
        {
            context.WellbeingCheckins.AddRange(checkins);
            await context.SaveChangesAsync();
        }
    }

    // ─── Player Tasks ─────────────────────────────────────────────────────────

    private enum SeedTaskState { Completed, Pending, Overdue }
    // PlayerSlot deliberately clusters outcomes so the demo has a clear top performer
    // (slots 0/1 = all completed) and a clear needs-attention athlete (slot 3 = overdue).
    private record SeedTaskSpec(
        string Title, string? Description, TaskCategory Category, TaskPriority Priority,
        int CreatedDaysAgo, SeedTaskState State, int DueOffsetDays, int CompletedDaysAgo, int PlayerSlot);

    // Seeds a realistic spread of tasks for the two demo teams' coaches, so the coach Tasks
    // page + analytics (completion rate, overdue, weekly trend, callouts) are populated.
    // Self-guarded on the PlayerTasks table.
    private static async Task SeedPlayerTasksAsync(ApplicationDbContext context, DateTime today)
    {
        if (await context.PlayerTasks.AnyAsync()) return;

        // Mix of states/categories/priorities spread over ~3 weeks (for the weekly trend):
        // 6 completed, 6 pending, 2 overdue.
        var specs = new[]
        {
            new SeedTaskSpec("Complete film review of last match", "Note 3 positioning takeaways.", TaskCategory.Tactical, TaskPriority.Medium, 18, SeedTaskState.Completed, 0, 15, 0),
            new SeedTaskSpec("Weak-foot finishing — 3 sessions", "30 minutes, focus on accuracy over power.", TaskCategory.Training, TaskPriority.High, 16, SeedTaskState.Completed, 0, 12, 0),
            new SeedTaskSpec("Log daily hydration for a week", "Track fluid intake and report back.", TaskCategory.Nutrition, TaskPriority.Low, 14, SeedTaskState.Completed, 0, 9, 1),
            new SeedTaskSpec("Core stability circuit ×2", "Planks, dead bugs, bird dogs.", TaskCategory.Physical, TaskPriority.Medium, 12, SeedTaskState.Completed, 0, 8, 1),
            new SeedTaskSpec("Study set-piece assignments", "Learn your marking role on corners.", TaskCategory.Tactical, TaskPriority.Medium, 9, SeedTaskState.Completed, 0, 6, 2),
            new SeedTaskSpec("Extra passing drills (20 min)", "One- and two-touch under light pressure.", TaskCategory.Training, TaskPriority.Medium, 7, SeedTaskState.Completed, 0, 3, 4),
            new SeedTaskSpec("Sprint interval session", "6 × 40m at 90%, 90s rest between reps.", TaskCategory.Physical, TaskPriority.High, 10, SeedTaskState.Overdue, 2, 0, 3),
            new SeedTaskSpec("Weak-side defending drills", "Recovery runs and covering angles.", TaskCategory.Tactical, TaskPriority.High, 5, SeedTaskState.Overdue, 1, 0, 3),
            new SeedTaskSpec("Mobility routine before each session", "Dynamic warm-up, 10 minutes.", TaskCategory.Recovery, TaskPriority.Low, 11, SeedTaskState.Pending, 3, 0, 2),
            new SeedTaskSpec("Increase protein at breakfast", "Aim for 30g protein in the morning.", TaskCategory.Nutrition, TaskPriority.Medium, 6, SeedTaskState.Pending, 5, 0, 4),
            new SeedTaskSpec("Foam-rolling + stretch nightly", "10 minutes before bed.", TaskCategory.Recovery, TaskPriority.Low, 4, SeedTaskState.Pending, 2, 0, 3),
            new SeedTaskSpec("Complete fitness benchmark test", "Beep test — record your level.", TaskCategory.Physical, TaskPriority.High, 3, SeedTaskState.Pending, 4, 0, 5),
            new SeedTaskSpec("Review nutrition plan with coach", "Book a 15-minute slot this week.", TaskCategory.Nutrition, TaskPriority.Low, 2, SeedTaskState.Pending, 6, 0, 6),
            new SeedTaskSpec("Finishing under fatigue drill", "Shooting reps after conditioning.", TaskCategory.Training, TaskPriority.High, 1, SeedTaskState.Pending, 7, 0, 7),
        };

        var teams = await context.Teams
            .Where(t => t.Name == "City FC U18" || t.Name == "Riverside Hawks")
            .Include(t => t.Players)
            .ToListAsync();

        var tasks = new List<PlayerTask>();
        foreach (var team in teams)
        {
            var players = team.Players.OrderBy(p => p.Id).ToList();
            if (players.Count == 0) continue;

            foreach (var spec in specs)
            {
                var player = players[spec.PlayerSlot % players.Count];
                var createdAt = today.AddDays(-spec.CreatedDaysAgo);

                var task = new PlayerTask
                {
                    CoachId = team.CoachId,
                    PlayerId = player.Id,
                    Title = spec.Title,
                    Description = spec.Description,
                    Priority = spec.Priority,
                    Category = spec.Category,
                    CreatedAt = createdAt,
                };

                switch (spec.State)
                {
                    case SeedTaskState.Completed:
                        task.IsCompleted = true;
                        task.CompletedAt = today.AddDays(-spec.CompletedDaysAgo);
                        task.CompletedNote = "Done — felt good.";
                        break;
                    case SeedTaskState.Pending:
                        task.DueDate = today.AddDays(spec.DueOffsetDays);
                        break;
                    case SeedTaskState.Overdue:
                        task.DueDate = today.AddDays(-spec.DueOffsetDays);
                        break;
                }
                tasks.Add(task);
            }
        }

        context.PlayerTasks.AddRange(tasks);
        await context.SaveChangesAsync();
    }

    // ─── Training Sessions ────────────────────────────────────────────────────

    private static void SeedTrainingSessions(
        ApplicationDbContext context, DateTime today,
        Player[] sp, int soccerTeamId,
        Player[] bp, int basketballTeamId,
        Player[] vp, int volleyballTeamId,
        Player[] bvp, int beachVolleyTeamId,
        Player[] tp, int tennisTeamId)
    {
        // Soccer — 5 sessions × 8 players
        AddSessions(context, sp, soccerTeamId, 90,
            new[] { today.AddDays(-14), today.AddDays(-10), today.AddDays(-7), today.AddDays(-4), today.AddDays(-2) },
            new AttendanceStatus[][]
            {
                new[] { AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Excused,  AttendanceStatus.Present, AttendanceStatus.Present },
                new[] { AttendanceStatus.Present, AttendanceStatus.Late,    AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Present,  AttendanceStatus.Absent,  AttendanceStatus.Present },
                new[] { AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Excused, AttendanceStatus.Present, AttendanceStatus.Present,  AttendanceStatus.Present, AttendanceStatus.Present },
                new[] { AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Late,    AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Present,  AttendanceStatus.Present, AttendanceStatus.Absent  },
                new[] { AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Present,  AttendanceStatus.Present, AttendanceStatus.Present }
            },
            new string?[][]
            {
                new string?[] { "GK drills — full session.", null, null, null, null, "Excused — family commitment.", null, null },
                new string?[] { null, "Arrived 10 min late.", null, null, null, null, "Absent — illness.", null },
                new string?[] { null, null, null, "Excused — medical appointment.", null, null, null, null },
                new string?[] { null, null, "Arrived 5 min late.", null, null, null, null, "Absent — school exam." },
                new string?[] { null, null, null, null, null, null, null, null }
            });

        // Basketball — 5 sessions × 7 players
        AddSessions(context, bp, basketballTeamId, 75,
            new[] { today.AddDays(-13), today.AddDays(-10), today.AddDays(-6), today.AddDays(-3), today.AddDays(-1) },
            new AttendanceStatus[][]
            {
                new[] { AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Late,    AttendanceStatus.Present },
                new[] { AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Absent,  AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Present },
                new[] { AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Excused },
                new[] { AttendanceStatus.Late,    AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Present },
                new[] { AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Present }
            },
            new string?[][]
            {
                new string?[] { null, null, null, null, null, "Late — traffic.", null },
                new string?[] { null, null, "Absent — illness.", null, null, null, null },
                new string?[] { null, null, null, null, null, null, "Excused — physio appointment." },
                new string?[] { "Arrived 8 min late.", null, null, null, null, null, null },
                new string?[] { null, null, null, null, null, null, null }
            });

        // Volleyball — 5 sessions × 6 players
        AddSessions(context, vp, volleyballTeamId, 90,
            new[] { today.AddDays(-15), today.AddDays(-11), today.AddDays(-7), today.AddDays(-4), today.AddDays(-2) },
            new AttendanceStatus[][]
            {
                new[] { AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Excused, AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Present },
                new[] { AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Late,    AttendanceStatus.Present },
                new[] { AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Absent  },
                new[] { AttendanceStatus.Present, AttendanceStatus.Late,    AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Present },
                new[] { AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Present }
            },
            new string?[][]
            {
                new string?[] { null, null, "Physio appointment.", null, null, null },
                new string?[] { null, null, null, null, "Late — 10 min.", null },
                new string?[] { null, null, null, null, null, "Absent — illness." },
                new string?[] { null, "Late — 5 min.", null, null, null, null },
                new string?[] { null, null, null, null, null, null }
            });

        // Beach Volleyball — 5 sessions × 4 players
        AddSessions(context, bvp, beachVolleyTeamId, 120,
            new[] { today.AddDays(-14), today.AddDays(-10), today.AddDays(-7), today.AddDays(-3), today.AddDays(-1) },
            new AttendanceStatus[][]
            {
                new[] { AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Present },
                new[] { AttendanceStatus.Present, AttendanceStatus.Late,    AttendanceStatus.Present, AttendanceStatus.Present },
                new[] { AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Excused },
                new[] { AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Present },
                new[] { AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Present }
            },
            new string?[][]
            {
                new string?[] { null, null, null, null },
                new string?[] { null, "Late — 15 min.", null, null },
                new string?[] { null, null, null, "Excused — travel." },
                new string?[] { null, null, null, null },
                new string?[] { null, null, null, null }
            });

        // Tennis — 5 sessions × 5 players
        AddSessions(context, tp, tennisTeamId, 90,
            new[] { today.AddDays(-13), today.AddDays(-9), today.AddDays(-6), today.AddDays(-3), today.AddDays(-1) },
            new AttendanceStatus[][]
            {
                new[] { AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Late    },
                new[] { AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Absent,  AttendanceStatus.Present, AttendanceStatus.Present },
                new[] { AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Present },
                new[] { AttendanceStatus.Late,    AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Present },
                new[] { AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Present }
            },
            new string?[][]
            {
                new string?[] { null, null, null, null, "Late — 10 min." },
                new string?[] { null, null, "Absent — illness.", null, null },
                new string?[] { null, null, null, null, null },
                new string?[] { "Late — 7 min.", null, null, null, null },
                new string?[] { null, null, null, null, null }
            });
    }

    private static void AddSessions(
        ApplicationDbContext context,
        Player[] players, int teamId, int durationMinutes,
        DateTime[] dates, AttendanceStatus[][] attendance, string?[][] notes)
    {
        for (int s = 0; s < dates.Length; s++)
            for (int p = 0; p < players.Length; p++)
                context.TrainingSessions.Add(new TrainingSession
                {
                    PlayerId = players[p].Id, TeamId = teamId,
                    Date = dates[s], DurationMinutes = durationMinutes,
                    AttendanceStatus = attendance[s][p],
                    Notes = notes[s][p]
                });
    }

    // ─── Match Performances ───────────────────────────────────────────────────

    private static void SeedMatchPerformances(
        ApplicationDbContext context, DateTime today,
        Player[] sp, Player[] bp, Player[] vp, Player[] bvp, Player[] tp)
    {
        var soccerOpps = new[] { "Riverside United", "Northern FC", "Eastside Athletic", "Harbor City" };
        var soccerDays = new[] { -22, -15, -8, -3 };

        AddMatches(context, sp[0], today, soccerDays, soccerOpps,
            new[] { 7, 8, 7, 9 },
            new[] { "Solid performance — 4 key saves.", "Commanded the box well.", "Good distribution, one error.", "Best performance of the season — 6 saves." },
            new[] { "{\"Saves\":4,\"GoalsConceded\":1,\"DistributionAccuracy\":78}", "{\"Saves\":3,\"GoalsConceded\":0,\"DistributionAccuracy\":82}", "{\"Saves\":2,\"GoalsConceded\":2,\"DistributionAccuracy\":75}", "{\"Saves\":6,\"GoalsConceded\":0,\"DistributionAccuracy\":85}" });

        AddMatches(context, sp[1], today, soccerDays, soccerOpps,
            new[] { 7, 8, 6, 8 },
            new[] { "Strong aerial performance.", "Key interceptions in second half.", "Caught out of position once.", "Led defensive line superbly." },
            new[] { "{\"Tackles\":4,\"AerialDuelsWon\":3,\"Interceptions\":2}", "{\"Tackles\":5,\"AerialDuelsWon\":4,\"Interceptions\":3}", "{\"Tackles\":3,\"AerialDuelsWon\":2,\"Interceptions\":1}", "{\"Tackles\":6,\"AerialDuelsWon\":5,\"Interceptions\":4}" });

        AddMatches(context, sp[2], today, soccerDays, soccerOpps,
            new[] { 7, 8, 7, 9 },
            new[] { "Good passing tempo set.", "Controlled midfield battle.", "Struggled in tight spaces early on.", "Superb game — orchestrated attack." },
            new[] { "{\"Passes\":42,\"PassAccuracy\":81,\"Touches\":68}", "{\"Passes\":51,\"PassAccuracy\":86,\"Touches\":75}", "{\"Passes\":38,\"PassAccuracy\":78,\"Touches\":60}", "{\"Passes\":58,\"PassAccuracy\":89,\"Touches\":82}" });

        AddMatches(context, sp[3], today, soccerDays, soccerOpps,
            new[] { 7, 6, 8, 7 },
            new[] { "Good direct running.", "Hamstring tightness — subbed off at 60 min.", "Back to full speed.", "Dangerous all game." },
            new[] { "{\"Crosses\":4,\"DribbleSuccess\":3,\"Assists\":1}", "{\"Crosses\":2,\"DribbleSuccess\":1,\"Assists\":0}", "{\"Crosses\":6,\"DribbleSuccess\":4,\"Assists\":2}", "{\"Crosses\":5,\"DribbleSuccess\":3,\"Assists\":1}" });

        AddMatches(context, sp[4], today, soccerDays, soccerOpps,
            new[] { 8, 7, 9, 8 },
            new[] { "Scored twice, strong link-up play.", "Efficient hold-up play.", "Hat-trick — best game of season.", "Scored and created another." },
            new[] { "{\"Goals\":2,\"Shots\":5,\"PassAccuracy\":82}", "{\"Goals\":1,\"Shots\":4,\"PassAccuracy\":79}", "{\"Goals\":3,\"Shots\":6,\"PassAccuracy\":84}", "{\"Goals\":1,\"Shots\":3,\"PassAccuracy\":81}" });

        AddMatches(context, sp[5], today, soccerDays, soccerOpps,
            new[] { 6, 7, 7, 8 },
            new[] { "Easing back in, managed load.", "Better — pressing triggers improving.", "Good composure on the ball.", "Full 90 — best return so far." },
            new[] { "{\"Passes\":35,\"PassAccuracy\":80,\"Touches\":55}", "{\"Passes\":44,\"PassAccuracy\":83,\"Touches\":65}", "{\"Passes\":47,\"PassAccuracy\":84,\"Touches\":70}", "{\"Passes\":52,\"PassAccuracy\":87,\"Touches\":78}" });

        AddMatches(context, sp[6], today, soccerDays, soccerOpps,
            new[] { 8, 7, 8, 9 },
            new[] { "Excellent in the air.", "Solid defensive display.", "Won all headers in set pieces.", "Dominant — best defender on the pitch." },
            new[] { "{\"Tackles\":5,\"AerialDuelsWon\":4,\"Clearances\":3}", "{\"Tackles\":4,\"AerialDuelsWon\":3,\"Clearances\":2}", "{\"Tackles\":6,\"AerialDuelsWon\":5,\"Clearances\":4}", "{\"Tackles\":7,\"AerialDuelsWon\":6,\"Clearances\":5}" });

        AddMatches(context, sp[7], today, soccerDays, soccerOpps,
            new[] { 6, 7, 7, 8 },
            new[] { "Lively but wasteful in front of goal.", "Better movement off the ball.", "Scored late substitute goal.", "Full 90 — impressive pressing." },
            new[] { "{\"Goals\":0,\"Shots\":3,\"PassAccuracy\":75}", "{\"Goals\":0,\"Shots\":2,\"PassAccuracy\":77}", "{\"Goals\":1,\"Shots\":3,\"PassAccuracy\":80}", "{\"Goals\":1,\"Shots\":4,\"PassAccuracy\":82}" });

        var bbOpps = new[] { "Northgate Eagles", "Summit Wolves", "Lakeside Lions", "Metro Thunder" };
        var bbDays = new[] { -21, -14, -7, -2 };

        AddMatches(context, bp[0], today, bbDays, bbOpps,
            new[] { 8, 7, 9, 8 },
            new[] { "Great vision, 2 TOs.", "Steady floor game.", "Career-best assist night.", "Controlled pace perfectly." },
            new[] { "{\"Points\":12,\"Assists\":8,\"Rebounds\":3,\"Turnovers\":2}", "{\"Points\":10,\"Assists\":6,\"Rebounds\":4,\"Turnovers\":3}", "{\"Points\":14,\"Assists\":11,\"Rebounds\":3,\"Turnovers\":1}", "{\"Points\":13,\"Assists\":9,\"Rebounds\":5,\"Turnovers\":2}" });

        AddMatches(context, bp[1], today, bbDays, bbOpps,
            new[] { 7, 8, 7, 9 },
            new[] { "Efficient shooting night.", "Streaky — hot second half.", "Solid wing play.", "Career-high scoring game." },
            new[] { "{\"Points\":18,\"Assists\":4,\"Rebounds\":3,\"ThreePointers\":4}", "{\"Points\":22,\"Assists\":3,\"Rebounds\":5,\"ThreePointers\":5}", "{\"Points\":16,\"Assists\":2,\"Rebounds\":4,\"ThreePointers\":3}", "{\"Points\":27,\"Assists\":4,\"Rebounds\":6,\"ThreePointers\":7}" });

        AddMatches(context, bp[2], today, bbDays, bbOpps,
            new[] { 7, 8, 7, 9 },
            new[] { "Anchored defense, 10 boards.", "Dominant rebounding.", "3 blocks, key presence.", "Career rebounding game." },
            new[] { "{\"Points\":8,\"Assists\":1,\"Rebounds\":10,\"Blocks\":2}", "{\"Points\":12,\"Assists\":2,\"Rebounds\":12,\"Blocks\":3}", "{\"Points\":9,\"Assists\":1,\"Rebounds\":9,\"Blocks\":3}", "{\"Points\":14,\"Assists\":2,\"Rebounds\":15,\"Blocks\":4}" });

        AddMatches(context, bp[3], today, bbDays, bbOpps,
            new[] { 8, 7, 8, 9 },
            new[] { "Double-double on boards.", "Good two-way game.", "Key putbacks in fourth quarter.", "Career night all round." },
            new[] { "{\"Points\":14,\"Assists\":3,\"Rebounds\":10,\"FGPercent\":52}", "{\"Points\":12,\"Assists\":2,\"Rebounds\":8,\"FGPercent\":48}", "{\"Points\":16,\"Assists\":3,\"Rebounds\":11,\"FGPercent\":55}", "{\"Points\":20,\"Assists\":4,\"Rebounds\":13,\"FGPercent\":60}" });

        AddMatches(context, bp[4], today, bbDays, bbOpps,
            new[] { 9, 8, 9, 10 },
            new[] { "Lights-out shooting.", "Good off-ball movement.", "5-of-6 from three.", "Perfect shooting night." },
            new[] { "{\"Points\":24,\"Assists\":3,\"Rebounds\":4,\"ThreePointers\":6}", "{\"Points\":19,\"Assists\":4,\"Rebounds\":3,\"ThreePointers\":4}", "{\"Points\":22,\"Assists\":3,\"Rebounds\":3,\"ThreePointers\":5}", "{\"Points\":28,\"Assists\":5,\"Rebounds\":4,\"ThreePointers\":7}" });

        AddMatches(context, bp[5], today, bbDays, bbOpps,
            new[] { 7, 8, 7, 8 },
            new[] { "Solid backup role.", "Good pick-and-roll reads.", "Timely buckets off bench.", "Best backup performance of season." },
            new[] { "{\"Points\":10,\"Assists\":5,\"Rebounds\":3,\"Turnovers\":2}", "{\"Points\":13,\"Assists\":7,\"Rebounds\":4,\"Turnovers\":1}", "{\"Points\":11,\"Assists\":6,\"Rebounds\":3,\"Turnovers\":2}", "{\"Points\":15,\"Assists\":8,\"Rebounds\":5,\"Turnovers\":1}" });

        AddMatches(context, bp[6], today, bbDays, bbOpps,
            new[] { 6, 7, 7, 8 },
            new[] { "Physical — rim protection solid.", "Better conditioning this game.", "Good post moves.", "Full game — best since return from knee." },
            new[] { "{\"Points\":8,\"Assists\":1,\"Rebounds\":7,\"Blocks\":2}", "{\"Points\":11,\"Assists\":2,\"Rebounds\":9,\"Blocks\":3}", "{\"Points\":10,\"Assists\":1,\"Rebounds\":8,\"Blocks\":2}", "{\"Points\":14,\"Assists\":2,\"Rebounds\":11,\"Blocks\":4}" });

        var vbOpps = new[] { "Central Spikers", "Westside Serve", "Coastal Aces", "Harbor Blockers" };
        var vbDays = new[] { -20, -13, -6, -2 };

        AddMatches(context, vp[0], today, vbDays, vbOpps,
            new[] { 8, 8, 9, 9 },
            new[] { "Clean sets all game.", "Great tempo variation.", "Quick sets unlocked defense.", "Best setter performance this season." },
            new[] { "{\"Assists\":32,\"Aces\":2,\"SetErrors\":1}", "{\"Assists\":35,\"Aces\":3,\"SetErrors\":0}", "{\"Assists\":38,\"Aces\":4,\"SetErrors\":0}", "{\"Assists\":40,\"Aces\":4,\"SetErrors\":0}" });

        AddMatches(context, vp[1], today, vbDays, vbOpps,
            new[] { 8, 7, 9, 8 },
            new[] { "Powerful kills.", "Solid approach timing.", "Career-high kills.", "Dominant attack performance." },
            new[] { "{\"Kills\":14,\"Aces\":2,\"Blocks\":1,\"Errors\":3}", "{\"Kills\":12,\"Aces\":1,\"Blocks\":2,\"Errors\":4}", "{\"Kills\":18,\"Aces\":3,\"Blocks\":2,\"Errors\":2}", "{\"Kills\":15,\"Aces\":2,\"Blocks\":3,\"Errors\":2}" });

        AddMatches(context, vp[2], today, vbDays, vbOpps,
            new[] { 7, 7, 8, 8 },
            new[] { "Strong net presence.", "Managed load — shoulder.", "Shoulder held up well.", "Best game since injury." },
            new[] { "{\"Blocks\":5,\"Kills\":8,\"Digs\":4,\"Errors\":2}", "{\"Blocks\":4,\"Kills\":7,\"Digs\":3,\"Errors\":3}", "{\"Blocks\":6,\"Kills\":10,\"Digs\":5,\"Errors\":1}", "{\"Blocks\":7,\"Kills\":11,\"Digs\":6,\"Errors\":1}" });

        AddMatches(context, vp[3], today, vbDays, vbOpps,
            new[] { 9, 8, 9, 10 },
            new[] { "Outstanding defensive game.", "Clean platform all night.", "Dug everything.", "Flawless — defensive player of the match." },
            new[] { "{\"Digs\":22,\"ServeReceivePct\":95,\"Aces\":3,\"Errors\":0}", "{\"Digs\":18,\"ServeReceivePct\":92,\"Aces\":2,\"Errors\":1}", "{\"Digs\":24,\"ServeReceivePct\":96,\"Aces\":4,\"Errors\":0}", "{\"Digs\":26,\"ServeReceivePct\":98,\"Aces\":5,\"Errors\":0}" });

        AddMatches(context, vp[4], today, vbDays, vbOpps,
            new[] { 8, 7, 9, 8 },
            new[] { "Strong outside attack.", "Good chemistry with setter.", "Added jump serve to game.", "Consistent all around." },
            new[] { "{\"Kills\":13,\"Aces\":3,\"Blocks\":2,\"Errors\":3}", "{\"Kills\":11,\"Aces\":2,\"Blocks\":1,\"Errors\":4}", "{\"Kills\":16,\"Aces\":4,\"Blocks\":3,\"Errors\":2}", "{\"Kills\":14,\"Aces\":3,\"Blocks\":2,\"Errors\":2}" });

        AddMatches(context, vp[5], today, vbDays, vbOpps,
            new[] { 7, 7, 8, 8 },
            new[] { "Developing well as opposite.", "Good transition play.", "Back-row attack is improving.", "Confident performance." },
            new[] { "{\"Kills\":10,\"Aces\":2,\"Blocks\":3,\"Errors\":4}", "{\"Kills\":11,\"Aces\":1,\"Blocks\":4,\"Errors\":3}", "{\"Kills\":13,\"Aces\":2,\"Blocks\":4,\"Errors\":2}", "{\"Kills\":14,\"Aces\":3,\"Blocks\":5,\"Errors\":2}" });

        // Beach Volleyball — 3 matches per player
        var bvOpps = new[] { "Sunset Duo", "Coastal Pair", "Bay Slammers" };
        var bvDays = new[] { -18, -11, -4 };

        AddMatches(context, bvp[0], today, bvDays, bvOpps,
            new[] { 8, 9, 9 },
            new[] { "Blocked 60% of attacks.", "Best blocking game of year.", "Dominant at the net." },
            new[] { "{\"Kills\":10,\"Aces\":3,\"Blocks\":8,\"DigEfficiencyPct\":78}", "{\"Kills\":12,\"Aces\":4,\"Blocks\":10,\"DigEfficiencyPct\":82}", "{\"Kills\":14,\"Aces\":5,\"Blocks\":12,\"DigEfficiencyPct\":85}" });

        AddMatches(context, bvp[1], today, bvDays, bvOpps,
            new[] { 8, 8, 9 },
            new[] { "Excellent sand coverage.", "Clean digs all game.", "Flawless defensive display." },
            new[] { "{\"Digs\":18,\"Kills\":6,\"Aces\":2,\"DigEfficiencyPct\":85}", "{\"Digs\":20,\"Kills\":7,\"Aces\":3,\"DigEfficiencyPct\":88}", "{\"Digs\":22,\"Kills\":8,\"Aces\":4,\"DigEfficiencyPct\":92}" });

        AddMatches(context, bvp[2], today, bvDays, bvOpps,
            new[] { 7, 8, 9 },
            new[] { "Good serving in wind.", "Serve accuracy improving.", "Best tournament match." },
            new[] { "{\"Kills\":8,\"Aces\":4,\"Blocks\":5,\"ServeAccuracyPct\":74}", "{\"Kills\":10,\"Aces\":5,\"Blocks\":6,\"ServeAccuracyPct\":79}", "{\"Kills\":12,\"Aces\":6,\"Blocks\":7,\"ServeAccuracyPct\":84}" });

        AddMatches(context, bvp[3], today, bvDays, bvOpps,
            new[] { 7, 8, 8 },
            new[] { "Veteran experience showed.", "Led team through tight set.", "Strong left-side development." },
            new[] { "{\"Kills\":9,\"Aces\":3,\"Blocks\":7,\"DigEfficiencyPct\":80}", "{\"Kills\":11,\"Aces\":4,\"Blocks\":8,\"DigEfficiencyPct\":83}", "{\"Kills\":12,\"Aces\":4,\"Blocks\":9,\"DigEfficiencyPct\":86}" });

        // Tennis — 3 matches per player
        var tOpps = new[] { "River Valley TC", "Central Courts TC", "East End TC" };
        var tDays = new[] { -17, -10, -3 };

        AddMatches(context, tp[0], today, tDays, tOpps,
            new[] { 8, 8, 9 },
            new[] { "Won in straight sets, serve dominant.", "Tight match — clutch serving in decider.", "Best match of the season." },
            new[] { "{\"Winners\":24,\"UnforcedErrors\":8,\"ServeInPct\":68,\"BreakPointsConverted\":3}", "{\"Winners\":21,\"UnforcedErrors\":10,\"ServeInPct\":65,\"BreakPointsConverted\":2}", "{\"Winners\":28,\"UnforcedErrors\":6,\"ServeInPct\":72,\"BreakPointsConverted\":4}" });

        AddMatches(context, tp[1], today, tDays, tOpps,
            new[] { 7, 8, 9 },
            new[] { "Solid baseline control.", "Won from two sets down.", "Dominant rally performance." },
            new[] { "{\"Winners\":18,\"UnforcedErrors\":12,\"ServeInPct\":61,\"BreakPointsConverted\":2}", "{\"Winners\":22,\"UnforcedErrors\":9,\"ServeInPct\":64,\"BreakPointsConverted\":3}", "{\"Winners\":26,\"UnforcedErrors\":7,\"ServeInPct\":67,\"BreakPointsConverted\":4}" });

        AddMatches(context, tp[2], today, tDays, tOpps,
            new[] { 8, 7, 8 },
            new[] { "Net game was the difference.", "Lost a close third set.", "Strong serve-and-volley display." },
            new[] { "{\"Winners\":22,\"UnforcedErrors\":9,\"ServeInPct\":69,\"BreakPointsConverted\":3}", "{\"Winners\":18,\"UnforcedErrors\":13,\"ServeInPct\":64,\"BreakPointsConverted\":2}", "{\"Winners\":23,\"UnforcedErrors\":8,\"ServeInPct\":71,\"BreakPointsConverted\":3}" });

        AddMatches(context, tp[3], today, tDays, tOpps,
            new[] { 9, 8, 10 },
            new[] { "Exceptional footwork throughout.", "Tiebreak warrior.", "Perfect match — dropped only 3 games total." },
            new[] { "{\"Winners\":27,\"UnforcedErrors\":5,\"ServeInPct\":70,\"BreakPointsConverted\":5}", "{\"Winners\":23,\"UnforcedErrors\":7,\"ServeInPct\":67,\"BreakPointsConverted\":4}", "{\"Winners\":31,\"UnforcedErrors\":3,\"ServeInPct\":74,\"BreakPointsConverted\":6}" });

        AddMatches(context, tp[4], today, tDays, tOpps,
            new[] { 7, 8, 8 },
            new[] { "Good return game in doubles.", "Communication with partner improving.", "Best doubles performance this season." },
            new[] { "{\"Winners\":16,\"UnforcedErrors\":10,\"ServeInPct\":62,\"BreakPointsConverted\":2}", "{\"Winners\":19,\"UnforcedErrors\":8,\"ServeInPct\":65,\"BreakPointsConverted\":3}", "{\"Winners\":21,\"UnforcedErrors\":7,\"ServeInPct\":68,\"BreakPointsConverted\":3}" });
    }

    private static void AddMatches(
        ApplicationDbContext context, Player player, DateTime today,
        int[] dayOffsets, string[] opponents, int[] ratings, string[] notes, string[] stats)
    {
        for (int i = 0; i < dayOffsets.Length; i++)
            context.MatchPerformances.Add(new MatchPerformance
            {
                PlayerId = player.Id,
                MatchDate = today.AddDays(dayOffsets[i]),
                Opponent = opponents[i],
                PerformanceRating = ratings[i],
                Notes = notes[i],
                SportSpecificStats = stats[i]
            });
    }
}
