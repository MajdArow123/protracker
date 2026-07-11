using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace ProTracker.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddBenchmarkProfiles : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "BenchmarkProfileId",
                table: "Teams",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "BenchmarkProfiles",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CoachId = table.Column<string>(type: "text", nullable: true),
                    SportId = table.Column<int>(type: "integer", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    AgeGroupMin = table.Column<int>(type: "integer", nullable: true),
                    AgeGroupMax = table.Column<int>(type: "integer", nullable: true),
                    CompetitionLevel = table.Column<int>(type: "integer", nullable: false),
                    IsDefault = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BenchmarkProfiles", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BenchmarkProfiles_Sports_SportId",
                        column: x => x.SportId,
                        principalTable: "Sports",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "BenchmarkValues",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    BenchmarkProfileId = table.Column<int>(type: "integer", nullable: false),
                    MetricDefinitionId = table.Column<int>(type: "integer", nullable: false),
                    BenchmarkLow = table.Column<decimal>(type: "numeric(9,2)", nullable: false),
                    BenchmarkMid = table.Column<decimal>(type: "numeric(9,2)", nullable: false),
                    BenchmarkHigh = table.Column<decimal>(type: "numeric(9,2)", nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BenchmarkValues", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BenchmarkValues_BenchmarkProfiles_BenchmarkProfileId",
                        column: x => x.BenchmarkProfileId,
                        principalTable: "BenchmarkProfiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_BenchmarkValues_SportMetricDefinitions_MetricDefinitionId",
                        column: x => x.MetricDefinitionId,
                        principalTable: "SportMetricDefinitions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Teams_BenchmarkProfileId",
                table: "Teams",
                column: "BenchmarkProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_BenchmarkProfiles_SportId_CoachId",
                table: "BenchmarkProfiles",
                columns: new[] { "SportId", "CoachId" });

            migrationBuilder.CreateIndex(
                name: "IX_BenchmarkValues_BenchmarkProfileId_MetricDefinitionId",
                table: "BenchmarkValues",
                columns: new[] { "BenchmarkProfileId", "MetricDefinitionId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_BenchmarkValues_MetricDefinitionId",
                table: "BenchmarkValues",
                column: "MetricDefinitionId");

            migrationBuilder.AddForeignKey(
                name: "FK_Teams_BenchmarkProfiles_BenchmarkProfileId",
                table: "Teams",
                column: "BenchmarkProfileId",
                principalTable: "BenchmarkProfiles",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Teams_BenchmarkProfiles_BenchmarkProfileId",
                table: "Teams");

            migrationBuilder.DropTable(
                name: "BenchmarkValues");

            migrationBuilder.DropTable(
                name: "BenchmarkProfiles");

            migrationBuilder.DropIndex(
                name: "IX_Teams_BenchmarkProfileId",
                table: "Teams");

            migrationBuilder.DropColumn(
                name: "BenchmarkProfileId",
                table: "Teams");
        }
    }
}
