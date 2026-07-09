using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProTracker.Services;

namespace ProTracker.Controllers.Api;

// Reference data. The sport list is public (the coach marketplace + landing page need it
// without a login); the rest requires auth via the base controller's [Authorize].
public class SportsController : ApiControllerBase
{
    private readonly ISportService _sportService;

    public SportsController(ISportService sportService)
    {
        _sportService = sportService;
    }

    [HttpGet]
    [AllowAnonymous]
    public async Task<ActionResult> GetAll() => Success(await _sportService.GetAllAsync());

    [HttpGet("{id}")]
    public async Task<ActionResult> GetById(int id) => Success(await _sportService.GetByIdAsync(id));

    [HttpGet("{id}/positions")]
    public async Task<ActionResult> GetPositions(int id) => Success(await _sportService.GetPositionsAsync(id));

    [HttpGet("{id}/stat-categories")]
    public async Task<ActionResult> GetStatCategories(int id) => Success(await _sportService.GetStatCategoriesAsync(id));
}
