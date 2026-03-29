using System.Diagnostics;
using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProTracker.Data;
using ProTracker.Models;
using TaskStatus = ProTracker.Models.TaskStatus;

namespace ProTracker.Controllers;

public class HomeController : Controller
{
    private readonly ILogger<HomeController> _logger;
    private readonly ApplicationDbContext _context;

    public HomeController(ILogger<HomeController> logger, ApplicationDbContext context)
    {
        _logger = logger;
        _context = context;
    }

    public async Task<IActionResult> Index()
    {
        if (User.Identity == null || !User.Identity.IsAuthenticated)
            return View(); // logged-out landing page

        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

        // ✅ Route to the right dashboard based on role
        if (User.IsInRole("Coach"))
            return await CoachDashboard(userId!);

        if (User.IsInRole("Athlete"))
            return await AthleteDashboard(userId!);

        // Fallback: user registered but has no role yet
        return View();
    }

    private async Task<IActionResult> CoachDashboard(string coachId)
    {
        // All plans this coach created, including tasks and athlete info
        var myPlans = await _context.TrainingPlans
            .Where(p => p.CoachId == coachId)
            .Include(p => p.Tasks)
            .OrderBy(p => p.StartDate)
            .ToListAsync();

        // Unique athletes this coach has assigned plans to
        var athleteIds = myPlans.Select(p => p.AthleteId).Distinct().ToList();

        // Per-athlete summary: name + their plans + completion %
        var athleteSummaries = new List<AthleteSummary>();
        foreach (var athleteId in athleteIds)
        {
            var athletePlans = myPlans.Where(p => p.AthleteId == athleteId).ToList();
            var allTasks = athletePlans.SelectMany(p => p.Tasks).ToList();
            var completedCount = allTasks.Count(t => t.Status == TaskStatus.Completed);
            var percent = allTasks.Count > 0 ? (int)((double)completedCount / allTasks.Count * 100) : 0;

            // Try to get the athlete's username from Identity
            var user = await _context.Users.FindAsync(athleteId);

            athleteSummaries.Add(new AthleteSummary
            {
                AthleteId = athleteId,
                AthleteName = user?.UserName ?? "Unknown Athlete",
                TotalPlans = athletePlans.Count,
                CompletedTasks = completedCount,
                TotalTasks = allTasks.Count,
                CompletionPercent = percent
            });
        }

        ViewBag.TotalPlans = myPlans.Count;
        ViewBag.TotalAthletes = athleteIds.Count;
        ViewBag.CompletedTasks = myPlans.SelectMany(p => p.Tasks).Count(t => t.Status == TaskStatus.Completed);
        ViewBag.AthleteSummaries = athleteSummaries;
        ViewBag.RecentPlans = myPlans.OrderByDescending(p => p.StartDate).Take(5).ToList();

        return View("CoachDashboard");
    }

    private async Task<IActionResult> AthleteDashboard(string athleteId)
    {
        // All plans assigned to this athlete, with tasks
        var myPlans = await _context.TrainingPlans
            .Where(p => p.AthleteId == athleteId)
            .Include(p => p.Tasks)
            .OrderBy(p => p.StartDate)
            .ToListAsync();

        var allTasks = myPlans.SelectMany(p => p.Tasks).ToList();
        var completedTasks = allTasks.Count(t => t.Status == TaskStatus.Completed);
        var inProgressTasks = allTasks.Count(t => t.Status == TaskStatus.InProgress);
        var overallPercent = allTasks.Count > 0
            ? (int)((double)completedTasks / allTasks.Count * 100)
            : 0;

        // Active plan = any plan with at least one InProgress or NotStarted task
        var activePlan = myPlans.FirstOrDefault(p =>
            p.Tasks.Any(t => t.Status != TaskStatus.Completed));

        ViewBag.MyPlans = myPlans;
        ViewBag.TotalPlans = myPlans.Count;
        ViewBag.CompletedTasks = completedTasks;
        ViewBag.InProgressTasks = inProgressTasks;
        ViewBag.TotalTasks = allTasks.Count;
        ViewBag.OverallPercent = overallPercent;
        ViewBag.ActivePlan = activePlan;

        return View("AthleteDashboard");
    }

    public IActionResult Privacy() => View();

    [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
    public IActionResult Error() =>
        View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
}

// ✅ ViewModel for coach's per-athlete summary row
public class AthleteSummary
{
    public string AthleteId { get; set; } = "";
    public string AthleteName { get; set; } = "";
    public int TotalPlans { get; set; }
    public int CompletedTasks { get; set; }
    public int TotalTasks { get; set; }
    public int CompletionPercent { get; set; }
}
