using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ProTracker.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddMatchScoreFormat : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "StatJson",
                table: "PlayerMatchRatings",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ScoreFormat",
                table: "MatchResults",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "SetScores",
                table: "MatchResults",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "StatJson",
                table: "PlayerMatchRatings");

            migrationBuilder.DropColumn(
                name: "ScoreFormat",
                table: "MatchResults");

            migrationBuilder.DropColumn(
                name: "SetScores",
                table: "MatchResults");
        }
    }
}
