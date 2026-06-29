using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace ProTracker.Services;

public interface IAIService
{
    Task<string> GenerateTextAsync(string prompt);
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

    public async Task<string> GenerateTextAsync(string prompt)
    {
        var body = new
        {
            model = _model,
            max_tokens = _maxTokens,
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
        var match = Regex.Match(text.Trim(), @"```(?:json)?\s*([\s\S]*?)```");
        return match.Success ? match.Groups[1].Value.Trim() : text.Trim();
    }
}
