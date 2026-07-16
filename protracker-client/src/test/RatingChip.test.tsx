import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RatingChip } from '../components/teams/lineup/LineupPlayerCard';
import type { RatingState } from '../components/teams/lineup/lineupLogic';

// Regression net for the Phase-0 contract: the chip's existing honesty ladder is
// UNCHANGED; the only addition is the accessible calculated-source title on the
// medium/confident value chips (which previously had no title at all).
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string, opts?: Record<string, unknown>) =>
      (fallback ?? key).replace(/\{\{(\w+)\}\}/g, (_, name) => String(opts?.[name] ?? '')),
  }),
}));

const confident: RatingState = { kind: 'confident', value: 8.42, confidence: 'VeryHigh', scoredMetrics: 6 };
const medium: RatingState = { kind: 'medium', value: 6.1, confidence: 'Medium', scoredMetrics: 4 };
const thin: RatingState = { kind: 'thin', value: 9.5, confidence: 'Low', scoredMetrics: 2 };

describe('RatingChip — existing behaviour unchanged', () => {
  it('no data renders an em-dash, never 0.0', () => {
    const { container } = render(<RatingChip rating={{ kind: 'none' }} />);
    expect(container.textContent).toBe('—');
    expect(container.textContent).not.toContain('0.0');
    expect(container.querySelector('[title]')?.getAttribute('title')).toBe('No data');
  });

  it('a load failure renders "?" — a different claim from "no data"', () => {
    const { container } = render(<RatingChip rating={confident} loadFailed />);
    expect(container.textContent).toBe('?');
    expect(container.querySelector('[title]')?.getAttribute('title')).toBe('Rating unavailable');
  });

  it('thin data stays muted + dashed with its caution title, value still shown', () => {
    const { container } = render(<RatingChip rating={thin} />);
    expect(screen.getByText('9.5')).toBeInTheDocument();
    const chip = container.querySelector('span');
    expect(chip?.className).toContain('border-dashed');
    expect(chip?.className).toContain('text-gray-500');
    expect(chip?.getAttribute('title')).toBe('Thin data — treat with caution');
  });

  it('confident renders bold with the value to one decimal', () => {
    const { container } = render(<RatingChip rating={confident} />);
    expect(screen.getByText('8.4')).toBeInTheDocument();
    expect(container.querySelector('span')?.className).toContain('font-black');
  });

  it('medium renders semibold, not bold', () => {
    const { container } = render(<RatingChip rating={medium} />);
    const cls = container.querySelector('span')?.className ?? '';
    expect(cls).toContain('font-semibold');
    expect(cls).not.toContain('font-black');
  });
});

describe('RatingChip — Phase 0 accessible provenance', () => {
  it('the confident chip declares its calculated source in the title', () => {
    const { container } = render(<RatingChip rating={confident} />);
    expect(container.querySelector('span')?.getAttribute('title'))
      .toBe('Calculated from 6 evidence metrics — Very High confidence');
  });

  it('the medium chip declares its calculated source in the title', () => {
    const { container } = render(<RatingChip rating={medium} />);
    expect(container.querySelector('span')?.getAttribute('title'))
      .toBe('Calculated from 4 evidence metrics — Medium confidence');
  });

  it('thin/none/failed titles are NOT replaced by the source title', () => {
    for (const [rating, failed, title] of [
      [thin, false, 'Thin data — treat with caution'],
      [{ kind: 'none' } as RatingState, false, 'No data'],
      [confident, true, 'Rating unavailable'],
    ] as const) {
      const { container, unmount } = render(<RatingChip rating={rating} loadFailed={failed} />);
      expect(container.querySelector('span')?.getAttribute('title')).toBe(title);
      unmount();
    }
  });
});
