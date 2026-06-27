using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProTracker.Dtos;
using ProTracker.Services;

namespace ProTracker.Controllers.Api;

[Route("api/stat-scores")]
public class PlayerStatScoresController : ApiControllerBase
{
    private readonly IStatScoreService _statScoreService;

    public PlayerStatScoresController(IStatScoreService statScoreService)
    {
        _statScoreService = statScoreService;
    }

    [HttpGet("assessment/{assessmentId}")]
    public async Task<ActionResult> GetForAssessment(int assessmentId) => Success(await _statScoreService.GetForAssessmentAsync(User, assessmentId));

    [HttpPost]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> Create(CreatePlayerStatScoreDto dto) => Created(await _statScoreService.CreateAsync(User, dto));

    [HttpPut("{id}")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> Update(int id, CreatePlayerStatScoreDto dto) => Success(await _statScoreService.UpdateAsync(User, id, dto));
}
