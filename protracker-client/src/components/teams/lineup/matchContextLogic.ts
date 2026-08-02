import type { MatchOutcome, MatchStatus } from '../../../types';

// Pure logic for Phase 7a match context (exported + vitest-tested BEFORE any
// UI). Honesty contracts:
// - Previous meetings are DERIVED from real Played matches only — a Scheduled
//   fixture is not a meeting, and the reference match itself never counts.
// - The W-D-L record over those meetings comes straight from the server's
//   `result` field (null on Scheduled rows — excluded before it matters).
// - Picker grouping separates upcoming fixtures from recent results so an
//   unplayed match can never be read as a result.

/** The MatchResult fields this module needs (structural — the app type satisfies it). */
export interface ContextMatch {
  id: number;
  opponentName: string;
  matchDate: string;
  status: MatchStatus;
  result: MatchOutcome | null;
  scoreDisplay: string | null;
}

/** Opponent names are free text — match them trimmed + case-insensitively. */
export function normalizeOpponent(name: string): string {
  return name.trim().toLowerCase();
}

export interface MeetingsRecord {
  wins: number;
  draws: number;
  losses: number;
}

export interface PreviousMeetings<M extends ContextMatch = ContextMatch> {
  /** Played meetings vs this opponent, newest first. */
  meetings: M[];
  record: MeetingsRecord;
}

/**
 * Real prior meetings vs an opponent: PLAYED matches only, same normalized
 * opponent name, dated on or before the reference date, excluding the
 * reference match itself. Newest first.
 */
export function previousMeetings<M extends ContextMatch>(
  matches: readonly M[],
  opponentName: string,
  beforeDate: string,
  excludeMatchId?: number,
): PreviousMeetings<M> {
  const opponent = normalizeOpponent(opponentName);
  const before = Date.parse(beforeDate);
  const meetings = matches
    .filter(m =>
      m.id !== excludeMatchId
      && m.status === 'Played'
      && normalizeOpponent(m.opponentName) === opponent
      && Date.parse(m.matchDate) <= before)
    .slice()
    .sort((a, b) => Date.parse(b.matchDate) - Date.parse(a.matchDate));

  const record: MeetingsRecord = { wins: 0, draws: 0, losses: 0 };
  for (const m of meetings) {
    if (m.result === 'Win') record.wins++;
    else if (m.result === 'Draw') record.draws++;
    else if (m.result === 'Loss') record.losses++;
  }
  return { meetings, record };
}

export interface PickerMatchGroups<M extends ContextMatch = ContextMatch> {
  /** Scheduled fixtures, soonest first — the "build a lineup for the next match" path. */
  upcoming: M[];
  /** Played matches, newest first (the pre-Phase-7 picker order). */
  recent: M[];
}

/** Split the picker's match list so a fixture is never listed as a result. */
export function groupMatchesForPicker<M extends ContextMatch>(matches: readonly M[]): PickerMatchGroups<M> {
  const upcoming = matches.filter(m => m.status === 'Scheduled')
    .slice()
    .sort((a, b) => Date.parse(a.matchDate) - Date.parse(b.matchDate));
  const recent = matches.filter(m => m.status !== 'Scheduled')
    .slice()
    .sort((a, b) => Date.parse(b.matchDate) - Date.parse(a.matchDate));
  return { upcoming, recent };
}
