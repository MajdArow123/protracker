namespace ProTracker.Data.Showcase;

// Deterministic RNG for demo data: seeded from a stable string key (player/team
// name), so every re-run of the seeder regenerates byte-identical "variation".
// That is what makes the showcase seeder idempotent without any marker columns —
// natural keys never move because the randomness never moves.
public sealed class ShowcaseRng
{
    private uint _state;

    public ShowcaseRng(string key)
    {
        // FNV-1a hash of the key as the xorshift seed (never zero).
        uint hash = 2166136261;
        foreach (var c in key)
        {
            hash ^= c;
            hash *= 16777619;
        }
        _state = hash == 0 ? 1u : hash;
    }

    private uint NextUInt()
    {
        // xorshift32
        _state ^= _state << 13;
        _state ^= _state >> 17;
        _state ^= _state << 5;
        return _state;
    }

    /// <summary>Integer in [minInclusive, maxExclusive).</summary>
    public int Next(int minInclusive, int maxExclusive)
        => minInclusive + (int)(NextUInt() % (uint)(maxExclusive - minInclusive));

    /// <summary>Decimal in [min, max] rounded to the given number of places.</summary>
    public decimal NextDecimal(decimal min, decimal max, int decimals = 1)
    {
        var t = (NextUInt() % 10000) / 10000m;
        return Math.Round(min + (max - min) * t, decimals);
    }

    public bool Chance(double probability) => (NextUInt() % 10000) / 10000.0 < probability;

    public T Pick<T>(IReadOnlyList<T> items) => items[Next(0, items.Count)];
}
