namespace ProTracker.Data;

// Test protocol guides for every measurable metric: how to set up, run, and not ruin
// each test. Keyed by (sportId, metric name) and consumed by MetricDefinitionSeeder —
// both when seeding fresh installs and when backfilling protocols onto existing rows.
// Sport ids: 1=Soccer, 2=Basketball, 3=Volleyball, 4=Beach Volleyball, 5=Tennis.
public static class TestProtocols
{
    public sealed record Protocol(string Setup, string Procedure, string Mistakes);

    public static Protocol? For(int sportId, string metricName) =>
        All.TryGetValue((sportId, metricName), out var p) ? p : null;

    private static readonly Dictionary<(int SportId, string Metric), Protocol> All = new()
    {
        // ─── SOCCER ──────────────────────────────────────────────────────────
        [(1, "Speed")] = new(
            "Flat surface (grass or track), measuring tape, cones at 0m and 30m, a stopwatch accurate to 0.01s (timing gates if available).",
            "1. Player starts in a standing position behind the 0m cone.\n2. On 'Go', player sprints through the 30m cone at full effort.\n3. Time stops when the player's chest crosses the 30m line.\n4. Rest 3 minutes.\n5. Repeat twice and record the best time.",
            "Starting too early (false start), slowing before the line, timing from first movement instead of the signal, running on an uneven or wet surface."),
        [(1, "Stamina")] = new(
            "400m track or a measured flat loop, stopwatch, cones every 50m to read partial distance.",
            "1. Warm up 10 minutes.\n2. On 'Go', the player runs as far as possible in 12 minutes (Cooper test).\n3. Count completed laps plus the last partial 50m segment.\n4. Record total distance in meters.",
            "Starting too fast and fading, walking breaks from poor pacing, an unmeasured course, testing in extreme heat."),
        [(1, "Passing")] = new(
            "20 balls, two 1m-wide cone gates at 10m and 20m, a flat pitch area.",
            "1. Player passes 10 balls into the 10m gate and 10 into the 20m gate.\n2. A pass counts when the ball rolls through the gate below knee height.\n3. Record the percentage on target across all 20 attempts.",
            "Moving the gates between players, allowing bouncing balls to count, stationary balls only (add a touch first for realism), rushing attempts without reset."),
        [(1, "Shooting")] = new(
            "10 balls, full-size goal, penalty-area edge marked (16-18m), a goalkeeper is optional but must be consistent across players.",
            "1. Player takes 10 shots from the area edge: 5 with the dominant foot, 5 with the other.\n2. Only shots on target (goal or keeper save) count as successful.\n3. Record the percentage on target.",
            "Different distances per player, counting rebounds, letting players only use their strong foot, no goalkeeper for some players but not others."),
        [(1, "Dribbling")] = new(
            "Ball, 1 defender (or coach), a 10x10m grid marked with cones.",
            "1. Attacker starts with the ball on one side, defender opposite.\n2. Attacker attempts to dribble past the defender and cross the far line under control.\n3. Run 10 attempts with brief rests.\n4. Record the percentage of successful take-ons.",
            "Passive defending (defender must genuinely try), oversized grid making it too easy, counting escapes where the ball ran loose."),
        [(1, "Defending")] = new(
            "Ball, 1 attacker, the same 10x10m grid as the dribbling test.",
            "1. Defender starts opposite an attacker who tries to dribble past.\n2. A duel is won if the defender wins the ball or forces the attacker out of the grid.\n3. Run 10 duels with brief rests.\n4. Record the percentage of duels won.",
            "Fouling counted as winning, attacker not at full effort, no rest between duels (fatigue skews late attempts)."),
        [(1, "Ball Control")] = new(
            "One ball per player, flat surface.",
            "1. Player starts with the ball in hand, drops it and juggles using feet, thighs, head — no hands.\n2. Count consecutive touches until the ball hits the ground.\n3. Three attempts; record the best count.",
            "Steadying the ball on the body or catching it, counting the drop as a touch, uneven or windy conditions."),
        [(1, "Agility")] = new(
            "Three cones in a line 5m apart (5-10-5 / pro-agility), stopwatch or timing gates.",
            "1. Player straddles the middle cone in a 3-point stance.\n2. On 'Go', sprint 5m right, touch the line, sprint 10m left, touch, then 5m back through the middle.\n3. Rest 2 minutes; repeat twice and record the best time.",
            "Not touching the lines, rounding turns wide, inconsistent start stance, timing by foot movement instead of the signal."),

        // ─── BASKETBALL ──────────────────────────────────────────────────────
        [(2, "Speed")] = new(
            "Full court, cones at the baseline and the far free-throw line (3/4 court), stopwatch.",
            "1. Player starts behind the baseline in a standing stance.\n2. On 'Go', sprint to the far free-throw line at full effort.\n3. Time stops when the lead foot crosses the line.\n4. Two attempts with 2 minutes rest; record the best.",
            "Starting in motion, easing up before the line, slippery court, timing from movement not signal."),
        [(2, "Vertical Jump")] = new(
            "Flat floor next to a wall, measuring tape or Vertec device, chalk or tape for marking.",
            "1. Player stands flat-footed side-on to the wall and marks standing reach with chalk.\n2. From a standing position (no step or run-up), jump as high as possible and mark the wall at the peak.\n3. Measure the difference between the two marks.\n4. Three attempts; record the best.",
            "Allowing a step or run-up, measuring total height instead of the difference, not extending fully on the standing reach, jumping off one foot."),
        [(2, "Ball Handling")] = new(
            "6 cones 3m apart in a straight line down the court, one ball, stopwatch.",
            "1. Player dribbles through the cone slalom and back, alternating hands at each cone.\n2. Time the full down-and-back run.\n3. A missed cone or lost ball invalidates the attempt.\n4. Two valid attempts; record the best time.",
            "Carrying the ball, skipping cones, using only the strong hand, moving cones between players."),
        [(2, "Shooting")] = new(
            "25 balls (or rebounders), 5 marked spots around the arc/mid-range: both corners, both wings, top of the key.",
            "1. Player takes 5 shots from each of the 5 spots (25 total) at game pace.\n2. Count makes only.\n3. Record the percentage made.",
            "Different spot distances per player, uncontested warm-up shots counted, letting a shooter stay at a hot spot longer."),
        [(2, "Passing")] = new(
            "Wall with a 50cm target square at chest height, 3m distance line, one ball, stopwatch.",
            "1. Player makes chest passes at the target for 30 seconds.\n2. Count passes that hit inside the square and are caught cleanly on return.\n3. Record hits from total attempts as a percentage.",
            "Stepping over the line, counting wall hits outside the square, catching on the bounce."),
        [(2, "Conditioning")] = new(
            "Full court, lines marked at baseline, quarter, half, three-quarter and far baseline, stopwatch.",
            "1. From the baseline, sprint to the quarter line and back, half and back, three-quarter and back, full court and back (a 'suicide').\n2. Touch every line with a hand.\n3. Time the full drill; record the best of two with 3 minutes rest.",
            "Missing line touches, pacing instead of sprinting, timing without the final baseline touch."),

        // ─── VOLLEYBALL ──────────────────────────────────────────────────────
        [(3, "Serve")] = new(
            "20 balls, regulation net, court split into 4 marked target zones (2x2 grid on the receiving side).",
            "1. Announce a target zone before each serve.\n2. Player serves 20 balls (any style), rotating the announced zone every 5 serves.\n3. Count serves landing in the announced zone.\n4. Record the percentage on target.",
            "Serving without calling zones, counting lets inconsistently, standing inside the line, zones marked differently between sessions."),
        [(3, "Setting")] = new(
            "20 balls, a feeder, a 1m-diameter hoop or marked circle placed in the outside-hitter window.",
            "1. Feeder tosses to the setter position.\n2. Player sets toward the target circle at the left antenna, 20 attempts.\n3. Count sets landing in (or dropping through) the target.\n4. Record the percentage on target.",
            "Inconsistent feeds (feeder must be steady), letting the setter move the target, counting sets that would be unhittable in play."),
        [(3, "Attack")] = new(
            "20 balls, a consistent setter, regulation net, court marked in and out.",
            "1. Setter delivers a consistent high set to the outside.\n2. Player attacks 20 balls against a passive single block.\n3. A kill = ball lands in court untouched or off the block out of play.\n4. Record kill percentage.",
            "No block for some players but not others, wildly varying sets, counting blocked balls as kills."),
        [(3, "Vertical Jump")] = new(
            "Flat floor next to a wall or Vertec, measuring tape, chalk.",
            "1. Mark standing reach with both feet flat.\n2. Using a normal spike approach (up to 3 steps), jump and mark the peak touch.\n3. Measure the difference.\n4. Three attempts; record the best.",
            "Not marking standing reach first, measuring absolute touch height, inconsistent approach allowance between players."),
        [(3, "Reaction")] = new(
            "Reaction-light board or a phone reaction app; a quiet space.",
            "1. Player rests a hand at the marked start point.\n2. On the visual stimulus, touch the target as fast as possible.\n3. Run 5 trials, discard the slowest, average the rest in milliseconds.",
            "Anticipating a rhythm (randomize intervals), testing when fatigued, mixing audio and visual stimuli between sessions."),

        // ─── BEACH VOLLEYBALL ────────────────────────────────────────────────
        [(4, "Serve")] = new(
            "20 balls, regulation beach net, receiving court split into 4 marked zones (use cones or lines in the sand).",
            "1. Announce a target zone before each serve.\n2. Serve 20 balls, rotating zones every 5 serves.\n3. Count serves landing in the announced zone.\n4. Record the percentage on target.",
            "Wind direction changing mid-test (serve both ways or note conditions), zones drawn differently each session, foot faults ignored."),
        [(4, "Attack")] = new(
            "20 balls, a consistent setter/tosser, regulation beach net.",
            "1. Partner delivers consistent sets from a hand toss.\n2. Player attacks 20 balls into the open court.\n3. A kill = ball lands in the court.\n4. Record kill percentage.",
            "Inconsistent sets, ignoring wind (attack both directions), counting shanks that land in as intentional."),
        [(4, "Sand Movement")] = new(
            "Three cones in a line 5m apart on level sand (modified 5-10-5), stopwatch.",
            "1. Player straddles the middle cone.\n2. On 'Go', sprint 5m right, touch, 10m left, touch, 5m back through the middle.\n3. Rest 2 minutes; two attempts, record the best.",
            "Deep, uneven or wet sand patches between attempts, not touching lines, comparing times against grass/track numbers."),
        [(4, "Jump Endurance")] = new(
            "A wall or antenna reference marked at 80% of the player's max jump touch, level sand.",
            "1. Establish the player's max jump touch, mark 80% of it.\n2. Player performs continuous block jumps, touching above the 80% mark each time, ~1 jump per 2 seconds.\n3. Count consecutive jumps until two misses in a row.\n4. Record the count.",
            "Not re-measuring the 80% line per player, allowing long pauses between jumps, counting touches below the line."),

        // ─── TENNIS ──────────────────────────────────────────────────────────
        [(5, "Serve")] = new(
            "20 balls, regulation court, both service boxes visible; optionally mark deep/wide target zones.",
            "1. Player serves 10 first serves to the deuce box and 10 to the ad box at match intensity.\n2. Count serves landing in the correct box.\n3. Record the percentage in.",
            "Practice-pace 'arm' serves (require match intensity), ignoring foot faults, counting lets inconsistently."),
        [(5, "Forehand")] = new(
            "Ball machine or a consistent feeder, full court, a partner or coach counting.",
            "1. Feed consistent cross-court balls to the forehand side.\n2. Player rallies cross-court forehands; count consecutive shots landing beyond the service line and inside the sideline.\n3. Stop at the first error; three attempts, record the best streak.",
            "Feeds varying in depth/pace, counting short balls that land in the service box, restarting streaks after 'almost' misses."),
        [(5, "Backhand")] = new(
            "Ball machine or a consistent feeder, full court.",
            "1. Feed consistent cross-court balls to the backhand side.\n2. Count consecutive backhands landing beyond the service line and in.\n3. Stop at the first error; three attempts, record the best streak.",
            "Same as forehand: inconsistent feeds, counting short balls, mixing slice and drive without noting it."),
        [(5, "Footwork")] = new(
            "5 balls placed around the court: both singles-sideline/baseline corners, both service-line/sideline junctions, one at the T; a hoop or racquet at the centre baseline; stopwatch.",
            "1. Player starts at the centre baseline.\n2. On 'Go', run to each ball in a set order, carry it back to the centre target one at a time (spider drill).\n3. Time stops when the fifth ball is placed.\n4. Two attempts; record the best.",
            "Throwing balls at the target instead of placing them, changing the collection order between players, skipping the returning touch."),
        [(5, "Speed")] = new(
            "Flat court or track, cones at 0m and 20m, stopwatch.",
            "1. Standing start behind the 0m cone.\n2. On 'Go', sprint through the 20m cone.\n3. Rest 2-3 minutes; two attempts, record the best.",
            "Rolling starts, easing up early, timing from movement instead of the signal."),
        [(5, "Return")] = new(
            "A consistent server (or ball machine on serve setting), 20 serves of realistic pace.",
            "1. Server alternates deuce and ad-side serves.\n2. Player returns 20 serves; count returns landing in the singles court.\n3. Record the percentage in play.",
            "Serve pace far below match level, counting returns that clip the net cord inconsistently, only testing one side."),
        [(5, "Volley")] = new(
            "A feeder at the baseline, player at the net, one ball in play at a time.",
            "1. Feeder hits controlled passes at the net player.\n2. Count consecutive controlled volleys landing in the court.\n3. Stop at the first error; three attempts, record the best streak.",
            "Feeds aimed straight at the body only (mix sides), counting half-volleys, feeder pace varying between players."),
        [(5, "Consistency")] = new(
            "A rally partner of steady level or a ball machine, full court.",
            "1. Rally cooperatively from the baseline at moderate pace.\n2. Count the player's consecutive shots landing in without an unforced error.\n3. Stop at the player's first error (partner errors don't end the count if play restarts).\n4. Three attempts; record the best streak.",
            "Partner errors ending the count, pace so slow it isn't representative, moonballing to inflate streaks."),
        [(5, "Endurance")] = new(
            "400m track or measured loop, stopwatch.",
            "1. Warm up 10 minutes.\n2. Run as far as possible in 12 minutes (Cooper test).\n3. Record total distance in meters.",
            "Poor pacing (too fast early), unmeasured course, testing right after a match or hard session."),
        [(5, "Agility")] = new(
            "Three cones in a line 5m apart (5-10-5), stopwatch.",
            "1. Straddle the middle cone in a ready stance.\n2. On 'Go', sprint 5m right, touch, 10m left, touch, 5m back through the middle.\n3. Rest 2 minutes; two attempts, record the best.",
            "Not touching the lines, wide rounded turns, inconsistent surfaces between test days."),
    };
}
