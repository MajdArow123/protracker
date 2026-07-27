using FluentValidation;
using ProTracker.Dtos;

namespace ProTracker.Validation;

public class MealSuggestionRequestValidator : AbstractValidator<MealSuggestionRequest>
{
    private static readonly string[] GoalTypes = { "fatLoss", "maintain", "muscleGain" };
    private static readonly string[] TimesOfDay = { "morning", "afternoon", "evening", "night" };
    private static readonly string[] MealTypes = { "breakfast", "lunch", "dinner", "snack", "postWorkout" };

    public MealSuggestionRequestValidator()
    {
        // Upper bounds keep garbage numbers out of the AI prompt.
        RuleFor(x => x.CaloriesRemaining)
            .GreaterThan(0).WithMessage("caloriesRemaining must be greater than 0.")
            .LessThanOrEqualTo(20000).WithMessage("caloriesRemaining must be 20000 or less.");
        RuleFor(x => x.ProteinRemaining)
            .InclusiveBetween(0, 2000).WithMessage("proteinRemaining must be between 0 and 2000.");
        RuleFor(x => x.CarbsRemaining)
            .InclusiveBetween(0, 2000).WithMessage("carbsRemaining must be between 0 and 2000.");
        RuleFor(x => x.FatRemaining)
            .InclusiveBetween(0, 2000).WithMessage("fatRemaining must be between 0 and 2000.");
        RuleFor(x => x.GoalType)
            .Must(v => GoalTypes.Contains(v, StringComparer.OrdinalIgnoreCase))
            .WithMessage("goalType must be one of: fatLoss, maintain, muscleGain.");
        RuleFor(x => x.TimeOfDay)
            .Must(v => TimesOfDay.Contains(v, StringComparer.OrdinalIgnoreCase))
            .WithMessage("timeOfDay must be one of: morning, afternoon, evening, night.");
        RuleFor(x => x.MealType)
            .Must(v => MealTypes.Contains(v, StringComparer.OrdinalIgnoreCase))
            .When(x => !string.IsNullOrEmpty(x.MealType))
            .WithMessage("mealType must be one of: breakfast, lunch, dinner, snack, postWorkout.");
        RuleFor(x => x.UserPreference)
            .MaximumLength(100).WithMessage("userPreference must be 100 characters or fewer.");
    }
}
