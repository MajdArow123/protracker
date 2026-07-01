using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ProTracker.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddInjuryDetails : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "BodyPart",
                table: "InjuryRecords",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "RecoveredDate",
                table: "InjuryRecords",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TreatmentPlan",
                table: "InjuryRecords",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BodyPart",
                table: "InjuryRecords");

            migrationBuilder.DropColumn(
                name: "RecoveredDate",
                table: "InjuryRecords");

            migrationBuilder.DropColumn(
                name: "TreatmentPlan",
                table: "InjuryRecords");
        }
    }
}
