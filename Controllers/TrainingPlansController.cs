using System.Security.Claims;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProTracker.Data;
using ProTracker.Models;

namespace ProTracker.Controllers;

[Authorize]
public class TrainingPlansController : Controller
{
    private readonly ApplicationDbContext _context;
    private readonly UserManager<IdentityUser> _userManager;

    public TrainingPlansController(ApplicationDbContext context, UserManager<IdentityUser> userManager)
    {
        _context = context;
        _userManager = userManager;
    }

    public async Task<IActionResult> Index()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var plans = await _context.TrainingPlans
            .Where(p => p.CoachId == userId)
            .Include(p => p.Tasks)
            .ToListAsync();
        return View(plans);
    }

    public async Task<IActionResult> Details(int id)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

        var plan = await _context.TrainingPlans
            .Include(p => p.Tasks)
            .FirstOrDefaultAsync(p => p.TrainingPlanId == id &&
                (p.CoachId == userId || p.AthleteId == userId));

        if (plan == null)
            return NotFound();

        return View(plan);
    }

    [Authorize(Roles = "Coach")]
    public async Task<IActionResult> Create()
    {
        var athletes = await _userManager.GetUsersInRoleAsync("Athlete");
        ViewBag.Athletes = athletes.Select(a => new SelectListItem
        {
            Value = a.Id,
            Text = a.Email
        }).ToList();
        return View();
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    [Authorize(Roles = "Coach")]
    public async Task<IActionResult> Create(TrainingPlan trainingPlan)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        trainingPlan.CoachId = userId!;
        ModelState.Remove(nameof(TrainingPlan.CoachId));

        if (!ModelState.IsValid)
        {
            var athletes = await _userManager.GetUsersInRoleAsync("Athlete");
            ViewBag.Athletes = athletes.Select(a => new SelectListItem
            {
                Value = a.Id,
                Text = a.Email
            }).ToList();
            return View(trainingPlan);
        }

        _context.TrainingPlans.Add(trainingPlan);
        await _context.SaveChangesAsync();

        return RedirectToAction("CoachDashboard", "Dashboard");
    }
}