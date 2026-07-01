using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ProTracker.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddDecimalStatScores : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<decimal>(
                name: "Score",
                table: "PlayerStatScores",
                type: "numeric(3,1)",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<int>(
                name: "Score",
                table: "PlayerStatScores",
                type: "integer",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric(3,1)");
        }
    }
}
