using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProTracker.Dtos;
using ProTracker.Services;

namespace ProTracker.Controllers.Api;

public class PlayersController : ApiControllerBase
{
    private readonly IPlayerService _playerService;
    private readonly IAssessmentService _assessmentService;
    private readonly IImprovementPlanService _improvementPlanService;
    private readonly INutritionGuidanceService _nutritionGuidanceService;
    private readonly INutritionProfileService _nutritionProfileService;

    public PlayersController(
        IPlayerService playerService,
        IAssessmentService assessmentService,
        IImprovementPlanService improvementPlanService,
        INutritionGuidanceService nutritionGuidanceService,
        INutritionProfileService nutritionProfileService)
    {
        _playerService = playerService;
        _assessmentService = assessmentService;
        _improvementPlanService = improvementPlanService;
        _nutritionGuidanceService = nutritionGuidanceService;
        _nutritionProfileService = nutritionProfileService;
    }

    [HttpGet]
    public async Task<ActionResult> GetAll() => Success(await _playerService.GetAccessiblePlayersAsync(User));

    /// <summary>Resolves the logged-in athlete's own player record without iterating teammates.</summary>
    [HttpGet("me")]
    [Authorize(Roles = "Athlete,Admin")]
    public async Task<ActionResult> GetMe() => Success(await _playerService.GetMyPlayerAsync(User));

    [HttpGet("{id:int}")]
    public async Task<ActionResult> GetById(int id) => Success(await _playerService.GetByIdAsync(User, id));

    [HttpPost]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> Create(PlayerCreateDto dto) => Created(await _playerService.CreateAsync(User, dto));

    [HttpPut("{id}")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> Update(int id, PlayerUpdateDto dto) => Success(await _playerService.UpdateAsync(User, id, dto));

    [HttpDelete("{id}")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> Delete(int id)
    {
        await _playerService.DeleteAsync(User, id);
        return NoContentSuccess();
    }

    [HttpGet("{id}/assessments")]
    public async Task<ActionResult> GetAssessments(int id) => Success(await _assessmentService.GetAssessmentsForPlayerAsync(User, id));

    [HttpGet("{id}/improvement-plan")]
    public async Task<ActionResult> GetImprovementPlan(int id) => Success(await _improvementPlanService.GetForPlayerAsync(User, id));

    [HttpGet("{id}/nutrition-guidance")]
    public async Task<ActionResult> GetNutritionGuidance(int id) => Success(await _nutritionGuidanceService.GetForPlayerAsync(User, id));

    [HttpGet("{id}/nutrition-profile")]
    public async Task<ActionResult> GetNutritionProfile(int id) => Success(await _nutritionProfileService.GetForPlayerAsync(User, id));

    [HttpPut("{id}/nutrition-profile")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> ReplaceNutritionProfile(int id, List<CreateNutritionProfileItemDto> items)
    {
        // Bulk replace: clear existing items for the player, then add the new set.
        var existing = await _nutritionProfileService.GetForPlayerAsync(User, id);
        foreach (var item in existing)
            await _nutritionProfileService.DeleteAsync(User, id, item.Id);

        var created = new List<NutritionProfileItemDto>();
        foreach (var item in items)
            created.Add(await _nutritionProfileService.CreateAsync(User, id, item));

        return Success(created);
    }
}
