using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace ProTracker.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddMultiSportDataModel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "FoodAlternativesLibrary",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    OriginalFood = table.Column<string>(type: "TEXT", nullable: false),
                    AlternativeFood = table.Column<string>(type: "TEXT", nullable: false),
                    ProteinMatchScore = table.Column<int>(type: "INTEGER", nullable: false),
                    CarbMatchScore = table.Column<int>(type: "INTEGER", nullable: false),
                    FatMatchScore = table.Column<int>(type: "INTEGER", nullable: false),
                    CalorieMatchScore = table.Column<int>(type: "INTEGER", nullable: false),
                    RecoveryValue = table.Column<int>(type: "INTEGER", nullable: false),
                    SportPerformanceNote = table.Column<string>(type: "TEXT", nullable: true),
                    ReasonExplanation = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FoodAlternativesLibrary", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Sports",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Name = table.Column<string>(type: "TEXT", nullable: false),
                    Description = table.Column<string>(type: "TEXT", nullable: true),
                    IconOrImage = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Sports", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Positions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Name = table.Column<string>(type: "TEXT", nullable: false),
                    SportId = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Positions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Positions_Sports_SportId",
                        column: x => x.SportId,
                        principalTable: "Sports",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "SportStatCategories",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Name = table.Column<string>(type: "TEXT", nullable: false),
                    SportId = table.Column<int>(type: "INTEGER", nullable: false),
                    Description = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SportStatCategories", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SportStatCategories_Sports_SportId",
                        column: x => x.SportId,
                        principalTable: "Sports",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Teams",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Name = table.Column<string>(type: "TEXT", nullable: false),
                    SportId = table.Column<int>(type: "INTEGER", nullable: false),
                    CoachId = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Teams", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Teams_Sports_SportId",
                        column: x => x.SportId,
                        principalTable: "Sports",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "AssessmentPeriods",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Name = table.Column<string>(type: "TEXT", nullable: false),
                    StartDate = table.Column<DateTime>(type: "TEXT", nullable: false),
                    EndDate = table.Column<DateTime>(type: "TEXT", nullable: false),
                    TeamId = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AssessmentPeriods", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AssessmentPeriods_Teams_TeamId",
                        column: x => x.TeamId,
                        principalTable: "Teams",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CoachTeamScopes",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    CoachId = table.Column<string>(type: "TEXT", nullable: false),
                    TeamId = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CoachTeamScopes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CoachTeamScopes_Teams_TeamId",
                        column: x => x.TeamId,
                        principalTable: "Teams",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Players",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    FullName = table.Column<string>(type: "TEXT", nullable: false),
                    Age = table.Column<int>(type: "INTEGER", nullable: false),
                    Height = table.Column<double>(type: "REAL", nullable: false),
                    Weight = table.Column<double>(type: "REAL", nullable: false),
                    SportId = table.Column<int>(type: "INTEGER", nullable: false),
                    TeamId = table.Column<int>(type: "INTEGER", nullable: false),
                    PositionId = table.Column<int>(type: "INTEGER", nullable: false),
                    FitnessLevel = table.Column<int>(type: "INTEGER", nullable: false),
                    InjuryNotes = table.Column<string>(type: "TEXT", nullable: true),
                    Goals = table.Column<string>(type: "TEXT", nullable: true),
                    CoachNotes = table.Column<string>(type: "TEXT", nullable: true),
                    ProfileImageUrl = table.Column<string>(type: "TEXT", nullable: true),
                    UserId = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Players", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Players_Positions_PositionId",
                        column: x => x.PositionId,
                        principalTable: "Positions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Players_Sports_SportId",
                        column: x => x.SportId,
                        principalTable: "Sports",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Players_Teams_TeamId",
                        column: x => x.TeamId,
                        principalTable: "Teams",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ImprovementPlans",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    PlayerId = table.Column<int>(type: "INTEGER", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "TEXT", nullable: false),
                    WeeklyGoals = table.Column<string>(type: "TEXT", nullable: true),
                    TrainingRecommendations = table.Column<string>(type: "TEXT", nullable: true),
                    SkillTargets = table.Column<string>(type: "TEXT", nullable: true),
                    SportSpecificDrills = table.Column<string>(type: "TEXT", nullable: true),
                    PositionFocus = table.Column<string>(type: "TEXT", nullable: true),
                    CoachNotes = table.Column<string>(type: "TEXT", nullable: true),
                    IsAIGenerated = table.Column<bool>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ImprovementPlans", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ImprovementPlans_Players_PlayerId",
                        column: x => x.PlayerId,
                        principalTable: "Players",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "InjuryRecords",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    PlayerId = table.Column<int>(type: "INTEGER", nullable: false),
                    InjuryDate = table.Column<DateTime>(type: "TEXT", nullable: false),
                    InjuryType = table.Column<string>(type: "TEXT", nullable: false),
                    Severity = table.Column<int>(type: "INTEGER", nullable: false),
                    RecoveryStatus = table.Column<int>(type: "INTEGER", nullable: false),
                    Notes = table.Column<string>(type: "TEXT", nullable: true),
                    ExpectedReturnDate = table.Column<DateTime>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InjuryRecords", x => x.Id);
                    table.ForeignKey(
                        name: "FK_InjuryRecords_Players_PlayerId",
                        column: x => x.PlayerId,
                        principalTable: "Players",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "MatchPerformances",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    PlayerId = table.Column<int>(type: "INTEGER", nullable: false),
                    MatchDate = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Opponent = table.Column<string>(type: "TEXT", nullable: false),
                    PerformanceRating = table.Column<int>(type: "INTEGER", nullable: false),
                    Notes = table.Column<string>(type: "TEXT", nullable: true),
                    SportSpecificStats = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MatchPerformances", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MatchPerformances_Players_PlayerId",
                        column: x => x.PlayerId,
                        principalTable: "Players",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "NutritionGuidances",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    PlayerId = table.Column<int>(type: "INTEGER", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Goal = table.Column<string>(type: "TEXT", nullable: true),
                    MealSuggestions = table.Column<string>(type: "TEXT", nullable: true),
                    HydrationTips = table.Column<string>(type: "TEXT", nullable: true),
                    RecoveryTips = table.Column<string>(type: "TEXT", nullable: true),
                    FoodsToPrioritize = table.Column<string>(type: "TEXT", nullable: true),
                    FoodsToLimit = table.Column<string>(type: "TEXT", nullable: true),
                    Disclaimer = table.Column<string>(type: "TEXT", nullable: false),
                    IsAIGenerated = table.Column<bool>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NutritionGuidances", x => x.Id);
                    table.ForeignKey(
                        name: "FK_NutritionGuidances_Players_PlayerId",
                        column: x => x.PlayerId,
                        principalTable: "Players",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PlayerAssessments",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    PlayerId = table.Column<int>(type: "INTEGER", nullable: false),
                    AssessmentPeriodId = table.Column<int>(type: "INTEGER", nullable: false),
                    DateRecorded = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Notes = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlayerAssessments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PlayerAssessments_AssessmentPeriods_AssessmentPeriodId",
                        column: x => x.AssessmentPeriodId,
                        principalTable: "AssessmentPeriods",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PlayerAssessments_Players_PlayerId",
                        column: x => x.PlayerId,
                        principalTable: "Players",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PlayerNutritionProfiles",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    PlayerId = table.Column<int>(type: "INTEGER", nullable: false),
                    PreferenceType = table.Column<int>(type: "INTEGER", nullable: false),
                    Category = table.Column<int>(type: "INTEGER", nullable: false),
                    SpecificItem = table.Column<string>(type: "TEXT", nullable: true),
                    Severity = table.Column<int>(type: "INTEGER", nullable: false),
                    Notes = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlayerNutritionProfiles", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PlayerNutritionProfiles_Players_PlayerId",
                        column: x => x.PlayerId,
                        principalTable: "Players",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TrainingSessions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    PlayerId = table.Column<int>(type: "INTEGER", nullable: false),
                    TeamId = table.Column<int>(type: "INTEGER", nullable: false),
                    Date = table.Column<DateTime>(type: "TEXT", nullable: false),
                    DurationMinutes = table.Column<int>(type: "INTEGER", nullable: false),
                    Notes = table.Column<string>(type: "TEXT", nullable: true),
                    AttendanceStatus = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TrainingSessions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TrainingSessions_Players_PlayerId",
                        column: x => x.PlayerId,
                        principalTable: "Players",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_TrainingSessions_Teams_TeamId",
                        column: x => x.TeamId,
                        principalTable: "Teams",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PlayerStatScores",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    PlayerAssessmentId = table.Column<int>(type: "INTEGER", nullable: false),
                    SportStatCategoryId = table.Column<int>(type: "INTEGER", nullable: false),
                    Score = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlayerStatScores", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PlayerStatScores_PlayerAssessments_PlayerAssessmentId",
                        column: x => x.PlayerAssessmentId,
                        principalTable: "PlayerAssessments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PlayerStatScores_SportStatCategories_SportStatCategoryId",
                        column: x => x.SportStatCategoryId,
                        principalTable: "SportStatCategories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.InsertData(
                table: "FoodAlternativesLibrary",
                columns: new[] { "Id", "AlternativeFood", "CalorieMatchScore", "CarbMatchScore", "FatMatchScore", "OriginalFood", "ProteinMatchScore", "ReasonExplanation", "RecoveryValue", "SportPerformanceNote" },
                values: new object[,]
                {
                    { 1, "Greek yogurt", 3, 3, 3, "Eggs", 4, "High in protein with probiotics; comparable protein density to eggs per serving.", 4, "Good post-training protein source, easy to digest." },
                    { 2, "Tofu", 3, 2, 3, "Eggs", 4, "Complete plant protein; firm tofu has a similar protein-per-gram profile to eggs.", 3, "Suitable pre- or post-session, low fat load." },
                    { 3, "Cottage cheese", 3, 2, 2, "Eggs", 5, "Very high protein-to-calorie ratio, close match to eggs for muscle repair.", 4, "Slow-digesting casein protein, good before bed for recovery." },
                    { 4, "Chicken", 3, 1, 2, "Eggs", 5, "Higher protein density than eggs, minimal carbs, lean if skinless.", 4, "Solid lean protein for muscle maintenance across training cycles." },
                    { 5, "Tuna", 2, 1, 2, "Eggs", 5, "High protein, low calorie alternative with added anti-inflammatory fats.", 4, "Lean protein plus omega-3s, useful for recovery days." },
                    { 6, "Lentils", 3, 4, 1, "Eggs", 3, "Lower protein density than eggs but pairs protein with fiber and carbs.", 3, "Adds slow-release carbs alongside protein for endurance athletes." },
                    { 7, "Soy milk", 3, 3, 3, "Milk / Dairy", 4, "Soy milk has the closest protein content to dairy milk among plant milks.", 3, "Closest plant-based match for post-workout shakes." },
                    { 8, "Lactose-free milk", 4, 4, 4, "Milk / Dairy", 5, "Same nutrition profile as regular milk, lactose enzymatically broken down.", 4, "Direct nutritional swap, no performance trade-off." },
                    { 9, "Almond milk with added protein", 2, 2, 2, "Milk / Dairy", 3, "Plain almond milk is protein-poor, so a protein-fortified version is needed to approach dairy milk.", 2, "Lower calorie option; pair with another protein source on training days." },
                    { 10, "Fish", 3, 1, 2, "Chicken", 5, "Comparable lean protein with added anti-inflammatory benefits.", 5, "Excellent recovery food due to omega-3 content." },
                    { 11, "Turkey", 3, 1, 2, "Chicken", 5, "Almost identical macro profile to chicken breast.", 4, "Near-identical swap for any chicken-based meal plan." },
                    { 12, "Tofu", 3, 2, 3, "Chicken", 4, "Lower protein density than chicken but complete amino acid profile.", 3, "Good vegetarian/vegan substitute in stir-fries and bowls." },
                    { 13, "Lentils", 3, 4, 1, "Chicken", 3, "Lower protein density than chicken, higher carb and fiber content.", 3, "Adds carbs for endurance sessions instead of pure protein." },
                    { 14, "Beans", 3, 4, 1, "Chicken", 3, "Moderate protein with added carbohydrate and fiber not present in chicken.", 3, "Budget-friendly plant protein with good fiber for general health." },
                    { 15, "Potatoes", 3, 4, 1, "Rice", 1, "Comparable carbohydrate load to rice with more potassium.", 4, "High-glycemic carb source, effective for fast glycogen refill post-match." },
                    { 16, "Pasta", 4, 5, 1, "Rice", 2, "Very close carbohydrate density to rice, slightly more protein.", 4, "Classic pre-match carb-loading option." },
                    { 17, "Quinoa", 3, 4, 2, "Rice", 3, "Similar carb content to rice with meaningfully more protein.", 4, "Adds complete protein on top of carb intake, useful for plant-based athletes." },
                    { 18, "Oats", 3, 4, 2, "Rice", 3, "Comparable carbohydrate density with more fiber and protein than rice.", 4, "Good slow-release carb option for pre-training meals." },
                    { 19, "Tahini", 4, 2, 4, "Peanut butter", 3, "Sesame-based, similar calorie-dense fat profile to peanut butter without nuts.", 3, "Good fat/calorie source for athletes needing peanut-free spreads." },
                    { 20, "Almond butter", 4, 2, 4, "Peanut butter", 3, "Very close macro profile to peanut butter (note: still a tree nut, not suitable for peanut+tree nut allergies).", 3, "Comparable energy-dense snack for endurance athletes." },
                    { 21, "Sunflower seed butter", 4, 2, 4, "Peanut butter", 3, "Nut-free spread with a close calorie and fat profile to peanut butter.", 3, "Safe nut-free, seed-based alternative for school/team settings." }
                });

            migrationBuilder.InsertData(
                table: "Sports",
                columns: new[] { "Id", "Description", "IconOrImage", "Name" },
                values: new object[,]
                {
                    { 1, "Eleven-a-side football.", null, "Football / Soccer" },
                    { 2, "Five-a-side basketball.", null, "Basketball" },
                    { 3, "Six-a-side indoor volleyball.", null, "Volleyball Indoor" },
                    { 4, "Two-a-side beach volleyball.", null, "Beach Volleyball" },
                    { 5, "Singles or doubles tennis.", null, "Tennis" }
                });

            migrationBuilder.InsertData(
                table: "Positions",
                columns: new[] { "Id", "Name", "SportId" },
                values: new object[,]
                {
                    { 1, "Goalkeeper", 1 },
                    { 2, "Defender", 1 },
                    { 3, "Midfielder", 1 },
                    { 4, "Winger", 1 },
                    { 5, "Striker", 1 },
                    { 6, "Point Guard", 2 },
                    { 7, "Shooting Guard", 2 },
                    { 8, "Small Forward", 2 },
                    { 9, "Power Forward", 2 },
                    { 10, "Center", 2 },
                    { 11, "Setter", 3 },
                    { 12, "Outside Hitter", 3 },
                    { 13, "Opposite Hitter", 3 },
                    { 14, "Middle Blocker", 3 },
                    { 15, "Libero", 3 },
                    { 16, "Defender", 4 },
                    { 17, "Blocker", 4 },
                    { 18, "All-Round Player", 4 },
                    { 19, "Singles Player", 5 },
                    { 20, "Doubles Player", 5 },
                    { 21, "Baseline Player", 5 },
                    { 22, "Serve-and-Volley Player", 5 },
                    { 23, "All-Court Player", 5 }
                });

            migrationBuilder.InsertData(
                table: "SportStatCategories",
                columns: new[] { "Id", "Description", "Name", "SportId" },
                values: new object[,]
                {
                    { 1, null, "Speed", 1 },
                    { 2, null, "Stamina", 1 },
                    { 3, null, "Passing", 1 },
                    { 4, null, "Shooting", 1 },
                    { 5, null, "Defense", 1 },
                    { 6, null, "Ball Control", 1 },
                    { 7, null, "Agility", 1 },
                    { 8, null, "Match Performance", 1 },
                    { 9, null, "Shooting", 2 },
                    { 10, null, "Dribbling", 2 },
                    { 11, null, "Passing", 2 },
                    { 12, null, "Defense", 2 },
                    { 13, null, "Rebounding", 2 },
                    { 14, null, "Vertical Jump", 2 },
                    { 15, null, "Court Vision", 2 },
                    { 16, null, "Stamina", 2 },
                    { 17, null, "Serving", 3 },
                    { 18, null, "Passing", 3 },
                    { 19, null, "Setting", 3 },
                    { 20, null, "Blocking", 3 },
                    { 21, null, "Spiking", 3 },
                    { 22, null, "Reaction", 3 },
                    { 23, null, "Jumping", 3 },
                    { 24, null, "Team Communication", 3 },
                    { 25, null, "Serving", 4 },
                    { 26, null, "Passing", 4 },
                    { 27, null, "Spiking", 4 },
                    { 28, null, "Defense", 4 },
                    { 29, null, "Movement on Sand", 4 },
                    { 30, null, "Stamina", 4 },
                    { 31, null, "Reaction", 4 },
                    { 32, null, "Communication", 4 },
                    { 33, null, "Serve", 5 },
                    { 34, null, "Forehand", 5 },
                    { 35, null, "Backhand", 5 },
                    { 36, null, "Footwork", 5 },
                    { 37, null, "Stamina", 5 },
                    { 38, null, "Match Consistency", 5 },
                    { 39, null, "Return", 5 },
                    { 40, null, "Mental Focus", 5 }
                });

            migrationBuilder.CreateIndex(
                name: "IX_AssessmentPeriods_TeamId",
                table: "AssessmentPeriods",
                column: "TeamId");

            migrationBuilder.CreateIndex(
                name: "IX_CoachTeamScopes_CoachId_TeamId",
                table: "CoachTeamScopes",
                columns: new[] { "CoachId", "TeamId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CoachTeamScopes_TeamId",
                table: "CoachTeamScopes",
                column: "TeamId");

            migrationBuilder.CreateIndex(
                name: "IX_ImprovementPlans_PlayerId",
                table: "ImprovementPlans",
                column: "PlayerId");

            migrationBuilder.CreateIndex(
                name: "IX_InjuryRecords_PlayerId",
                table: "InjuryRecords",
                column: "PlayerId");

            migrationBuilder.CreateIndex(
                name: "IX_MatchPerformances_PlayerId",
                table: "MatchPerformances",
                column: "PlayerId");

            migrationBuilder.CreateIndex(
                name: "IX_NutritionGuidances_PlayerId",
                table: "NutritionGuidances",
                column: "PlayerId");

            migrationBuilder.CreateIndex(
                name: "IX_PlayerAssessments_AssessmentPeriodId",
                table: "PlayerAssessments",
                column: "AssessmentPeriodId");

            migrationBuilder.CreateIndex(
                name: "IX_PlayerAssessments_PlayerId",
                table: "PlayerAssessments",
                column: "PlayerId");

            migrationBuilder.CreateIndex(
                name: "IX_PlayerNutritionProfiles_PlayerId",
                table: "PlayerNutritionProfiles",
                column: "PlayerId");

            migrationBuilder.CreateIndex(
                name: "IX_Players_PositionId",
                table: "Players",
                column: "PositionId");

            migrationBuilder.CreateIndex(
                name: "IX_Players_SportId",
                table: "Players",
                column: "SportId");

            migrationBuilder.CreateIndex(
                name: "IX_Players_TeamId",
                table: "Players",
                column: "TeamId");

            migrationBuilder.CreateIndex(
                name: "IX_Players_UserId",
                table: "Players",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_PlayerStatScores_PlayerAssessmentId",
                table: "PlayerStatScores",
                column: "PlayerAssessmentId");

            migrationBuilder.CreateIndex(
                name: "IX_PlayerStatScores_SportStatCategoryId",
                table: "PlayerStatScores",
                column: "SportStatCategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_Positions_SportId",
                table: "Positions",
                column: "SportId");

            migrationBuilder.CreateIndex(
                name: "IX_SportStatCategories_SportId",
                table: "SportStatCategories",
                column: "SportId");

            migrationBuilder.CreateIndex(
                name: "IX_Teams_CoachId",
                table: "Teams",
                column: "CoachId");

            migrationBuilder.CreateIndex(
                name: "IX_Teams_SportId",
                table: "Teams",
                column: "SportId");

            migrationBuilder.CreateIndex(
                name: "IX_TrainingSessions_PlayerId",
                table: "TrainingSessions",
                column: "PlayerId");

            migrationBuilder.CreateIndex(
                name: "IX_TrainingSessions_TeamId",
                table: "TrainingSessions",
                column: "TeamId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CoachTeamScopes");

            migrationBuilder.DropTable(
                name: "FoodAlternativesLibrary");

            migrationBuilder.DropTable(
                name: "ImprovementPlans");

            migrationBuilder.DropTable(
                name: "InjuryRecords");

            migrationBuilder.DropTable(
                name: "MatchPerformances");

            migrationBuilder.DropTable(
                name: "NutritionGuidances");

            migrationBuilder.DropTable(
                name: "PlayerNutritionProfiles");

            migrationBuilder.DropTable(
                name: "PlayerStatScores");

            migrationBuilder.DropTable(
                name: "TrainingSessions");

            migrationBuilder.DropTable(
                name: "PlayerAssessments");

            migrationBuilder.DropTable(
                name: "SportStatCategories");

            migrationBuilder.DropTable(
                name: "AssessmentPeriods");

            migrationBuilder.DropTable(
                name: "Players");

            migrationBuilder.DropTable(
                name: "Positions");

            migrationBuilder.DropTable(
                name: "Teams");

            migrationBuilder.DropTable(
                name: "Sports");
        }
    }
}
