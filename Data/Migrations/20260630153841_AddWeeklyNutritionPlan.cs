using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ProTracker.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddWeeklyNutritionPlan : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "WeeklyNutritionPlans",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    PlayerId = table.Column<int>(type: "INTEGER", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "TEXT", nullable: false),
                    WeekStartDate = table.Column<DateTime>(type: "TEXT", nullable: false),
                    IsAIGenerated = table.Column<bool>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WeeklyNutritionPlans", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WeeklyNutritionPlans_Players_PlayerId",
                        column: x => x.PlayerId,
                        principalTable: "Players",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "DailyMealPlans",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    WeeklyNutritionPlanId = table.Column<int>(type: "INTEGER", nullable: false),
                    DayNumber = table.Column<int>(type: "INTEGER", nullable: false),
                    DayName = table.Column<string>(type: "TEXT", nullable: false),
                    DailyCalories = table.Column<int>(type: "INTEGER", nullable: false),
                    DailyProtein = table.Column<int>(type: "INTEGER", nullable: false),
                    DailyCarbs = table.Column<int>(type: "INTEGER", nullable: false),
                    DailyFats = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DailyMealPlans", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DailyMealPlans_WeeklyNutritionPlans_WeeklyNutritionPlanId",
                        column: x => x.WeeklyNutritionPlanId,
                        principalTable: "WeeklyNutritionPlans",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PlannedMeals",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    DailyMealPlanId = table.Column<int>(type: "INTEGER", nullable: false),
                    MealType = table.Column<string>(type: "TEXT", nullable: false),
                    Time = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlannedMeals", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PlannedMeals_DailyMealPlans_DailyMealPlanId",
                        column: x => x.DailyMealPlanId,
                        principalTable: "DailyMealPlans",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PlannedMealItems",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    PlannedMealId = table.Column<int>(type: "INTEGER", nullable: false),
                    FoodName = table.Column<string>(type: "TEXT", nullable: false),
                    Portion = table.Column<string>(type: "TEXT", nullable: false),
                    Calories = table.Column<int>(type: "INTEGER", nullable: false),
                    Protein = table.Column<int>(type: "INTEGER", nullable: false),
                    Carbs = table.Column<int>(type: "INTEGER", nullable: false),
                    Fats = table.Column<int>(type: "INTEGER", nullable: false),
                    IsSwapped = table.Column<bool>(type: "INTEGER", nullable: false),
                    OriginalFoodName = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlannedMealItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PlannedMealItems_PlannedMeals_PlannedMealId",
                        column: x => x.PlannedMealId,
                        principalTable: "PlannedMeals",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_DailyMealPlans_WeeklyNutritionPlanId",
                table: "DailyMealPlans",
                column: "WeeklyNutritionPlanId");

            migrationBuilder.CreateIndex(
                name: "IX_PlannedMealItems_PlannedMealId",
                table: "PlannedMealItems",
                column: "PlannedMealId");

            migrationBuilder.CreateIndex(
                name: "IX_PlannedMeals_DailyMealPlanId",
                table: "PlannedMeals",
                column: "DailyMealPlanId");

            migrationBuilder.CreateIndex(
                name: "IX_WeeklyNutritionPlans_PlayerId",
                table: "WeeklyNutritionPlans",
                column: "PlayerId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PlannedMealItems");

            migrationBuilder.DropTable(
                name: "PlannedMeals");

            migrationBuilder.DropTable(
                name: "DailyMealPlans");

            migrationBuilder.DropTable(
                name: "WeeklyNutritionPlans");
        }
    }
}
