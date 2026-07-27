using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using ProTracker.Services;

namespace ProTracker.Tests;

// The public Vora meal-suggestion endpoint (v2, structured JSON): anonymous access,
// bare (un-enveloped) response contract, validation 400s, retry/500 behavior, and
// per-IP rate limiting. IAIService is stubbed so no test touches the Anthropic API.
public class MealSuggestionTests : IClassFixture<ProTrackerWebApplicationFactory>
{
    private const string ValidMealJson =
        """
        {"mealName":"Grilled Chicken & Rice Bowl","mealType":"dinner",
         "description":"A balanced high-protein dinner to close your macros.",
         "foods":[{"name":"chicken breast","grams":200,"unit":"g"},
                  {"name":"white rice","grams":150,"unit":"g"},
                  {"name":"broccoli","grams":200,"unit":"g"}],
         "cookingTip":"Season with lemon and herbs."}
        """;

    private readonly ProTrackerWebApplicationFactory _factory;

    public MealSuggestionTests(ProTrackerWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private sealed class StubAIService : IAIService
    {
        public Func<string> OnGenerate { get; set; } = () => ValidMealJson;

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

    private static Dictionary<string, object?> ValidRequest() => new()
    {
        ["caloriesRemaining"] = 800,
        ["proteinRemaining"] = 60,
        ["carbsRemaining"] = 90,
        ["fatRemaining"] = 25,
        ["goalType"] = "fatLoss",
        ["timeOfDay"] = "evening",
        ["mealType"] = "dinner",
        ["userPreference"] = "something with chicken",
    };

    [Fact]
    public async Task Post_Anonymous_ReturnsBareStructuredResponse()
    {
        var client = CreateClient(new StubAIService());

        var response = await client.PostAsJsonAsync("/api/v1/meal-suggestion", ValidRequest());

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var root = doc.RootElement;

        // Bare Vora contract — must NOT be wrapped in the {success, data} envelope.
        Assert.False(root.TryGetProperty("success", out _));
        Assert.False(root.TryGetProperty("data", out _));
        Assert.Equal("Grilled Chicken & Rice Bowl", root.GetProperty("mealName").GetString());
        Assert.Equal("dinner", root.GetProperty("mealType").GetString());
        Assert.Equal("A balanced high-protein dinner to close your macros.",
            root.GetProperty("description").GetString());
        Assert.Equal("Season with lemon and herbs.", root.GetProperty("cookingTip").GetString());
        Assert.EndsWith("Z", root.GetProperty("generatedAt").GetString());

        var foods = root.GetProperty("foods").EnumerateArray().ToList();
        Assert.Equal(3, foods.Count);
        Assert.Equal("chicken breast", foods[0].GetProperty("name").GetString());
        Assert.Equal(200, foods[0].GetProperty("grams").GetDouble());
        Assert.Equal("g", foods[0].GetProperty("unit").GetString());
    }

    [Fact]
    public async Task Post_RequestedMealTypeOverridesModelReply()
    {
        // Stub always says "dinner"; the request asks for a snack — the request wins.
        var client = CreateClient(new StubAIService());
        var request = ValidRequest();
        request["mealType"] = "snack";

        var response = await client.PostAsJsonAsync("/api/v1/meal-suggestion", request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal("snack", doc.RootElement.GetProperty("mealType").GetString());
    }

    [Fact]
    public async Task Post_WithoutOptionalFields_Succeeds()
    {
        var client = CreateClient(new StubAIService());
        var request = ValidRequest();
        request.Remove("mealType");
        request.Remove("userPreference");

        var response = await client.PostAsJsonAsync("/api/v1/meal-suggestion", request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        // No requested type -> the model's own value is kept.
        Assert.Equal("dinner", doc.RootElement.GetProperty("mealType").GetString());
    }

    [Fact]
    public async Task Post_NoMealTypeAnywhere_FallsBackToMeal()
    {
        var stub = new StubAIService
        {
            OnGenerate = () =>
                """{"mealName":"Bowl","foods":[{"name":"oats","grams":80},{"name":"milk","grams":250}]}""",
        };
        var client = CreateClient(stub);
        var request = ValidRequest();
        request.Remove("mealType");

        var response = await client.PostAsJsonAsync("/api/v1/meal-suggestion", request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal("meal", doc.RootElement.GetProperty("mealType").GetString());
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
        var request = ValidRequest();
        request[field] = value;

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
    [InlineData("mealType", "brunch", "breakfast, lunch, dinner, snack, postWorkout")]
    public async Task Post_InvalidEnumString_Returns400WithAllowedValues(string field, string value, string expectedInMessage)
    {
        var client = CreateClient(new StubAIService());
        var request = ValidRequest();
        request[field] = value;

        var response = await client.PostAsJsonAsync("/api/v1/meal-suggestion", request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var error = await response.Content.ReadFromJsonAsync<TestApiError>();
        Assert.Contains(error!.Errors, e => e.Contains(expectedInMessage));
    }

    [Fact]
    public async Task Post_UserPreferenceOver100Chars_Returns400()
    {
        var client = CreateClient(new StubAIService());
        var request = ValidRequest();
        request["userPreference"] = new string('x', 101);

        var response = await client.PostAsJsonAsync("/api/v1/meal-suggestion", request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var error = await response.Content.ReadFromJsonAsync<TestApiError>();
        Assert.Contains(error!.Errors, e => e.Contains("100 characters"));
    }

    [Fact]
    public async Task Post_EnumStringsAreCaseInsensitive()
    {
        var client = CreateClient(new StubAIService());
        var request = ValidRequest();
        request["goalType"] = "FATLOSS";
        request["timeOfDay"] = "Evening";
        request["mealType"] = "POSTWORKOUT";

        var response = await client.PostAsJsonAsync("/api/v1/meal-suggestion", request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Post_MalformedAiReply_RetriesOnceThenSucceeds()
    {
        var calls = 0;
        var stub = new StubAIService
        {
            OnGenerate = () => ++calls == 1 ? "this is not JSON" : ValidMealJson,
        };
        var client = CreateClient(stub);

        var response = await client.PostAsJsonAsync("/api/v1/meal-suggestion", ValidRequest());

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(2, calls);
    }

    [Fact]
    public async Task Post_TwoMalformedReplies_Returns500WithContractMessage()
    {
        var stub = new StubAIService { OnGenerate = () => "still not JSON" };
        var client = CreateClient(stub);

        var response = await client.PostAsJsonAsync("/api/v1/meal-suggestion", ValidRequest());

        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        var error = await response.Content.ReadFromJsonAsync<TestApiError>();
        Assert.Equal("Could not generate a valid suggestion. Try again.", error!.Message);
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

    // --- ParseMealJson (pure) ---

    [Fact]
    public void ParseMealJson_ParsesFullReply()
    {
        var meal = MealSuggestionService.ParseMealJson(ValidMealJson);

        Assert.Equal("Grilled Chicken & Rice Bowl", meal.MealName);
        Assert.Equal("dinner", meal.MealType);
        Assert.Equal(3, meal.Foods.Count);
        Assert.Equal("white rice", meal.Foods[1].Name);
        Assert.Equal(150, meal.Foods[1].Grams);
    }

    [Fact]
    public void ParseMealJson_PropertyNamesAreCaseInsensitive()
    {
        var meal = MealSuggestionService.ParseMealJson(
            """{"MEALNAME":"Toast","FOODS":[{"NAME":"bread","GRAMS":60},{"NAME":"eggs","GRAMS":100}]}""");

        Assert.Equal("Toast", meal.MealName);
        Assert.Equal(2, meal.Foods.Count);
    }

    [Fact]
    public void ParseMealJson_DefaultsCosmeticFields()
    {
        var meal = MealSuggestionService.ParseMealJson(
            """{"mealName":"Bowl","foods":[{"name":"oats","grams":80},{"name":"milk","grams":250}]}""");

        Assert.Equal("", meal.Description);
        Assert.Equal("", meal.CookingTip);
        Assert.Equal("", meal.MealType);
        Assert.All(meal.Foods, f => Assert.Equal("g", f.Unit));
    }

    [Theory]
    [InlineData("not json at all")]
    [InlineData("{}")]
    [InlineData("""{"mealName":"","foods":[{"name":"a","grams":1},{"name":"b","grams":1}]}""")]
    [InlineData("""{"mealName":"One food only","foods":[{"name":"rice","grams":100}]}""")]
    [InlineData("""{"mealName":"Six foods","foods":[{"name":"a","grams":1},{"name":"b","grams":1},{"name":"c","grams":1},{"name":"d","grams":1},{"name":"e","grams":1},{"name":"f","grams":1}]}""")]
    [InlineData("""{"mealName":"Zero grams","foods":[{"name":"rice","grams":0},{"name":"beans","grams":100}]}""")]
    [InlineData("""{"mealName":"Missing grams","foods":[{"name":"rice"},{"name":"beans","grams":100}]}""")]
    [InlineData("""{"mealName":"Nameless food","foods":[{"name":"","grams":50},{"name":"beans","grams":100}]}""")]
    public void ParseMealJson_ThrowsOnStructuralViolations(string raw)
    {
        Assert.Throws<FormatException>(() => MealSuggestionService.ParseMealJson(raw));
    }
}
