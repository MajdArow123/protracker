using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProTracker.Services;

namespace ProTracker.Controllers.Api;

// Phase 10 S7: retroactive season stamping. Owner-only (a caller owning zero seasons
// gets the uniform season 404 from the service; athletes/parents stop at the role
// gate). Preview is a genuine dry run — it writes nothing.
[Route("api")]
[Authorize(Roles = "Coach,Admin")]
public class SeasonBackfillController : ApiControllerBase
{
    private readonly ISeasonBackfillService _service;

    public SeasonBackfillController(ISeasonBackfillService service)
    {
        _service = service;
    }

    [HttpPost("seasons/backfill/preview")]
    public async Task<ActionResult> Preview() => Success(await _service.PreviewAsync(User));

    [HttpPost("seasons/backfill/execute")]
    public async Task<ActionResult> Execute() => Success(await _service.ExecuteAsync(User));
}
