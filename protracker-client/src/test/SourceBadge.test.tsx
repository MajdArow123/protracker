import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SourceBadge } from '../components/ui/SourceBadge';
import type { DataSource } from '../types';

// jsdom has no initialized i18next instance — mock t() to interpolate the
// English defaultValue (the established SwapModal.test pattern).
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string, opts?: Record<string, unknown>) =>
      (fallback ?? key).replace(/\{\{(\w+)\}\}/g, (_, name) => String(opts?.[name] ?? '')),
  }),
}));

const CASES: Array<[DataSource, string]> = [
  ['recorded', 'Recorded'],
  ['coach-entered', 'Coach-entered'],
  ['player-reported', 'Player-reported'],
  ['calculated', 'Calculated'],
  ['not-tracked', 'Not tracked'],
];

describe('SourceBadge', () => {
  it.each(CASES)('renders %s with a VISIBLE text label (never color-only)', (source, label) => {
    render(<SourceBadge source={source} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('marks the icon decorative so the text is the accessible content', () => {
    const { container } = render(<SourceBadge source="recorded" />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute('aria-hidden')).toBe('true');
  });

  it('labels remain distinguishable with all color stripped (text only)', () => {
    const seen = new Set<string>();
    for (const [source] of CASES) {
      const { container, unmount } = render(<SourceBadge source={source} />);
      seen.add(container.textContent ?? '');
      unmount();
    }
    expect(seen.size).toBe(CASES.length);
  });

  it('an unexpected source renders the explicit Unknown badge, not a real provenance', () => {
    render(<SourceBadge source="vibes" />);
    expect(screen.getByText('Unknown source')).toBeInTheDocument();
  });

  it('accepts a richer hover title while keeping the visible source name', () => {
    render(<SourceBadge source="calculated" title="Calculated · from evidence scores" />);
    const badge = screen.getByText('Calculated');
    expect(badge.closest('span[title]')?.getAttribute('title')).toBe('Calculated · from evidence scores');
  });

  it('renders inside an RTL container without error', () => {
    render(
      <div dir="rtl">
        <SourceBadge source="player-reported" />
      </div>,
    );
    expect(screen.getByText('Player-reported')).toBeInTheDocument();
  });
});
