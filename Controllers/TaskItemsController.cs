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
        return RedirectToAction("Details", "TrainingPlans", new { id = taskItem.TrainingPlanId });
    }

    [Authorize(Roles = "Coach")]
    public async Task<IActionResult> Edit(int id)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var task = await _context.TaskItems
            .Include(t => t.TrainingPlan)
            .FirstOrDefaultAsync(t => t.TaskItemId == id && t.TrainingPlan.CoachId == userId);

        if (task == null) return NotFound();
        return View(task);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    [Authorize(Roles = "Coach")]
    public async Task<IActionResult> Edit(int id, TaskItem taskItem)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        ModelState.Remove(nameof(TaskItem.TrainingPlan));

        if (!ModelState.IsValid)
            return View(taskItem);

        var existing = await _context.TaskItems
            .Include(t => t.TrainingPlan)
            .FirstOrDefaultAsync(t => t.TaskItemId == id && t.TrainingPlan.CoachId == userId);

        if (existing == null) return NotFound();

        existing.Title = taskItem.Title;
        existing.Description = taskItem.Description;
        existing.Status = taskItem.Status;
        existing.DueDate = taskItem.DueDate;

        await _context.SaveChangesAsync();
        return RedirectToAction("Details", "TrainingPlans", new { id = existing.TrainingPlanId });
    }

    [Authorize(Roles = "Coach")]
    public async Task<IActionResult> Delete(int id)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var task = await _context.TaskItems
            .Include(t => t.TrainingPlan)
            .FirstOrDefaultAsync(t => t.TaskItemId == id && t.TrainingPlan.CoachId == userId);

        if (task == null) return NotFound();
        return View(task);
    }

    [HttpPost, ActionName("Delete")]
    [ValidateAntiForgeryToken]
    [Authorize(Roles = "Coach")]
    public async Task<IActionResult> DeleteConfirmed(int id)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var task = await _context.TaskItems
            .Include(t => t.TrainingPlan)
            .FirstOrDefaultAsync(t => t.TaskItemId == id && t.TrainingPlan.CoachId == userId);

        if (task != null)
        {
            var planId = task.TrainingPlanId;
            _context.TaskItems.Remove(task);
            await _context.SaveChangesAsync();
            return RedirectToAction("Details", "TrainingPlans", new { id = planId });
        }

        return RedirectToAction("CoachDashboard", "Dashboard");
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

        // Allow both coach and athlete to toggle
        if (task.TrainingPlan.CoachId != userId && task.TrainingPlan.AthleteId != userId)
            return Forbid();

        task.Status = task.Status switch
        {
            TaskStatus.NotStarted => TaskStatus.InProgress,
            TaskStatus.InProgress => TaskStatus.Completed,
            TaskStatus.Completed => TaskStatus.NotStarted,
            _ => TaskStatus.NotStarted
        };

        await _context.SaveChangesAsync();
        return RedirectToAction("Details", "TrainingPlans", new { id = task.TrainingPlanId });
    }
}