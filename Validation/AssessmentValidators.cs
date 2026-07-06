using FluentValidation;
using ProTracker.Dtos;

namespace ProTracker.Validation;

public class CreateAssessmentPeriodDtoValidator : AbstractValidator<CreateAssessmentPeriodDto>
{
    public CreateAssessmentPeriodDtoValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
        // Null TeamId = a solo athlete's personal period (ownership enforced in the service).
        RuleFor(x => x.TeamId).GreaterThan(0).When(x => x.TeamId.HasValue);
        RuleFor(x => x.EndDate).GreaterThanOrEqualTo(x => x.StartDate)
            .WithMessage("EndDate must be on or after StartDate.");
    }
}

public class CreatePlayerAssessmentDtoValidator : AbstractValidator<CreatePlayerAssessmentDto>
{
    public CreatePlayerAssessmentDtoValidator()
    {
        RuleFor(x => x.PlayerId).GreaterThan(0);
        // 0 = solo athlete's auto-created personal period (rejected for coaches in the service).
        RuleFor(x => x.AssessmentPeriodId).GreaterThanOrEqualTo(0);
        RuleFor(x => x.DateRecorded).NotEqual(default(DateTime))
            .WithMessage("DateRecorded must be a valid date.");
        RuleForEach(x => x.StatScores).SetValidator(new CreatePlayerStatScoreDtoValidator());
    }
}

public class CreatePlayerStatScoreDtoValidator : AbstractValidator<CreatePlayerStatScoreDto>
{
    public CreatePlayerStatScoreDtoValidator()
    {
        RuleFor(x => x.PlayerAssessmentId).GreaterThanOrEqualTo(0);
        RuleFor(x => x.SportStatCategoryId).GreaterThan(0);
        RuleFor(x => x.Score).InclusiveBetween(1, 10)
            .WithMessage("Score must be between 1 and 10.");
    }
}
