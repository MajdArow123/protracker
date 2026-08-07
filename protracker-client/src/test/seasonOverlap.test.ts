import { describe, expect, it } from 'vitest';
import { findOverlappingSeasons } from '../utils/seasonOverlap';
import type { Season } from '../types';

function mkSeason(id: number, name: string, startDate: string, endDate: string): Season {
  return { id, name, startDate, endDate, teams: [], status: 'Active', linkedPeriodCount: 0 };
}

const seasons = [
  mkSeason(1, 'Spring', '2030-03-01', '2030-06-30'),
  mkSeason(2, 'Fall', '2030-08-01', '2030-11-30'),
];

describe('findOverlappingSeasons', () => {
  it('finds a window overlapping an existing season', () => {
    expect(findOverlappingSeasons(seasons, '2030-06-01', '2030-07-15').map(s => s.id)).toEqual([1]);
  });

  it('returns empty for a window between seasons', () => {
    expect(findOverlappingSeasons(seasons, '2030-07-01', '2030-07-31')).toEqual([]);
  });

  it('a shared boundary day counts as overlap (day-granular, inclusive)', () => {
    expect(findOverlappingSeasons(seasons, '2030-06-30', '2030-07-10').map(s => s.id)).toEqual([1]);
  });

  it('a window spanning both seasons names both', () => {
    expect(findOverlappingSeasons(seasons, '2030-01-01', '2030-12-31').map(s => s.id)).toEqual([1, 2]);
  });

  it('excludes the season being edited', () => {
    expect(findOverlappingSeasons(seasons, '2030-03-01', '2030-06-30', 1)).toEqual([]);
  });

  it('handles full ISO datetime strings from the API', () => {
    const isoSeasons = [mkSeason(3, 'ISO', '2030-03-01T00:00:00Z', '2030-06-30T00:00:00Z')];
    expect(findOverlappingSeasons(isoSeasons, '2030-04-01', '2030-04-30').map(s => s.id)).toEqual([3]);
  });

  it('empty dates never claim an overlap', () => {
    expect(findOverlappingSeasons(seasons, '', '2030-07-15')).toEqual([]);
    expect(findOverlappingSeasons(seasons, '2030-07-01', '')).toEqual([]);
  });
});
