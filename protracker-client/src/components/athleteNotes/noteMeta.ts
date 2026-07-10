import type { AthleteNoteCategory } from '../../types';

export const NOTE_CATEGORIES: AthleteNoteCategory[] = [
  'Training', 'Nutrition', 'Mental', 'Personal', 'Goal', 'Other',
];

// Pill/badge classes per category (light + dark).
export const NOTE_CATEGORY_STYLES: Record<AthleteNoteCategory, string> = {
  Training: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  Nutrition: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  Mental: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  Personal: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  Goal: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  Other: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
};

export function noteTitleOf(note: { title?: string | null; content: string }, untitledLabel = 'Untitled note'): string {
  if (note.title && note.title.trim()) return note.title.trim();
  const firstLine = note.content.split('\n')[0].trim();
  return firstLine.length > 60 ? `${firstLine.slice(0, 60)}…` : firstLine || untitledLabel;
}

export function fmtNoteDate(s: string): string {
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
