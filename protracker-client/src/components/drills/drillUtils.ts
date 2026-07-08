import type { DrillCategory, DrillDifficulty } from '../../types';

export const CATEGORY_ORDER: DrillCategory[] = [
  'WarmUp', 'Technical', 'Tactical', 'Fitness', 'Strength', 'Speed', 'Agility', 'Recovery', 'Mental', 'Cooldown',
];
export const DIFFICULTY_ORDER: DrillDifficulty[] = ['Beginner', 'Intermediate', 'Advanced', 'Elite'];

// "WarmUp" enum name → display label.
export const CATEGORY_LABEL: Record<DrillCategory, string> = {
  WarmUp: 'Warm-up', Technical: 'Technical', Tactical: 'Tactical', Fitness: 'Fitness',
  Strength: 'Strength', Speed: 'Speed', Agility: 'Agility', Recovery: 'Recovery',
  Mental: 'Mental', Cooldown: 'Cooldown',
};

export const CATEGORY_BADGE: Record<DrillCategory, string> = {
  WarmUp: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  Technical: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  Tactical: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  Fitness: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  Strength: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  Speed: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  Agility: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  Recovery: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  Mental: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  Cooldown: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
};

export const DIFFICULTY_BADGE: Record<DrillDifficulty, string> = {
  Beginner: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  Intermediate: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  Advanced: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  Elite: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

// Sport badge keyed by Sport id (names vary: "Football / Soccer", "Volleyball Indoor" …).
export const SPORT_BADGE: Record<number, string> = {
  1: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  2: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  3: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  4: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  5: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};

// Short sport labels for compact badges.
export const SPORT_SHORT: Record<number, string> = {
  1: 'Soccer', 2: 'Basketball', 3: 'Volleyball', 4: 'Beach Volley', 5: 'Tennis',
};

export function sportBadge(id: number): string {
  return SPORT_BADGE[id] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
}

export type DurationFilter = 'any' | 'under10' | '10to20' | 'over20';

export function matchesDuration(minutes: number | null | undefined, filter: DurationFilter): boolean {
  if (filter === 'any') return true;
  if (minutes == null) return false;
  if (filter === 'under10') return minutes < 10;
  if (filter === '10to20') return minutes >= 10 && minutes <= 20;
  return minutes > 20;
}

// Split newline-separated instructions into steps.
export function instructionSteps(instructions?: string | null): string[] {
  if (!instructions) return [];
  return instructions.split('\n').map(s => s.replace(/^\s*\d+[.)]\s*/, '').trim()).filter(Boolean);
}
