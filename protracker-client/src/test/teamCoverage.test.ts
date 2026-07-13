import { describe, it, expect } from 'vitest';
import { coverageLevel } from '../components/evidence/teamCoverage';

describe('coverageLevel', () => {
  it('returns none with no scored players (or an empty squad)', () => {
    expect(coverageLevel(0, 8)).toBe('none');
    expect(coverageLevel(0, 0)).toBe('none');
    expect(coverageLevel(3, 0)).toBe('none');
  });

  it('is always thin below 3 scored players, whatever the ratio', () => {
    // 2 of 2 is 100% coverage but still an anecdote, not an average.
    expect(coverageLevel(2, 2)).toBe('thin');
    expect(coverageLevel(2, 8)).toBe('thin');
    expect(coverageLevel(1, 1)).toBe('thin');
  });

  it('is thin below half the squad', () => {
    expect(coverageLevel(3, 8)).toBe('thin');    // 37%
    expect(coverageLevel(4, 10)).toBe('thin');   // 40%
  });

  it('is partial from 50% up to (not including) 80%', () => {
    expect(coverageLevel(4, 8)).toBe('partial'); // exactly 50%
    expect(coverageLevel(6, 8)).toBe('partial'); // 75%
    expect(coverageLevel(7, 9)).toBe('partial'); // ~78%
  });

  it('is good from 80% coverage', () => {
    expect(coverageLevel(7, 8)).toBe('good');    // 87.5%
    expect(coverageLevel(8, 10)).toBe('good');   // exactly 80%
    expect(coverageLevel(8, 8)).toBe('good');
    expect(coverageLevel(3, 3)).toBe('good');    // small squad, full coverage, >= 3 scored
  });
});
