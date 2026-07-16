using System.Net.Http.Json;

namespace ProTracker.Tests;

public static class TestAuth
{
    public static async Task<HttpClient> LoginAsync(ProTrackerWebApplicationFactory factory, string email, string password)
    {
        var client = factory.CreateClient();
        var response = await client.PostAsJsonAsync("/api/auth/login", new { email, password });
        response.EnsureSuccessStatusCode();
        return client;
    }

    // Well-known seed accounts created by Data/DemoDataSeeder.cs (see Phase 2/3 seed data).
    public const string SoccerCoachEmail = "coach.soccer@protracker.seed";
    public const string BasketballCoachEmail = "coach.basketball@protracker.seed";
    public const string LucasWardAthleteEmail = "lucas.ward@protracker.seed"; // player id 5
    public const string MarcusBellAthleteEmail = "marcus.bell@protracker.seed"; // player id 9
    public const string SeedPassword = "SeedCoach123!";

    // Deterministic IDs given the seeding order in DemoDataSeeder against a fresh database.
    public const int SoccerTeamId = 1;
    public const int BasketballTeamId = 2;
    public const int LucasWardPlayerId = 5;
    // First basketball player — ids 1-8 are the soccer roster (was wrongly 7 = Jack Turner).
    public const int MarcusBellPlayerId = 9;
    public const int NoahBennettPlayerId = 2;
    public const int LiamCarterPlayerId = 1;
    public const int FirstSoccerAssessmentPeriodId = 1;
}
