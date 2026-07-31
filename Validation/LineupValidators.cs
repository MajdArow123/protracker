using FluentValidation;
using ProTracker.Dtos;

namespace ProTracker.Validation;

public class SaveLineupDtoValidator : AbstractValidator<SaveLineupDto>
{
    public SaveLineupDtoValidator()
    {
        RuleFor(x => x.MatchResultId).GreaterThan(0).When(x => x.MatchResultId.HasValue);
        // Named lineups are team lineups only — a match lineup's key stays 2-D.
        RuleFor(x => x.Name).MaximumLength(60);
        RuleFor(x => x.Name)
            .Must(n => string.IsNullOrWhiteSpace(n))
            .WithMessage("A match lineup cannot also have a name.")
            .When(x => x.MatchResultId.HasValue);
        RuleFor(x => x.BaseVersion).GreaterThan(0).When(x => x.BaseVersion.HasValue);
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

        // Tactical layer (Phase 3) — shape only; XI-membership rules live in
        // LineupService.UpsertAsync where the slot set is authoritative.
        RuleFor(x => x.CaptainPlayerId).GreaterThan(0).When(x => x.CaptainPlayerId.HasValue);
        RuleFor(x => x.ViceCaptainPlayerId).GreaterThan(0).When(x => x.ViceCaptainPlayerId.HasValue);
        RuleFor(x => x.Notes).MaximumLength(2000);
        RuleFor(x => x.TacticalLabels!)
            .Must(l => l.Count <= 6).WithMessage("At most 6 tactical labels.")
            .Must(l => l.All(k => !string.IsNullOrWhiteSpace(k) && k.Length <= 40 && !k.Contains(',')))
            .WithMessage("Each tactical label must be a non-empty key of at most 40 characters without commas.")
            .When(x => x.TacticalLabels != null);
        RuleFor(x => x.SetPieces!)
            .Must(s => s.Count <= 10).WithMessage("At most 10 set-piece assignments.")
            .Must(s => s.Select(a => a.Type.Trim().ToLowerInvariant()).Distinct().Count() == s.Count)
            .WithMessage("Each set-piece type can only have one taker.")
            .When(x => x.SetPieces != null);
        RuleForEach(x => x.SetPieces!).SetValidator(new SetPieceAssignmentDtoValidator())
            .When(x => x.SetPieces != null);
    }
}

public class LineupSlotDtoValidator : AbstractValidator<LineupSlotDto>
{
    public LineupSlotDtoValidator()
    {
        RuleFor(x => x.SlotKey).NotEmpty().MaximumLength(16);
        RuleFor(x => x.PlayerId).GreaterThan(0);
        RuleFor(x => x.Role).MaximumLength(40);
        RuleFor(x => x.Instructions).MaximumLength(200);
    }
}

public class SetPieceAssignmentDtoValidator : AbstractValidator<SetPieceAssignmentDto>
{
    public SetPieceAssignmentDtoValidator()
    {
        RuleFor(x => x.Type).NotEmpty().MaximumLength(40);
        RuleFor(x => x.PlayerId).GreaterThan(0);
    }
}

// Tactical presets (Phase 6): shape only — role/label keys are opaque frontend
// catalog keys (the SlotKey precedent); sport/name uniqueness lives in the service.
public class SaveTacticalPresetDtoValidator : AbstractValidator<SaveTacticalPresetDto>
{
    public SaveTacticalPresetDtoValidator()
    {
        RuleFor(x => x.SportId).GreaterThan(0);
        RuleFor(x => x.Name).NotEmpty().MaximumLength(60);
        RuleFor(x => x.Formation).MaximumLength(16);
        RuleFor(x => x.Roles!)
            .Must(r => r.Count <= 11).WithMessage("At most 11 slot roles.")
            .Must(r => r.All(kv =>
                !string.IsNullOrWhiteSpace(kv.Key) && kv.Key.Length <= 16
                && !string.IsNullOrWhiteSpace(kv.Value) && kv.Value.Length <= 40))
            .WithMessage("Each role must map a slot key (≤16 chars) to a role key (≤40 chars).")
            .When(x => x.Roles != null);
        RuleFor(x => x.Labels!)
            .Must(l => l.Count <= 6).WithMessage("At most 6 tactical labels.")
            .Must(l => l.All(k => !string.IsNullOrWhiteSpace(k) && k.Length <= 40 && !k.Contains(',')))
            .WithMessage("Each tactical label must be a non-empty key of at most 40 characters without commas.")
            .When(x => x.Labels != null);
    }
}
