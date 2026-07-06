import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WellbeingCheckinWidget } from '../components/wellbeing/WellbeingCheckinWidget';
import * as wellbeingHooks from '../hooks/useWellbeing';

vi.mock('../hooks/useWellbeing', () => ({
  useTodayCheckin: vi.fn(),
  useSubmitCheckin: vi.fn(),
}));

const mockedHooks = vi.mocked(wellbeingHooks);

describe('WellbeingCheckinWidget', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockedHooks.useSubmitCheckin.mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any);
  });

  it('shows the check-in prompt when there is no check-in today', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockedHooks.useTodayCheckin.mockReturnValue({ data: null, isLoading: false } as any);
    render(<WellbeingCheckinWidget />);
    expect(screen.getByText('How are you feeling?')).toBeInTheDocument();
  });

  it('shows the checked-in summary once a check-in exists for today', () => {
    mockedHooks.useTodayCheckin.mockReturnValue({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { id: 1, playerId: 1, date: '2026-07-06', feeling: 4, energy: 4, sleep: 5, hasPain: false, painArea: null, painNote: null, score: 8.7 } as any,
      isLoading: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    render(<WellbeingCheckinWidget />);
    expect(screen.getByText("You're checked in for today")).toBeInTheDocument();
  });

  it('renders nothing while loading', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockedHooks.useTodayCheckin.mockReturnValue({ data: undefined, isLoading: true } as any);
    const { container } = render(<WellbeingCheckinWidget />);
    expect(container).toBeEmptyDOMElement();
  });
});
