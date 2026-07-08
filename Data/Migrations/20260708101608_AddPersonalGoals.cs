using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace ProTracker.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddPersonalGoals : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PersonalGoals",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    PlayerId = table.Column<int>(type: "integer", nullable: false),
                    UserId = table.Column<string>(type: "text", nullable: true),
                    Title = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    Category = table.Column<int>(type: "integer", nullable: false),
                    TargetValue = table.Column<decimal>(type: "numeric(9,2)", nullable: true),
                    CurrentValue = table.Column<decimal>(type: "numeric(9,2)", nullable: true),
                    Unit = table.Column<string>(type: "text", nullable: true),
                    LinkedStatCategoryId = table.Column<int>(type: "integer", nullable: true),
                    StartDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    TargetDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    Priority = table.Column<int>(type: "integer", nullable: false),
                    IsPrivate = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    AchievedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PersonalGoals", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PersonalGoals_Players_PlayerId",
                        column: x => x.PlayerId,
                        principalTable: "Players",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "GoalMilestones",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    PersonalGoalId = table.Column<int>(type: "integer", nullable: false),
                    Title = table.Column<string>(type: "text", nullable: false),
                    TargetValue = table.Column<decimal>(type: "numeric(9,2)", nullable: true),
                    IsAchieved = table.Column<bool>(type: "boolean", nullable: false),
                    AchievedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    TargetDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GoalMilestones", x => x.Id);
                    table.ForeignKey(
                        name: "FK_GoalMilestones_PersonalGoals_PersonalGoalId",
                        column: x => x.PersonalGoalId,
                        principalTable: "PersonalGoals",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "GoalProgress",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    PersonalGoalId = table.Column<int>(type: "integer", nullable: false),
                    Value = table.Column<decimal>(type: "numeric(9,2)", nullable: false),
                    Note = table.Column<string>(type: "text", nullable: true),
                    RecordedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Source = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GoalProgress", x => x.Id);
                    table.ForeignKey(
                        name: "FK_GoalProgress_PersonalGoals_PersonalGoalId",
                        column: x => x.PersonalGoalId,
                        principalTable: "PersonalGoals",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_GoalMilestones_PersonalGoalId",
                table: "GoalMilestones",
                column: "PersonalGoalId");

            migrationBuilder.CreateIndex(
                name: "IX_GoalProgress_PersonalGoalId",
                table: "GoalProgress",
                column: "PersonalGoalId");

            migrationBuilder.CreateIndex(
                name: "IX_PersonalGoals_PlayerId",
                table: "PersonalGoals",
                column: "PlayerId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "GoalMilestones");

            migrationBuilder.DropTable(
                name: "GoalProgress");

            migrationBuilder.DropTable(
                name: "PersonalGoals");
        }
    }
}
