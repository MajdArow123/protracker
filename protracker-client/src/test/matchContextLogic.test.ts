import { describe, it, expect } from 'vitest';
import {
  normalizeOpponent,
  previousMeetings,
  groupMatchesForPicker,
  type ContextMatch,
} from '../components/teams/lineup/matchContextLogic';

function match(partial: Partial<ContextMatch> & { id: number }): ContextMatch {
  return {
    opponentName: 'Rovers FC',
    matchDate: '2026-03-01T18:00:00Z',
    status: 'Played',
    result: 'Win',
    scoreDisplay: '2 - 1',
    ...partial,
  };
}

describe('normalizeOpponent', () => {
  it('trims and lowercases', () => {
    expect(normalizeOpponent('  Rovers FC ')).toBe('rovers fc');
    expect(normalizeOpponent('ROVERS fc')).toBe('rovers fc');
  });
});

describe('previousMeetings', () => {
  const history: ContextMatch[] = [
    match({ id: 1, matchDate: '2026-01-10T18:00:00Z', result: 'Win', scoreDisplay: '2 - 0' }),
    match({ id: 2, matchDate: '2026-02-10T18:00:00Z', result: 'Loss', scoreDisplay: '0 - 1' }),
    match({ id: 3, matchDate: '2026-03-10T18:00:00Z', result: 'Draw', scoreDisplay: '1 - 1' }),
    // Different opponent — must never appear.
    match({ id: 4, opponentName: 'City United', matchDate: '2026-02-20T18:00:00Z' }),
    // A scheduled fixture vs the same opponent is NOT a meeting.
    match({ id: 5, matchDate: '2026-02-15T18:00:00Z', status: 'Scheduled', result: null, scoreDisplay: null }),
    // After the reference date — hasn't happened "yet" from the fixture's view.
    match({ id: 6, matchDate: '2026-06-01T18:00:00Z', result: 'Win' }),
  ];

  it('returns played meetings vs the same opponent, newest first, with the record', () => {
    const { meetings, record } = previousMeetings(history, 'Rovers FC', '2026-04-01T00:00:00Z');
    expect(meetings.map(m => m.id)).toEqual([3, 2, 1]);
    expect(record).toEqual({ wins: 1, draws: 1, losses: 1 });
  });

  it('matches opponent names case-insensitively and trimmed', () => {
    const { meetings } = previousMeetings(history, '  rovers fc ', '2026-04-01T00:00:00Z');
    expect(meetings.map(m => m.id)).toEqual([3, 2, 1]);
  });

  it('never counts scheduled fixtures, other opponents, or later matches', () => {
    const { meetings } = previousMeetings(history, 'Rovers FC', '2026-04-01T00:00:00Z');
    expect(meetings.some(m => m.id === 4 || m.id === 5 || m.id === 6)).toBe(false);
  });

  it('excludes the reference match itself', () => {
    const { meetings, record } = previousMeetings(history, 'Rovers FC', '2026-03-10T18:00:00Z', 3);
    expect(meetings.map(m => m.id)).toEqual([2, 1]);
    expect(record).toEqual({ wins: 1, draws: 0, losses: 1 });
  });

  it('is honest about zero history — empty meetings, zero record', () => {
    const { meetings, record } = previousMeetings(history, 'Never Played FC', '2026-04-01T00:00:00Z');
    expect(meetings).toEqual([]);
    expect(record).toEqual({ wins: 0, draws: 0, losses: 0 });
  });
});

describe('groupMatchesForPicker', () => {
  it('splits fixtures from results with honest ordering', () => {
    const { upcoming, recent } = groupMatchesForPicker([
      match({ id: 1, matchDate: '2026-01-10T18:00:00Z' }),
      match({ id: 2, matchDate: '2026-09-10T18:00:00Z', status: 'Scheduled', result: null, scoreDisplay: null }),
      match({ id: 3, matchDate: '2026-03-10T18:00:00Z' }),
      match({ id: 4, matchDate: '2026-08-20T18:00:00Z', status: 'Scheduled', result: null, scoreDisplay: null }),
    ]);
    // Fixtures soonest first — the next match is the one you plan for.
    expect(upcoming.map(m => m.id)).toEqual([4, 2]);
    // Results newest first — the pre-Phase-7 order, unchanged.
    expect(recent.map(m => m.id)).toEqual([3, 1]);
  });

  it('handles all-played and all-scheduled lists', () => {
    const played = [match({ id: 1 }), match({ id: 2 })];
    expect(groupMatchesForPicker(played).upcoming).toEqual([]);
    expect(groupMatchesForPicker(played).recent).toHaveLength(2);
    expect(groupMatchesForPicker([]).upcoming).toEqual([]);
  });
});
