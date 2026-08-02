using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ProTracker.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddMatchScheduling : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "OpponentFormation",
                table: "MatchResults",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ScoutingNotes",
                table: "MatchResults",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Status",
                table: "MatchResults",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "OpponentFormation",
                table: "MatchResults");

            migrationBuilder.DropColumn(
                name: "ScoutingNotes",
                table: "MatchResults");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "MatchResults");
        }
    }
}
