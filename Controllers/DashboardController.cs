using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProTracker.Data;
using ProTracker.Models;

namespace ProTracker.Controllers
{
    [Authorize]
    public class DashboardController : Controller
    {
        private readonly ApplicationDbContext _context;
        private readonly UserManager<ApplicationUser> _userManager;

        public DashboardController(ApplicationDbContext context, UserManager<ApplicationUser> userManager)
        {
            _context = context;
            _userManager = userManager;
        }

        [Authorize(Roles = "Coach")]
        public async Task<IActionResult> CoachDashboard()
        {
            var userId = _userManager.GetUserId(User);

            var plans = await _context.TrainingPlans
                .Where(p => p.CoachId == userId)
                .Include(p => p.Tasks)
                .ToListAsync();

            var athleteIds = plans.Select(p => p.AthleteId).Distinct().ToList();
            var athleteNames = new Dictionary<string, string>();
            foreach (var id in athleteIds)
            {
                var athlete = await _userManager.FindByIdAsync(id) as ApplicationUser;
                var name = !string.IsNullOrEmpty(athlete?.DisplayName)
                    ? athlete.DisplayName
                    : athlete?.Email?.Split("@")[0] ?? "Unknown";
                athleteNames[id] = name;
            }

            ViewBag.AthleteNames = athleteNames;
            return View(plans);
        }

        [Authorize(Roles = "Athlete")]
        public async Task<IActionResult> AthleteDashboard()
        {
            var userId = _userManager.GetUserId(User);

            var plans = await _context.TrainingPlans
                .Where(p => p.AthleteId == userId)
                .Include(p => p.Tasks)
                .ToListAsync();

            return View(plans);
        }

        [Authorize]
        public IActionResult Index()
        {
            return RedirectToAction("Dashboard", "Home");
        }
    }
}