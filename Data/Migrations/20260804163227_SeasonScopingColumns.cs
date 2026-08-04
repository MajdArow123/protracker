using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ProTracker.Data.Migrations
{
    /// <inheritdoc />
    public partial class SeasonScopingColumns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "SeasonId",
                table: "TrainingSessions",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SeasonId",
                table: "TrainingPlans",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SeasonId",
                table: "ScheduledSessions",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SeasonId",
                table: "PlayerAssessments",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "BenchmarkProfileId",
                table: "ObjectiveTestResults",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SeasonId",
                table: "ObjectiveTestResults",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SeasonId",
                table: "MatchResults",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SeasonId",
                table: "MatchPerformances",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SeasonId",
                table: "Lineups",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SeasonId",
                table: "ImprovementPlans",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "BenchmarkProfileId",
                table: "EvidenceBasedScores",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SeasonId",
                table: "EvidenceBasedScores",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_PlayerAssessments_SeasonId",
                table: "PlayerAssessments",
                column: "SeasonId");

            migrationBuilder.CreateIndex(
                name: "IX_ObjectiveTestResults_BenchmarkProfileId",
                table: "ObjectiveTestResults",
                column: "BenchmarkProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_ObjectiveTestResults_SeasonId",
                table: "ObjectiveTestResults",
                column: "SeasonId");

            migrationBuilder.CreateIndex(
                name: "IX_MatchResults_SeasonId",
                table: "MatchResults",
                column: "SeasonId");

            migrationBuilder.CreateIndex(
                name: "IX_MatchPerformances_SeasonId",
                table: "MatchPerformances",
                column: "SeasonId");

            migrationBuilder.CreateIndex(
                name: "IX_EvidenceBasedScores_BenchmarkProfileId",
                table: "EvidenceBasedScores",
                column: "BenchmarkProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_EvidenceBasedScores_SeasonId",
                table: "EvidenceBasedScores",
                column: "SeasonId");

            migrationBuilder.AddForeignKey(
                name: "FK_EvidenceBasedScores_BenchmarkProfiles_BenchmarkProfileId",
                table: "EvidenceBasedScores",
                column: "BenchmarkProfileId",
                principalTable: "BenchmarkProfiles",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_EvidenceBasedScores_Seasons_SeasonId",
                table: "EvidenceBasedScores",
                column: "SeasonId",
                principalTable: "Seasons",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_ImprovementPlans_Seasons_SeasonId",
                table: "ImprovementPlans",
                column: "SeasonId",
                principalTable: "Seasons",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Lineups_Seasons_SeasonId",
                table: "Lineups",
                column: "SeasonId",
                principalTable: "Seasons",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_MatchPerformances_Seasons_SeasonId",
                table: "MatchPerformances",
                column: "SeasonId",
                principalTable: "Seasons",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_MatchResults_Seasons_SeasonId",
                table: "MatchResults",
                column: "SeasonId",
                principalTable: "Seasons",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_ObjectiveTestResults_BenchmarkProfiles_BenchmarkProfileId",
                table: "ObjectiveTestResults",
                column: "BenchmarkProfileId",
                principalTable: "BenchmarkProfiles",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_ObjectiveTestResults_Seasons_SeasonId",
                table: "ObjectiveTestResults",
                column: "SeasonId",
                principalTable: "Seasons",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_PlayerAssessments_Seasons_SeasonId",
                table: "PlayerAssessments",
                column: "SeasonId",
                principalTable: "Seasons",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_ScheduledSessions_Seasons_SeasonId",
                table: "ScheduledSessions",
                column: "SeasonId",
                principalTable: "Seasons",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_TrainingPlans_Seasons_SeasonId",
                table: "TrainingPlans",
                column: "SeasonId",
                principalTable: "Seasons",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_TrainingSessions_Seasons_SeasonId",
                table: "TrainingSessions",
                column: "SeasonId",
                principalTable: "Seasons",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_EvidenceBasedScores_BenchmarkProfiles_BenchmarkProfileId",
                table: "EvidenceBasedScores");

            migrationBuilder.DropForeignKey(
                name: "FK_EvidenceBasedScores_Seasons_SeasonId",
                table: "EvidenceBasedScores");

            migrationBuilder.DropForeignKey(
                name: "FK_ImprovementPlans_Seasons_SeasonId",
                table: "ImprovementPlans");

            migrationBuilder.DropForeignKey(
                name: "FK_Lineups_Seasons_SeasonId",
                table: "Lineups");

            migrationBuilder.DropForeignKey(
                name: "FK_MatchPerformances_Seasons_SeasonId",
                table: "MatchPerformances");

            migrationBuilder.DropForeignKey(
                name: "FK_MatchResults_Seasons_SeasonId",
                table: "MatchResults");

            migrationBuilder.DropForeignKey(
                name: "FK_ObjectiveTestResults_BenchmarkProfiles_BenchmarkProfileId",
                table: "ObjectiveTestResults");

            migrationBuilder.DropForeignKey(
                name: "FK_ObjectiveTestResults_Seasons_SeasonId",
                table: "ObjectiveTestResults");

            migrationBuilder.DropForeignKey(
                name: "FK_PlayerAssessments_Seasons_SeasonId",
                table: "PlayerAssessments");

            migrationBuilder.DropForeignKey(
                name: "FK_ScheduledSessions_Seasons_SeasonId",
                table: "ScheduledSessions");

            migrationBuilder.DropForeignKey(
                name: "FK_TrainingPlans_Seasons_SeasonId",
                table: "TrainingPlans");

            migrationBuilder.DropForeignKey(
                name: "FK_TrainingSessions_Seasons_SeasonId",
                table: "TrainingSessions");

            migrationBuilder.DropIndex(
                name: "IX_PlayerAssessments_SeasonId",
                table: "PlayerAssessments");

            migrationBuilder.DropIndex(
                name: "IX_ObjectiveTestResults_BenchmarkProfileId",
                table: "ObjectiveTestResults");

            migrationBuilder.DropIndex(
                name: "IX_ObjectiveTestResults_SeasonId",
                table: "ObjectiveTestResults");

            migrationBuilder.DropIndex(
                name: "IX_MatchResults_SeasonId",
                table: "MatchResults");

            migrationBuilder.DropIndex(
                name: "IX_MatchPerformances_SeasonId",
                table: "MatchPerformances");

            migrationBuilder.DropIndex(
                name: "IX_EvidenceBasedScores_BenchmarkProfileId",
                table: "EvidenceBasedScores");

            migrationBuilder.DropIndex(
                name: "IX_EvidenceBasedScores_SeasonId",
                table: "EvidenceBasedScores");

            migrationBuilder.DropColumn(
                name: "SeasonId",
                table: "TrainingSessions");

            migrationBuilder.DropColumn(
                name: "SeasonId",
                table: "TrainingPlans");

            migrationBuilder.DropColumn(
                name: "SeasonId",
                table: "ScheduledSessions");

            migrationBuilder.DropColumn(
                name: "SeasonId",
                table: "PlayerAssessments");

            migrationBuilder.DropColumn(
                name: "BenchmarkProfileId",
                table: "ObjectiveTestResults");

            migrationBuilder.DropColumn(
                name: "SeasonId",
                table: "ObjectiveTestResults");

            migrationBuilder.DropColumn(
                name: "SeasonId",
                table: "MatchResults");

            migrationBuilder.DropColumn(
                name: "SeasonId",
                table: "MatchPerformances");

            migrationBuilder.DropColumn(
                name: "SeasonId",
                table: "Lineups");

            migrationBuilder.DropColumn(
                name: "SeasonId",
                table: "ImprovementPlans");

            migrationBuilder.DropColumn(
                name: "BenchmarkProfileId",
                table: "EvidenceBasedScores");

            migrationBuilder.DropColumn(
                name: "SeasonId",
                table: "EvidenceBasedScores");
        }
    }
}
