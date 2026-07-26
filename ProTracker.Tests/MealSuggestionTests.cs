using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using ProTracker.Services;

namespace ProTracker.Tests;

// The public Vora meal-suggestion endpoint: anonymous access, bare (un-enveloped)
// response contract, validation 400s, AI-failure 500, and per-IP rate limiting.
// IAIService is stubbed so no test touches the Anthropic API.
public class MealSuggestionTests : IClassFixture<ProTrackerWebApplicationFactory>
{
    private readonly ProTrackerWebApplicationFactory _factory;

    public MealSuggestionTests(ProTrackerWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private sealed class StubAIService : IAIService
    {
        public Func<string> OnGenerate { get; set; } =
            () => "High-Protein Dinner\n200g chicken breast + 200g sweet potato + salad with olive oil";

        public Task<string> GenerateTextAsync(
            string prompt, int? maxTokensOverride = null, string? modelOverride = null,
            string? assistantPrefill = null, CancellationToken ct = default) =>
            Task.FromResult(OnGenerate());
    }

    // Fresh host per test: the stub is swapped in AND the rate-limiter window resets,
    // so tests can't starve each other's 10/hour budget.
    private HttpClient CreateClient(StubAIService stub) =>
        _factory.WithWebHostBuilder(builder =>
            builder.ConfigureTestServices(services => services.AddSingleton<IAIService>(stub)))
        .CreateClient();

    private static object ValidRequest(double calories = 800) => new
    {
        caloriesRemaining = calories,
        proteinRemaining = 60,
        carbsRemaining = 90,
        fatRemaining = 25,
        goalType = "fatLoss",
        timeOfDay = "evening",
    };

    [Fact]
    public async Task Post_Anonymous_ReturnsBareResponseShape()
    {
        var client = CreateClient(new StubAIService());

        var response = await client.PostAsJsonAsync("/api/v1/meal-suggestion", ValidRequest());

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var root = doc.RootElement;

        // Bare Vora contract — must NOT be wrapped in the {success, data} envelope.
        Assert.False(root.TryGetProperty("success", out _));
        Assert.False(root.TryGetProperty("data", out _));
        Assert.Equal("High-Protein Dinner", root.GetProperty("mealName").GetString());
        Assert.Equal("200g chicken breast + 200g sweet potato + salad with olive oil",
            root.GetProperty("detail").GetString());
        Assert.EndsWith("Z", root.GetProperty("generatedAt").GetString());
    }

    [Theory]
    [InlineData("caloriesRemaining", 0.0)]
    [InlineData("caloriesRemaining", -100.0)]
    [InlineData("proteinRemaining", -1.0)]
    [InlineData("carbsRemaining", -1.0)]
    [InlineData("fatRemaining", -1.0)]
    public async Task Post_InvalidMacro_Returns400(string field, double value)
    {
        var client = CreateClient(new StubAIService());
        var request = new Dictionary<string, object>
        {
            ["caloriesRemaining"] = 800, ["proteinRemaining"] = 60, ["carbsRemaining"] = 90,
            ["fatRemaining"] = 25, ["goalType"] = "fatLoss", ["timeOfDay"] = "evening",
            [field] = value,
        };

        var response = await client.PostAsJsonAsync("/api/v1/meal-suggestion", request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var error = await response.Content.ReadFromJsonAsync<TestApiError>();
        Assert.False(error!.Success);
        Assert.NotEmpty(error.Errors);
    }

    [Theory]
    [InlineData("goalType", "bulking", "fatLoss, maintain, muscleGain")]
    [InlineData("goalType", "", "fatLoss, maintain, muscleGain")]
    [InlineData("timeOfDay", "midnight", "morning, afternoon, evening, night")]
    public async Task Post_InvalidEnumString_Returns400WithAllowedValues(string field, string value, string expectedInMessage)
    {
        var client = CreateClient(new StubAIService());
        var request = new Dictionary<string, object>
        {
            ["caloriesRemaining"] = 800, ["proteinRemaining"] = 60, ["carbsRemaining"] = 90,
            ["fatRemaining"] = 25, ["goalType"] = "fatLoss", ["timeOfDay"] = "evening",
            [field] = value,
        };

        var response = await client.PostAsJsonAsync("/api/v1/meal-suggestion", request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var error = await response.Content.ReadFromJsonAsync<TestApiError>();
        Assert.Contains(error!.Errors, e => e.Contains(expectedInMessage));
    }

    [Fact]
    public async Task Post_GoalTypeIsCaseInsensitive()
    {
        var client = CreateClient(new StubAIService());
        var request = new Dictionary<string, object>
        {
            ["caloriesRemaining"] = 800, ["proteinRemaining"] = 60, ["carbsRemaining"] = 90,
            ["fatRemaining"] = 25, ["goalType"] = "FATLOSS", ["timeOfDay"] = "Evening",
        };

        var response = await client.PostAsJsonAsync("/api/v1/meal-suggestion", request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Post_AiFailure_Returns500()
    {
        var stub = new StubAIService
        {
            OnGenerate = () => throw new InvalidOperationException("AI service returned 529."),
        };
        var client = CreateClient(stub);

        var response = await client.PostAsJsonAsync("/api/v1/meal-suggestion", ValidRequest());

        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
    }

    [Fact]
    public async Task Post_MalformedAiReply_RetriesOnceThenSucceeds()
    {
        var calls = 0;
        var stub = new StubAIService
        {
            OnGenerate = () => ++calls == 1
                ? "just one line, no detail"
                : "Recovery Bowl\n150g salmon + quinoa + greens",
        };
        var client = CreateClient(stub);

        var response = await client.PostAsJsonAsync("/api/v1/meal-suggestion", ValidRequest());

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(2, calls);
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal("Recovery Bowl", doc.RootElement.GetProperty("mealName").GetString());
    }

    [Fact]
    public async Task Post_EleventhRequestInWindow_Returns429()
    {
        var client = CreateClient(new StubAIService());

        for (var i = 0; i < 10; i++)
        {
            var ok = await client.PostAsJsonAsync("/api/v1/meal-suggestion", ValidRequest());
            Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
        }

        var limited = await client.PostAsJsonAsync("/api/v1/meal-suggestion", ValidRequest());
        Assert.Equal(HttpStatusCode.TooManyRequests, limited.StatusCode);
    }

    // --- ParseMealText (pure) ---

    [Fact]
    public void ParseMealText_SplitsNameFromDetail()
    {
        var (name, detail) = MealSuggestionService.ParseMealText(
            "High-Protein Dinner\n200g chicken breast\n1 cup rice");

        Assert.Equal("High-Protein Dinner", name);
        Assert.Equal("200g chicken breast\n1 cup rice", detail);
    }

    [Fact]
    public void ParseMealText_IgnoresBlankLinesAndCarriageReturns()
    {
        var (name, detail) = MealSuggestionService.ParseMealText(
            "\r\n  Omelette Wrap \r\n\r\n3 eggs + tortilla\r\n");

        Assert.Equal("Omelette Wrap", name);
        Assert.Equal("3 eggs + tortilla", detail);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   \n  \n")]
    [InlineData("Only a meal name, no detail")]
    public void ParseMealText_ThrowsWhenDetailMissing(string raw)
    {
        Assert.Throws<FormatException>(() => MealSuggestionService.ParseMealText(raw));
    }
}
