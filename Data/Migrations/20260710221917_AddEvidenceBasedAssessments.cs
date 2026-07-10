using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace ProTracker.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddEvidenceBasedAssessments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "MatchStatEntries",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    PlayerId = table.Column<int>(type: "integer", nullable: false),
                    MatchResultId = table.Column<int>(type: "integer", nullable: true),
                    StatDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    SportId = table.Column<int>(type: "integer", nullable: false),
                    StatsJson = table.Column<string>(type: "text", nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MatchStatEntries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MatchStatEntries_MatchResults_MatchResultId",
                        column: x => x.MatchResultId,
                        principalTable: "MatchResults",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_MatchStatEntries_Players_PlayerId",
                        column: x => x.PlayerId,
                        principalTable: "Players",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_MatchStatEntries_Sports_SportId",
                        column: x => x.SportId,
                        principalTable: "Sports",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "SportMetricDefinitions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    SportId = table.Column<int>(type: "integer", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    ShortName = table.Column<string>(type: "text", nullable: true),
                    Category = table.Column<int>(type: "integer", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    Unit = table.Column<string>(type: "text", nullable: true),
                    InputType = table.Column<int>(type: "integer", nullable: false),
                    ObjectiveTestWeight = table.Column<decimal>(type: "numeric(3,2)", nullable: false),
                    MatchStatWeight = table.Column<decimal>(type: "numeric(3,2)", nullable: false),
                    CoachEvalWeight = table.Column<decimal>(type: "numeric(3,2)", nullable: false),
                    SelfAssessWeight = table.Column<decimal>(type: "numeric(3,2)", nullable: false),
                    IsObjectiveRequired = table.Column<bool>(type: "boolean", nullable: false),
                    BenchmarkLow = table.Column<decimal>(type: "numeric(9,2)", nullable: false),
                    BenchmarkMid = table.Column<decimal>(type: "numeric(9,2)", nullable: false),
                    BenchmarkHigh = table.Column<decimal>(type: "numeric(9,2)", nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    SportStatCategoryId = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SportMetricDefinitions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SportMetricDefinitions_SportStatCategories_SportStatCategor~",
                        column: x => x.SportStatCategoryId,
                        principalTable: "SportStatCategories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SportMetricDefinitions_Sports_SportId",
                        column: x => x.SportId,
                        principalTable: "Sports",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "CoachEvaluations",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    PlayerId = table.Column<int>(type: "integer", nullable: false),
                    CoachId = table.Column<string>(type: "text", nullable: false),
                    MetricDefinitionId = table.Column<int>(type: "integer", nullable: false),
                    Rating = table.Column<decimal>(type: "numeric(3,1)", nullable: false),
                    EvalDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    AssessmentId = table.Column<int>(type: "integer", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CoachEvaluations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CoachEvaluations_PlayerAssessments_AssessmentId",
                        column: x => x.AssessmentId,
                        principalTable: "PlayerAssessments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_CoachEvaluations_Players_PlayerId",
                        column: x => x.PlayerId,
                        principalTable: "Players",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CoachEvaluations_SportMetricDefinitions_MetricDefinitionId",
                        column: x => x.MetricDefinitionId,
                        principalTable: "SportMetricDefinitions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "EvidenceBasedScores",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    PlayerId = table.Column<int>(type: "integer", nullable: false),
                    MetricDefinitionId = table.Column<int>(type: "integer", nullable: false),
                    AssessmentId = table.Column<int>(type: "integer", nullable: true),
                    FinalScore = table.Column<decimal>(type: "numeric(3,1)", nullable: false),
                    Confidence = table.Column<int>(type: "integer", nullable: false),
                    CalculationMethod = table.Column<int>(type: "integer", nullable: false),
                    ObjectiveScore = table.Column<decimal>(type: "numeric(3,1)", nullable: true),
                    MatchStatScore = table.Column<decimal>(type: "numeric(3,1)", nullable: true),
                    CoachEvalScore = table.Column<decimal>(type: "numeric(3,1)", nullable: true),
                    SelfAssessScore = table.Column<decimal>(type: "numeric(3,1)", nullable: true),
                    ObjectiveWeight = table.Column<decimal>(type: "numeric(4,3)", nullable: false),
                    MatchStatWeight = table.Column<decimal>(type: "numeric(4,3)", nullable: false),
                    CoachEvalWeight = table.Column<decimal>(type: "numeric(4,3)", nullable: false),
                    SelfAssessWeight = table.Column<decimal>(type: "numeric(4,3)", nullable: false),
                    EvidenceSources = table.Column<string>(type: "text", nullable: false),
                    Explanation = table.Column<string>(type: "text", nullable: true),
                    LastCalculatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EvidenceBasedScores", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EvidenceBasedScores_PlayerAssessments_AssessmentId",
                        column: x => x.AssessmentId,
                        principalTable: "PlayerAssessments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_EvidenceBasedScores_Players_PlayerId",
                        column: x => x.PlayerId,
                        principalTable: "Players",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_EvidenceBasedScores_SportMetricDefinitions_MetricDefinition~",
                        column: x => x.MetricDefinitionId,
                        principalTable: "SportMetricDefinitions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ObjectiveTestResults",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    PlayerId = table.Column<int>(type: "integer", nullable: false),
                    MetricDefinitionId = table.Column<int>(type: "integer", nullable: false),
                    Value = table.Column<decimal>(type: "numeric(9,2)", nullable: false),
                    Unit = table.Column<string>(type: "text", nullable: false),
                    TestedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    TestedBy = table.Column<int>(type: "integer", nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    AssessmentId = table.Column<int>(type: "integer", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ObjectiveTestResults", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ObjectiveTestResults_PlayerAssessments_AssessmentId",
                        column: x => x.AssessmentId,
                        principalTable: "PlayerAssessments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_ObjectiveTestResults_Players_PlayerId",
                        column: x => x.PlayerId,
                        principalTable: "Players",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ObjectiveTestResults_SportMetricDefinitions_MetricDefinitio~",
                        column: x => x.MetricDefinitionId,
                        principalTable: "SportMetricDefinitions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "SelfAssessmentEntries",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    PlayerId = table.Column<int>(type: "integer", nullable: false),
                    MetricDefinitionId = table.Column<int>(type: "integer", nullable: false),
                    Rating = table.Column<decimal>(type: "numeric(3,1)", nullable: false),
                    EvalDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    GuidedAnswers = table.Column<string>(type: "text", nullable: true),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    AssessmentId = table.Column<int>(type: "integer", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SelfAssessmentEntries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SelfAssessmentEntries_PlayerAssessments_AssessmentId",
                        column: x => x.AssessmentId,
                        principalTable: "PlayerAssessments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_SelfAssessmentEntries_Players_PlayerId",
                        column: x => x.PlayerId,
                        principalTable: "Players",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SelfAssessmentEntries_SportMetricDefinitions_MetricDefiniti~",
                        column: x => x.MetricDefinitionId,
                        principalTable: "SportMetricDefinitions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CoachEvaluations_AssessmentId",
                table: "CoachEvaluations",
                column: "AssessmentId");

            migrationBuilder.CreateIndex(
                name: "IX_CoachEvaluations_MetricDefinitionId",
                table: "CoachEvaluations",
                column: "MetricDefinitionId");

            migrationBuilder.CreateIndex(
                name: "IX_CoachEvaluations_PlayerId_MetricDefinitionId_EvalDate",
                table: "CoachEvaluations",
                columns: new[] { "PlayerId", "MetricDefinitionId", "EvalDate" });

            migrationBuilder.CreateIndex(
                name: "IX_EvidenceBasedScores_AssessmentId",
                table: "EvidenceBasedScores",
                column: "AssessmentId");

            migrationBuilder.CreateIndex(
                name: "IX_EvidenceBasedScores_MetricDefinitionId",
                table: "EvidenceBasedScores",
                column: "MetricDefinitionId");

            migrationBuilder.CreateIndex(
                name: "IX_EvidenceBasedScores_PlayerId_MetricDefinitionId",
                table: "EvidenceBasedScores",
                columns: new[] { "PlayerId", "MetricDefinitionId" });

            migrationBuilder.CreateIndex(
                name: "IX_MatchStatEntries_MatchResultId",
                table: "MatchStatEntries",
                column: "MatchResultId");

            migrationBuilder.CreateIndex(
                name: "IX_MatchStatEntries_PlayerId_StatDate",
                table: "MatchStatEntries",
                columns: new[] { "PlayerId", "StatDate" });

            migrationBuilder.CreateIndex(
                name: "IX_MatchStatEntries_SportId",
                table: "MatchStatEntries",
                column: "SportId");

            migrationBuilder.CreateIndex(
                name: "IX_ObjectiveTestResults_AssessmentId",
                table: "ObjectiveTestResults",
                column: "AssessmentId");

            migrationBuilder.CreateIndex(
                name: "IX_ObjectiveTestResults_MetricDefinitionId",
                table: "ObjectiveTestResults",
                column: "MetricDefinitionId");

            migrationBuilder.CreateIndex(
                name: "IX_ObjectiveTestResults_PlayerId_MetricDefinitionId_TestedAt",
                table: "ObjectiveTestResults",
                columns: new[] { "PlayerId", "MetricDefinitionId", "TestedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_SelfAssessmentEntries_AssessmentId",
                table: "SelfAssessmentEntries",
                column: "AssessmentId");

            migrationBuilder.CreateIndex(
                name: "IX_SelfAssessmentEntries_MetricDefinitionId",
                table: "SelfAssessmentEntries",
                column: "MetricDefinitionId");

            migrationBuilder.CreateIndex(
                name: "IX_SelfAssessmentEntries_PlayerId_MetricDefinitionId_EvalDate",
                table: "SelfAssessmentEntries",
                columns: new[] { "PlayerId", "MetricDefinitionId", "EvalDate" });

            migrationBuilder.CreateIndex(
                name: "IX_SportMetricDefinitions_SportId",
                table: "SportMetricDefinitions",
                column: "SportId");

            migrationBuilder.CreateIndex(
                name: "IX_SportMetricDefinitions_SportStatCategoryId",
                table: "SportMetricDefinitions",
                column: "SportStatCategoryId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CoachEvaluations");

            migrationBuilder.DropTable(
                name: "EvidenceBasedScores");

            migrationBuilder.DropTable(
                name: "MatchStatEntries");

            migrationBuilder.DropTable(
                name: "ObjectiveTestResults");

            migrationBuilder.DropTable(
                name: "SelfAssessmentEntries");

            migrationBuilder.DropTable(
                name: "SportMetricDefinitions");
        }
    }
}
