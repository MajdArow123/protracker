import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SwapModal } from '../components/nutrition/SwapModal';
import type { PlannedMealItem, EquivalentFood } from '../types';

const foods: EquivalentFood[] = [
  { id: 1, foodName: 'Turkey breast', category: 'Protein', suggestedPortion: '245g', calories: 331, protein: 74, carbs: 0, fats: 2, isGoodMatch: true, matchQuality: 'good', originalCalories: 330, caloriesDiffPct: 0.3 },
  { id: 2, foodName: 'Ground turkey', category: 'Protein', suggestedPortion: '190g', calories: 334, protein: 51, carbs: 0, fats: 15, isGoodMatch: false, matchQuality: 'similar', originalCalories: 330, caloriesDiffPct: 1.2 },
  { id: 3, foodName: 'Pumpkin seeds', category: 'Fat', suggestedPortion: '60g', calories: 335, protein: 18, carbs: 7, fats: 29, isGoodMatch: false, matchQuality: 'different', originalCalories: 330, caloriesDiffPct: 1.5 },
];

// Without an initialized i18next instance, useTranslation()'s t() returns the
// defaultValue WITHOUT interpolating {{placeholders}} — the modal title rendered
// literally as "Swap {{food}}". Mock t() to interpolate so the assertion keeps
// checking the real contract: the food name appears in the title.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string, opts?: Record<string, unknown>) =>
      (fallback ?? key).replace(/\{\{(\w+)\}\}/g, (_, name) => String(opts?.[name] ?? '')),
  }),
}));
vi.mock('../hooks/useReports', () => ({
  useEquivalentFoods: () => ({ data: foods, isLoading: false }),
}));
vi.mock('../hooks/useNutrition', () => ({
  useSwapMealItem: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('../context/useToast', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

const item: PlannedMealItem = {
  id: 10, plannedMealId: 1, foodName: 'Grilled chicken breast', portion: '200g',
  calories: 330, protein: 62, carbs: 0, fats: 7, isSwapped: false,
};

describe('SwapModal', () => {
  it('shows the meal item being swapped', () => {
    render(<SwapModal item={item} playerId={1} onClose={() => {}} />);
    expect(screen.getByText('Swap Grilled chicken breast')).toBeInTheDocument();
    // The current food chip appears in the "Currently in your plan" panel.
    expect(screen.getAllByText('Grilled chicken breast').length).toBeGreaterThan(0);
  });

  it('renders the three match-quality badges for the scaled foods', () => {
    render(<SwapModal item={item} playerId={1} onClose={() => {}} />);
    expect(screen.getByText('Good match')).toBeInTheDocument();
    expect(screen.getByText('Similar macros')).toBeInTheDocument();
    expect(screen.getByText('Different macros')).toBeInTheDocument();
  });

  it('lists the portion-scaled alternative foods', () => {
    render(<SwapModal item={item} playerId={1} onClose={() => {}} />);
    expect(screen.getByText('Turkey breast')).toBeInTheDocument();
    expect(screen.getByText('245g')).toBeInTheDocument();
  });
});
