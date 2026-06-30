import { useState } from 'react';
import type { WeeklyNutritionPlan, PlannedMealItem, DailyMealPlan, PlannedMeal } from '../../types';
import { Sun, Salad, Apple, UtensilsCrossed, Dumbbell, ArrowLeftRight, Loader2, Sparkles } from 'lucide-react';
import { clsx } from 'clsx';
import { SwapModal } from './SwapModal';

const MEAL_ICONS: Record<string, React.ElementType> = {
  Breakfast: Sun,
  Lunch: Salad,
  Snack: Apple,
  Dinner: UtensilsCrossed,
  PostWorkout: Dumbbell,
};

const DAY_ABBREVIATIONS: Record<string, string> = {
  Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu',
  Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun',
};

function MacroBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold', color)}>
      {label}: {value}g
    </span>
  );
}

function MealCard({
  meal,
  canSwap,
  onSwapClick,
}: {
  meal: PlannedMeal;
  canSwap: boolean;
  onSwapClick: (item: PlannedMealItem) => void;
}) {
  const Icon = MEAL_ICONS[meal.mealType] ?? UtensilsCrossed;
  const mealTotal = {
    calories: meal.plannedMealItems.reduce((s, i) => s + i.calories, 0),
    protein: meal.plannedMealItems.reduce((s, i) => s + i.protein, 0),
    carbs: meal.plannedMealItems.reduce((s, i) => s + i.carbs, 0),
    fats: meal.plannedMealItems.reduce((s, i) => s + i.fats, 0),
  };

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/60">
        <div className="p-1.5 rounded-lg bg-indigo-500/10">
          <Icon size={15} className="text-indigo-400" />
        </div>
        <div>
          <p className="text-sm font-bold text-gray-900 dark:text-white">{meal.mealType}</p>
          <p className="text-[11px] text-gray-400">{meal.time}</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{mealTotal.calories} kcal</p>
          <p className="text-[10px] text-gray-400">P:{mealTotal.protein}g C:{mealTotal.carbs}g F:{mealTotal.fats}g</p>
        </div>
      </div>

      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {meal.plannedMealItems.map((item) => (
          <div key={item.id} className="flex items-center gap-3 px-4 py-2.5">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-800 dark:text-gray-200 font-medium truncate">
                {item.foodName}
                {item.isSwapped && (
                  <span className="ml-2 text-[10px] font-semibold text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded-full">
                    swapped
                  </span>
                )}
              </p>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <span className="text-[11px] text-gray-400">{item.portion}</span>
                <span className="text-[11px] text-gray-500">·</span>
                <span className="text-[11px] text-gray-500">{item.calories} kcal</span>
                <MacroBadge label="P" value={item.protein} color="bg-blue-500/10 text-blue-500" />
                <MacroBadge label="C" value={item.carbs} color="bg-amber-500/10 text-amber-600 dark:text-amber-400" />
                <MacroBadge label="F" value={item.fats} color="bg-red-500/10 text-red-500" />
              </div>
            </div>
            {canSwap && (
              <button
                onClick={() => onSwapClick(item)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors flex-shrink-0"
                title="Swap this food item"
              >
                <ArrowLeftRight size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function DaySummaryCard({ day }: { day: DailyMealPlan }) {
  const proteinPct = day.dailyCalories > 0 ? Math.round((day.dailyProtein * 4 / day.dailyCalories) * 100) : 0;
  const carbsPct = day.dailyCalories > 0 ? Math.round((day.dailyCarbs * 4 / day.dailyCalories) * 100) : 0;
  const fatsPct = day.dailyCalories > 0 ? Math.round((day.dailyFats * 9 / day.dailyCalories) * 100) : 0;

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-bold text-gray-900 dark:text-white">Daily Summary</p>
        <span className="text-lg font-black text-indigo-500">{day.dailyCalories.toLocaleString()} <span className="text-xs font-normal text-gray-400">kcal</span></span>
      </div>
      <div className="space-y-2">
        <MacroBar label="Protein" grams={day.dailyProtein} pct={proteinPct} color="bg-blue-500" />
        <MacroBar label="Carbs" grams={day.dailyCarbs} pct={carbsPct} color="bg-amber-500" />
        <MacroBar label="Fats" grams={day.dailyFats} pct={fatsPct} color="bg-red-400" />
      </div>
    </div>
  );
}

function MacroBar({ label, grams, pct, color }: { label: string; grams: number; pct: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-gray-500 dark:text-gray-400">{label}</span>
        <span className="text-gray-700 dark:text-gray-300 font-medium">{grams}g <span className="text-gray-400">({pct}%)</span></span>
      </div>
      <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
        <div className={clsx('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

interface Props {
  plan: WeeklyNutritionPlan;
  canSwap?: boolean;
  isCoach?: boolean;
  onGenerate?: () => void;
  isGenerating?: boolean;
  playerId: number;
}

export function WeeklyNutritionPlanView({ plan, canSwap = false, isCoach = false, onGenerate, isGenerating, playerId }: Props) {
  const [selectedDay, setSelectedDay] = useState(0);
  const [swapItem, setSwapItem] = useState<PlannedMealItem | null>(null);

  const days = plan.dailyMealPlans;
  const currentDay = days[selectedDay];

  if (!currentDay) return null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Week of {new Date(plan.weekStartDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            {plan.isAIGenerated && (
              <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 text-[10px] font-semibold">
                <Sparkles size={9} />AI
              </span>
            )}
          </p>
        </div>
        {isCoach && onGenerate && (
          <button
            onClick={onGenerate}
            disabled={isGenerating}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-semibold transition-colors"
          >
            {isGenerating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            {isGenerating ? 'Generating…' : 'Generate New Week'}
          </button>
        )}
      </div>

      {/* Day tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {days.map((day, idx) => (
          <button
            key={day.id}
            onClick={() => setSelectedDay(idx)}
            className={clsx(
              'flex-shrink-0 px-3 py-2 rounded-xl text-xs font-semibold transition-all',
              idx === selectedDay
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            )}
          >
            {DAY_ABBREVIATIONS[day.dayName] ?? day.dayName}
          </button>
        ))}
      </div>

      {/* Day content */}
      <DaySummaryCard day={currentDay} />

      <div className="space-y-3">
        {currentDay.plannedMeals.map((meal) => (
          <MealCard
            key={meal.id}
            meal={meal}
            canSwap={canSwap}
            onSwapClick={setSwapItem}
          />
        ))}
      </div>

      {/* Swap modal */}
      {swapItem && (
        <SwapModal
          item={swapItem}
          playerId={playerId}
          onClose={() => setSwapItem(null)}
        />
      )}
    </div>
  );
}
