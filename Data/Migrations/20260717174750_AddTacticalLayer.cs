using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace ProTracker.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddTacticalLayer : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<int>(
                name: "FitnessLevel",
                table: "Players",
                type: "integer",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AddColumn<int>(
                name: "PreferredFoot",
                table: "Players",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SecondaryPositionIds",
                table: "Players",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Instructions",
                table: "LineupSlots",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Role",
                table: "LineupSlots",
                type: "character varying(40)",
                maxLength: 40,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CaptainPlayerId",
                table: "Lineups",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Notes",
                table: "Lineups",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TacticalLabels",
                table: "Lineups",
                type: "character varying(400)",
                maxLength: 400,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ViceCaptainPlayerId",
                table: "Lineups",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "SetPieceAssignments",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    LineupId = table.Column<int>(type: "integer", nullable: false),
                    Type = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    PlayerId = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SetPieceAssignments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SetPieceAssignments_Lineups_LineupId",
                        column: x => x.LineupId,
                        principalTable: "Lineups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SetPieceAssignments_Players_PlayerId",
                        column: x => x.PlayerId,
                        principalTable: "Players",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Lineups_CaptainPlayerId",
                table: "Lineups",
                column: "CaptainPlayerId");

            migrationBuilder.CreateIndex(
                name: "IX_Lineups_ViceCaptainPlayerId",
                table: "Lineups",
                column: "ViceCaptainPlayerId");

            migrationBuilder.CreateIndex(
                name: "IX_SetPieceAssignments_LineupId",
                table: "SetPieceAssignments",
                column: "LineupId");

            migrationBuilder.CreateIndex(
                name: "IX_SetPieceAssignments_PlayerId",
                table: "SetPieceAssignments",
                column: "PlayerId");

            migrationBuilder.AddForeignKey(
                name: "FK_Lineups_Players_CaptainPlayerId",
                table: "Lineups",
                column: "CaptainPlayerId",
                principalTable: "Players",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Lineups_Players_ViceCaptainPlayerId",
                table: "Lineups",
                column: "ViceCaptainPlayerId",
                principalTable: "Players",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Lineups_Players_CaptainPlayerId",
                table: "Lineups");

            migrationBuilder.DropForeignKey(
                name: "FK_Lineups_Players_ViceCaptainPlayerId",
                table: "Lineups");

            migrationBuilder.DropTable(
                name: "SetPieceAssignments");

            migrationBuilder.DropIndex(
                name: "IX_Lineups_CaptainPlayerId",
                table: "Lineups");

            migrationBuilder.DropIndex(
                name: "IX_Lineups_ViceCaptainPlayerId",
                table: "Lineups");

            migrationBuilder.DropColumn(
                name: "PreferredFoot",
                table: "Players");

            migrationBuilder.DropColumn(
                name: "SecondaryPositionIds",
                table: "Players");

            migrationBuilder.DropColumn(
                name: "Instructions",
                table: "LineupSlots");

            migrationBuilder.DropColumn(
                name: "Role",
                table: "LineupSlots");

            migrationBuilder.DropColumn(
                name: "CaptainPlayerId",
                table: "Lineups");

            migrationBuilder.DropColumn(
                name: "Notes",
                table: "Lineups");

            migrationBuilder.DropColumn(
                name: "TacticalLabels",
                table: "Lineups");

            migrationBuilder.DropColumn(
                name: "ViceCaptainPlayerId",
                table: "Lineups");

            // Hand-added: restoring NOT NULL fails on both providers if any row is
            // NULL (Postgres SET NOT NULL errors; the SQLite table rebuild can't
            // copy NULL into a NOT NULL column). Backfill with 5 — the historical
            // registration default. Quoted identifiers are valid on both providers.
            migrationBuilder.Sql("UPDATE \"Players\" SET \"FitnessLevel\" = 5 WHERE \"FitnessLevel\" IS NULL");

            migrationBuilder.AlterColumn<int>(
                name: "FitnessLevel",
                table: "Players",
                type: "integer",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);
        }
    }
}
