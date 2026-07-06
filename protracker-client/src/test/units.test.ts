import { describe, it, expect } from 'vitest';
import {
  cmToFtIn, ftInToCm, kgToLb, lbToKg, formatHeight, formatWeight,
} from '../utils/units';

describe('units', () => {
  it('cmToFtIn converts 180cm to 5\'11"', () => {
    expect(cmToFtIn(180)).toEqual({ ft: '5', inches: '11' });
  });

  it('ftInToCm converts 5ft 11in back to ~180cm', () => {
    expect(ftInToCm('5', '11')).toBe('180');
  });

  it('kgToLb converts 80kg to 176lb', () => {
    expect(kgToLb(80)).toBe('176');
  });

  it('lbToKg converts 176lb to 80kg', () => {
    expect(lbToKg(176)).toBe('80');
  });

  it('kgToLb returns empty string for non-numeric input', () => {
    expect(kgToLb('abc')).toBe('');
  });

  it('formatHeight honors the cm and ft-in units', () => {
    expect(formatHeight(180, 'cm')).toBe('180 cm');
    expect(formatHeight(180, 'ftin')).toBe(`5'11"`);
  });

  it('formatWeight honors the kg and lb units', () => {
    expect(formatWeight(80, 'kg')).toBe('80 kg');
    expect(formatWeight(80, 'lb')).toBe('176 lb');
  });

  it('formatHeight/formatWeight return null for null input', () => {
    expect(formatHeight(null, 'cm')).toBeNull();
    expect(formatWeight(undefined, 'kg')).toBeNull();
  });
});
