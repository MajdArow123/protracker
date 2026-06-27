using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProTracker.Dtos;
using ProTracker.Services;

namespace ProTracker.Controllers.Api;

[Route("api/assessment-periods")]
public class AssessmentPeriodsController : ApiControllerBase
{
    private readonly IAssessmentService _assessmentService;

    public AssessmentPeriodsController(IAssessmentService assessmentService)
    {
        _assessmentService = assessmentService;
    }

    [HttpGet]
    public async Task<ActionResult> GetAll() => Success(await _assessmentService.GetAccessiblePeriodsAsync(User));

    [HttpGet("{id}")]
    public async Task<ActionResult> GetById(int id) => Success(await _assessmentService.GetPeriodByIdAsync(User, id));

    [HttpPost]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> Create(CreateAssessmentPeriodDto dto) => Created(await _assessmentService.CreatePeriodAsync(User, dto));

    [HttpPut("{id}")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> Update(int id, CreateAssessmentPeriodDto dto) => Success(await _assessmentService.UpdatePeriodAsync(User, id, dto));

    [HttpDelete("{id}")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> Delete(int id)
    {
        await _assessmentService.DeletePeriodAsync(User, id);
        return NoContentSuccess();
    }
}
