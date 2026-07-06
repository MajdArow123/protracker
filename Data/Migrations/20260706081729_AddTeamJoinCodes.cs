using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace ProTracker.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddTeamJoinCodes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "DateOfBirth",
                table: "Players",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "JerseyNumber",
                table: "Players",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "JoinedViaCodeAt",
                table: "Players",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EmergencyContactName",
                table: "AspNetUsers",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EmergencyContactPhone",
                table: "AspNetUsers",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EmergencyContactRelationship",
                table: "AspNetUsers",
                type: "text",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "AthleteInvites",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    TeamId = table.Column<int>(type: "integer", nullable: false),
                    Email = table.Column<string>(type: "text", nullable: false),
                    InvitedByCoachId = table.Column<string>(type: "text", nullable: false),
                    JoinCode = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    AcceptedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AthleteInvites", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AthleteInvites_Teams_TeamId",
                        column: x => x.TeamId,
                        principalTable: "Teams",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TeamJoinCodes",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    TeamId = table.Column<int>(type: "integer", nullable: false),
                    CoachId = table.Column<string>(type: "text", nullable: false),
                    Code = table.Column<string>(type: "text", nullable: false),
                    QRCodeData = table.Column<string>(type: "text", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    MaxUses = table.Column<int>(type: "integer", nullable: true),
                    UseCount = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TeamJoinCodes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TeamJoinCodes_Teams_TeamId",
                        column: x => x.TeamId,
                        principalTable: "Teams",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AthleteInvites_TeamId",
                table: "AthleteInvites",
                column: "TeamId");

            migrationBuilder.CreateIndex(
                name: "IX_TeamJoinCodes_Code",
                table: "TeamJoinCodes",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TeamJoinCodes_TeamId_IsActive",
                table: "TeamJoinCodes",
                columns: new[] { "TeamId", "IsActive" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AthleteInvites");

            migrationBuilder.DropTable(
                name: "TeamJoinCodes");

            migrationBuilder.DropColumn(
                name: "DateOfBirth",
                table: "Players");

            migrationBuilder.DropColumn(
                name: "JerseyNumber",
                table: "Players");

            migrationBuilder.DropColumn(
                name: "JoinedViaCodeAt",
                table: "Players");

            migrationBuilder.DropColumn(
                name: "EmergencyContactName",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "EmergencyContactPhone",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "EmergencyContactRelationship",
                table: "AspNetUsers");
        }
    }
}
