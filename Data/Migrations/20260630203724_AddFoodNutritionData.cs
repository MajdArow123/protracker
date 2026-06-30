using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ProTracker.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddFoodNutritionData : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Calories",
                table: "FoodAlternativesLibrary",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Carbs",
                table: "FoodAlternativesLibrary",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Fats",
                table: "FoodAlternativesLibrary",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Protein",
                table: "FoodAlternativesLibrary",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SuggestedPortion",
                table: "FoodAlternativesLibrary",
                type: "TEXT",
                nullable: true);

            migrationBuilder.UpdateData(
                table: "FoodAlternativesLibrary",
                keyColumn: "Id",
                keyValue: 1,
                columns: new[] { "Calories", "Carbs", "Fats", "Protein", "SuggestedPortion" },
                values: new object[] { 130, 8, 4, 15, "150g" });

            migrationBuilder.UpdateData(
                table: "FoodAlternativesLibrary",
                keyColumn: "Id",
                keyValue: 2,
                columns: new[] { "Calories", "Carbs", "Fats", "Protein", "SuggestedPortion" },
                values: new object[] { 120, 3, 6, 15, "150g" });

            migrationBuilder.UpdateData(
                table: "FoodAlternativesLibrary",
                keyColumn: "Id",
                keyValue: 3,
                columns: new[] { "Calories", "Carbs", "Fats", "Protein", "SuggestedPortion" },
                values: new object[] { 130, 5, 4, 17, "150g" });

            migrationBuilder.UpdateData(
                table: "FoodAlternativesLibrary",
                keyColumn: "Id",
                keyValue: 4,
                columns: new[] { "AlternativeFood", "Calories", "Carbs", "Fats", "Protein", "SuggestedPortion" },
                values: new object[] { "Chicken breast", 165, 0, 4, 31, "100g" });

            migrationBuilder.UpdateData(
                table: "FoodAlternativesLibrary",
                keyColumn: "Id",
                keyValue: 5,
                columns: new[] { "Calories", "Carbs", "Fats", "Protein", "SuggestedPortion" },
                values: new object[] { 116, 0, 1, 25, "100g" });

            migrationBuilder.UpdateData(
                table: "FoodAlternativesLibrary",
                keyColumn: "Id",
                keyValue: 6,
                columns: new[] { "Calories", "Carbs", "Fats", "Protein", "SuggestedPortion" },
                values: new object[] { 230, 40, 1, 18, "200g cooked" });

            migrationBuilder.UpdateData(
                table: "FoodAlternativesLibrary",
                keyColumn: "Id",
                keyValue: 7,
                columns: new[] { "Calories", "Carbs", "Fats", "Protein", "SuggestedPortion" },
                values: new object[] { 80, 4, 4, 7, "240ml" });

            migrationBuilder.UpdateData(
                table: "FoodAlternativesLibrary",
                keyColumn: "Id",
                keyValue: 8,
                columns: new[] { "Calories", "Carbs", "Fats", "Protein", "SuggestedPortion" },
                values: new object[] { 150, 12, 8, 8, "240ml" });

            migrationBuilder.UpdateData(
                table: "FoodAlternativesLibrary",
                keyColumn: "Id",
                keyValue: 9,
                columns: new[] { "AlternativeFood", "Calories", "Carbs", "Fats", "Protein", "SuggestedPortion" },
                values: new object[] { "Almond milk with protein", 60, 2, 2, 5, "240ml" });

            migrationBuilder.UpdateData(
                table: "FoodAlternativesLibrary",
                keyColumn: "Id",
                keyValue: 10,
                columns: new[] { "AlternativeFood", "Calories", "Carbs", "Fats", "Protein", "SuggestedPortion" },
                values: new object[] { "Salmon", 200, 0, 11, 25, "120g" });

            migrationBuilder.UpdateData(
                table: "FoodAlternativesLibrary",
                keyColumn: "Id",
                keyValue: 11,
                columns: new[] { "AlternativeFood", "Calories", "Carbs", "Fats", "Protein", "SuggestedPortion" },
                values: new object[] { "Turkey breast", 165, 0, 3, 31, "100g" });

            migrationBuilder.UpdateData(
                table: "FoodAlternativesLibrary",
                keyColumn: "Id",
                keyValue: 12,
                columns: new[] { "AlternativeFood", "Calories", "Carbs", "Fats", "Protein", "SuggestedPortion" },
                values: new object[] { "Firm tofu", 120, 3, 6, 15, "150g" });

            migrationBuilder.UpdateData(
                table: "FoodAlternativesLibrary",
                keyColumn: "Id",
                keyValue: 13,
                columns: new[] { "AlternativeFood", "Calories", "Carbs", "Fats", "Protein", "SuggestedPortion" },
                values: new object[] { "Red lentils", 230, 40, 1, 18, "200g cooked" });

            migrationBuilder.UpdateData(
                table: "FoodAlternativesLibrary",
                keyColumn: "Id",
                keyValue: 14,
                columns: new[] { "AlternativeFood", "Calories", "Carbs", "Fats", "Protein", "SuggestedPortion" },
                values: new object[] { "Black beans", 220, 40, 1, 15, "200g cooked" });

            migrationBuilder.UpdateData(
                table: "FoodAlternativesLibrary",
                keyColumn: "Id",
                keyValue: 15,
                columns: new[] { "Calories", "Carbs", "Fats", "Protein", "SuggestedPortion" },
                values: new object[] { 160, 37, 0, 4, "200g" });

            migrationBuilder.UpdateData(
                table: "FoodAlternativesLibrary",
                keyColumn: "Id",
                keyValue: 16,
                columns: new[] { "Calories", "Carbs", "Fats", "Protein", "SuggestedPortion" },
                values: new object[] { 220, 43, 1, 8, "180g cooked" });

            migrationBuilder.UpdateData(
                table: "FoodAlternativesLibrary",
                keyColumn: "Id",
                keyValue: 17,
                columns: new[] { "Calories", "Carbs", "Fats", "Protein", "SuggestedPortion" },
                values: new object[] { 220, 39, 4, 8, "180g cooked" });

            migrationBuilder.UpdateData(
                table: "FoodAlternativesLibrary",
                keyColumn: "Id",
                keyValue: 18,
                columns: new[] { "Calories", "Carbs", "Fats", "Protein", "SuggestedPortion" },
                values: new object[] { 300, 54, 5, 10, "80g dry" });

            migrationBuilder.UpdateData(
                table: "FoodAlternativesLibrary",
                keyColumn: "Id",
                keyValue: 19,
                columns: new[] { "Calories", "Carbs", "Fats", "Protein", "SuggestedPortion" },
                values: new object[] { 180, 6, 16, 5, "30g" });

            migrationBuilder.UpdateData(
                table: "FoodAlternativesLibrary",
                keyColumn: "Id",
                keyValue: 20,
                columns: new[] { "Calories", "Carbs", "Fats", "Protein", "SuggestedPortion" },
                values: new object[] { 190, 6, 17, 7, "30g" });

            migrationBuilder.UpdateData(
                table: "FoodAlternativesLibrary",
                keyColumn: "Id",
                keyValue: 21,
                columns: new[] { "Calories", "Carbs", "Fats", "Protein", "SuggestedPortion" },
                values: new object[] { 185, 6, 16, 6, "30g" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Calories",
                table: "FoodAlternativesLibrary");

            migrationBuilder.DropColumn(
                name: "Carbs",
                table: "FoodAlternativesLibrary");

            migrationBuilder.DropColumn(
                name: "Fats",
                table: "FoodAlternativesLibrary");

            migrationBuilder.DropColumn(
                name: "Protein",
                table: "FoodAlternativesLibrary");

            migrationBuilder.DropColumn(
                name: "SuggestedPortion",
                table: "FoodAlternativesLibrary");

            migrationBuilder.UpdateData(
                table: "FoodAlternativesLibrary",
                keyColumn: "Id",
                keyValue: 4,
                column: "AlternativeFood",
                value: "Chicken");

            migrationBuilder.UpdateData(
                table: "FoodAlternativesLibrary",
                keyColumn: "Id",
                keyValue: 9,
                column: "AlternativeFood",
                value: "Almond milk with added protein");

            migrationBuilder.UpdateData(
                table: "FoodAlternativesLibrary",
                keyColumn: "Id",
                keyValue: 10,
                column: "AlternativeFood",
                value: "Fish");

            migrationBuilder.UpdateData(
                table: "FoodAlternativesLibrary",
                keyColumn: "Id",
                keyValue: 11,
                column: "AlternativeFood",
                value: "Turkey");

            migrationBuilder.UpdateData(
                table: "FoodAlternativesLibrary",
                keyColumn: "Id",
                keyValue: 12,
                column: "AlternativeFood",
                value: "Tofu");

            migrationBuilder.UpdateData(
                table: "FoodAlternativesLibrary",
                keyColumn: "Id",
                keyValue: 13,
                column: "AlternativeFood",
                value: "Lentils");

            migrationBuilder.UpdateData(
                table: "FoodAlternativesLibrary",
                keyColumn: "Id",
                keyValue: 14,
                column: "AlternativeFood",
                value: "Beans");
        }
    }
}
