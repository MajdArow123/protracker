namespace ProTracker.Services;

/// <summary>
/// Immutable comparison snapshot of a lineup, taken before/after a save.
/// TacticalSignature is a canonical string of the coach-entered detail layer
/// (notes/labels/roles/set-pieces) — compared, never parsed back.
/// </summary>
public record LineupSnapshot(
    string Formation,
    IReadOnlyDictionary<string, int> SlotPlayers,
    int? CaptainPlayerId,
    int? ViceCaptainPlayerId,
    string TacticalSignature);

/// <summary>
/// Pure, DB-free audit-summary builder (Phase 6, the TeamPerformanceMath
/// pattern). Every summary is derived from the REAL diff between two snapshots
/// — never a generic "updated lineup". An empty result means "no material
/// change"; the caller skips the audit row entirely.
/// </summary>
public static class LineupDiffSummarizer
{
    public const int MaxLength = 500;
    private const int MaxNames = 3;

    public static string BuildTacticalSignature(
        string? notes,
        IEnumerable<string>? labels,
        IEnumerable<KeyValuePair<string, string?>>? rolesBySlot,
        IEnumerable<KeyValuePair<string, int>>? setPiecesByType)
    {
        var labelPart = string.Join(',', (labels ?? Enumerable.Empty<string>())
            .Select(l => l.Trim()).Where(l => l.Length > 0).OrderBy(l => l, StringComparer.Ordinal));
        var rolePart = string.Join(',', (rolesBySlot ?? Enumerable.Empty<KeyValuePair<string, string?>>())
            .Where(r => !string.IsNullOrWhiteSpace(r.Value))
            .OrderBy(r => r.Key, StringComparer.Ordinal)
            .Select(r => $"{r.Key}={r.Value!.Trim()}"));
        var setPiecePart = string.Join(',', (setPiecesByType ?? Enumerable.Empty<KeyValuePair<string, int>>())
            .OrderBy(s => s.Key, StringComparer.Ordinal)
            .Select(s => $"{s.Key}={s.Value}"));
        return $"n:{notes?.Trim() ?? ""}|l:{labelPart}|r:{rolePart}|s:{setPiecePart}";
    }

    public static string SummarizeCreated(LineupSnapshot after)
    {
        var count = after.SlotPlayers.Count;
        return Truncate($"Created — {after.Formation}, {count} player{(count == 1 ? "" : "s")}");
    }

    /// <summary>Returns "" when nothing material changed (caller skips the audit row).</summary>
    public static string SummarizeSave(
        LineupSnapshot before,
        LineupSnapshot after,
        IReadOnlyDictionary<int, string> playerNames)
    {
        var parts = new List<string>();

        if (!string.Equals(before.Formation, after.Formation, StringComparison.Ordinal))
            parts.Add($"Formation {before.Formation} → {after.Formation}");

        var beforeIds = before.SlotPlayers.Values.ToHashSet();
        var afterIds = after.SlotPlayers.Values.ToHashSet();
        var came = afterIds.Except(beforeIds).ToList();
        var left = beforeIds.Except(afterIds).ToList();
        if (came.Count > 0) parts.Add($"In: {FormatNames(came, playerNames)}");
        if (left.Count > 0) parts.Add($"Out: {FormatNames(left, playerNames)}");

        if (came.Count == 0 && left.Count == 0)
        {
            // Same XI — count players whose slot changed (a real move, not churn
            // in slot keys only, which formation changes already report).
            var beforeByPlayer = before.SlotPlayers.ToDictionary(kv => kv.Value, kv => kv.Key);
            var moved = after.SlotPlayers.Count(kv =>
                beforeByPlayer.TryGetValue(kv.Value, out var oldSlot)
                && !string.Equals(oldSlot, kv.Key, StringComparison.Ordinal));
            if (moved > 0) parts.Add($"{moved} repositioned");
        }

        if (before.CaptainPlayerId != after.CaptainPlayerId)
            parts.Add(after.CaptainPlayerId is int c
                ? $"Captain: {NameOf(c, playerNames)}"
                : "Captain removed");
        if (before.ViceCaptainPlayerId != after.ViceCaptainPlayerId)
            parts.Add(after.ViceCaptainPlayerId is int v
                ? $"Vice-captain: {NameOf(v, playerNames)}"
                : "Vice-captain removed");

        if (!string.Equals(before.TacticalSignature, after.TacticalSignature, StringComparison.Ordinal))
            parts.Add("Tactical details updated");

        return parts.Count == 0 ? "" : Truncate(string.Join(" · ", parts));
    }

    private static string FormatNames(IReadOnlyCollection<int> ids, IReadOnlyDictionary<int, string> names)
    {
        var shown = ids.Take(MaxNames).Select(id => NameOf(id, names));
        var text = string.Join(", ", shown);
        return ids.Count > MaxNames ? $"{text} +{ids.Count - MaxNames} more" : text;
    }

    private static string NameOf(int id, IReadOnlyDictionary<int, string> names) =>
        names.TryGetValue(id, out var name) && !string.IsNullOrWhiteSpace(name) ? name : $"Player {id}";

    private static string Truncate(string value) =>
        value.Length <= MaxLength ? value : value[..(MaxLength - 1)] + "…";
}
