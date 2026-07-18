using FluentValidation;
using ProTracker.Dtos;

namespace ProTracker.Validation;

public static class PlayerRules
{
    // Shape rules for secondary positions (Phase 3): ≤3, distinct, never the
    // primary. Sport membership needs the DB and lives in PlayerService.
    public static IRuleBuilderOptions<T, List<int>?> SecondaryPositions<T>(
        IRuleBuilder<T, List<int>?> rule, Func<T, int> primaryPositionId) =>
        rule
            .Must(ids => ids == null || ids.Count <= 3)
            .WithMessage("At most 3 secondary positions.")
            .Must(ids => ids == null || ids.Distinct().Count() == ids.Count)
            .WithMessage("Secondary positions must be distinct.")
            .Must(ids => ids == null || ids.All(id => id > 0))
            .WithMessage("Secondary position ids must be positive.")
            .Must((dto, ids) => ids == null || !ids.Contains(primaryPositionId(dto)))
            .WithMessage("A secondary position can't duplicate the primary position.");
}

public class PlayerCreateDtoValidator : AbstractValidator<PlayerCreateDto>
{
    public PlayerCreateDtoValidator()
    {
        RuleFor(x => x.FullName).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Age).GreaterThan(0).LessThan(100);
        RuleFor(x => x.Height).GreaterThan(0);
        RuleFor(x => x.Weight).GreaterThan(0);
        RuleFor(x => x.TeamId).GreaterThan(0);
        RuleFor(x => x.PositionId).GreaterThan(0);
        // Null = not recorded (honest state); validated only when present.
        RuleFor(x => x.FitnessLevel).InclusiveBetween(1, 10);
        PlayerRules.SecondaryPositions(RuleFor(x => x.SecondaryPositionIds), x => x.PositionId);
    }
}

public class PlayerUpdateDtoValidator : AbstractValidator<PlayerUpdateDto>
{
    public PlayerUpdateDtoValidator()
    {
        RuleFor(x => x.FullName).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Age).GreaterThan(0).LessThan(100);
        RuleFor(x => x.Height).GreaterThan(0);
        RuleFor(x => x.Weight).GreaterThan(0);
        RuleFor(x => x.PositionId).GreaterThan(0);
        RuleFor(x => x.FitnessLevel).InclusiveBetween(1, 10);
        PlayerRules.SecondaryPositions(RuleFor(x => x.SecondaryPositionIds), x => x.PositionId);
    }
}
