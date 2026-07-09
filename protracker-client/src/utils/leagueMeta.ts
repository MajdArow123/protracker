import type { LeagueType, LeagueStatus, LeagueMatchStatus, LeagueFormat } from '../types';

export const LEAGUE_TYPES: { value: LeagueType; label: string; desc: string }[] = [
  { value: 'League', label: 'League', desc: 'Season-long, every team plays each other' },
  { value: 'Tournament', label: 'Tournament', desc: 'Knockout bracket to a champion' },
  { value: 'Cup', label: 'Cup', desc: 'Competition for a trophy' },
];

export const LEAGUE_FORMATS: { value: LeagueFormat; label: string; desc: string }[] = [
  { value: 'RoundRobin', label: 'Round Robin', desc: 'Everyone plays everyone once' },
  { value: 'Knockout', label: 'Knockout', desc: 'Single elimination bracket' },
  { value: 'GroupStageKnockout', label: 'Groups + Knockout', desc: 'Group stage then knockouts' },
  { value: 'Swiss', label: 'Swiss', desc: 'Paired by record each round' },
];

export const LEAGUE_STATUS_STYLES: Record<LeagueStatus, string> = {
  Draft: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  Registration: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  Active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  Completed: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  Cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

export const MATCH_STATUS_STYLES: Record<LeagueMatchStatus, string> = {
  Scheduled: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  Live: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  Completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  Postponed: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  Cancelled: 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-300',
};

export function formatLabel(f: LeagueFormat): string {
  return LEAGUE_FORMATS.find(x => x.value === f)?.label ?? f;
}

// The short label for the "goals" column in standings, per score format.
export function scoreColumnLabels(scoreFormat: string): { for: string; against: string; forFull: string } {
  switch (scoreFormat) {
    case 'Points': return { for: 'PF', against: 'PA', forFull: 'Points For' };
    case 'Sets': return { for: 'SF', against: 'SA', forFull: 'Sets For' };
    case 'GamesAndSets': return { for: 'SF', against: 'SA', forFull: 'Sets For' };
    default: return { for: 'GF', against: 'GA', forFull: 'Goals For' };
  }
}

// Result-pill colors for the form string.
export const FORM_STYLES: Record<string, string> = {
  W: 'bg-green-500 text-white',
  D: 'bg-gray-400 text-white',
  L: 'bg-red-500 text-white',
};
