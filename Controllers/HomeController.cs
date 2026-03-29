using System.Diagnostics;
using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProTracker.Data;
using ProTracker.Models;

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
        if (User.Identity != null && User.Identity.IsAuthenticated)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

            var assignedPlans = await _context.TrainingPlans
                .Where(p => p.AthleteId == userId)
                .OrderBy(p => p.StartDate)
                .ToListAsync();

            ViewBag.AssignedPlans = assignedPlans;
        }

        return View();
    }

    public IActionResult Privacy()
    {
        return View();
    }

    [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
    public IActionResult Error()
    {
        return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
    }
}