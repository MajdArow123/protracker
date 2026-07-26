using System.Text;
using System.Text.Json;

namespace ProTracker.Services;

public interface IAIService
{
    Task<string> GenerateTextAsync(string prompt, int? maxTokensOverride = null, string? modelOverride = null, string? assistantPrefill = null, CancellationToken ct = default);
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

    public async Task<string> GenerateTextAsync(
        string prompt,
        int? maxTokensOverride = null,
        string? modelOverride = null,
        string? assistantPrefill = null,
        CancellationToken ct = default)
    {
        // Build the messages array; optionally seed the assistant turn so the
        // model continues from that exact text (great for guaranteed JSON output).
        object[] messages = assistantPrefill is not null
            ? new object[]
              {
                  new { role = "user",      content = prompt },
                  new { role = "assistant", content = assistantPrefill },
              }
            : new object[]
              {
                  new { role = "user", content = prompt },
              };

        var body = new
        {
            model      = modelOverride ?? _model,
            max_tokens = maxTokensOverride ?? _maxTokens,
            messages,
        };

        var json    = JsonSerializer.Serialize(body);
        var content = new StringContent(json, Encoding.UTF8, "application/json");

        var response = await _httpClient.PostAsync("v1/messages", content, ct);

        if (!response.IsSuccessStatusCode)
        {
            var err = await response.Content.ReadAsStringAsync(ct);
            _logger.LogError("Anthropic API error {Status}: {Body}", response.StatusCode, err);
            throw new InvalidOperationException($"AI service returned {response.StatusCode}.");
        }

        var raw = await response.Content.ReadAsStringAsync(ct);
        using var doc = JsonDocument.Parse(raw);
        var text = doc.RootElement
            .GetProperty("content")[0]
            .GetProperty("text")
            .GetString() ?? "";

        // When a prefill was used the model's output is the continuation;
        // restore the full string by prepending the prefill.
        var full = assistantPrefill is not null ? assistantPrefill + text : text;

        return StripMarkdownCodeBlock(full);
    }

    private static string StripMarkdownCodeBlock(string text)
    {
        var s = text.Trim();
        if (!s.StartsWith("```")) return s;
        var nl = s.IndexOf('\n');
        if (nl >= 0) s = s[(nl + 1)..];
        var lastFence = s.LastIndexOf("```");
        if (lastFence >= 0) s = s[..lastFence];
        return s.Trim();
    }
}
