using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace ProTracker.Data.Migrations
{
    /// <inheritdoc />
    /// <remarks>
    /// Seasons move from team-owned to ACCOUNT-owned. Hand-ordered data migration
    /// (the scaffold wrongly renamed TeamId → Status, which would have carried team
    /// ids as status values): add the new shape first, backfill from the old columns
    /// while they still exist, then tighten OwnerId and drop TeamId/IsActive.
    /// All raw SQL uses double-quoted identifiers, valid on both Npgsql and the
    /// SQLite test provider.
    /// </remarks>
    public partial class SeasonAccountScoping : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // --- New shape, additive first (OwnerId starts nullable for the backfill) ---
            migrationBuilder.AddColumn<string>(
                name: "OwnerId",
                table: "Seasons",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Status",
                table: "Seasons",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "CurrentSeasonId",
                table: "AspNetUsers",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "SeasonTeams",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    SeasonId = table.Column<int>(type: "integer", nullable: false),
                    TeamId = table.Column<int>(type: "integer", nullable: false),
                    BenchmarkProfileId = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SeasonTeams", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SeasonTeams_BenchmarkProfiles_BenchmarkProfileId",
                        column: x => x.BenchmarkProfileId,
                        principalTable: "BenchmarkProfiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_SeasonTeams_Seasons_SeasonId",
                        column: x => x.SeasonId,
                        principalTable: "Seasons",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SeasonTeams_Teams_TeamId",
                        column: x => x.TeamId,
                        principalTable: "Teams",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SeasonRosters",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    PlayerId = table.Column<int>(type: "integer", nullable: false),
                    SeasonId = table.Column<int>(type: "integer", nullable: false),
                    TeamId = table.Column<int>(type: "integer", nullable: false),
                    JerseyNumber = table.Column<int>(type: "integer", nullable: true),
                    PositionId = table.Column<int>(type: "integer", nullable: true),
                    JoinedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LeftAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SeasonRosters", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SeasonRosters_Players_PlayerId",
                        column: x => x.PlayerId,
                        principalTable: "Players",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SeasonRosters_Positions_PositionId",
                        column: x => x.PositionId,
                        principalTable: "Positions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SeasonRosters_Seasons_SeasonId",
                        column: x => x.SeasonId,
                        principalTable: "Seasons",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SeasonRosters_Teams_TeamId",
                        column: x => x.TeamId,
                        principalTable: "Teams",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            // --- Data migration (old columns still present) ---
            // Seasons were team-owned; the owning account is that team's head coach.
            migrationBuilder.Sql(
                "UPDATE \"Seasons\" SET \"OwnerId\" = " +
                "(SELECT t.\"CoachId\" FROM \"Teams\" t WHERE t.\"Id\" = \"Seasons\".\"TeamId\")");

            // One participation row per existing season, carrying the team's current
            // benchmark profile as the season's starting profile.
            migrationBuilder.Sql(
                "INSERT INTO \"SeasonTeams\" (\"SeasonId\", \"TeamId\", \"BenchmarkProfileId\") " +
                "SELECT s.\"Id\", s.\"TeamId\", t.\"BenchmarkProfileId\" " +
                "FROM \"Seasons\" s JOIN \"Teams\" t ON t.\"Id\" = s.\"TeamId\"");

            // IsActive → Active(1); otherwise already-over seasons → Completed(2); else Draft(0).
            migrationBuilder.Sql(
                "UPDATE \"Seasons\" SET \"Status\" = " +
                "CASE WHEN \"IsActive\" THEN 1 " +
                "WHEN \"EndDate\" < CURRENT_TIMESTAMP THEN 2 " +
                "ELSE 0 END");

            // --- Tighten and drop the old shape ---
            migrationBuilder.AlterColumn<string>(
                name: "OwnerId",
                table: "Seasons",
                type: "text",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "text",
                oldNullable: true);

            migrationBuilder.DropForeignKey(
                name: "FK_Seasons_Teams_TeamId",
                table: "Seasons");

            migrationBuilder.DropIndex(
                name: "IX_Seasons_TeamId",
                table: "Seasons");

            migrationBuilder.DropColumn(
                name: "TeamId",
                table: "Seasons");

            migrationBuilder.DropColumn(
                name: "IsActive",
                table: "Seasons");

            migrationBuilder.CreateIndex(
                name: "IX_Seasons_OwnerId",
                table: "Seasons",
                column: "OwnerId");

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUsers_CurrentSeasonId",
                table: "AspNetUsers",
                column: "CurrentSeasonId");

            migrationBuilder.CreateIndex(
                name: "IX_SeasonRosters_PlayerId_SeasonId",
                table: "SeasonRosters",
                columns: new[] { "PlayerId", "SeasonId" });

            migrationBuilder.CreateIndex(
                name: "IX_SeasonRosters_PositionId",
                table: "SeasonRosters",
                column: "PositionId");

            migrationBuilder.CreateIndex(
                name: "IX_SeasonRosters_SeasonId_TeamId",
                table: "SeasonRosters",
                columns: new[] { "SeasonId", "TeamId" });

            migrationBuilder.CreateIndex(
                name: "IX_SeasonRosters_TeamId",
                table: "SeasonRosters",
                column: "TeamId");

            migrationBuilder.CreateIndex(
                name: "IX_SeasonTeams_BenchmarkProfileId",
                table: "SeasonTeams",
                column: "BenchmarkProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_SeasonTeams_SeasonId_TeamId",
                table: "SeasonTeams",
                columns: new[] { "SeasonId", "TeamId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SeasonTeams_TeamId",
                table: "SeasonTeams",
                column: "TeamId");

            migrationBuilder.AddForeignKey(
                name: "FK_AspNetUsers_Seasons_CurrentSeasonId",
                table: "AspNetUsers",
                column: "CurrentSeasonId",
                principalTable: "Seasons",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Seasons_AspNetUsers_OwnerId",
                table: "Seasons",
                column: "OwnerId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        /// <remarks>
        /// Best-effort restore of the single-team era: TeamId comes back as the lowest
        /// participating TeamId, IsActive from Status == Active. Seasons with no
        /// participation row cannot satisfy the old NOT NULL TeamId and are deleted
        /// (their assessment periods unlink via ON DELETE SET NULL).
        /// </remarks>
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AspNetUsers_Seasons_CurrentSeasonId",
                table: "AspNetUsers");

            migrationBuilder.DropForeignKey(
                name: "FK_Seasons_AspNetUsers_OwnerId",
                table: "Seasons");

            migrationBuilder.DropIndex(
                name: "IX_Seasons_OwnerId",
                table: "Seasons");

            migrationBuilder.DropIndex(
                name: "IX_AspNetUsers_CurrentSeasonId",
                table: "AspNetUsers");

            // --- Restore the old shape (TeamId nullable for the backfill) ---
            migrationBuilder.AddColumn<int>(
                name: "TeamId",
                table: "Seasons",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsActive",
                table: "Seasons",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.Sql(
                "UPDATE \"Seasons\" SET \"TeamId\" = " +
                "(SELECT MIN(st.\"TeamId\") FROM \"SeasonTeams\" st WHERE st.\"SeasonId\" = \"Seasons\".\"Id\")");

            migrationBuilder.Sql(
                "DELETE FROM \"Seasons\" WHERE \"TeamId\" IS NULL");

            migrationBuilder.Sql(
                "UPDATE \"Seasons\" SET \"IsActive\" = (\"Status\" = 1)");

            migrationBuilder.AlterColumn<int>(
                name: "TeamId",
                table: "Seasons",
                type: "integer",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

            migrationBuilder.DropTable(
                name: "SeasonRosters");

            migrationBuilder.DropTable(
                name: "SeasonTeams");

            migrationBuilder.DropColumn(
                name: "OwnerId",
                table: "Seasons");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "Seasons");

            migrationBuilder.DropColumn(
                name: "CurrentSeasonId",
                table: "AspNetUsers");

            migrationBuilder.CreateIndex(
                name: "IX_Seasons_TeamId",
                table: "Seasons",
                column: "TeamId");

            migrationBuilder.AddForeignKey(
                name: "FK_Seasons_Teams_TeamId",
                table: "Seasons",
                column: "TeamId",
                principalTable: "Teams",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
