using FluentValidation;
using ProTracker.Dtos;

namespace ProTracker.Validation;

public class CreateAssessmentPeriodDtoValidator : AbstractValidator<CreateAssessmentPeriodDto>
{
    public CreateAssessmentPeriodDtoValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
        RuleFor(x => x.TeamId).GreaterThan(0);
        RuleFor(x => x.EndDate).GreaterThanOrEqualTo(x => x.StartDate)
            .WithMessage("EndDate must be on or after StartDate.");
    }
}

public class CreatePlayerAssessmentDtoValidator : AbstractValidator<CreatePlayerAssessmentDto>
{
    public CreatePlayerAssessmentDtoValidator()
    {
        RuleFor(x => x.PlayerId).GreaterThan(0);
        RuleFor(x => x.AssessmentPeriodId).GreaterThan(0);
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
