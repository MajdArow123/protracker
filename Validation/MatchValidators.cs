using FluentValidation;
using ProTracker.Dtos;

namespace ProTracker.Validation;

public class CreateMatchResultDtoValidator : AbstractValidator<CreateMatchResultDto>
{
    public CreateMatchResultDtoValidator()
    {
        RuleFor(x => x.OpponentName).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Status).IsInEnum();
        RuleFor(x => x.HomeScore).GreaterThanOrEqualTo(0);
        RuleFor(x => x.AwayScore).GreaterThanOrEqualTo(0);
        RuleFor(x => x.SetScores).MaximumLength(200);
        RuleFor(x => x.Venue).MaximumLength(200);
        RuleFor(x => x.Competition).MaximumLength(200);
        RuleFor(x => x.Notes).MaximumLength(2000);
        RuleFor(x => x.OpponentFormation).MaximumLength(20);
        RuleFor(x => x.ScoutingNotes).MaximumLength(2000);
        RuleFor(x => x.PersonalRating).InclusiveBetween(1, 10).When(x => x.PersonalRating.HasValue);
    }
}
