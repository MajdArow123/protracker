using FluentValidation;
using ProTracker.Dtos;

namespace ProTracker.Validation;

public class TeamCreateDtoValidator : AbstractValidator<TeamCreateDto>
{
    public TeamCreateDtoValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.SportId).GreaterThan(0);
    }
}

public class TeamUpdateDtoValidator : AbstractValidator<TeamUpdateDto>
{
    public TeamUpdateDtoValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
    }
}
