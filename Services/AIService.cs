using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace ProTracker.Services;

public interface IAIService
{
    Task<string> GenerateTextAsync(string prompt, int? maxTokensOverride = null, string? modelOverride = null);
}

public class AIService : IAIService
{
    private readonly HttpClient _httpClient;
    private readonly string _model;
    private readonly int _maxTokens;
    private readonly ILogger<AIService> _logger;

    public AIService(HttpClient httpClient, IConfiguration config, ILogger<AIService> logger)
    {
        _httpClient = httpClient;
        _model = config["Anthropic:Model"] ?? "claude-sonnet-4-6";
        _maxTokens = int.TryParse(config["Anthropic:MaxTokens"], out var mt) ? mt : 2000;
        _logger = logger;
    }

    public async Task<string> GenerateTextAsync(string prompt, int? maxTokensOverride = null, string? modelOverride = null)
    {
        var body = new
        {
            model = modelOverride ?? _model,
            max_tokens = maxTokensOverride ?? _maxTokens,
            messages = new[] { new { role = "user", content = prompt } }
        };

        var json = JsonSerializer.Serialize(body);
        var content = new StringContent(json, Encoding.UTF8, "application/json");

        var response = await _httpClient.PostAsync("v1/messages", content);

        if (!response.IsSuccessStatusCode)
        {
            var err = await response.Content.ReadAsStringAsync();
            _logger.LogError("Anthropic API error {Status}: {Body}", response.StatusCode, err);
            throw new InvalidOperationException($"AI service returned {response.StatusCode}.");
        }

        var raw = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(raw);
        var text = doc.RootElement
            .GetProperty("content")[0]
            .GetProperty("text")
            .GetString() ?? "";

        return StripMarkdownCodeBlock(text);
    }

    // Claude sometimes wraps the JSON in ```json ... ``` fences
    private static string StripMarkdownCodeBlock(string text)
    {
        var s = text.Trim();
        if (!s.StartsWith("```")) return s;
        // Remove opening fence line
        var nl = s.IndexOf('\n');
        if (nl >= 0) s = s[(nl + 1)..];
        // Remove closing fence if present (may be absent if response was truncated)
        var lastFence = s.LastIndexOf("```");
        if (lastFence >= 0) s = s[..lastFence];
        return s.Trim();
    }
}
