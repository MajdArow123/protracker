import {
  AlertTriangle, BarChart2, CircleOff, ClipboardCheck, EyeOff, HelpCircle,
  Minus, PenLine, Sigma, UserRound,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { DataSource, MissingReason } from '../types';

/**
 * ── The data-honesty taxonomy (lineup program Phase 0) ──────────────────────
 *
 * Every value ProTracker displays carries exactly one provenance (`DataSource`
 * in types/index.ts), and every absent value has exactly one reason
 * (`MissingReason`). The rules these helpers encode:
 *
 * 1. Never fabricate. A displayed number is recorded, coach-entered,
 *    player-reported, or calculated (with a stated method) — or the attribute
 *    is `not-tracked` and renders an explicit empty state, never a default.
 * 2. Never silently substitute. Wellbeing "Energy" is not fatigue and
 *    "Feeling" is not morale (player-reported proxies keep their real names);
 *    an evidence FinalScore is CALCULATED, not recorded; a coach-set fitness
 *    level is COACH-ENTERED, not recorded; a co-appearance count is a count,
 *    never a chemistry score.
 * 3. Absence is typed. "Not tracked" (the app doesn't measure this) is a
 *    different claim from "Not recorded" (measurable, no data), "Not set"
 *    (optional coach field left empty), "Not enough data" (below an honesty
 *    gate, e.g. <3 tests), and "Unable to load" (a request failure says
 *    nothing about the data). No generic dash where the distinction matters.
 *
 * Unexpected runtime values (an API newer than this build) fall back to an
 * explicit "Unknown" meta — never to one of the real provenance types.
 */

export interface SourceMeta {
  labelKey: string;
  fallbackLabel: string;
  icon: LucideIcon;
  /** Badge classes, light + dark — distinct from the confidence badge palette. */
  badgeClass: string;
}

const SOURCE_META: Record<DataSource, SourceMeta> = {
  recorded: {
    labelKey: 'common.dataSource.recorded',
    fallbackLabel: 'Recorded',
    icon: ClipboardCheck,
    badgeClass: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  },
  'coach-entered': {
    labelKey: 'common.dataSource.coachEntered',
    fallbackLabel: 'Coach-entered',
    icon: PenLine,
    badgeClass: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  },
  'player-reported': {
    labelKey: 'common.dataSource.playerReported',
    fallbackLabel: 'Player-reported',
    icon: UserRound,
    badgeClass: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  },
  calculated: {
    labelKey: 'common.dataSource.calculated',
    fallbackLabel: 'Calculated',
    icon: Sigma,
    badgeClass: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  },
  'not-tracked': {
    labelKey: 'common.dataSource.notTracked',
    fallbackLabel: 'Not tracked',
    icon: EyeOff,
    badgeClass: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-600',
  },
};

export const UNKNOWN_SOURCE_META: SourceMeta = {
  labelKey: 'common.dataSource.unknown',
  fallbackLabel: 'Unknown source',
  icon: HelpCircle,
  badgeClass: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

/** Widened to string: runtime API data may carry values newer than this build. */
export function sourceMeta(source: DataSource | string): SourceMeta {
  return (SOURCE_META as Record<string, SourceMeta>)[source] ?? UNKNOWN_SOURCE_META;
}

export interface MissingReasonMeta {
  labelKey: string;
  fallbackLabel: string;
  icon: LucideIcon;
  /** Compact glyph. "?" is reserved for load failures (the RatingChip convention). */
  glyph: '—' | '?';
}

const MISSING_META: Record<MissingReason, MissingReasonMeta> = {
  'not-tracked': {
    labelKey: 'common.dataSource.missingNotTracked',
    fallbackLabel: 'Not tracked',
    icon: EyeOff,
    glyph: '—',
  },
  'not-recorded': {
    labelKey: 'common.dataSource.missingNotRecorded',
    fallbackLabel: 'Not recorded',
    icon: CircleOff,
    glyph: '—',
  },
  'not-set': {
    labelKey: 'common.dataSource.missingNotSet',
    fallbackLabel: 'Not set',
    icon: Minus,
    glyph: '—',
  },
  'not-enough-data': {
    labelKey: 'common.dataSource.missingNotEnoughData',
    fallbackLabel: 'Not enough data',
    icon: BarChart2,
    glyph: '—',
  },
  'load-failed': {
    labelKey: 'common.dataSource.missingLoadFailed',
    fallbackLabel: 'Unable to load',
    icon: AlertTriangle,
    glyph: '?',
  },
};

export const UNKNOWN_MISSING_META: MissingReasonMeta = {
  labelKey: 'common.dataSource.missingUnknown',
  fallbackLabel: 'Unknown',
  icon: HelpCircle,
  glyph: '—',
};

export function missingReasonMeta(reason: MissingReason | string): MissingReasonMeta {
  return (MISSING_META as Record<string, MissingReasonMeta>)[reason] ?? UNKNOWN_MISSING_META;
}
