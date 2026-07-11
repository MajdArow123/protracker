using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ProTracker.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddTestProtocols : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CommonMistakes",
                table: "SportMetricDefinitions",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TestProcedure",
                table: "SportMetricDefinitions",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TestSetup",
                table: "SportMetricDefinitions",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "VideoUrl",
                table: "SportMetricDefinitions",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CommonMistakes",
                table: "SportMetricDefinitions");

            migrationBuilder.DropColumn(
                name: "TestProcedure",
                table: "SportMetricDefinitions");

            migrationBuilder.DropColumn(
                name: "TestSetup",
                table: "SportMetricDefinitions");

            migrationBuilder.DropColumn(
                name: "VideoUrl",
                table: "SportMetricDefinitions");
        }
    }
}
