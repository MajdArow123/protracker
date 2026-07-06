using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace ProTracker.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddSoloAthlete : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<int>(
                name: "TeamId",
                table: "ScheduledSessions",
                type: "integer",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AddColumn<int>(
                name: "PlayerId",
                table: "ScheduledSessions",
                type: "integer",
                nullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "TeamId",
                table: "Players",
                type: "integer",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AddColumn<bool>(
                name: "IsSolo",
                table: "Players",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "SoloUserId",
                table: "Players",
                type: "text",
                nullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "TeamId",
                table: "MatchResults",
                type: "integer",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AddColumn<int>(
                name: "PlayerId",
                table: "MatchResults",
                type: "integer",
                nullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "TeamId",
                table: "AssessmentPeriods",
                type: "integer",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AddColumn<int>(
                name: "PlayerId",
                table: "AssessmentPeriods",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "SoloProfiles",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    PlayerId = table.Column<int>(type: "integer", nullable: false),
                    UserId = table.Column<string>(type: "text", nullable: false),
                    SportId = table.Column<int>(type: "integer", nullable: false),
                    SkillLevel = table.Column<int>(type: "integer", nullable: false),
                    Goals = table.Column<string>(type: "text", nullable: true),
                    Motivation = table.Column<string>(type: "text", nullable: true),
                    TrainingFrequency = table.Column<int>(type: "integer", nullable: false),
                    IsPublic = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SoloProfiles", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SoloProfiles_Players_PlayerId",
                        column: x => x.PlayerId,
                        principalTable: "Players",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SoloProfiles_Sports_SportId",
                        column: x => x.SportId,
                        principalTable: "Sports",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ScheduledSessions_PlayerId_StartTime",
                table: "ScheduledSessions",
                columns: new[] { "PlayerId", "StartTime" });

            migrationBuilder.CreateIndex(
                name: "IX_MatchResults_PlayerId",
                table: "MatchResults",
                column: "PlayerId");

            migrationBuilder.CreateIndex(
                name: "IX_AssessmentPeriods_PlayerId",
                table: "AssessmentPeriods",
                column: "PlayerId");

            migrationBuilder.CreateIndex(
                name: "IX_SoloProfiles_PlayerId",
                table: "SoloProfiles",
                column: "PlayerId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SoloProfiles_SportId",
                table: "SoloProfiles",
                column: "SportId");

            migrationBuilder.CreateIndex(
                name: "IX_SoloProfiles_UserId",
                table: "SoloProfiles",
                column: "UserId");

            migrationBuilder.AddForeignKey(
                name: "FK_AssessmentPeriods_Players_PlayerId",
                table: "AssessmentPeriods",
                column: "PlayerId",
                principalTable: "Players",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_MatchResults_Players_PlayerId",
                table: "MatchResults",
                column: "PlayerId",
                principalTable: "Players",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_ScheduledSessions_Players_PlayerId",
                table: "ScheduledSessions",
                column: "PlayerId",
                principalTable: "Players",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AssessmentPeriods_Players_PlayerId",
                table: "AssessmentPeriods");

            migrationBuilder.DropForeignKey(
                name: "FK_MatchResults_Players_PlayerId",
                table: "MatchResults");

            migrationBuilder.DropForeignKey(
                name: "FK_ScheduledSessions_Players_PlayerId",
                table: "ScheduledSessions");

            migrationBuilder.DropTable(
                name: "SoloProfiles");

            migrationBuilder.DropIndex(
                name: "IX_ScheduledSessions_PlayerId_StartTime",
                table: "ScheduledSessions");

            migrationBuilder.DropIndex(
                name: "IX_MatchResults_PlayerId",
                table: "MatchResults");

            migrationBuilder.DropIndex(
                name: "IX_AssessmentPeriods_PlayerId",
                table: "AssessmentPeriods");

            migrationBuilder.DropColumn(
                name: "PlayerId",
                table: "ScheduledSessions");

            migrationBuilder.DropColumn(
                name: "IsSolo",
                table: "Players");

            migrationBuilder.DropColumn(
                name: "SoloUserId",
                table: "Players");

            migrationBuilder.DropColumn(
                name: "PlayerId",
                table: "MatchResults");

            migrationBuilder.DropColumn(
                name: "PlayerId",
                table: "AssessmentPeriods");

            migrationBuilder.AlterColumn<int>(
                name: "TeamId",
                table: "ScheduledSessions",
                type: "integer",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "TeamId",
                table: "Players",
                type: "integer",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "TeamId",
                table: "MatchResults",
                type: "integer",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "TeamId",
                table: "AssessmentPeriods",
                type: "integer",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);
        }
    }
}
