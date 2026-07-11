using Microsoft.EntityFrameworkCore;
using ProTracker.Models;
using Cat = ProTracker.Models.MetricCategory;
using In = ProTracker.Models.MetricInputType;

namespace ProTracker.Data;

// Seeds the evidence-based metric definitions (reference data). Runs at startup; only
// inserts when the table is empty, so benchmark tweaks in code require a manual reseed
// but redeploys never duplicate rows.
// Sport ids: 1=Soccer, 2=Basketball, 3=Volleyball, 4=Beach Volleyball, 5=Tennis.
// SportStatCategoryId links a metric to the existing slider stat category it corresponds
// to (fixed HasData ids 1-40 in ApplicationDbContext) so slider assessments feed evidence.
public static class MetricDefinitionSeeder
{
    public static async Task SeedAsync(ApplicationDbContext context)
    {
        if (await context.SportMetricDefinitions.AnyAsync())
        {
            await BackfillProtocolsAsync(context);
            return;
        }

        var definitions = BuildDefinitions();
        foreach (var def in definitions)
            ApplyProtocol(def);
        context.SportMetricDefinitions.AddRange(definitions);
        await context.SaveChangesAsync();
    }

    // Existing databases seeded before the protocol guides shipped get them filled in
    // (only where TestSetup is still null, so coach edits are never overwritten).
    private static async Task BackfillProtocolsAsync(ApplicationDbContext context)
    {
        var missing = await context.SportMetricDefinitions
            .Where(m => m.TestSetup == null && m.InputType != MetricInputType.Rating)
            .ToListAsync();
        if (missing.Count == 0) return;

        var changed = false;
        foreach (var def in missing)
            changed |= ApplyProtocol(def);
        if (changed) await context.SaveChangesAsync();
    }

    private static bool ApplyProtocol(SportMetricDefinition def)
    {
        var protocol = TestProtocols.For(def.SportId, def.Name);
        if (protocol == null) return false;
        def.TestSetup = protocol.Setup;
        def.TestProcedure = protocol.Procedure;
        def.CommonMistakes = protocol.Mistakes;
        return true;
    }

    // Weights default to the spec's 0.4/0.3/0.2/0.1 (objective/match/coach/self); metrics
    // with no possible objective test or match stat shift weight onto coach + self instead.
    private static SportMetricDefinition M(int sportId, string name, Cat cat, In input, string? unit,
        decimal low, decimal mid, decimal high, string description, string? notes,
        int? statCategoryId = null, bool objectiveRequired = false,
        decimal wObj = 0.4m, decimal wMatch = 0.3m, decimal wCoach = 0.2m, decimal wSelf = 0.1m) => new()
    {
        SportId = sportId,
        Name = name,
        ShortName = name.Length <= 12 ? name : null,
        Category = cat,
        InputType = input,
        Unit = unit,
        BenchmarkLow = low,
        BenchmarkMid = mid,
        BenchmarkHigh = high,
        Description = description,
        Notes = notes,
        SportStatCategoryId = statCategoryId,
        IsObjectiveRequired = objectiveRequired,
        ObjectiveTestWeight = wObj,
        MatchStatWeight = wMatch,
        CoachEvalWeight = wCoach,
        SelfAssessWeight = wSelf,
    };

    // A metric with no objective test: rated by coach + athlete only.
    private static SportMetricDefinition Rated(int sportId, string name, Cat cat, string description,
        int? statCategoryId = null, decimal wCoach = 0.6m, decimal wSelf = 0.4m, decimal wMatch = 0m) =>
        M(sportId, name, cat, In.Rating, null, 3, 5, 10, description,
            "Rated 1-10 from observation.", statCategoryId, objectiveRequired: false,
            wObj: 0m, wMatch: wMatch, wCoach: wCoach, wSelf: wSelf);

    private static List<SportMetricDefinition> BuildDefinitions() => new()
    {
        // ─── SOCCER (sport 1, stat categories 1-8) ───────────────────────────
        M(1, "Speed", Cat.Physical, In.Timer, "seconds", 4.8m, 4.3m, 3.8m,
            "Straight-line sprint speed over 30 meters.",
            "30m sprint from a standing start, timed with a stopwatch or gates. Elite: <3.9s, average: ~4.3s.",
            statCategoryId: 1, objectiveRequired: true),
        M(1, "Stamina", Cat.Physical, In.Distance, "meters", 2000, 2600, 3200,
            "Aerobic endurance across a full match.",
            "Cooper test: total distance covered in 12 minutes. Elite: >3000m. In matches: distance covered (km).",
            statCategoryId: 2),
        M(1, "Passing", Cat.Technical, In.Percentage, "%", 50, 70, 92,
            "Short and long passing accuracy and quality.",
            "Passing drill: % of passes on target from 20 attempts (vary distances).",
            statCategoryId: 3),
        M(1, "Shooting", Cat.Technical, In.Percentage, "%", 30, 55, 85,
            "Shot accuracy, power and technique.",
            "Shooting drill: % of shots on target from 10 attempts at match distance.",
            statCategoryId: 4),
        M(1, "Dribbling", Cat.Technical, In.Percentage, "%", 40, 60, 85,
            "Beating opponents while keeping control at speed.",
            "1v1 drill: % of successful take-ons from 10 attempts.",
            statCategoryId: null),
        M(1, "Defending", Cat.Technical, In.Percentage, "%", 30, 55, 80,
            "Tackling, intercepting and defensive duels.",
            "Duel drill: % of defensive duels won from 10. In matches: tackles + interceptions.",
            statCategoryId: 5),
        Rated(1, "Positioning", Cat.Tactical,
            "Being in the right place in and out of possession.", statCategoryId: null),
        M(1, "Ball Control", Cat.Technical, In.Count, "touches", 10, 40, 120,
            "First touch and close control.",
            "Juggling test: consecutive touches without the ball dropping.",
            statCategoryId: 6),
        M(1, "Agility", Cat.Physical, In.Timer, "seconds", 5.4m, 4.8m, 4.2m,
            "Change of direction at speed.",
            "5-10-5 shuttle (pro-agility) time. Elite: <4.3s.",
            statCategoryId: 7, objectiveRequired: true),
        Rated(1, "Weak Foot", Cat.Technical,
            "Quality of passing, control and shooting with the weaker foot.",
            statCategoryId: null, wCoach: 0.7m, wSelf: 0.3m),
        Rated(1, "Tactical Awareness", Cat.Mental,
            "Reading the game: decision making, scanning, anticipation.",
            statCategoryId: 8, wCoach: 0.55m, wSelf: 0.45m),

        // ─── BASKETBALL (sport 2, stat categories 9-16) ──────────────────────
        M(2, "Speed", Cat.Physical, In.Timer, "seconds", 3.8m, 3.4m, 3.0m,
            "Full-court and transition speed.",
            "3/4-court sprint (baseline to far free-throw line). Elite: ~3.0s.",
            statCategoryId: null, objectiveRequired: true),
        M(2, "Vertical Jump", Cat.Physical, In.Distance, "cm", 40, 55, 80,
            "Standing vertical leap.",
            "Standing vertical jump: highest touch minus standing reach. Elite: 80cm+, average: ~55cm.",
            statCategoryId: 14, objectiveRequired: true),
        M(2, "Ball Handling", Cat.Technical, In.Timer, "seconds", 12, 9.5m, 7.5m,
            "Dribbling control under pressure with both hands.",
            "Full-court dribble course (cones, both hands) — time to complete.",
            statCategoryId: 10),
        M(2, "Shooting", Cat.Technical, In.Percentage, "%", 35, 55, 80,
            "Field goal, three-point and free-throw shooting.",
            "Spot-up drill: % made from 25 shots across 5 spots. In matches: FG%.",
            statCategoryId: 9),
        M(2, "Passing", Cat.Technical, In.Percentage, "%", 50, 70, 90,
            "Pass accuracy and creating for teammates.",
            "Partner passing drill: % on-target from 20 (chest, bounce, overhead). In matches: assist/turnover ratio.",
            statCategoryId: 11),
        M(2, "Rebounding", Cat.Physical, In.Rating, null, 3, 5, 10,
            "Positioning, boxing out and securing boards.",
            "Rated from box-out technique; in matches: rebounds per game.",
            statCategoryId: 13, wObj: 0m, wMatch: 0.4m, wCoach: 0.4m, wSelf: 0.2m),
        M(2, "Defense", Cat.Tactical, In.Rating, null, 3, 5, 10,
            "On-ball and help defense.",
            "Rated from closeouts, slides and help rotations; in matches: steals + blocks.",
            statCategoryId: 12, wObj: 0m, wMatch: 0.4m, wCoach: 0.4m, wSelf: 0.2m),
        M(2, "Court Vision", Cat.Tactical, In.Rating, null, 3, 5, 10,
            "Seeing plays develop and finding open teammates.",
            "Rated from scrimmage reads; in matches: assists per game.",
            statCategoryId: 15, wObj: 0m, wMatch: 0.4m, wCoach: 0.4m, wSelf: 0.2m),
        M(2, "Conditioning", Cat.Physical, In.Timer, "seconds", 33, 30, 27,
            "Repeated-effort endurance at game intensity.",
            "Suicide/ladder drill time (baseline-quarter-half-3quarter-full and back).",
            statCategoryId: 16),
        Rated(2, "Decision Making", Cat.Mental,
            "Shot selection and turnover avoidance under pressure.",
            statCategoryId: null, wCoach: 0.5m, wSelf: 0.2m, wMatch: 0.3m),
        Rated(2, "Leadership", Cat.Mental,
            "Communication, composure and lifting teammates.", statCategoryId: null,
            wCoach: 0.6m, wSelf: 0.4m),

        // ─── VOLLEYBALL (sport 3, stat categories 17-24) ─────────────────────
        M(3, "Serve", Cat.Technical, In.Percentage, "%", 40, 60, 85,
            "Serve accuracy, consistency and aggression.",
            "Serving drill: % of serves into target zones from 20. In matches: ace rate vs errors.",
            statCategoryId: 17),
        Rated(3, "Passing", Cat.Technical,
            "Serve receive and reception quality (0-3 graded passes).",
            statCategoryId: 18, wCoach: 0.5m, wSelf: 0.2m, wMatch: 0.3m),
        M(3, "Setting", Cat.Technical, In.Percentage, "%", 45, 65, 90,
            "Set precision, tempo and decision making.",
            "Target setting drill: % of sets landing in the hitting window from 20.",
            statCategoryId: 19),
        M(3, "Attack", Cat.Technical, In.Percentage, "%", 20, 35, 55,
            "Spiking power, placement and kill efficiency.",
            "Hitting drill: kill % from 20 attempts vs block. In matches: kill percentage.",
            statCategoryId: 21),
        M(3, "Blocking", Cat.Technical, In.Rating, null, 3, 5, 10,
            "Block timing, hand positioning and reading hitters.",
            "Rated from footwork/timing; in matches: blocks per set.",
            statCategoryId: 20, wObj: 0m, wMatch: 0.4m, wCoach: 0.4m, wSelf: 0.2m),
        M(3, "Vertical Jump", Cat.Physical, In.Distance, "cm", 35, 50, 75,
            "Attack and block jump height.",
            "Standing vertical jump (highest touch minus reach).",
            statCategoryId: 23, objectiveRequired: true),
        M(3, "Reaction", Cat.Physical, In.Timer, "ms", 350, 280, 200,
            "Reaction speed to attacks and deflections.",
            "Reaction test (light board or app), average of 5 attempts in milliseconds.",
            statCategoryId: 22),
        Rated(3, "Court Positioning", Cat.Tactical,
            "Rotational awareness and defensive base positions.", statCategoryId: null),
        Rated(3, "Communication", Cat.Mental,
            "Calling balls, organizing the block and keeping energy up.",
            statCategoryId: 24, wCoach: 0.55m, wSelf: 0.45m),
        M(3, "Defensive Coverage", Cat.Technical, In.Rating, null, 3, 5, 10,
            "Digging, floor defense and hitter coverage.",
            "Rated from defensive drills; in matches: digs per set.",
            statCategoryId: null, wObj: 0m, wMatch: 0.4m, wCoach: 0.4m, wSelf: 0.2m),

        // ─── BEACH VOLLEYBALL (sport 4, stat categories 25-32) ───────────────
        M(4, "Serve", Cat.Technical, In.Percentage, "%", 40, 60, 85,
            "Serve accuracy and tactical variation in wind.",
            "Serving drill: % into target zones from 20. In matches: ace rate vs errors.",
            statCategoryId: 25),
        Rated(4, "Passing", Cat.Technical,
            "Serve receive quality on sand.",
            statCategoryId: 26, wCoach: 0.6m, wSelf: 0.4m),
        M(4, "Attack", Cat.Technical, In.Percentage, "%", 25, 40, 60,
            "Hitting, shots and kill efficiency.",
            "Hitting drill: kill % from 20 attempts. In matches: kills per attempt.",
            statCategoryId: 27),
        M(4, "Blocking", Cat.Technical, In.Rating, null, 3, 5, 10,
            "Net presence, block timing and hand control.",
            "Rated from blocking drills; in matches: blocks.",
            statCategoryId: null, wObj: 0m, wMatch: 0.4m, wCoach: 0.4m, wSelf: 0.2m),
        M(4, "Digging", Cat.Technical, In.Rating, null, 3, 5, 10,
            "Defensive range and dig control on sand.",
            "Rated from defensive drills; in matches: digs.",
            statCategoryId: 28, wObj: 0m, wMatch: 0.4m, wCoach: 0.4m, wSelf: 0.2m),
        M(4, "Sand Movement", Cat.Physical, In.Timer, "seconds", 6.5m, 5.8m, 5.0m,
            "Acceleration and change of direction on sand.",
            "Sand agility drill (modified 5-10-5 on sand), timed.",
            statCategoryId: 29),
        M(4, "Jump Endurance", Cat.Physical, In.Count, "jumps", 8, 15, 25,
            "Sustaining jump height across a long match.",
            "Repeated jump test: consecutive jumps reaching at least 80% of max height.",
            statCategoryId: 30, objectiveRequired: true),
        Rated(4, "Communication", Cat.Mental,
            "Constant talk and shared decisions in a 2-player team.",
            statCategoryId: 32, wCoach: 0.55m, wSelf: 0.45m),
        Rated(4, "Court Coverage", Cat.Tactical,
            "Covering the court as a pair: splits, switches and reads.", statCategoryId: null),
        Rated(4, "Wind Adaptation", Cat.Mental,
            "Adjusting sets, serves and shots to wind and conditions.", statCategoryId: null),

        // ─── TENNIS (sport 5, stat categories 33-40) ─────────────────────────
        M(5, "Serve", Cat.Technical, In.Percentage, "%", 45, 60, 75,
            "First-serve percentage, placement and power.",
            "Practice set or basket drill: first serves in from 20 attempts. In matches: 1st serve %.",
            statCategoryId: 33),
        M(5, "Forehand", Cat.Technical, In.Count, "shots", 10, 25, 60,
            "Forehand consistency, depth and weight of shot.",
            "Cross-court forehand rally: consecutive shots landing beyond the service line.",
            statCategoryId: 34),
        M(5, "Backhand", Cat.Technical, In.Count, "shots", 8, 20, 50,
            "Backhand consistency, depth and variety.",
            "Cross-court backhand rally: consecutive shots landing beyond the service line.",
            statCategoryId: 35),
        M(5, "Footwork", Cat.Physical, In.Timer, "seconds", 19, 17, 15,
            "Court movement patterns and recovery steps.",
            "Spider drill: touch 5 balls placed around the court, timed.",
            statCategoryId: 36),
        M(5, "Speed", Cat.Physical, In.Timer, "seconds", 3.6m, 3.3m, 3.0m,
            "Explosive first-step and sprint speed.",
            "20m sprint from a standing start.",
            statCategoryId: null, objectiveRequired: true),
        M(5, "Return", Cat.Technical, In.Percentage, "%", 50, 65, 85,
            "Return of serve: consistency and neutralizing power.",
            "Return drill: % of returns in play against varied serves from 20.",
            statCategoryId: 39),
        M(5, "Volley", Cat.Technical, In.Count, "volleys", 6, 15, 35,
            "Net play: volley technique and touch.",
            "Rapid-fire volley drill: consecutive controlled volleys without error.",
            statCategoryId: null),
        Rated(5, "Match Strategy", Cat.Tactical,
            "Point construction, pattern recognition and tactical adjustments.",
            statCategoryId: null),
        M(5, "Consistency", Cat.Technical, In.Count, "shots", 15, 35, 80,
            "Keeping the ball in play and limiting unforced errors.",
            "Groundstroke rally test: consecutive shots without an error. In matches: unforced errors.",
            statCategoryId: 38),
        Rated(5, "Mental Toughness", Cat.Mental,
            "Composure on big points, resilience after losing games.",
            statCategoryId: 40, wCoach: 0.4m, wSelf: 0.4m, wMatch: 0.2m),
        M(5, "Endurance", Cat.Physical, In.Distance, "meters", 2000, 2500, 3100,
            "Sustaining quality deep into long matches.",
            "Cooper test: distance covered in 12 minutes.",
            statCategoryId: 37),
        M(5, "Agility", Cat.Physical, In.Timer, "seconds", 5.6m, 5.0m, 4.4m,
            "Lateral quickness and direction changes.",
            "5-10-5 shuttle (pro-agility) time.",
            statCategoryId: null, objectiveRequired: true),
    };
}
