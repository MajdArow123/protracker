using System.Security.Claims;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProTracker.Data;
using ProTracker.Models;

namespace ProTracker.Controllers;

[Authorize]
public class TrainingPlansController : Controller
{
    private readonly ApplicationDbContext _context;

    public TrainingPlansController(ApplicationDbContext context)
    {
        _context = context;
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

    public IActionResult Create()
{
    var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

    var athletes = _context.Users
        .Where(u => u.Id != userId)
        .Select(u => new SelectListItem
        {
            Value = u.Id,
            Text = u.Email
        })
        .ToList();

    ViewBag.Athletes = athletes;

    return View();
}

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(TrainingPlan trainingPlan)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        trainingPlan.CoachId = userId!;
        ModelState.Remove(nameof(TrainingPlan.CoachId));

        if (!ModelState.IsValid)
        {
            return View(trainingPlan);
        }

        _context.TrainingPlans.Add(trainingPlan);
        await _context.SaveChangesAsync();

        return RedirectToAction(nameof(Index));
    }
}