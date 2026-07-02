using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace ProTracker.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddRecoveryPlans : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "InjuryRecoveryPlans",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    InjuryRecordId = table.Column<int>(type: "integer", nullable: false),
                    PlayerId = table.Column<int>(type: "integer", nullable: false),
                    CoachId = table.Column<string>(type: "text", nullable: false),
                    Title = table.Column<string>(type: "text", nullable: false),
                    EstimatedWeeks = table.Column<int>(type: "integer", nullable: false),
                    CurrentWeek = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InjuryRecoveryPlans", x => x.Id);
                    table.ForeignKey(
                        name: "FK_InjuryRecoveryPlans_InjuryRecords_InjuryRecordId",
                        column: x => x.InjuryRecordId,
                        principalTable: "InjuryRecords",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_InjuryRecoveryPlans_Players_PlayerId",
                        column: x => x.PlayerId,
                        principalTable: "Players",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "RecoveryExercises",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    InjuryRecoveryPlanId = table.Column<int>(type: "integer", nullable: false),
                    Title = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    Sets = table.Column<int>(type: "integer", nullable: true),
                    Reps = table.Column<int>(type: "integer", nullable: true),
                    DurationMinutes = table.Column<int>(type: "integer", nullable: true),
                    RestSeconds = table.Column<int>(type: "integer", nullable: true),
                    Week = table.Column<int>(type: "integer", nullable: false),
                    DayOfWeek = table.Column<string>(type: "text", nullable: false),
                    Category = table.Column<int>(type: "integer", nullable: false),
                    IsCompleted = table.Column<bool>(type: "boolean", nullable: false),
                    CompletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CompletedNote = table.Column<string>(type: "text", nullable: true),
                    DifficultyRating = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RecoveryExercises", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RecoveryExercises_InjuryRecoveryPlans_InjuryRecoveryPlanId",
                        column: x => x.InjuryRecoveryPlanId,
                        principalTable: "InjuryRecoveryPlans",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "RecoveryMilestones",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    InjuryRecoveryPlanId = table.Column<int>(type: "integer", nullable: false),
                    Title = table.Column<string>(type: "text", nullable: false),
                    TargetWeek = table.Column<int>(type: "integer", nullable: false),
                    IsAchieved = table.Column<bool>(type: "boolean", nullable: false),
                    AchievedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Notes = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RecoveryMilestones", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RecoveryMilestones_InjuryRecoveryPlans_InjuryRecoveryPlanId",
                        column: x => x.InjuryRecoveryPlanId,
                        principalTable: "InjuryRecoveryPlans",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_InjuryRecoveryPlans_InjuryRecordId",
                table: "InjuryRecoveryPlans",
                column: "InjuryRecordId");

            migrationBuilder.CreateIndex(
                name: "IX_InjuryRecoveryPlans_PlayerId",
                table: "InjuryRecoveryPlans",
                column: "PlayerId");

            migrationBuilder.CreateIndex(
                name: "IX_RecoveryExercises_InjuryRecoveryPlanId",
                table: "RecoveryExercises",
                column: "InjuryRecoveryPlanId");

            migrationBuilder.CreateIndex(
                name: "IX_RecoveryMilestones_InjuryRecoveryPlanId",
                table: "RecoveryMilestones",
                column: "InjuryRecoveryPlanId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RecoveryExercises");

            migrationBuilder.DropTable(
                name: "RecoveryMilestones");

            migrationBuilder.DropTable(
                name: "InjuryRecoveryPlans");
        }
    }
}
