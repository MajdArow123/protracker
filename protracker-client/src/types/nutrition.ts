export interface NutritionProfileItem {
  id: number;
  playerId: number;
  preferenceType: string;
  category: string;
  specificItem?: string | null;
  severity: string;
  notes?: string | null;
}

export interface NutritionGuidance {
  id: number;
  playerId: number;
  createdDate: string;
  goal?: string | null;
  mealSuggestions?: string | null;
  hydrationTips?: string | null;
  recoveryTips?: string | null;
  foodsToPrioritize?: string | null;
  foodsToLimit?: string | null;
  disclaimer: string;
  isAIGenerated: boolean;
  mealPlanJson?: string | null;
}

export interface MealItem {
  food: string;
  portion: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

export interface Meal {
  name: string;
  time: string;
  items: MealItem[];
}

export interface StructuredMealPlan {
  goal: string;
  dailyCalories: number;
  macros: { protein: number; carbs: number; fats: number; fiber: number };
  hydrationMl: number;
  meals: Meal[];
  mealSuggestions?: string;
  hydrationTips?: string;
  recoveryTips?: string;
  foodsToPrioritize?: string;
  foodsToLimit?: string;
}

// ── Weekly Nutrition Plan types ──────────────────────────────────────────────

export interface PlannedMealItem {
  id: number;
  plannedMealId: number;
  foodName: string;
  portion: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  isSwapped: boolean;
  originalFoodName?: string | null;
}

export interface PlannedMeal {
  id: number;
  dailyMealPlanId: number;
  mealType: string;
  time: string;
  plannedMealItems: PlannedMealItem[];
}

export interface DailyMealPlan {
  id: number;
  weeklyNutritionPlanId: number;
  dayNumber: number;
  dayName: string;
  dailyCalories: number;
  dailyProtein: number;
  dailyCarbs: number;
  dailyFats: number;
  plannedMeals: PlannedMeal[];
}

export interface WeeklyNutritionPlan {
  id: number;
  playerId: number;
  createdDate: string;
  weekStartDate: string;
  isAIGenerated: boolean;
  dailyMealPlans: DailyMealPlan[];
}

export interface SwapMealItemRequest {
  newFoodName: string;
  newPortion: string;
  newCalories: number;
  newProtein: number;
  newCarbs: number;
  newFats: number;
}

export interface FoodAlternative {
  id: number;
  originalFood: string;
  alternativeFood: string;
  proteinMatchScore: number;
  carbMatchScore: number;
  fatMatchScore: number;
  calorieMatchScore: number;
  recoveryValue: number;
  sportPerformanceNote?: string | null;
  reasonExplanation?: string | null;
  suggestedPortion?: string | null;
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fats?: number | null;
}

// A food scaled to a portion matching the meal item being swapped (see /api/food-alternatives/equivalent).
export interface EquivalentFood {
  id: number;
  foodName: string;
  category: string;
  suggestedPortion: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  isGoodMatch: boolean;
  matchQuality: 'good' | 'similar' | 'different';
  originalCalories: number;
  caloriesDiffPct: number;
}
