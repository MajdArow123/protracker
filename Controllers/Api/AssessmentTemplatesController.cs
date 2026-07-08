using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProTracker.Dtos;
using ProTracker.Services;

namespace ProTracker.Controllers.Api;

// Reusable, sport-specific assessment templates owned by a coach.
[Route("api/assessment-templates")]
[Authorize(Roles = "Coach,Admin")]
public class AssessmentTemplatesController : ApiControllerBase
{
    private readonly IAssessmentTemplateService _service;

    public AssessmentTemplatesController(IAssessmentTemplateService service)
    {
        _service = service;
    }

    [HttpGet]
    public async Task<ActionResult> List([FromQuery] int? sport) => Success(await _service.ListAsync(User, sport));

    [HttpPost]
    public async Task<ActionResult> Create(CreateAssessmentTemplateDto dto) => Created(await _service.CreateAsync(User, dto));

    [HttpPut("{id}")]
    public async Task<ActionResult> Update(int id, CreateAssessmentTemplateDto dto) => Success(await _service.UpdateAsync(User, id, dto));

    [HttpDelete("{id}")]
    public async Task<ActionResult> Delete(int id)
    {
        await _service.DeleteAsync(User, id);
        return NoContentSuccess();
    }

    // Pre-fill an assessment form for a player using this template's defaults.
    [HttpPost("{id}/apply/{playerId}")]
    public async Task<ActionResult> Apply(int id, int playerId) => Success(await _service.ApplyAsync(User, id, playerId));
}
