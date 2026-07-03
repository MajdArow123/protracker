using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProTracker.Dtos;
using ProTracker.Services;

namespace ProTracker.Controllers.Api;

[Route("api")]
public class RecoveryPlansController : ApiControllerBase
{
    private readonly IRecoveryPlanService _service;

    public RecoveryPlansController(IRecoveryPlanService service)
    {
        _service = service;
    }

    // Built-in recovery templates (reference data) — any authenticated coach/athlete can list.
    [HttpGet("recovery-templates")]
    public async Task<ActionResult> GetTemplates() => Success(await _service.GetTemplatesAsync());

    [HttpPost("injuries/{injuryId}/recovery-plan/from-template/{templateId}")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> ApplyTemplate(int injuryId, int templateId)
        => Success(await _service.ApplyTemplateAsync(User, injuryId, templateId));

    [HttpGet("injuries/{injuryId}/recovery-plan")]
    public async Task<ActionResult> GetForInjury(int injuryId) => Success(await _service.GetForInjuryAsync(User, injuryId));

    [HttpGet("players/{playerId}/recovery-plan")]
    public async Task<ActionResult> GetActiveForPlayer(int playerId) => Success(await _service.GetActiveForPlayerAsync(User, playerId));

    [HttpPost("injuries/{injuryId}/recovery-plan")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> Create(int injuryId, CreateRecoveryPlanDto dto) => Created(await _service.CreateAsync(User, injuryId, dto));

    [HttpPut("recovery-plans/{id}")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> Update(int id, UpdateRecoveryPlanDto dto) => Success(await _service.UpdateAsync(User, id, dto));

    [HttpPost("recovery-plans/{id}/exercises")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> AddExercise(int id, CreateRecoveryExerciseDto dto) => Created(await _service.AddExerciseAsync(User, id, dto));

    [HttpPut("recovery-exercises/{id}")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> UpdateExercise(int id, CreateRecoveryExerciseDto dto) => Success(await _service.UpdateExerciseAsync(User, id, dto));

    [HttpDelete("recovery-exercises/{id}")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> DeleteExercise(int id) => Success(await _service.DeleteExerciseAsync(User, id));

    // Athletes (own) and coaches may mark exercises complete.
    [HttpPatch("recovery-exercises/{id}/complete")]
    public async Task<ActionResult> CompleteExercise(int id, CompleteRecoveryExerciseDto dto) => Success(await _service.CompleteExerciseAsync(User, id, dto));

    [HttpPost("recovery-plans/{id}/milestones")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> AddMilestone(int id, CreateRecoveryMilestoneDto dto) => Created(await _service.AddMilestoneAsync(User, id, dto));

    [HttpPatch("recovery-milestones/{id}/achieve")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> AchieveMilestone(int id, AchieveMilestoneDto dto) => Success(await _service.AchieveMilestoneAsync(User, id, dto));
}
