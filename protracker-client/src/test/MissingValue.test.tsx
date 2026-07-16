import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MissingValue } from '../components/ui/MissingValue';
import type { MissingReason } from '../types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string, opts?: Record<string, unknown>) =>
      (fallback ?? key).replace(/\{\{(\w+)\}\}/g, (_, name) => String(opts?.[name] ?? '')),
  }),
}));

const CASES: Array<[MissingReason, string]> = [
  ['not-tracked', 'Not tracked'],
  ['not-recorded', 'Not recorded'],
  ['not-set', 'Not set'],
  ['not-enough-data', 'Not enough data'],
  ['load-failed', 'Unable to load'],
];

describe('MissingValue (full variant)', () => {
  it.each(CASES)('%s renders its own distinct visible label', (reason, label) => {
    render(<MissingValue reason={reason} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('never collapses two states into the same text', () => {
    const seen = new Set<string>();
    for (const [reason] of CASES) {
      const { container, unmount } = render(<MissingValue reason={reason} />);
      seen.add(container.textContent ?? '');
      unmount();
    }
    expect(seen.size).toBe(CASES.length);
  });
});

describe('MissingValue (compact variant)', () => {
  it.each(CASES)('%s keeps the state accessible behind the glyph', (reason, label) => {
    const { container } = render(<MissingValue reason={reason} variant="compact" />);
    // visible glyph: "?" only for load failures, "—" otherwise (RatingChip convention)
    const glyph = container.querySelector('[aria-hidden="true"]');
    expect(glyph?.textContent).toBe(reason === 'load-failed' ? '?' : '—');
    // the semantic label is still there for AT + hover
    expect(screen.getByText(label)).toHaveClass('sr-only');
    expect(container.querySelector('[title]')?.getAttribute('title')).toBe(label);
  });
});

describe('MissingValue (fallback)', () => {
  it('an unexpected reason renders a safe Unknown, not one of the five states', () => {
    render(<MissingValue reason="mystery" />);
    expect(screen.getByText('Unknown')).toBeInTheDocument();
    for (const [, label] of CASES) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }
  });
});
