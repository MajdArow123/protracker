// Shared sport color maps for the coach marketplace (and reusable elsewhere). Keyed by
// sport name; falls back to indigo for anything unknown. Mirrors the values already used
// on TeamsPage / TeamDetailPage.

export const SPORT_GRADIENTS: Record<string, string> = {
  Football: 'from-green-500 via-emerald-600 to-green-700',
  Soccer: 'from-green-500 via-emerald-600 to-green-700',
  'Football / Soccer': 'from-green-500 via-emerald-600 to-green-700',
  Basketball: 'from-orange-400 via-orange-500 to-amber-600',
  Volleyball: 'from-blue-500 via-blue-600 to-indigo-700',
  'Beach Volleyball': 'from-yellow-400 via-amber-500 to-orange-500',
  Tennis: 'from-purple-500 via-violet-600 to-purple-700',
};

export const SPORT_DOTS: Record<string, string> = {
  Football: 'bg-green-500',
  Soccer: 'bg-green-500',
  'Football / Soccer': 'bg-green-500',
  Basketball: 'bg-orange-500',
  Volleyball: 'bg-blue-500',
  'Beach Volleyball': 'bg-yellow-500',
  Tennis: 'bg-purple-500',
};

// Solid badge (bg + text) classes per sport, for pills and chips.
export const SPORT_BADGES: Record<string, string> = {
  Football: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  Soccer: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  'Football / Soccer': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  Basketball: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  Volleyball: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  'Beach Volleyball': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  Tennis: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
};

export function sportGradient(name?: string | null): string {
  return (name && SPORT_GRADIENTS[name]) || 'from-indigo-500 via-indigo-600 to-violet-700';
}

export function sportDot(name?: string | null): string {
  return (name && SPORT_DOTS[name]) || 'bg-indigo-500';
}

export function sportBadge(name?: string | null): string {
  return (name && SPORT_BADGES[name]) || 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300';
}
