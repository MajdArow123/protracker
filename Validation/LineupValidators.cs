using FluentValidation;
using ProTracker.Dtos;

namespace ProTracker.Validation;

public class SaveLineupDtoValidator : AbstractValidator<SaveLineupDto>
{
    public SaveLineupDtoValidator()
    {
        RuleFor(x => x.MatchResultId).GreaterThan(0).When(x => x.MatchResultId.HasValue);
        RuleFor(x => x.Formation).NotEmpty().MaximumLength(16);
        // Largest surface is soccer's XI; the server stays sport-agnostic beyond the cap.
        RuleFor(x => x.Slots).NotNull().Must(s => s.Count <= 11)
            .WithMessage("A lineup holds at most 11 slots.");
        RuleFor(x => x.Slots)
            .Must(s => s.Select(x => x.SlotKey).Distinct().Count() == s.Count)
            .WithMessage("Slot keys must be unique.")
            .Must(s => s.Select(x => x.PlayerId).Distinct().Count() == s.Count)
            .WithMessage("A player can only fill one slot.");
        RuleForEach(x => x.Slots).SetValidator(new LineupSlotDtoValidator());
    }
}

public class LineupSlotDtoValidator : AbstractValidator<LineupSlotDto>
{
    public LineupSlotDtoValidator()
    {
        RuleFor(x => x.SlotKey).NotEmpty().MaximumLength(16);
        RuleFor(x => x.PlayerId).GreaterThan(0);
    }
}
