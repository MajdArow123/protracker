using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using ProTracker.Models;

namespace ProTracker.Data;

// Seeds realistic demo teams/players/assessments/nutrition profiles. Static reference data
// (Sports, Positions, SportStatCategories, FoodAlternativesLibrary) is seeded separately via
// EF Core HasData in ApplicationDbContext, since it doesn't depend on runtime-created users.
// This seeder needs real ApplicationUser accounts to own teams, so it runs at app startup
// instead.
//
// Athlete logins are created unconditionally (before the Teams idempotency guard) so they
// always exist even when the rest of the seed data was already present — e.g. on the
// production database that was seeded before athlete accounts were added.
public static class DemoDataSeeder
{
    private const string SeedPassword = "SeedCoach123!";

    public static async Task SeedAsync(IServiceProvider services)
    {
        var context = services.GetRequiredService<ApplicationDbContext>();
        var userManager = services.GetRequiredService<UserManager<ApplicationUser>>();

        var soccerCoach = await GetOrCreateCoachAsync(userManager, "coach.soccer@protracker.seed", "Coach Daniels");
        var basketballCoach = await GetOrCreateCoachAsync(userManager, "coach.basketball@protracker.seed", "Coach Reyes");
        var volleyballCoach = await GetOrCreateCoachAsync(userManager, "coach.volleyball@protracker.seed", "Coach Whitfield");

        // Athlete logins must exist before the idempotency guard so they're always present.
        var lucasWardLogin = await GetOrCreateAthleteAsync(userManager, "lucas.ward@protracker.seed", "Lucas Ward");
        var marcusBellLogin = await GetOrCreateAthleteAsync(userManager, "marcus.bell@protracker.seed", "Marcus Bell");

        // Link athletes to their player records if not already linked.
        var lucasWardPlayer = await context.Players.FirstOrDefaultAsync(p => p.FullName == "Lucas Ward" && p.UserId == null);
        if (lucasWardPlayer != null) { lucasWardPlayer.UserId = lucasWardLogin.Id; }
        var marcusBellPlayer = await context.Players.FirstOrDefaultAsync(p => p.FullName == "Marcus Bell" && p.UserId == null);
        if (marcusBellPlayer != null) { marcusBellPlayer.UserId = marcusBellLogin.Id; }
        if (lucasWardPlayer != null || marcusBellPlayer != null)
            await context.SaveChangesAsync();

        if (await context.Teams.AnyAsync())
            return; // rest of the demo data is already seeded

        var soccerTeam = new Team { Name = "City FC U18", SportId = 1, CoachId = soccerCoach.Id };
        var basketballTeam = new Team { Name = "Riverside Hawks", SportId = 2, CoachId = basketballCoach.Id };
        var volleyballTeam = new Team { Name = "Lakeside Spikers", SportId = 3, CoachId = volleyballCoach.Id };
        context.Teams.AddRange(soccerTeam, basketballTeam, volleyballTeam);
        await context.SaveChangesAsync();

        context.CoachTeamScopes.AddRange(
            new CoachTeamScope { CoachId = soccerCoach.Id, TeamId = soccerTeam.Id },
            new CoachTeamScope { CoachId = basketballCoach.Id, TeamId = basketballTeam.Id },
            new CoachTeamScope { CoachId = volleyballCoach.Id, TeamId = volleyballTeam.Id }
        );

        var today = DateTime.UtcNow.Date;
        var soccerPeriods = CreateWeeklyPeriods(soccerTeam.Id, today);
        var basketballPeriods = CreateWeeklyPeriods(basketballTeam.Id, today);
        var volleyballPeriods = CreateWeeklyPeriods(volleyballTeam.Id, today);
        context.AssessmentPeriods.AddRange(soccerPeriods.Concat(basketballPeriods).Concat(volleyballPeriods));
        await context.SaveChangesAsync();

        // Football / Soccer positions: Goalkeeper=1, Defender=2, Midfielder=3, Winger=4, Striker=5
        var soccerPlayers = new[]
        {
            MakePlayer("Liam Carter", 19, 183, 78, sportId: 1, teamId: soccerTeam.Id, positionId: 1, fitness: 7, goals: "Improve distribution under pressure.", coachNotes: "Strong shot-stopper, needs work on footwork."),
            MakePlayer("Noah Bennett", 20, 180, 75, sportId: 1, teamId: soccerTeam.Id, positionId: 2, fitness: 8, goals: "Win more aerial duels.", coachNotes: null),
            MakePlayer("Ethan Brooks", 18, 176, 70, sportId: 1, teamId: soccerTeam.Id, positionId: 3, fitness: 8, goals: "Increase passing accuracy in tight spaces.", coachNotes: "Good engine, reads the game well."),
            MakePlayer("Mason Reid", 21, 174, 68, sportId: 1, teamId: soccerTeam.Id, positionId: 4, fitness: 9, goals: "Add a final ball to pace.", coachNotes: null, injuryNotes: "Recovering from mild hamstring strain (3 weeks ago)."),
            MakePlayer("Lucas Ward", 19, 179, 74, sportId: 1, teamId: soccerTeam.Id, positionId: 5, fitness: 8, goals: "Improve finishing with weak foot.", coachNotes: "Top scorer this season."),
            MakePlayer("Oliver Hayes", 22, 181, 77, sportId: 1, teamId: soccerTeam.Id, positionId: 3, fitness: 6, goals: "Build match fitness back up.", coachNotes: "Returning from injury, ease into full training load.")
        };

        // Basketball positions: PointGuard=6, ShootingGuard=7, SmallForward=8, PowerForward=9, Center=10
        var basketballPlayers = new[]
        {
            MakePlayer("Marcus Bell", 20, 185, 80, sportId: 2, teamId: basketballTeam.Id, positionId: 6, fitness: 8, goals: "Cut down turnovers.", coachNotes: "Excellent court vision."),
            MakePlayer("Tyler Grant", 19, 193, 88, sportId: 2, teamId: basketballTeam.Id, positionId: 8, fitness: 7, goals: "Improve three-point consistency.", coachNotes: null),
            MakePlayer("Jordan Pierce", 21, 200, 100, sportId: 2, teamId: basketballTeam.Id, positionId: 10, fitness: 7, goals: "Increase vertical for rebounding.", coachNotes: "Anchor of the defense."),
            MakePlayer("Caleb Foster", 18, 190, 84, sportId: 2, teamId: basketballTeam.Id, positionId: 9, fitness: 8, goals: "Add mid-range jumper.", coachNotes: null),
            MakePlayer("Aiden Walsh", 19, 188, 82, sportId: 2, teamId: basketballTeam.Id, positionId: 7, fitness: 9, goals: "Improve off-ball movement.", coachNotes: "Best shooter on the roster.")
        };

        // Volleyball Indoor positions: Setter=11, OutsideHitter=12, OppositeHitter=13, MiddleBlocker=14, Libero=15
        var volleyballPlayers = new[]
        {
            MakePlayer("Sofia Martin", 20, 178, 65, sportId: 3, teamId: volleyballTeam.Id, positionId: 11, fitness: 8, goals: "Faster set release.", coachNotes: "Team captain."),
            MakePlayer("Ava Coleman", 19, 184, 70, sportId: 3, teamId: volleyballTeam.Id, positionId: 12, fitness: 8, goals: "Improve approach timing.", coachNotes: null),
            MakePlayer("Grace Mitchell", 21, 187, 72, sportId: 3, teamId: volleyballTeam.Id, positionId: 14, fitness: 7, goals: "Read blocks earlier.", coachNotes: "Strong at the net.", injuryNotes: "Mild shoulder soreness, monitoring load."),
            MakePlayer("Mia Sanders", 18, 170, 60, sportId: 3, teamId: volleyballTeam.Id, positionId: 15, fitness: 9, goals: "Improve serve-receive consistency.", coachNotes: "Best defensive player on the team.")
        };

        var allPlayers = soccerPlayers.Concat(basketballPlayers).Concat(volleyballPlayers).ToList();
        context.Players.AddRange(allPlayers);
        await context.SaveChangesAsync();

        // Link the athlete accounts (already created above) to their player rows.
        soccerPlayers[4].UserId = lucasWardLogin.Id; // Lucas Ward
        basketballPlayers[0].UserId = marcusBellLogin.Id; // Marcus Bell
        await context.SaveChangesAsync();

        await SeedAssessmentsAsync(context, soccerPlayers, sportStatCategoryRange: (1, 8), periods: soccerPeriods);
        await SeedAssessmentsAsync(context, basketballPlayers, sportStatCategoryRange: (9, 16), periods: basketballPeriods);
        await SeedAssessmentsAsync(context, volleyballPlayers, sportStatCategoryRange: (17, 24), periods: volleyballPeriods);

        SeedNutritionProfiles(context, soccerPlayers, basketballPlayers, volleyballPlayers);

        SeedLightTouchSamples(context, soccerPlayers, soccerTeam.Id, basketballPlayers, volleyballPlayers);

        await context.SaveChangesAsync();
    }

    private static async Task<ApplicationUser> GetOrCreateCoachAsync(UserManager<ApplicationUser> userManager, string email, string displayName)
    {
        var existing = await userManager.FindByEmailAsync(email);
        if (existing != null)
            return existing;

        var user = new ApplicationUser
        {
            UserName = email,
            Email = email,
            EmailConfirmed = true,
            DisplayName = displayName
        };

        var result = await userManager.CreateAsync(user, SeedPassword);
        if (!result.Succeeded)
            throw new InvalidOperationException($"Failed to create seed coach {email}: {string.Join(", ", result.Errors.Select(e => e.Description))}");

        await userManager.AddToRoleAsync(user, "Coach");
        return user;
    }

    private static async Task<ApplicationUser> GetOrCreateAthleteAsync(UserManager<ApplicationUser> userManager, string email, string displayName)
    {
        var existing = await userManager.FindByEmailAsync(email);
        if (existing != null)
            return existing;

        var user = new ApplicationUser
        {
            UserName = email,
            Email = email,
            EmailConfirmed = true,
            DisplayName = displayName
        };

        var result = await userManager.CreateAsync(user, SeedPassword);
        if (!result.Succeeded)
            throw new InvalidOperationException($"Failed to create seed athlete {email}: {string.Join(", ", result.Errors.Select(e => e.Description))}");

        await userManager.AddToRoleAsync(user, "Athlete");
        return user;
    }

    private static List<AssessmentPeriod> CreateWeeklyPeriods(int teamId, DateTime today)
    {
        return new List<AssessmentPeriod>
        {
            new() { Name = "Week 1", TeamId = teamId, StartDate = today.AddDays(-21), EndDate = today.AddDays(-15) },
            new() { Name = "Week 2", TeamId = teamId, StartDate = today.AddDays(-14), EndDate = today.AddDays(-8) },
            new() { Name = "Week 3", TeamId = teamId, StartDate = today.AddDays(-7), EndDate = today.AddDays(-1) }
        };
    }

    private static Player MakePlayer(
        string fullName, int age, double height, double weight,
        int sportId, int teamId, int positionId, int fitness,
        string? goals = null, string? coachNotes = null, string? injuryNotes = null)
    {
        return new Player
        {
            FullName = fullName,
            Age = age,
            Height = height,
            Weight = weight,
            SportId = sportId,
            TeamId = teamId,
            PositionId = positionId,
            FitnessLevel = fitness,
            Goals = goals,
            CoachNotes = coachNotes,
            InjuryNotes = injuryNotes
        };
    }

    private static async Task SeedAssessmentsAsync(
        ApplicationDbContext context, IEnumerable<Player> players,
        (int From, int To) sportStatCategoryRange, List<AssessmentPeriod> periods)
    {
        var categoryIds = Enumerable.Range(sportStatCategoryRange.From, sportStatCategoryRange.To - sportStatCategoryRange.From + 1).ToList();

        foreach (var player in players)
        {
            var rng = new Random(player.Id * 7919); // deterministic per player, reproducible seed data

            foreach (var period in periods)
            {
                var assessment = new PlayerAssessment
                {
                    PlayerId = player.Id,
                    AssessmentPeriodId = period.Id,
                    DateRecorded = period.EndDate,
                    Notes = $"Assessment for {period.Name}."
                };
                context.PlayerAssessments.Add(assessment);
                await context.SaveChangesAsync(); // need assessment.Id before adding scores

                foreach (var categoryId in categoryIds)
                {
                    context.PlayerStatScores.Add(new PlayerStatScore
                    {
                        PlayerAssessmentId = assessment.Id,
                        SportStatCategoryId = categoryId,
                        Score = rng.Next(4, 11) // 4-10, realistic spread, never below "needs work" floor
                    });
                }
            }
        }

        await context.SaveChangesAsync();
    }

    private static void SeedNutritionProfiles(
        ApplicationDbContext context,
        Player[] soccerPlayers, Player[] basketballPlayers, Player[] volleyballPlayers)
    {
        // Hard allergy
        context.PlayerNutritionProfiles.Add(new PlayerNutritionProfile
        {
            PlayerId = soccerPlayers[3].Id, // Mason Reid
            PreferenceType = NutritionPreferenceType.Allergy,
            Category = NutritionCategory.NutAllergy,
            SpecificItem = "peanuts",
            Severity = NutritionSeverity.Hard,
            Notes = "Carries an EpiPen at all sessions."
        });

        // Lifestyle choices
        context.PlayerNutritionProfiles.Add(new PlayerNutritionProfile
        {
            PlayerId = soccerPlayers[2].Id, // Ethan Brooks
            PreferenceType = NutritionPreferenceType.Lifestyle,
            Category = NutritionCategory.Vegetarian,
            Severity = NutritionSeverity.Lifestyle
        });

        context.PlayerNutritionProfiles.Add(new PlayerNutritionProfile
        {
            PlayerId = basketballPlayers[0].Id, // Marcus Bell
            PreferenceType = NutritionPreferenceType.Lifestyle,
            Category = NutritionCategory.Halal,
            Severity = NutritionSeverity.Lifestyle
        });

        context.PlayerNutritionProfiles.Add(new PlayerNutritionProfile
        {
            PlayerId = volleyballPlayers[0].Id, // Sofia Martin
            PreferenceType = NutritionPreferenceType.Lifestyle,
            Category = NutritionCategory.Vegan,
            Severity = NutritionSeverity.Lifestyle
        });

        // Hard dietary restriction (non-allergy but still strict)
        context.PlayerNutritionProfiles.Add(new PlayerNutritionProfile
        {
            PlayerId = basketballPlayers[2].Id, // Jordan Pierce
            PreferenceType = NutritionPreferenceType.Allergy,
            Category = NutritionCategory.DairyFree,
            SpecificItem = "lactose",
            Severity = NutritionSeverity.Hard,
            Notes = "Lactose intolerant — causes significant GI distress."
        });

        // Soft preference
        context.PlayerNutritionProfiles.Add(new PlayerNutritionProfile
        {
            PlayerId = volleyballPlayers[2].Id, // Grace Mitchell
            PreferenceType = NutritionPreferenceType.SoftPreference,
            Category = NutritionCategory.Custom,
            SpecificItem = "fish",
            Severity = NutritionSeverity.Soft,
            Notes = "Dislikes the taste; coach can override with a note if no good alternative exists."
        });
    }

    private static void SeedLightTouchSamples(
        ApplicationDbContext context,
        Player[] soccerPlayers, int soccerTeamId,
        Player[] basketballPlayers, Player[] volleyballPlayers)
    {
        // A handful of records on the remaining tables to verify they seed and query correctly.
        // Not exhaustive — Phase 2's stated minimums are teams/players/assessments/nutrition profiles.
        context.InjuryRecords.AddRange(
            new InjuryRecord
            {
                PlayerId = soccerPlayers[3].Id, // Mason Reid
                InjuryDate = DateTime.UtcNow.Date.AddDays(-21),
                InjuryType = "Hamstring strain",
                Severity = InjurySeverity.Minor,
                RecoveryStatus = RecoveryStatus.Recovering,
                Notes = "Grade 1 strain, responding well to physio.",
                ExpectedReturnDate = DateTime.UtcNow.Date.AddDays(7)
            },
            new InjuryRecord
            {
                PlayerId = volleyballPlayers[2].Id, // Grace Mitchell
                InjuryDate = DateTime.UtcNow.Date.AddDays(-10),
                InjuryType = "Shoulder soreness",
                Severity = InjurySeverity.Minor,
                RecoveryStatus = RecoveryStatus.Active,
                Notes = "Load management in effect, no overhead drills this week."
            }
        );

        context.TrainingSessions.AddRange(
            new TrainingSession { PlayerId = soccerPlayers[0].Id, TeamId = soccerTeamId, Date = DateTime.UtcNow.Date.AddDays(-2), DurationMinutes = 90, AttendanceStatus = AttendanceStatus.Present, Notes = "Full session, goalkeeping drills." },
            new TrainingSession { PlayerId = soccerPlayers[1].Id, TeamId = soccerTeamId, Date = DateTime.UtcNow.Date.AddDays(-2), DurationMinutes = 90, AttendanceStatus = AttendanceStatus.Late, Notes = "Arrived 15 minutes late." },
            new TrainingSession { PlayerId = soccerPlayers[4].Id, TeamId = soccerTeamId, Date = DateTime.UtcNow.Date.AddDays(-2), DurationMinutes = 90, AttendanceStatus = AttendanceStatus.Absent, Notes = "Excused — family commitment." }
        );

        context.MatchPerformances.AddRange(
            new MatchPerformance { PlayerId = soccerPlayers[4].Id, MatchDate = DateTime.UtcNow.Date.AddDays(-6), Opponent = "Riverside United", PerformanceRating = 8, Notes = "Scored twice, strong link-up play.", SportSpecificStats = "{\"Goals\":2,\"Shots\":5,\"PassAccuracy\":82}" },
            new MatchPerformance { PlayerId = basketballPlayers[4].Id, MatchDate = DateTime.UtcNow.Date.AddDays(-5), Opponent = "Northgate Eagles", PerformanceRating = 7, Notes = "Efficient shooting night.", SportSpecificStats = "{\"Points\":18,\"Assists\":4,\"Rebounds\":3}" }
        );

        context.ImprovementPlans.Add(new ImprovementPlan
        {
            PlayerId = soccerPlayers[2].Id, // Ethan Brooks
            WeeklyGoals = "Complete 3 extra passing accuracy drills.",
            TrainingRecommendations = "Add rondos focused on one-touch passing.",
            SkillTargets = "First-touch control under pressure.",
            SportSpecificDrills = "4v2 rondo, switch-of-play passing ladder.",
            PositionFocus = "Midfielder — receiving on the half-turn.",
            CoachNotes = "Good progress, keep building game intelligence."
        });

        context.NutritionGuidances.Add(new NutritionGuidance
        {
            PlayerId = soccerPlayers[2].Id, // Ethan Brooks (vegetarian)
            Goal = "Maintain energy levels across a 3-match week.",
            MealSuggestions = "Lentil and quinoa bowls, tofu stir-fry, oats with fruit.",
            HydrationTips = "500ml water 2 hours before training, electrolytes on match day.",
            RecoveryTips = "Post-session protein within 30 minutes (Greek yogurt or a plant-protein shake).",
            FoodsToPrioritize = "Lentils, quinoa, tofu, leafy greens.",
            FoodsToLimit = "Fried foods, excess refined sugar."
        });
    }
}
