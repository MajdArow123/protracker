using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProTracker.Dtos;
using ProTracker.Services;

namespace ProTracker.Controllers.Api;

[Route("api/player-assessments")]
public class PlayerAssessmentsController : ApiControllerBase
{
    private readonly IAssessmentService _assessmentService;

    public PlayerAssessmentsController(IAssessmentService assessmentService)
    {
        _assessmentService = assessmentService;
    }

    [HttpGet]
    public async Task<ActionResult> GetAll([FromQuery] int? seasonId = null) => Success(await _assessmentService.GetAccessibleAssessmentsAsync(User, seasonId));

    [HttpGet("{id}")]
    public async Task<ActionResult> GetById(int id) => Success(await _assessmentService.GetAssessmentByIdAsync(User, id));

    [HttpPost]
    [Authorize(Roles = "Coach,Admin,SoloAthlete")]
    public async Task<ActionResult> Create(CreatePlayerAssessmentDto dto) => Created(await _assessmentService.CreateAssessmentAsync(User, dto));

    // Bulk "assess full team": creates assessments for many players in one transaction.
    [HttpPost("bulk")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> BulkCreate(BulkCreateAssessmentDto dto) => Created(await _assessmentService.BulkCreateAssessmentsAsync(User, dto));

    [HttpPut("{id}")]
    [Authorize(Roles = "Coach,Admin,SoloAthlete")]
    public async Task<ActionResult> Update(int id, CreatePlayerAssessmentDto dto) => Success(await _assessmentService.UpdateAssessmentAsync(User, id, dto));

    [HttpDelete("{id}")]
    [Authorize(Roles = "Coach,Admin,SoloAthlete")]
    public async Task<ActionResult> Delete(int id)
    {
        await _assessmentService.DeleteAssessmentAsync(User, id);
        return NoContentSuccess();
    }

    [HttpGet("player/{playerId}")]
    public async Task<ActionResult> GetForPlayer(int playerId, [FromQuery] int? seasonId = null) => Success(await _assessmentService.GetAssessmentsForPlayerAsync(User, playerId, seasonId));
}
