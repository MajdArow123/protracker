using ProTracker.Models;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace ProTracker.Data;

public class ApplicationDbContext : IdentityDbContext<ApplicationUser>
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    // Postgres "timestamp with time zone" columns reject DateTimes with Kind=Unspecified
    // (e.g. from a plain <input type="date"> bound straight into a DTO). Coercing every
    // DateTime through UTC here means individual services never have to think about it.
    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        configurationBuilder.Properties<DateTime>().HaveConversion<UtcDateTimeConverter>();
        configurationBuilder.Properties<DateTime?>().HaveConversion<UtcNullableDateTimeConverter>();
    }

    private class UtcDateTimeConverter : ValueConverter<DateTime, DateTime>
    {
        public UtcDateTimeConverter() : base(
            v => v.Kind == DateTimeKind.Utc ? v : DateTime.SpecifyKind(v, DateTimeKind.Utc),
            v => DateTime.SpecifyKind(v, DateTimeKind.Utc))
        {
        }
    }

    private class UtcNullableDateTimeConverter : ValueConverter<DateTime?, DateTime?>
    {
        public UtcNullableDateTimeConverter() : base(
            v => v.HasValue ? (v.Value.Kind == DateTimeKind.Utc ? v.Value : DateTime.SpecifyKind(v.Value, DateTimeKind.Utc)) : v,
            v => v.HasValue ? DateTime.SpecifyKind(v.Value, DateTimeKind.Utc) : v)
        {
        }
    }

    public DbSet<TrainingPlan> TrainingPlans => Set<TrainingPlan>();
    public DbSet<TaskItem> TaskItems => Set<TaskItem>();
    public DbSet<PlayerTask> PlayerTasks => Set<PlayerTask>();
    public DbSet<MatchResult> MatchResults => Set<MatchResult>();
    public DbSet<ScheduledSession> ScheduledSessions => Set<ScheduledSession>();
    public DbSet<CoachNote> CoachNotes => Set<CoachNote>();
    public DbSet<TeamAnnouncement> TeamAnnouncements => Set<TeamAnnouncement>();
    public DbSet<Message> Messages => Set<Message>();
    public DbSet<InjuryRecoveryPlan> InjuryRecoveryPlans => Set<InjuryRecoveryPlan>();
    public DbSet<RecoveryExercise> RecoveryExercises => Set<RecoveryExercise>();
    public DbSet<RecoveryMilestone> RecoveryMilestones => Set<RecoveryMilestone>();
    public DbSet<PlayerMatchRating> PlayerMatchRatings => Set<PlayerMatchRating>();
    public DbSet<WellbeingCheckin> WellbeingCheckins => Set<WellbeingCheckin>();
    public DbSet<RecoveryTemplate> RecoveryTemplates => Set<RecoveryTemplate>();
    public DbSet<RecoveryTemplateExercise> RecoveryTemplateExercises => Set<RecoveryTemplateExercise>();
    public DbSet<RecoveryTemplateMilestone> RecoveryTemplateMilestones => Set<RecoveryTemplateMilestone>();

    public DbSet<Sport> Sports => Set<Sport>();
    public DbSet<Position> Positions => Set<Position>();
    public DbSet<SportStatCategory> SportStatCategories => Set<SportStatCategory>();
    public DbSet<Team> Teams => Set<Team>();
    public DbSet<Player> Players => Set<Player>();
    public DbSet<CoachTeamScope> CoachTeamScopes => Set<CoachTeamScope>();
    public DbSet<AssessmentPeriod> AssessmentPeriods => Set<AssessmentPeriod>();
    public DbSet<Season> Seasons => Set<Season>();
    public DbSet<PlayerAssessment> PlayerAssessments => Set<PlayerAssessment>();
    public DbSet<PlayerStatScore> PlayerStatScores => Set<PlayerStatScore>();
    public DbSet<ImprovementPlan> ImprovementPlans => Set<ImprovementPlan>();
    public DbSet<NutritionGuidance> NutritionGuidances => Set<NutritionGuidance>();
    public DbSet<PlayerNutritionProfile> PlayerNutritionProfiles => Set<PlayerNutritionProfile>();
    public DbSet<FoodAlternativesLibrary> FoodAlternativesLibrary => Set<FoodAlternativesLibrary>();
    public DbSet<FoodItem> FoodItems => Set<FoodItem>();
    public DbSet<TrainingSession> TrainingSessions => Set<TrainingSession>();
    public DbSet<MatchPerformance> MatchPerformances => Set<MatchPerformance>();
    public DbSet<InjuryRecord> InjuryRecords => Set<InjuryRecord>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<PasswordResetToken> PasswordResetTokens => Set<PasswordResetToken>();
    public DbSet<WeeklyNutritionPlan> WeeklyNutritionPlans => Set<WeeklyNutritionPlan>();
    public DbSet<DailyMealPlan> DailyMealPlans => Set<DailyMealPlan>();
    public DbSet<PlannedMeal> PlannedMeals => Set<PlannedMeal>();
    public DbSet<PlannedMealItem> PlannedMealItems => Set<PlannedMealItem>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        // --- Reference data (Sport / Position / SportStatCategory) ---
        // Reference data is never cascade-deleted away by accident.
        builder.Entity<Position>()
            .HasOne(p => p.Sport)
            .WithMany(s => s.Positions)
            .HasForeignKey(p => p.SportId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Entity<SportStatCategory>()
            .HasOne(c => c.Sport)
            .WithMany(s => s.StatCategories)
            .HasForeignKey(c => c.SportId)
            .OnDelete(DeleteBehavior.Restrict);

        // --- Team / Player ownership ---
        builder.Entity<Team>()
            .HasOne(t => t.Sport)
            .WithMany(s => s.Teams)
            .HasForeignKey(t => t.SportId)
            .OnDelete(DeleteBehavior.Restrict);

        // Never let an AspNetUsers delete cascade into business data.
        builder.Entity<Team>()
            .HasIndex(t => t.CoachId);

        builder.Entity<Player>()
            .HasOne(p => p.Sport)
            .WithMany()
            .HasForeignKey(p => p.SportId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Entity<Player>()
            .HasOne(p => p.Team)
            .WithMany(t => t.Players)
            .HasForeignKey(p => p.TeamId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Entity<Player>()
            .HasOne(p => p.Position)
            .WithMany()
            .HasForeignKey(p => p.PositionId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Entity<Player>()
            .HasIndex(p => p.UserId);

        // --- Access scoping ---
        builder.Entity<CoachTeamScope>()
            .HasOne(c => c.Team)
            .WithMany(t => t.CoachScopes)
            .HasForeignKey(c => c.TeamId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<CoachTeamScope>()
            .HasIndex(c => new { c.CoachId, c.TeamId })
            .IsUnique();

        // --- Assessments ---
        builder.Entity<AssessmentPeriod>()
            .HasOne(a => a.Team)
            .WithMany(t => t.AssessmentPeriods)
            .HasForeignKey(a => a.TeamId)
            .OnDelete(DeleteBehavior.Cascade);

        // Deleting a season unlinks its assessment periods (SetNull) rather than deleting them.
        builder.Entity<AssessmentPeriod>()
            .HasOne(a => a.Season)
            .WithMany(s => s.AssessmentPeriods)
            .HasForeignKey(a => a.SeasonId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.Entity<Season>()
            .HasOne(s => s.Team)
            .WithMany()
            .HasForeignKey(s => s.TeamId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<PlayerAssessment>()
            .HasOne(a => a.Player)
            .WithMany()
            .HasForeignKey(a => a.PlayerId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<PlayerAssessment>()
            .HasOne(a => a.AssessmentPeriod)
            .WithMany(p => p.PlayerAssessments)
            .HasForeignKey(a => a.AssessmentPeriodId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<PlayerStatScore>()
            .HasOne(s => s.PlayerAssessment)
            .WithMany(a => a.StatScores)
            .HasForeignKey(s => s.PlayerAssessmentId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<PlayerStatScore>()
            .HasOne(s => s.SportStatCategory)
            .WithMany()
            .HasForeignKey(s => s.SportStatCategoryId)
            .OnDelete(DeleteBehavior.Restrict);

        // --- Player-owned records (deleted along with the player) ---
        builder.Entity<ImprovementPlan>()
            .HasOne(i => i.Player)
            .WithMany()
            .HasForeignKey(i => i.PlayerId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<NutritionGuidance>()
            .HasOne(n => n.Player)
            .WithMany()
            .HasForeignKey(n => n.PlayerId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<PlayerNutritionProfile>()
            .HasOne(n => n.Player)
            .WithMany()
            .HasForeignKey(n => n.PlayerId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<TrainingSession>()
            .HasOne(s => s.Player)
            .WithMany()
            .HasForeignKey(s => s.PlayerId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<TrainingSession>()
            .HasOne(s => s.Team)
            .WithMany()
            .HasForeignKey(s => s.TeamId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<MatchPerformance>()
            .HasOne(m => m.Player)
            .WithMany()
            .HasForeignKey(m => m.PlayerId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<InjuryRecord>()
            .HasOne(i => i.Player)
            .WithMany()
            .HasForeignKey(i => i.PlayerId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<PlayerTask>()
            .HasOne(t => t.Player)
            .WithMany()
            .HasForeignKey(t => t.PlayerId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<PlayerTask>()
            .HasIndex(t => t.CoachId);

        builder.Entity<MatchResult>()
            .HasOne(m => m.Team)
            .WithMany()
            .HasForeignKey(m => m.TeamId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<PlayerMatchRating>()
            .HasOne(r => r.MatchResult)
            .WithMany(m => m.Ratings)
            .HasForeignKey(r => r.MatchResultId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<PlayerMatchRating>()
            .HasOne(r => r.Player)
            .WithMany()
            .HasForeignKey(r => r.PlayerId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<ScheduledSession>()
            .HasOne(s => s.Team)
            .WithMany()
            .HasForeignKey(s => s.TeamId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.Entity<ScheduledSession>()
            .HasIndex(s => new { s.TeamId, s.StartTime });

        builder.Entity<CoachNote>()
            .HasOne(n => n.Player)
            .WithMany()
            .HasForeignKey(n => n.PlayerId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.Entity<CoachNote>()
            .HasIndex(n => n.PlayerId);

        builder.Entity<TeamAnnouncement>()
            .HasOne(a => a.Team)
            .WithMany()
            .HasForeignKey(a => a.TeamId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.Entity<TeamAnnouncement>()
            .HasIndex(a => a.TeamId);

        builder.Entity<Message>()
            .HasIndex(m => m.ConversationId);
        builder.Entity<Message>()
            .HasIndex(m => new { m.ReceiverId, m.IsRead });

        builder.Entity<InjuryRecoveryPlan>()
            .HasOne(p => p.InjuryRecord)
            .WithMany()
            .HasForeignKey(p => p.InjuryRecordId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.Entity<InjuryRecoveryPlan>()
            .HasOne(p => p.Player)
            .WithMany()
            .HasForeignKey(p => p.PlayerId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.Entity<InjuryRecoveryPlan>()
            .HasIndex(p => p.PlayerId);
        builder.Entity<RecoveryExercise>()
            .HasOne(e => e.InjuryRecoveryPlan)
            .WithMany(p => p.Exercises)
            .HasForeignKey(e => e.InjuryRecoveryPlanId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.Entity<RecoveryMilestone>()
            .HasOne(m => m.InjuryRecoveryPlan)
            .WithMany(p => p.Milestones)
            .HasForeignKey(m => m.InjuryRecoveryPlanId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<RecoveryTemplateExercise>()
            .HasOne(e => e.RecoveryTemplate)
            .WithMany(t => t.Exercises)
            .HasForeignKey(e => e.RecoveryTemplateId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.Entity<RecoveryTemplateMilestone>()
            .HasOne(m => m.RecoveryTemplate)
            .WithMany(t => t.Milestones)
            .HasForeignKey(m => m.RecoveryTemplateId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<WellbeingCheckin>()
            .HasOne(c => c.Player)
            .WithMany()
            .HasForeignKey(c => c.PlayerId)
            .OnDelete(DeleteBehavior.Cascade);
        // One check-in per player per calendar day.
        builder.Entity<WellbeingCheckin>()
            .HasIndex(c => new { c.PlayerId, c.Date })
            .IsUnique();

        builder.Entity<RefreshToken>()
            .HasIndex(r => r.UserId);
        builder.Entity<RefreshToken>()
            .HasIndex(r => r.TokenHash)
            .IsUnique();

        builder.Entity<PasswordResetToken>()
            .HasIndex(t => t.Token)
            .IsUnique();
        builder.Entity<PasswordResetToken>()
            .HasIndex(t => t.UserId);

        // --- Static reference data seed (Sports / Positions / StatCategories / Food Alternatives) ---
        // Safe to seed via HasData: fixed IDs, no dependency on runtime-generated data (e.g. user IDs).
        SeedReferenceData(builder);
    }

    private static void SeedReferenceData(ModelBuilder builder)
    {
        builder.Entity<Sport>().HasData(
            new Sport { Id = 1, Name = "Football / Soccer", Description = "Eleven-a-side football." },
            new Sport { Id = 2, Name = "Basketball", Description = "Five-a-side basketball." },
            new Sport { Id = 3, Name = "Volleyball Indoor", Description = "Six-a-side indoor volleyball." },
            new Sport { Id = 4, Name = "Beach Volleyball", Description = "Two-a-side beach volleyball." },
            new Sport { Id = 5, Name = "Tennis", Description = "Singles or doubles tennis." }
        );

        builder.Entity<Position>().HasData(
            // Football / Soccer (SportId = 1)
            new Position { Id = 1, Name = "Goalkeeper", SportId = 1 },
            new Position { Id = 2, Name = "Defender", SportId = 1 },
            new Position { Id = 3, Name = "Midfielder", SportId = 1 },
            new Position { Id = 4, Name = "Winger", SportId = 1 },
            new Position { Id = 5, Name = "Striker", SportId = 1 },
            // Basketball (SportId = 2)
            new Position { Id = 6, Name = "Point Guard", SportId = 2 },
            new Position { Id = 7, Name = "Shooting Guard", SportId = 2 },
            new Position { Id = 8, Name = "Small Forward", SportId = 2 },
            new Position { Id = 9, Name = "Power Forward", SportId = 2 },
            new Position { Id = 10, Name = "Center", SportId = 2 },
            // Volleyball Indoor (SportId = 3)
            new Position { Id = 11, Name = "Setter", SportId = 3 },
            new Position { Id = 12, Name = "Outside Hitter", SportId = 3 },
            new Position { Id = 13, Name = "Opposite Hitter", SportId = 3 },
            new Position { Id = 14, Name = "Middle Blocker", SportId = 3 },
            new Position { Id = 15, Name = "Libero", SportId = 3 },
            // Beach Volleyball (SportId = 4)
            new Position { Id = 16, Name = "Defender", SportId = 4 },
            new Position { Id = 17, Name = "Blocker", SportId = 4 },
            new Position { Id = 18, Name = "All-Round Player", SportId = 4 },
            // Tennis (SportId = 5)
            new Position { Id = 19, Name = "Singles Player", SportId = 5 },
            new Position { Id = 20, Name = "Doubles Player", SportId = 5 },
            new Position { Id = 21, Name = "Baseline Player", SportId = 5 },
            new Position { Id = 22, Name = "Serve-and-Volley Player", SportId = 5 },
            new Position { Id = 23, Name = "All-Court Player", SportId = 5 }
        );

        builder.Entity<SportStatCategory>().HasData(
            // Football / Soccer (SportId = 1)
            new SportStatCategory { Id = 1, Name = "Speed", SportId = 1 },
            new SportStatCategory { Id = 2, Name = "Stamina", SportId = 1 },
            new SportStatCategory { Id = 3, Name = "Passing", SportId = 1 },
            new SportStatCategory { Id = 4, Name = "Shooting", SportId = 1 },
            new SportStatCategory { Id = 5, Name = "Defense", SportId = 1 },
            new SportStatCategory { Id = 6, Name = "Ball Control", SportId = 1 },
            new SportStatCategory { Id = 7, Name = "Agility", SportId = 1 },
            new SportStatCategory { Id = 8, Name = "Match Performance", SportId = 1 },
            // Basketball (SportId = 2)
            new SportStatCategory { Id = 9, Name = "Shooting", SportId = 2 },
            new SportStatCategory { Id = 10, Name = "Dribbling", SportId = 2 },
            new SportStatCategory { Id = 11, Name = "Passing", SportId = 2 },
            new SportStatCategory { Id = 12, Name = "Defense", SportId = 2 },
            new SportStatCategory { Id = 13, Name = "Rebounding", SportId = 2 },
            new SportStatCategory { Id = 14, Name = "Vertical Jump", SportId = 2 },
            new SportStatCategory { Id = 15, Name = "Court Vision", SportId = 2 },
            new SportStatCategory { Id = 16, Name = "Stamina", SportId = 2 },
            // Volleyball Indoor (SportId = 3)
            new SportStatCategory { Id = 17, Name = "Serving", SportId = 3 },
            new SportStatCategory { Id = 18, Name = "Passing", SportId = 3 },
            new SportStatCategory { Id = 19, Name = "Setting", SportId = 3 },
            new SportStatCategory { Id = 20, Name = "Blocking", SportId = 3 },
            new SportStatCategory { Id = 21, Name = "Spiking", SportId = 3 },
            new SportStatCategory { Id = 22, Name = "Reaction", SportId = 3 },
            new SportStatCategory { Id = 23, Name = "Jumping", SportId = 3 },
            new SportStatCategory { Id = 24, Name = "Team Communication", SportId = 3 },
            // Beach Volleyball (SportId = 4)
            new SportStatCategory { Id = 25, Name = "Serving", SportId = 4 },
            new SportStatCategory { Id = 26, Name = "Passing", SportId = 4 },
            new SportStatCategory { Id = 27, Name = "Spiking", SportId = 4 },
            new SportStatCategory { Id = 28, Name = "Defense", SportId = 4 },
            new SportStatCategory { Id = 29, Name = "Movement on Sand", SportId = 4 },
            new SportStatCategory { Id = 30, Name = "Stamina", SportId = 4 },
            new SportStatCategory { Id = 31, Name = "Reaction", SportId = 4 },
            new SportStatCategory { Id = 32, Name = "Communication", SportId = 4 },
            // Tennis (SportId = 5)
            new SportStatCategory { Id = 33, Name = "Serve", SportId = 5 },
            new SportStatCategory { Id = 34, Name = "Forehand", SportId = 5 },
            new SportStatCategory { Id = 35, Name = "Backhand", SportId = 5 },
            new SportStatCategory { Id = 36, Name = "Footwork", SportId = 5 },
            new SportStatCategory { Id = 37, Name = "Stamina", SportId = 5 },
            new SportStatCategory { Id = 38, Name = "Match Consistency", SportId = 5 },
            new SportStatCategory { Id = 39, Name = "Return", SportId = 5 },
            new SportStatCategory { Id = 40, Name = "Mental Focus", SportId = 5 }
        );

        builder.Entity<FoodAlternativesLibrary>().HasData(
            // Eggs ->
            new FoodAlternativesLibrary { Id = 1, OriginalFood = "Eggs", AlternativeFood = "Greek yogurt", ProteinMatchScore = 4, CarbMatchScore = 3, FatMatchScore = 3, CalorieMatchScore = 3, RecoveryValue = 4, SportPerformanceNote = "Good post-training protein source, easy to digest.", ReasonExplanation = "High in protein with probiotics; comparable protein density to eggs per serving.", SuggestedPortion = "150g", Calories = 130, Protein = 15, Carbs = 8, Fats = 4 },
            new FoodAlternativesLibrary { Id = 2, OriginalFood = "Eggs", AlternativeFood = "Tofu", ProteinMatchScore = 4, CarbMatchScore = 2, FatMatchScore = 3, CalorieMatchScore = 3, RecoveryValue = 3, SportPerformanceNote = "Suitable pre- or post-session, low fat load.", ReasonExplanation = "Complete plant protein; firm tofu has a similar protein-per-gram profile to eggs.", SuggestedPortion = "150g", Calories = 120, Protein = 15, Carbs = 3, Fats = 6 },
            new FoodAlternativesLibrary { Id = 3, OriginalFood = "Eggs", AlternativeFood = "Cottage cheese", ProteinMatchScore = 5, CarbMatchScore = 2, FatMatchScore = 2, CalorieMatchScore = 3, RecoveryValue = 4, SportPerformanceNote = "Slow-digesting casein protein, good before bed for recovery.", ReasonExplanation = "Very high protein-to-calorie ratio, close match to eggs for muscle repair.", SuggestedPortion = "150g", Calories = 130, Protein = 17, Carbs = 5, Fats = 4 },
            new FoodAlternativesLibrary { Id = 4, OriginalFood = "Eggs", AlternativeFood = "Chicken breast", ProteinMatchScore = 5, CarbMatchScore = 1, FatMatchScore = 2, CalorieMatchScore = 3, RecoveryValue = 4, SportPerformanceNote = "Solid lean protein for muscle maintenance across training cycles.", ReasonExplanation = "Higher protein density than eggs, minimal carbs, lean if skinless.", SuggestedPortion = "100g", Calories = 165, Protein = 31, Carbs = 0, Fats = 4 },
            new FoodAlternativesLibrary { Id = 5, OriginalFood = "Eggs", AlternativeFood = "Tuna", ProteinMatchScore = 5, CarbMatchScore = 1, FatMatchScore = 2, CalorieMatchScore = 2, RecoveryValue = 4, SportPerformanceNote = "Lean protein plus omega-3s, useful for recovery days.", ReasonExplanation = "High protein, low calorie alternative with added anti-inflammatory fats.", SuggestedPortion = "100g", Calories = 116, Protein = 25, Carbs = 0, Fats = 1 },
            new FoodAlternativesLibrary { Id = 6, OriginalFood = "Eggs", AlternativeFood = "Lentils", ProteinMatchScore = 3, CarbMatchScore = 4, FatMatchScore = 1, CalorieMatchScore = 3, RecoveryValue = 3, SportPerformanceNote = "Adds slow-release carbs alongside protein for endurance athletes.", ReasonExplanation = "Lower protein density than eggs but pairs protein with fiber and carbs.", SuggestedPortion = "200g cooked", Calories = 230, Protein = 18, Carbs = 40, Fats = 1 },
            // Milk / Dairy ->
            new FoodAlternativesLibrary { Id = 7, OriginalFood = "Milk / Dairy", AlternativeFood = "Soy milk", ProteinMatchScore = 4, CarbMatchScore = 3, FatMatchScore = 3, CalorieMatchScore = 3, RecoveryValue = 3, SportPerformanceNote = "Closest plant-based match for post-workout shakes.", ReasonExplanation = "Soy milk has the closest protein content to dairy milk among plant milks.", SuggestedPortion = "240ml", Calories = 80, Protein = 7, Carbs = 4, Fats = 4 },
            new FoodAlternativesLibrary { Id = 8, OriginalFood = "Milk / Dairy", AlternativeFood = "Lactose-free milk", ProteinMatchScore = 5, CarbMatchScore = 4, FatMatchScore = 4, CalorieMatchScore = 4, RecoveryValue = 4, SportPerformanceNote = "Direct nutritional swap, no performance trade-off.", ReasonExplanation = "Same nutrition profile as regular milk, lactose enzymatically broken down.", SuggestedPortion = "240ml", Calories = 150, Protein = 8, Carbs = 12, Fats = 8 },
            new FoodAlternativesLibrary { Id = 9, OriginalFood = "Milk / Dairy", AlternativeFood = "Almond milk with protein", ProteinMatchScore = 3, CarbMatchScore = 2, FatMatchScore = 2, CalorieMatchScore = 2, RecoveryValue = 2, SportPerformanceNote = "Lower calorie option; pair with another protein source on training days.", ReasonExplanation = "Plain almond milk is protein-poor, so a protein-fortified version is needed to approach dairy milk.", SuggestedPortion = "240ml", Calories = 60, Protein = 5, Carbs = 2, Fats = 2 },
            // Chicken ->
            new FoodAlternativesLibrary { Id = 10, OriginalFood = "Chicken", AlternativeFood = "Salmon", ProteinMatchScore = 5, CarbMatchScore = 1, FatMatchScore = 2, CalorieMatchScore = 3, RecoveryValue = 5, SportPerformanceNote = "Excellent recovery food due to omega-3 content.", ReasonExplanation = "Comparable lean protein with added anti-inflammatory benefits.", SuggestedPortion = "120g", Calories = 200, Protein = 25, Carbs = 0, Fats = 11 },
            new FoodAlternativesLibrary { Id = 11, OriginalFood = "Chicken", AlternativeFood = "Turkey breast", ProteinMatchScore = 5, CarbMatchScore = 1, FatMatchScore = 2, CalorieMatchScore = 3, RecoveryValue = 4, SportPerformanceNote = "Near-identical swap for any chicken-based meal plan.", ReasonExplanation = "Almost identical macro profile to chicken breast.", SuggestedPortion = "100g", Calories = 165, Protein = 31, Carbs = 0, Fats = 3 },
            new FoodAlternativesLibrary { Id = 12, OriginalFood = "Chicken", AlternativeFood = "Firm tofu", ProteinMatchScore = 4, CarbMatchScore = 2, FatMatchScore = 3, CalorieMatchScore = 3, RecoveryValue = 3, SportPerformanceNote = "Good vegetarian/vegan substitute in stir-fries and bowls.", ReasonExplanation = "Lower protein density than chicken but complete amino acid profile.", SuggestedPortion = "150g", Calories = 120, Protein = 15, Carbs = 3, Fats = 6 },
            new FoodAlternativesLibrary { Id = 13, OriginalFood = "Chicken", AlternativeFood = "Red lentils", ProteinMatchScore = 3, CarbMatchScore = 4, FatMatchScore = 1, CalorieMatchScore = 3, RecoveryValue = 3, SportPerformanceNote = "Adds carbs for endurance sessions instead of pure protein.", ReasonExplanation = "Lower protein density than chicken, higher carb and fiber content.", SuggestedPortion = "200g cooked", Calories = 230, Protein = 18, Carbs = 40, Fats = 1 },
            new FoodAlternativesLibrary { Id = 14, OriginalFood = "Chicken", AlternativeFood = "Black beans", ProteinMatchScore = 3, CarbMatchScore = 4, FatMatchScore = 1, CalorieMatchScore = 3, RecoveryValue = 3, SportPerformanceNote = "Budget-friendly plant protein with good fiber for general health.", ReasonExplanation = "Moderate protein with added carbohydrate and fiber not present in chicken.", SuggestedPortion = "200g cooked", Calories = 220, Protein = 15, Carbs = 40, Fats = 1 },
            // Rice ->
            new FoodAlternativesLibrary { Id = 15, OriginalFood = "Rice", AlternativeFood = "Potatoes", ProteinMatchScore = 1, CarbMatchScore = 4, FatMatchScore = 1, CalorieMatchScore = 3, RecoveryValue = 4, SportPerformanceNote = "High-glycemic carb source, effective for fast glycogen refill post-match.", ReasonExplanation = "Comparable carbohydrate load to rice with more potassium.", SuggestedPortion = "200g", Calories = 160, Protein = 4, Carbs = 37, Fats = 0 },
            new FoodAlternativesLibrary { Id = 16, OriginalFood = "Rice", AlternativeFood = "Pasta", ProteinMatchScore = 2, CarbMatchScore = 5, FatMatchScore = 1, CalorieMatchScore = 4, RecoveryValue = 4, SportPerformanceNote = "Classic pre-match carb-loading option.", ReasonExplanation = "Very close carbohydrate density to rice, slightly more protein.", SuggestedPortion = "180g cooked", Calories = 220, Protein = 8, Carbs = 43, Fats = 1 },
            new FoodAlternativesLibrary { Id = 17, OriginalFood = "Rice", AlternativeFood = "Quinoa", ProteinMatchScore = 3, CarbMatchScore = 4, FatMatchScore = 2, CalorieMatchScore = 3, RecoveryValue = 4, SportPerformanceNote = "Adds complete protein on top of carb intake, useful for plant-based athletes.", ReasonExplanation = "Similar carb content to rice with meaningfully more protein.", SuggestedPortion = "180g cooked", Calories = 220, Protein = 8, Carbs = 39, Fats = 4 },
            new FoodAlternativesLibrary { Id = 18, OriginalFood = "Rice", AlternativeFood = "Oats", ProteinMatchScore = 3, CarbMatchScore = 4, FatMatchScore = 2, CalorieMatchScore = 3, RecoveryValue = 4, SportPerformanceNote = "Good slow-release carb option for pre-training meals.", ReasonExplanation = "Comparable carbohydrate density with more fiber and protein than rice.", SuggestedPortion = "80g dry", Calories = 300, Protein = 10, Carbs = 54, Fats = 5 },
            // Peanut butter ->
            new FoodAlternativesLibrary { Id = 19, OriginalFood = "Peanut butter", AlternativeFood = "Tahini", ProteinMatchScore = 3, CarbMatchScore = 2, FatMatchScore = 4, CalorieMatchScore = 4, RecoveryValue = 3, SportPerformanceNote = "Good fat/calorie source for athletes needing peanut-free spreads.", ReasonExplanation = "Sesame-based, similar calorie-dense fat profile to peanut butter without nuts.", SuggestedPortion = "30g", Calories = 180, Protein = 5, Carbs = 6, Fats = 16 },
            new FoodAlternativesLibrary { Id = 20, OriginalFood = "Peanut butter", AlternativeFood = "Almond butter", ProteinMatchScore = 3, CarbMatchScore = 2, FatMatchScore = 4, CalorieMatchScore = 4, RecoveryValue = 3, SportPerformanceNote = "Comparable energy-dense snack for endurance athletes.", ReasonExplanation = "Very close macro profile to peanut butter (note: still a tree nut, not suitable for peanut+tree nut allergies).", SuggestedPortion = "30g", Calories = 190, Protein = 7, Carbs = 6, Fats = 17 },
            new FoodAlternativesLibrary { Id = 21, OriginalFood = "Peanut butter", AlternativeFood = "Sunflower seed butter", ProteinMatchScore = 3, CarbMatchScore = 2, FatMatchScore = 4, CalorieMatchScore = 4, RecoveryValue = 3, SportPerformanceNote = "Safe nut-free, seed-based alternative for school/team settings.", ReasonExplanation = "Nut-free spread with a close calorie and fat profile to peanut butter.", SuggestedPortion = "30g", Calories = 185, Protein = 6, Carbs = 6, Fats = 16 }
        );
    }
}
