import { describe, expect, it } from 'vitest';
import { groupStintsByTeam } from '../utils/seasonRoster';
import type { SeasonRosterStint, SeasonTeamRef } from '../types';

function mkStint(overrides: Partial<SeasonRosterStint>): SeasonRosterStint {
  return {
    id: 1,
    seasonId: 1,
    teamId: 10,
    teamName: 'Alpha',
    playerId: 1,
    playerName: 'Player',
    joinedAt: '2030-01-01T00:00:00Z',
    leftAt: null,
    ...overrides,
  };
}

const alpha: SeasonTeamRef = { id: 10, name: 'Alpha' };
const beta: SeasonTeamRef = { id: 20, name: 'Beta' };

describe('groupStintsByTeam', () => {
  it('keeps a participating team with no stints as an honest empty group', () => {
    const groups = groupStintsByTeam([alpha, beta], [mkStint({ teamId: 10 })]);
    expect(groups.map(g => g.team.id)).toEqual([10, 20]);
    expect(groups[0].stints).toHaveLength(1);
    expect(groups[1].stints).toHaveLength(0);
  });

  it('sorts stints by player name, then join date (rejoins read chronologically)', () => {
    const groups = groupStintsByTeam([alpha], [
      mkStint({ id: 1, playerName: 'Zoe', joinedAt: '2030-01-01T00:00:00Z' }),
      mkStint({ id: 2, playerName: 'Amy', joinedAt: '2030-04-01T00:00:00Z' }),
      mkStint({ id: 3, playerName: 'Amy', joinedAt: '2030-01-01T00:00:00Z' }),
    ]);
    expect(groups[0].stints.map(s => s.id)).toEqual([3, 2, 1]);
  });

  it('never drops a stint on an unlisted team — it gets a trailing group from its own fields', () => {
    const orphan = mkStint({ id: 9, teamId: 99, teamName: 'Ghost FC' });
    const groups = groupStintsByTeam([alpha], [orphan]);
    expect(groups).toHaveLength(2);
    expect(groups[1].team).toEqual({ id: 99, name: 'Ghost FC' });
    expect(groups[1].stints).toEqual([orphan]);
  });

  it('returns no groups for a season with no teams and no stints', () => {
    expect(groupStintsByTeam([], [])).toEqual([]);
  });
});
