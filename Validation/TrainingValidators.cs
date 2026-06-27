using FluentValidation;
using ProTracker.Dtos;

namespace ProTracker.Validation;

public class CreateTrainingSessionDtoValidator : AbstractValidator<CreateTrainingSessionDto>
{
    public CreateTrainingSessionDtoValidator()
    {
        RuleFor(x => x.PlayerId).GreaterThan(0);
        RuleFor(x => x.TeamId).GreaterThan(0);
        RuleFor(x => x.DurationMinutes).GreaterThan(0);
        RuleFor(x => x.AttendanceStatus).IsInEnum();
    }
}

public class CreateMatchPerformanceDtoValidator : AbstractValidator<CreateMatchPerformanceDto>
{
    public CreateMatchPerformanceDtoValidator()
    {
        RuleFor(x => x.PlayerId).GreaterThan(0);
        RuleFor(x => x.Opponent).NotEmpty().MaximumLength(200);
        RuleFor(x => x.PerformanceRating).InclusiveBetween(1, 10);
    }
}

public class CreateInjuryRecordDtoValidator : AbstractValidator<CreateInjuryRecordDto>
{
    public CreateInjuryRecordDtoValidator()
    {
        RuleFor(x => x.PlayerId).GreaterThan(0);
        RuleFor(x => x.InjuryType).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Severity).IsInEnum();
        RuleFor(x => x.RecoveryStatus).IsInEnum();
        RuleFor(x => x.ExpectedReturnDate)
            .GreaterThanOrEqualTo(x => x.InjuryDate)
            .When(x => x.ExpectedReturnDate.HasValue)
            .WithMessage("ExpectedReturnDate must be on or after InjuryDate.");
    }
}

public class CreateImprovementPlanDtoValidator : AbstractValidator<CreateImprovementPlanDto>
{
    public CreateImprovementPlanDtoValidator()
    {
        RuleFor(x => x.PlayerId).GreaterThan(0);
    }
}
