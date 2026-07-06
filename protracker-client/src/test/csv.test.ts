import { describe, it, expect } from 'vitest';
import { toCsv, slugify, csvDate } from '../utils/csv';

describe('csv', () => {
  it('builds a header row and body row', () => {
    const csv = toCsv([{ Name: 'Lucas', Age: 19 }]);
    expect(csv).toBe('Name,Age\r\nLucas,19');
  });

  it('quotes values containing commas', () => {
    const csv = toCsv([{ Note: 'fast, agile' }]);
    expect(csv).toBe('Note\r\n"fast, agile"');
  });

  it('escapes embedded double quotes by doubling them', () => {
    const csv = toCsv([{ Q: 'he said "go"' }]);
    expect(csv).toBe('Q\r\n"he said ""go"""');
  });

  it('quotes values containing newlines', () => {
    const csv = toCsv([{ Multi: 'line1\nline2' }]);
    expect(csv).toBe('Multi\r\n"line1\nline2"');
  });

  it('renders null/undefined as empty cells', () => {
    const csv = toCsv([{ A: null, B: undefined, C: 'x' }]);
    expect(csv).toBe('A,B,C\r\n,,x');
  });

  it('respects an explicit header/column order', () => {
    const csv = toCsv([{ b: 2, a: 1 }], ['a', 'b']);
    expect(csv).toBe('a,b\r\n1,2');
  });

  it('slugify makes filenames tidy', () => {
    expect(slugify('City FC U18')).toBe('City-FC-U18');
    expect(slugify('2025/26 Season')).toBe('2025-26-Season');
  });

  it('csvDate formats ISO dates and handles missing values', () => {
    expect(csvDate('2026-07-06T10:30:00Z')).toBe('2026-07-06');
    expect(csvDate(null)).toBe('');
    expect(csvDate('not-a-date')).toBe('');
  });
});
