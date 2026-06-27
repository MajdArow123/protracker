using FluentValidation;
using ProTracker.Dtos;

namespace ProTracker.Validation;

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
        RuleFor(x => x.FitnessLevel).InclusiveBetween(1, 10);
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
    }
}
