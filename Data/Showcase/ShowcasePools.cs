namespace ProTracker.Data.Showcase;

// Hand-written text/name pools for the showcase seeder. No lorem ipsum: every
// string a demo visitor can read was written for its context.
public static class ShowcasePools
{
    // Full senior soccer roster. The first 8 are the DemoDataSeeder baseline names —
    // present ⇒ adopted by natural key; absent (post-teardown) ⇒ recreated, so the
    // showcase can rebuild the demo standalone.
    public static readonly string[] SoccerSeniorNames =
    {
        "Liam Carter", "Noah Bennett", "Ethan Brooks", "Mason Reid",
        "Lucas Ward", "Oliver Hayes", "Jack Turner", "Dylan Ross",
        "Theo Marchetti", "Kwame Mensah", "Rafael Ortiz", "Jonas Lindqvist",
        "Amir Haddad", "Callum O'Brien", "Yusuf Demir", "Dario Kovač",
        "Sam Whitfield", "Andre Baptiste", "Felix Wagner", "Tomas Silva",
        "Idris Keita", "Leo Fontaine", "Nathan Cole", "Bruno Costa",
    };

    // Minor soccer academy (ages 13-15).
    public static readonly string[] SoccerMinorNames =
    {
        "Oscar Reyes", "Milo Andersson", "Jaden Clarke", "Ibrahim Sow",
        "Luka Perić", "Finn Gallagher", "Mateo Vidal", "Elias Berg",
        "Kofi Owusu", "Ryan Doyle", "Tariq Aziz", "Noel Vargas",
        "Jamie McAllister", "Santi Herrera", "Emre Yilmaz", "Dominic Ferraro",
        "Ayo Adebayo", "Casper Holm", "Marco Bellini", "Zaid Rahman",
        "Aleks Novak", "Teddy Lawson",
    };

    public static readonly string[] GoalTitles =
    {
        "Raise sprint score past {0}", "Hit {0} pass accuracy in matches",
        "Win more 1v1 duels", "Add {0} km per match to work rate",
        "Sharpen first touch under pressure", "Improve weak-foot finishing",
        "Hold concentration for the full 90", "Own set-piece delivery",
    };

    public static readonly string[] TaskTitles =
    {
        "Cone dribbling ladder — 3 sets", "Wall passes, 100 each foot",
        "Shuttle sprints 5x30m", "Video review: last match positioning",
        "Core stability circuit", "Crossing drill with the U15 wingers",
        "Finishing session: far-post runs", "Defensive shape walkthrough",
        "Recovery jog + stretching 30min", "Penalty routine — 20 reps",
    };

    public static readonly string[] AnnouncementTitles =
    {
        "Saturday kickoff moved to 14:00", "Bring both kits this week",
        "Team dinner after Friday training", "Video analysis room booked Tuesday",
    };

    public static readonly string[] AnnouncementBodies =
    {
        "Pitch maintenance pushed our slot — arrive 45 minutes early for warm-up as usual.",
        "We may need the away kit depending on the referee's call, so pack both shirts.",
        "Quick team meal to mark the winning streak. Family welcome, details in the group chat.",
        "We'll break down the last two matches. Defenders 17:00, attackers 17:45.",
    };

    public static readonly string[] JournalSnippets =
    {
        "Legs felt heavy at the start but the second half of training was much better.",
        "Best session in weeks — the pressing drills finally clicked.",
        "Struggled with the new formation. Need to watch the video again.",
        "Coach said my positioning has improved. Want to keep that streak going.",
        "Slept badly, could feel it in the sprints. Early night today.",
        "Worked on weak foot after the session. Small gains but they add up.",
    };

    public static readonly string[] CoachNoteSnippets =
    {
        "Responded well to the extra defensive work this week.",
        "Needs an arm around the shoulder after the missed penalty — confidence is fragile.",
        "Quietly becoming the leader of the back line.",
        "Watch the workload — third week of high minutes in a row.",
    };

    public static readonly string[] AthleteNoteSnippets =
    {
        "Remember: first touch away from pressure, scan before receiving.",
        "New boots feel good. Stick with the same studs for the wet pitch.",
        "Ask coach about extra finishing sessions on Thursdays.",
    };

    public static readonly string[] MessagePairs =
    {
        "Great shift today — that pressing intensity is exactly what we need.|Thanks coach! Felt sharp today.",
        "How's the ankle feeling after yesterday?|A bit stiff in the morning but fine once I warmed up.",
        "I've assigned you two new finishing tasks for this week.|Seen them — I'll get the video done tonight.",
        "Don't forget the wellbeing check-in before Thursday.|Done! Energy's been better this week.",
    };

    public static readonly string[] SessionFocus =
    {
        "High press triggers", "Build-up through midfield", "Set pieces — attacking",
        "Transition defense", "Finishing patterns", "Possession under pressure",
    };

    public static readonly (string Type, string BodyPart)[] SoccerInjuries =
    {
        ("Hamstring strain", "Hamstring"), ("Ankle sprain", "Ankle"),
        ("Groin tightness", "Hip"), ("Knee contusion", "Knee"),
        ("Calf strain", "Calf"), ("Quad strain", "Quad"),
    };

    public static readonly string[] Opponents =
    {
        "Harbor City FC", "Eastside Athletic", "Northern FC", "Riverside United",
        "Old Mill Rovers", "Westgate Town", "Brookfield SC", "Kingsway FC",
    };

    // (FoodName, Portion, kcal, protein g, carbs g, fats g) — used to assemble
    // static weekly nutrition plans (IsAIGenerated = false).
    public static readonly (string Food, string Portion, int Kcal, int P, int C, int F)[] Foods =
    {
        ("Grilled chicken breast", "200g", 330, 62, 0, 7),
        ("Brown rice", "180g cooked", 230, 5, 48, 2),
        ("Salmon fillet", "180g", 340, 36, 0, 22),
        ("Sweet potato", "250g", 215, 4, 50, 0),
        ("Greek yogurt", "200g", 130, 20, 8, 4),
        ("Oats with banana", "80g + 1 banana", 390, 12, 75, 6),
        ("Whole-grain pasta", "200g cooked", 310, 12, 60, 3),
        ("Mixed green salad", "large bowl", 90, 3, 10, 5),
        ("Scrambled eggs", "3 eggs", 270, 19, 2, 20),
        ("Beef stir-fry", "220g", 380, 40, 12, 18),
        ("Cottage cheese", "150g", 150, 17, 6, 6),
        ("Fruit smoothie", "400ml", 240, 8, 48, 2),
        ("Turkey sandwich", "wholemeal", 350, 28, 40, 9),
        ("Trail mix", "50g", 250, 8, 20, 16),
    };

    public static readonly string[] MealTypes = { "Breakfast", "Lunch", "Snack", "Dinner" };
    public static readonly string[] MealTimes = { "07:30", "12:30", "16:00", "19:30" };
    public static readonly string[] DayNames = { "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday" };
}
