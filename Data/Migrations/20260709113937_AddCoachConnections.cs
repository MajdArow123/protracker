using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace ProTracker.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddCoachConnections : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CoachConnectionRequests",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CoachUserId = table.Column<string>(type: "text", nullable: false),
                    CoachName = table.Column<string>(type: "text", nullable: false),
                    AthleteUserId = table.Column<string>(type: "text", nullable: false),
                    AthleteName = table.Column<string>(type: "text", nullable: false),
                    AthletePlayerId = table.Column<int>(type: "integer", nullable: true),
                    Message = table.Column<string>(type: "text", nullable: true),
                    SportId = table.Column<int>(type: "integer", nullable: true),
                    SportName = table.Column<string>(type: "text", nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    CoachNote = table.Column<string>(type: "text", nullable: true),
                    ResultJoinCode = table.Column<string>(type: "text", nullable: true),
                    RequestedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    RespondedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CoachConnectionRequests", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CoachConnectionRequests_AthleteUserId_RequestedAt",
                table: "CoachConnectionRequests",
                columns: new[] { "AthleteUserId", "RequestedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_CoachConnectionRequests_CoachUserId_Status",
                table: "CoachConnectionRequests",
                columns: new[] { "CoachUserId", "Status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CoachConnectionRequests");
        }
    }
}
