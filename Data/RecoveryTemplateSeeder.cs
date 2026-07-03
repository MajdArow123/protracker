using Microsoft.EntityFrameworkCore;
using ProTracker.Models;
using Cat = ProTracker.Models.RecoveryExerciseCategory;

namespace ProTracker.Data;

// Seeds the 10 built-in recovery-plan templates (reference data). Runs at startup; only
// inserts when the table is empty, so it never duplicates or clobbers on redeploy.
public static class RecoveryTemplateSeeder
{
    public static async Task SeedAsync(ApplicationDbContext context)
    {
        if (await context.RecoveryTemplates.AnyAsync())
            return;

        context.RecoveryTemplates.AddRange(BuildTemplates());
        await context.SaveChangesAsync();
    }

    private static RecoveryTemplateExercise Ex(
        int week, string title, string desc, Cat cat, string day = "All",
        int? sets = null, int? reps = null, int? min = null, int? rest = null) => new()
    {
        Week = week, Title = title, Description = desc, Category = cat, DayOfWeek = day,
        Sets = sets, Reps = reps, DurationMinutes = min, RestSeconds = rest,
    };

    private static RecoveryTemplateMilestone Ms(int week, string title) => new() { TargetWeek = week, Title = title };

    private static List<RecoveryTemplate> BuildTemplates() => new()
    {
        new RecoveryTemplate
        {
            Name = "Hamstring Strain", BodyPart = "Hamstring", EstimatedWeeks = 4,
            TypicalSeverity = InjurySeverity.Moderate,
            Description = "Progressive hamstring rehab from protection to sprint-ready.",
            Exercises = new()
            {
                Ex(1, "Gentle isometric hamstring holds", "Lie prone, gently press heel into floor at 30% effort. Pain-free only.", Cat.Strength, sets: 3, reps: 8, rest: 30),
                Ex(1, "Ice after activity", "15 minutes ice on the hamstring to control inflammation.", Cat.Ice, min: 15),
                Ex(2, "Prone leg curls (bodyweight)", "Slow, controlled knee flexion in prone position.", Cat.Strength, sets: 3, reps: 12, rest: 45),
                Ex(2, "Single-leg glute bridge", "Bridge on the injured leg, controlled tempo.", Cat.Strength, sets: 3, reps: 10, rest: 45),
                Ex(3, "Nordic hamstring lowers (assisted)", "Eccentric lowering, assisted as needed. Key strengthener.", Cat.Strength, sets: 3, reps: 6, rest: 60),
                Ex(3, "Dynamic hamstring stretch", "Leg swings and A-skips to restore range.", Cat.Flexibility, min: 8),
                Ex(4, "Progressive sprint build-ups", "60m strides at 60-80-90% over the session.", Cat.Cardio, sets: 6, min: 1, rest: 120),
            },
            Milestones = new() { Ms(1, "Pain-free walking"), Ms(2, "Full range of motion"), Ms(3, "Jog without discomfort"), Ms(4, "Return to sprinting") },
        },
        new RecoveryTemplate
        {
            Name = "Ankle Sprain", BodyPart = "Ankle", EstimatedWeeks = 3,
            TypicalSeverity = InjurySeverity.Minor,
            Description = "Lateral ankle sprain rehab restoring stability and balance.",
            Exercises = new()
            {
                Ex(1, "Ankle alphabet", "Trace the alphabet with your toes to restore gentle motion.", Cat.Mobility, sets: 2),
                Ex(1, "RICE protocol", "Rest, ice 15 min, compression, elevation after activity.", Cat.Ice, min: 15),
                Ex(2, "Resistance band eversion/inversion", "Band-resisted ankle movements in all directions.", Cat.Strength, sets: 3, reps: 15, rest: 30),
                Ex(2, "Calf raises (double leg)", "Controlled heel raises, progress toward single leg.", Cat.Strength, sets: 3, reps: 15, rest: 45),
                Ex(3, "Single-leg balance", "Balance on the injured leg, eyes open then closed.", Cat.Balance, sets: 3, min: 1),
                Ex(3, "Lateral hops & cutting", "Controlled side-to-side hops progressing to cutting.", Cat.Cardio, sets: 3, reps: 10, rest: 60),
            },
            Milestones = new() { Ms(1, "Swelling controlled"), Ms(2, "Full weight bearing"), Ms(3, "Return to cutting & jumping") },
        },
        new RecoveryTemplate
        {
            Name = "ACL Reconstruction (Post-Op)", BodyPart = "Knee", EstimatedWeeks = 9,
            TypicalSeverity = InjurySeverity.Severe,
            Description = "Long-term post-surgical ACL protocol. Progress only on physio clearance.",
            Exercises = new()
            {
                Ex(1, "Quad sets & heel slides", "Reactivate the quadriceps and restore gentle knee flexion.", Cat.Strength, sets: 3, reps: 12, rest: 45),
                Ex(2, "Straight-leg raises", "Maintain quad strength without knee shear.", Cat.Strength, sets: 3, reps: 12, rest: 45),
                Ex(3, "Stationary bike (low resistance)", "Restore range and gentle cardio.", Cat.Cardio, min: 15),
                Ex(5, "Mini squats & leg press", "Controlled closed-chain strengthening within pain-free range.", Cat.Strength, sets: 3, reps: 12, rest: 60),
                Ex(6, "Single-leg balance & proprioception", "Wobble board and single-leg holds.", Cat.Balance, sets: 3, min: 1),
                Ex(8, "Jogging progression", "Straight-line jogging building volume gradually.", Cat.Cardio, min: 15),
                Ex(9, "Agility & sport-specific drills", "Cutting, deceleration and return-to-play drills.", Cat.Cardio, sets: 4, min: 5, rest: 120),
            },
            Milestones = new() { Ms(2, "Full knee extension"), Ms(4, "Walk without crutches"), Ms(6, "Single-leg squat control"), Ms(8, "Jog pain-free"), Ms(9, "Return-to-play testing") },
        },
        new RecoveryTemplate
        {
            Name = "Groin Strain", BodyPart = "Groin", EstimatedWeeks = 4,
            TypicalSeverity = InjurySeverity.Moderate,
            Description = "Adductor strain rehab from isometrics to change-of-direction.",
            Exercises = new()
            {
                Ex(1, "Isometric ball squeeze", "Squeeze a ball between knees at pain-free effort.", Cat.Strength, sets: 3, reps: 10, rest: 30),
                Ex(2, "Side-lying hip adduction", "Bottom-leg raises to strengthen adductors.", Cat.Strength, sets: 3, reps: 12, rest: 45),
                Ex(2, "Hip flexor & adductor mobility", "Gentle stretching to restore range.", Cat.Flexibility, min: 8),
                Ex(3, "Copenhagen adductor plank (short lever)", "Progressive adductor loading, short lever first.", Cat.Strength, sets: 3, reps: 8, rest: 60),
                Ex(4, "Lateral lunges & shuffles", "Change-of-direction loading toward return to play.", Cat.Cardio, sets: 3, reps: 10, rest: 60),
            },
            Milestones = new() { Ms(1, "Pain-free isometrics"), Ms(2, "Full range of motion"), Ms(3, "Resisted strength restored"), Ms(4, "Return to change-of-direction") },
        },
        new RecoveryTemplate
        {
            Name = "Shoulder Impingement", BodyPart = "Shoulder", EstimatedWeeks = 6,
            TypicalSeverity = InjurySeverity.Moderate,
            Description = "Rotator cuff & scapular rehab for overhead athletes.",
            Exercises = new()
            {
                Ex(1, "Pendulum swings", "Gentle passive circles to reduce stiffness.", Cat.Mobility, sets: 2, min: 2),
                Ex(1, "Scapular retraction holds", "Squeeze shoulder blades together and hold.", Cat.Strength, sets: 3, reps: 10, rest: 30),
                Ex(2, "Band external rotation", "Elbow at side, rotate outward against band.", Cat.Strength, sets: 3, reps: 15, rest: 30),
                Ex(3, "Scaption raises (light)", "Raise arms in the scapular plane, thumbs up.", Cat.Strength, sets: 3, reps: 12, rest: 45),
                Ex(4, "Wall slides & serratus punches", "Scapular control through range.", Cat.Mobility, sets: 3, reps: 12, rest: 45),
                Ex(6, "Overhead & throwing progression", "Gradual return to overhead / throwing load.", Cat.Strength, sets: 3, reps: 10, rest: 60),
            },
            Milestones = new() { Ms(1, "Pain-free daily motion"), Ms(3, "Full overhead range"), Ms(4, "Rotator cuff strength restored"), Ms(6, "Return to overhead sport") },
        },
        new RecoveryTemplate
        {
            Name = "Achilles Tendinopathy", BodyPart = "Achilles", EstimatedWeeks = 8,
            TypicalSeverity = InjurySeverity.Moderate,
            Description = "Tendon-loading program centred on eccentric heel drops.",
            Exercises = new()
            {
                Ex(1, "Isometric calf holds", "Mid-range calf hold to reduce pain and load the tendon.", Cat.Strength, sets: 5, min: 1, rest: 60),
                Ex(2, "Seated calf raises", "Lower-load tendon strengthening with knee bent.", Cat.Strength, sets: 3, reps: 15, rest: 45),
                Ex(3, "Eccentric heel drops (double leg)", "Slow lowering off a step. Cornerstone exercise.", Cat.Strength, sets: 3, reps: 15, rest: 60),
                Ex(5, "Eccentric heel drops (single leg)", "Progress to single-leg slow lowering.", Cat.Strength, sets: 3, reps: 12, rest: 60),
                Ex(6, "Calf & soleus mobility", "Stretching and foam rolling of the calf complex.", Cat.Flexibility, min: 8),
                Ex(8, "Hopping & running progression", "Reintroduce plyometrics and running gradually.", Cat.Cardio, sets: 4, min: 3, rest: 90),
            },
            Milestones = new() { Ms(2, "Reduced morning stiffness"), Ms(4, "Single-leg heel raise pain-free"), Ms(6, "Return to jogging"), Ms(8, "Return to running & hopping") },
        },
        new RecoveryTemplate
        {
            Name = "Calf Strain", BodyPart = "Calf", EstimatedWeeks = 3,
            TypicalSeverity = InjurySeverity.Minor,
            Description = "Gastrocnemius/soleus strain rehab back to running.",
            Exercises = new()
            {
                Ex(1, "Ankle pumps & gentle stretch", "Restore blood flow and gentle range without pain.", Cat.Mobility, sets: 3, reps: 15),
                Ex(1, "Ice after activity", "15 minutes ice to manage swelling.", Cat.Ice, min: 15),
                Ex(2, "Double-leg calf raises", "Controlled heel raises within pain-free range.", Cat.Strength, sets: 3, reps: 15, rest: 45),
                Ex(2, "Seated soleus raises", "Bent-knee heel raises to target soleus.", Cat.Strength, sets: 3, reps: 15, rest: 45),
                Ex(3, "Single-leg calf raises & jogging", "Single-leg strength then straight-line jogging.", Cat.Cardio, sets: 3, reps: 12, rest: 60),
            },
            Milestones = new() { Ms(1, "Pain-free walking"), Ms(2, "Full calf strength"), Ms(3, "Return to running") },
        },
        new RecoveryTemplate
        {
            Name = "Lower Back Strain", BodyPart = "Lower Back", EstimatedWeeks = 5,
            TypicalSeverity = InjurySeverity.Moderate,
            Description = "Lumbar strain rehab focused on core control and mobility.",
            Exercises = new()
            {
                Ex(1, "Pelvic tilts & cat-cow", "Gentle spinal mobility within comfort.", Cat.Mobility, sets: 3, reps: 10),
                Ex(2, "Dead bug", "Core control with neutral spine.", Cat.Strength, sets: 3, reps: 10, rest: 45),
                Ex(2, "Bird dog", "Contralateral limb raises for spinal stability.", Cat.Balance, sets: 3, reps: 10, rest: 45),
                Ex(3, "Glute bridges", "Strengthen the posterior chain to offload the spine.", Cat.Strength, sets: 3, reps: 12, rest: 45),
                Ex(4, "Side plank progression", "Lateral core endurance, knees then feet.", Cat.Strength, sets: 3, min: 1, rest: 60),
                Ex(5, "Hip hinge & loaded carries", "Reintroduce loaded movement with good mechanics.", Cat.Strength, sets: 3, reps: 10, rest: 60),
            },
            Milestones = new() { Ms(1, "Pain-free daily movement"), Ms(3, "Core endurance restored"), Ms(5, "Return to loaded training") },
        },
        new RecoveryTemplate
        {
            Name = "Concussion Return-to-Play", BodyPart = "Head", EstimatedWeeks = 3,
            TypicalSeverity = InjurySeverity.Moderate,
            Description = "Graduated return-to-play protocol. Advance one stage per symptom-free day.",
            Exercises = new()
            {
                Ex(1, "Relative rest", "Cognitive and physical rest until symptom-free at rest.", Cat.Rest, min: 30),
                Ex(1, "Light aerobic activity", "Walking or stationary bike at low intensity, symptom-limited.", Cat.Cardio, min: 15),
                Ex(2, "Sport-specific exercise", "Running drills, no head impact. Monitor symptoms.", Cat.Cardio, min: 20),
                Ex(2, "Non-contact training drills", "Progress to complex drills and resistance training.", Cat.Cardio, min: 30),
                Ex(3, "Full-contact practice", "Return to full training after medical clearance.", Cat.Cardio, min: 45),
            },
            Milestones = new() { Ms(1, "Symptom-free at rest"), Ms(2, "Tolerates sport-specific exercise"), Ms(3, "Medical clearance for contact") },
        },
        new RecoveryTemplate
        {
            Name = "Wrist Sprain", BodyPart = "Wrist", EstimatedWeeks = 3,
            TypicalSeverity = InjurySeverity.Minor,
            Description = "Wrist ligament sprain rehab restoring grip and stability.",
            Exercises = new()
            {
                Ex(1, "Wrist range of motion", "Gentle flexion, extension and circles.", Cat.Mobility, sets: 3, reps: 12),
                Ex(1, "Ice & compression", "Manage swelling after activity.", Cat.Ice, min: 15),
                Ex(2, "Wrist flexion/extension curls (light)", "Light dumbbell curls in both directions.", Cat.Strength, sets: 3, reps: 15, rest: 30),
                Ex(2, "Grip strengthening", "Squeeze a soft ball or putty.", Cat.Strength, sets: 3, reps: 15, rest: 30),
                Ex(3, "Weight-bearing & sport drills", "Progressive loading and return to sport-specific use.", Cat.Strength, sets: 3, reps: 12, rest: 45),
            },
            Milestones = new() { Ms(1, "Swelling controlled"), Ms(2, "Full range of motion"), Ms(3, "Grip strength & return to sport") },
        },
    };
}
