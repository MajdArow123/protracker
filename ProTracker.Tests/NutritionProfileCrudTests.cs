using System.Net;
using System.Net.Http.Json;

namespace ProTracker.Tests;

// "Nutrition profile CRUD."
public class NutritionProfileCrudTests : IClassFixture<ProTrackerWebApplicationFactory>
{
    private readonly ProTrackerWebApplicationFactory _factory;

    public NutritionProfileCrudTests(ProTrackerWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task FullCrudCycle_CreateReadUpdateDelete_Succeeds()
    {
        var client = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);
        var playerId = TestAuth.NoahBennettPlayerId; // no nutrition profile items seeded for this player

        // Create — SoftPreference must pair with Severity.Soft per the severity-matching rule.
        var createResponse = await client.PostAsJsonAsync($"/api/nutrition-profile/player/{playerId}", new
        {
            preferenceType = "SoftPreference",
            category = "Custom",
            specificItem = "mushrooms",
            severity = "Soft",
            notes = "Dislikes the texture."
        });
        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        var created = await createResponse.Content.ReadFromJsonAsync<TestApiResponse<ProfileItemShape>>();
        var itemId = created!.Data!.Id;

        // Read
        var getResponse = await client.GetAsync($"/api/nutrition-profile/player/{playerId}");
        getResponse.EnsureSuccessStatusCode();
        var list = await getResponse.Content.ReadFromJsonAsync<TestApiResponse<List<ProfileItemShape>>>();
        Assert.Contains(list!.Data!, i => i.Id == itemId && i.SpecificItem == "mushrooms");

        // Update
        var updateResponse = await client.PutAsJsonAsync($"/api/nutrition-profile/player/{playerId}/{itemId}", new
        {
            preferenceType = "SoftPreference",
            category = "Custom",
            specificItem = "mushrooms",
            severity = "Soft",
            notes = "Coach override: fine in small amounts."
        });
        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        var updated = await updateResponse.Content.ReadFromJsonAsync<TestApiResponse<ProfileItemShape>>();
        Assert.Equal("Coach override: fine in small amounts.", updated!.Data!.Notes);

        // Delete
        var deleteResponse = await client.DeleteAsync($"/api/nutrition-profile/player/{playerId}/{itemId}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var finalListResponse = await client.GetAsync($"/api/nutrition-profile/player/{playerId}");
        var finalList = await finalListResponse.Content.ReadFromJsonAsync<TestApiResponse<List<ProfileItemShape>>>();
        Assert.DoesNotContain(finalList!.Data!, i => i.Id == itemId);
    }

    [Fact]
    public async Task Create_WithMismatchedSeverity_ReturnsBadRequest()
    {
        var client = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);

        // Allergy must pair with Severity.Hard — Soft is a rule violation.
        var response = await client.PostAsJsonAsync($"/api/nutrition-profile/player/{TestAuth.NoahBennettPlayerId}", new
        {
            preferenceType = "Allergy",
            category = "NutAllergy",
            specificItem = "peanuts",
            severity = "Soft",
            notes = (string?)null
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    private class ProfileItemShape
    {
        public int Id { get; set; }
        public string? SpecificItem { get; set; }
        public string? Notes { get; set; }
    }
}
