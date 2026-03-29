using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProTracker.Data;
using ProTracker.Models;
using TaskStatus = ProTracker.Models.TaskStatus;

namespace ProTracker.Controllers;

[Authorize]
public class TaskItemsController : Controller
{
    private readonly ApplicationDbContext _context;

    public TaskItemsController(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<IActionResult> Index(int trainingPlanId)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var planExists = await _context.TrainingPlans.AnyAsync(p => p.TrainingPlanId == trainingPlanId && p.CoachId == userId);
        if (!planExists) return NotFound();

        var tasks = await _context.TaskItems
            .Where(t => t.TrainingPlanId == trainingPlanId)
            .OrderBy(t => t.DueDate)
            .ToListAsync();

        ViewBag.TrainingPlanId = trainingPlanId;
        return View(tasks);
    }

    public IActionResult Create(int trainingPlanId)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var planExists = _context.TrainingPlans.Any(p => p.TrainingPlanId == trainingPlanId && p.CoachId == userId);
        if (!planExists) return NotFound();

        ViewBag.TrainingPlanId = trainingPlanId;
        return View(new TaskItem { TrainingPlanId = trainingPlanId });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(TaskItem taskItem)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var planExists = await _context.TrainingPlans.AnyAsync(p => p.TrainingPlanId == taskItem.TrainingPlanId && p.CoachId == userId);
        if (!planExists) return NotFound();

        ModelState.Remove(nameof(TaskItem.TrainingPlan));

        if (!ModelState.IsValid)
        {
            ViewBag.TrainingPlanId = taskItem.TrainingPlanId;
            return View(taskItem);
        }

        _context.TaskItems.Add(taskItem);
        await _context.SaveChangesAsync();
        return RedirectToAction(nameof(Index), new { trainingPlanId = taskItem.TrainingPlanId });
    }

    [HttpPost]
[ValidateAntiForgeryToken]
public async Task<IActionResult> ToggleStatus(int id)
{
    var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

    var task = await _context.TaskItems
        .Include(t => t.TrainingPlan)
        .FirstOrDefaultAsync(t => t.TaskItemId == id);

    if (task == null) return NotFound();

    // Make sure only the coach of this plan can toggle
    if (task.TrainingPlan.CoachId != userId) return Forbid();

    // Cycle through statuses: NotStarted → InProgress → Completed → NotStarted
    task.Status = task.Status switch
    {
        TaskStatus.NotStarted => TaskStatus.InProgress,
        TaskStatus.InProgress => TaskStatus.Completed,
        TaskStatus.Completed => TaskStatus.NotStarted,
        _ => TaskStatus.NotStarted
    };

    await _context.SaveChangesAsync();
    return RedirectToAction(nameof(Index), new { trainingPlanId = task.TrainingPlanId });
}
}