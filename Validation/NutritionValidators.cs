using FluentValidation;
using ProTracker.Dtos;
using ProTracker.Models;

namespace ProTracker.Validation;

public class CreateNutritionProfileItemDtoValidator : AbstractValidator<CreateNutritionProfileItemDto>
{
    public CreateNutritionProfileItemDtoValidator()
    {
        RuleFor(x => x.PreferenceType).IsInEnum();
        RuleFor(x => x.Category).IsInEnum();
        RuleFor(x => x.Severity).IsInEnum();

        // Severity must match preference type: Allergy -> Hard, Lifestyle -> Lifestyle,
        // SoftPreference -> Soft. See PlayerNutritionProfile severity rules.
        RuleFor(x => x).Must(MatchesSeverityRule)
            .WithMessage("Severity must match preference type: Allergy=Hard, Lifestyle=Lifestyle, SoftPreference=Soft.");
    }

    private static bool MatchesSeverityRule(CreateNutritionProfileItemDto dto) => dto.PreferenceType switch
    {
        NutritionPreferenceType.Allergy => dto.Severity == NutritionSeverity.Hard,
        NutritionPreferenceType.Lifestyle => dto.Severity == NutritionSeverity.Lifestyle,
        NutritionPreferenceType.SoftPreference => dto.Severity == NutritionSeverity.Soft,
        _ => false
    };
}

public class CreateNutritionGuidanceDtoValidator : AbstractValidator<CreateNutritionGuidanceDto>
{
    public CreateNutritionGuidanceDtoValidator()
    {
        RuleFor(x => x.PlayerId).GreaterThan(0);
    }
}
