import { describe, it, expect } from 'vitest';
import { sportKey, scoreLabelsForSport, parseStatJson } from '../utils/matchSport';

describe('matchSport.sportKey', () => {
  it('maps sport names to canonical keys', () => {
    expect(sportKey('Basketball')).toBe('basketball');
    expect(sportKey('Beach Volleyball')).toBe('beach');
    expect(sportKey('Volleyball Indoor')).toBe('volleyball');
    expect(sportKey('Tennis')).toBe('tennis');
    expect(sportKey('Football / Soccer')).toBe('soccer');
  });
  it('defaults to soccer for unknown/empty input', () => {
    expect(sportKey(undefined)).toBe('soccer');
    expect(sportKey('Rugby')).toBe('soccer');
  });
});

describe('matchSport', () => {
  it('scoreLabelsForSport is sport-aware', () => {
    expect(scoreLabelsForSport('Basketball')).toEqual({ for: 'Points For', against: 'Points Against' });
    expect(scoreLabelsForSport('Football')).toEqual({ for: 'Goals For', against: 'Goals Against' });
    expect(scoreLabelsForSport('Tennis')).toEqual({ for: 'Sets Won', against: 'Sets Lost' });
  });

  it('parseStatJson parses valid JSON and tolerates junk', () => {
    expect(parseStatJson('{"goals":2,"assists":1}')).toEqual({ goals: 2, assists: 1 });
    expect(parseStatJson('not json')).toEqual({});
    expect(parseStatJson(null)).toEqual({});
    expect(parseStatJson(undefined)).toEqual({});
  });
});
