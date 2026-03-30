using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProTracker.Data;

namespace ProTracker.Controllers
{
    [Authorize]
    public class DashboardController : Controller
    {
        private readonly ApplicationDbContext _context;
        private readonly UserManager<IdentityUser> _userManager;

        public DashboardController(ApplicationDbContext context, UserManager<IdentityUser> userManager)
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
public async Task<IActionResult> Index()
{
    var user = await _userManager.GetUserAsync(User);
    if (user != null && await _userManager.IsInRoleAsync(user, "Coach"))
        return RedirectToAction("CoachDashboard");
    else
        return RedirectToAction("AthleteDashboard");
}
    }
}