import { afterEach, describe, expect, it } from 'vitest';
import { localDateString } from '../utils/localDate';

// Phase 10 ruling: the date sent to /seasons/current is the user's LOCAL calendar
// date, never the toISOString() UTC date. The regression these tests pin: for a
// Toronto user at 11:30pm, toISOString() already says TOMORROW — using it would
// reintroduce the exact final-day bug the ?date= parameter fixes.
describe('localDateString', () => {
  const originalTz = process.env.TZ;

  afterEach(() => {
    process.env.TZ = originalTz;
  });

  it('sends the local calendar date, not the toISOString() UTC date, late in the evening', () => {
    process.env.TZ = 'America/Toronto';
    const lateEvening = new Date(2026, 5, 30, 23, 30); // June 30, 11:30pm local (EDT)

    // The two dates genuinely differ at this moment — the ISO date is already July 1…
    expect(lateEvening.toISOString().slice(0, 10)).toBe('2026-07-01');
    // …and the function must report the LOCAL date, June 30.
    expect(localDateString(lateEvening)).toBe('2026-06-30');
  });

  it('zero-pads single-digit months and days', () => {
    expect(localDateString(new Date(2026, 0, 5, 12, 0))).toBe('2026-01-05');
  });
});
