using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace ProTracker.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddLineupWorkflow : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Name",
                table: "Lineups",
                type: "character varying(60)",
                maxLength: 60,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "PublishedAt",
                table: "Lineups",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Status",
                table: "Lineups",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            // Hand-edited: existing rows backfill to Version 1, the contract's
            // floor (versions are 1-based; BaseVersion must be > 0 on save).
            migrationBuilder.AddColumn<int>(
                name: "Version",
                table: "Lineups",
                type: "integer",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.CreateTable(
                name: "LineupChangeAudits",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    TeamId = table.Column<int>(type: "integer", nullable: false),
                    LineupId = table.Column<int>(type: "integer", nullable: true),
                    KeyLabel = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    ChangedByUserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
                    ChangedByName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Action = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    Summary = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LineupChangeAudits", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LineupChangeAudits_Lineups_LineupId",
                        column: x => x.LineupId,
                        principalTable: "Lineups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_LineupChangeAudits_Teams_TeamId",
                        column: x => x.TeamId,
                        principalTable: "Teams",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TacticalPresets",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CoachId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
                    SportId = table.Column<int>(type: "integer", nullable: false),
                    Name = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    Formation = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: true),
                    SettingsJson = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TacticalPresets", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TacticalPresets_Sports_SportId",
                        column: x => x.SportId,
                        principalTable: "Sports",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_LineupChangeAudits_LineupId",
                table: "LineupChangeAudits",
                column: "LineupId");

            migrationBuilder.CreateIndex(
                name: "IX_LineupChangeAudits_TeamId_CreatedAt",
                table: "LineupChangeAudits",
                columns: new[] { "TeamId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_TacticalPresets_CoachId_SportId",
                table: "TacticalPresets",
                columns: new[] { "CoachId", "SportId" });

            migrationBuilder.CreateIndex(
                name: "IX_TacticalPresets_SportId",
                table: "TacticalPresets",
                column: "SportId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "LineupChangeAudits");

            migrationBuilder.DropTable(
                name: "TacticalPresets");

            migrationBuilder.DropColumn(
                name: "Name",
                table: "Lineups");

            migrationBuilder.DropColumn(
                name: "PublishedAt",
                table: "Lineups");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "Lineups");

            migrationBuilder.DropColumn(
                name: "Version",
                table: "Lineups");
        }
    }
}
