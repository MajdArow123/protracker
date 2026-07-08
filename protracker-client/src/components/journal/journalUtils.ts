import { Star, Smile, Meh, Frown, CloudRain } from 'lucide-react';
import type { JournalMood } from '../../types';

export interface MoodConfig {
  label: string;
  icon: typeof Star;
  // Text/icon color.
  color: string;
  // Soft background pill (icon container / badge).
  bg: string;
  // Solid color for the heat-map square / dot.
  solid: string;
}

export const MOODS: JournalMood[] = ['Great', 'Good', 'Okay', 'Tough', 'Rough'];

export const MOOD_CONFIG: Record<JournalMood, MoodConfig> = {
  Great: { label: 'Great', icon: Star, color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-900/30', solid: 'bg-green-500' },
  Good: { label: 'Good', icon: Smile, color: 'text-teal-500', bg: 'bg-teal-100 dark:bg-teal-900/30', solid: 'bg-teal-500' },
  Okay: { label: 'Okay', icon: Meh, color: 'text-amber-500', bg: 'bg-amber-100 dark:bg-amber-900/30', solid: 'bg-amber-500' },
  Tough: { label: 'Tough', icon: Frown, color: 'text-orange-500', bg: 'bg-orange-100 dark:bg-orange-900/30', solid: 'bg-orange-500' },
  Rough: { label: 'Rough', icon: CloudRain, color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/30', solid: 'bg-red-500' },
};

// Rotating writing prompts shown when the entry is empty.
export const JOURNAL_PROMPTS = [
  'What went well in training today?',
  'What was the hardest part of today?',
  "What's one thing you want to improve?",
  'How are you feeling about your progress?',
  'What did you learn about yourself today?',
  'What are you grateful for after today?',
  'What would make tomorrow a win?',
];

export function randomPrompt(exclude?: string): string {
  const pool = exclude ? JOURNAL_PROMPTS.filter(p => p !== exclude) : JOURNAL_PROMPTS;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function parseTags(tags?: string | null): string[] {
  if (!tags) return [];
  return tags.split(',').map(t => t.trim()).filter(Boolean);
}

export function formatEntryDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

// A local YYYY-MM-DD key (used to align heat-map cells with entry dates).
export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function autoTitle(mood: JournalMood, dateStr: string): string {
  const date = new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${MOOD_CONFIG[mood].label} day — ${date}`;
}

export function isToday(dateStr: string): boolean {
  return dateKey(new Date(dateStr)) === dateKey(new Date());
}
