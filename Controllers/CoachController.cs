using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProTracker.Data;
using ProTracker.Models;
using TaskStatus = ProTracker.Models.TaskStatus;

namespace ProTracker.Controllers;

[Authorize(Roles = "Coach")]
public class CoachController : Controller
{
    private readonly ApplicationDbContext _context;
    private readonly UserManager<ApplicationUser> _userManager;

    public CoachController(ApplicationDbContext context, UserManager<ApplicationUser> userManager)
    {
        _context = context;
        _userManager = userManager;
    }

    public async Task<IActionResult> AthleteProgress(string athleteId)
    {
        var coachId = User.FindFirstValue(ClaimTypes.NameIdentifier);

        var plans = await _context.TrainingPlans
            .Where(p => p.AthleteId == athleteId && p.CoachId == coachId)
            .Include(p => p.Tasks)
            .OrderBy(p => p.StartDate)
            .ToListAsync();

        if (!plans.Any())
            return NotFound();

        var athlete = await _userManager.FindByIdAsync(athleteId) as ApplicationUser;
        var athleteName = !string.IsNullOrEmpty(athlete?.DisplayName)
            ? athlete.DisplayName
            : athlete?.Email?.Split("@")[0] ?? "Unknown";

        ViewBag.AthleteName = athleteName;
        ViewBag.AthleteId = athleteId;

        return View(plans);
    }
}