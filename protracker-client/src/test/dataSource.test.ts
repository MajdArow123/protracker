import { describe, it, expect } from 'vitest';
import {
  sourceMeta, missingReasonMeta, UNKNOWN_SOURCE_META, UNKNOWN_MISSING_META,
} from '../utils/dataSource';
import type { DataSource, MissingReason } from '../types';

const SOURCES: DataSource[] = ['recorded', 'coach-entered', 'player-reported', 'calculated', 'not-tracked'];
const REASONS: MissingReason[] = ['not-tracked', 'not-recorded', 'not-set', 'not-enough-data', 'load-failed'];

describe('sourceMeta', () => {
  it('returns a distinct label and icon for every DataSource value', () => {
    const labels = SOURCES.map(s => sourceMeta(s).fallbackLabel);
    expect(new Set(labels).size).toBe(SOURCES.length);
    const keys = SOURCES.map(s => sourceMeta(s).labelKey);
    expect(new Set(keys).size).toBe(SOURCES.length);
    for (const s of SOURCES) {
      expect(sourceMeta(s).icon).toBeTruthy();
      expect(sourceMeta(s).labelKey).toMatch(/^common\.dataSource\./);
    }
  });

  it('falls back to an explicit Unknown for unexpected values — never a real provenance', () => {
    const meta = sourceMeta('telepathy');
    expect(meta).toBe(UNKNOWN_SOURCE_META);
    expect(meta.fallbackLabel).toBe('Unknown source');
    // the fallback must not masquerade as any of the five real sources
    for (const s of SOURCES) expect(meta.labelKey).not.toBe(sourceMeta(s).labelKey);
  });
});

describe('missingReasonMeta', () => {
  it('keeps the five absence states semantically distinct', () => {
    const labels = REASONS.map(r => missingReasonMeta(r).fallbackLabel);
    expect(new Set(labels).size).toBe(REASONS.length);
    expect(missingReasonMeta('not-tracked').fallbackLabel).toBe('Not tracked');
    expect(missingReasonMeta('not-recorded').fallbackLabel).toBe('Not recorded');
    expect(missingReasonMeta('not-set').fallbackLabel).toBe('Not set');
    expect(missingReasonMeta('not-enough-data').fallbackLabel).toBe('Not enough data');
    expect(missingReasonMeta('load-failed').fallbackLabel).toBe('Unable to load');
  });

  it('reserves "?" for load failures; every other absence is an em-dash', () => {
    for (const r of REASONS) {
      expect(missingReasonMeta(r).glyph).toBe(r === 'load-failed' ? '?' : '—');
    }
  });

  it('falls back safely on unexpected values without claiming a real state', () => {
    const meta = missingReasonMeta('gremlins');
    expect(meta).toBe(UNKNOWN_MISSING_META);
    expect(meta.glyph).toBe('—');
    for (const r of REASONS) expect(meta.labelKey).not.toBe(missingReasonMeta(r).labelKey);
  });
});
