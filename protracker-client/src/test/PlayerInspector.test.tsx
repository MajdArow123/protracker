import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlayerInspectorBody } from '../components/teams/lineup/PlayerInspector';
import type { Player } from '../types';
import type { RatingState } from '../components/teams/lineup/lineupLogic';

// Interpolating i18n mock (the established pattern).
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string, opts?: Record<string, unknown>) =>
      (fallback ?? key).replace(/\{\{(\w+)\}\}/g, (_, name) => String(opts?.[name] ?? '')),
  }),
}));
vi.mock('../hooks/useLocaleFormat', () => ({
  useLocaleFormat: () => ({ formatDate: (d: string) => `[${d.slice(0, 10)}]` }),
}));
vi.mock('../i18n/dynamicLabels', () => ({
  useDynamicLabels: () => ({ generic: (_g: string, v?: string | null) => v ?? '' }),
}));

// One mutable store drives every data hook — tests set the scenario per case.
const q = (data: unknown) => ({ data, isLoading: false, isError: false });
const state: Record<string, { data: unknown; isLoading: boolean; isError: boolean }> = {};
const resetState = () => {
  state.tests = q([]);
  state.benchmarks = q({ playerId: 1, benchmarkProfileId: null, profileName: null, values: {} });
  state.wellbeing = q({ playerId: 1, playerName: 'X', checkins: [], painDays: 0 });
  state.goals = q([]);
  state.tasks = q([]);
  state.injuries = q([]);
};
vi.mock('../hooks/useEvidence', () => ({ usePlayerObjectiveTests: () => state.tests }));
vi.mock('../hooks/useBenchmarks', () => ({ usePlayerBenchmarks: () => state.benchmarks }));
vi.mock('../hooks/useWellbeing', () => ({ usePlayerWellbeing: () => state.wellbeing }));
vi.mock('../hooks/useGoals', () => ({ usePlayerGoals: () => state.goals }));
vi.mock('../hooks/useTasks', () => ({ useCoachTasks: () => state.tasks }));
vi.mock('../hooks/useInjuries', () => ({ useInjuries: () => state.injuries }));

const player = {
  id: 1, fullName: 'Test Player', positionId: 1, sportId: 1,
  jerseyNumber: 7, status: 'Active',
} as unknown as Player;

const noRating: RatingState = { kind: 'none' };
const goodRating: RatingState = { kind: 'confident', value: 8.2, confidence: 'High', scoredMetrics: 5 };

const baseProps = {
  player, loadFailed: false, breakdown: [], injured: false, open: true, onOpenProfile: () => {},
};

beforeEach(resetState);

describe('PlayerInspector — the all-empty dossier fabricates NOTHING', () => {
  it('renders explicit typed states, plain-fact empties, and no invented numbers', () => {
    const { container } = render(<PlayerInspectorBody {...baseProps} rating={noRating} />);

    // measurements absent → typed not-recorded (tests + wellbeing)
    expect(screen.getAllByText('Not recorded')).toHaveLength(2);
    expect(screen.getByText('No check-in in the last 30 days')).toBeInTheDocument();
    // empty LISTS are facts, not missing states
    expect(screen.getByText('No active injuries')).toBeInTheDocument();
    expect(screen.getByText('No shared goals')).toBeInTheDocument();
    expect(screen.getByText('No open tasks')).toBeInTheDocument();
    // form is not measured by the app — ever
    expect(screen.getByText('Not tracked')).toBeInTheDocument();
    // rating with zero evidence is an em-dash, never 0.0
    expect(container.textContent).not.toContain('0.0');
    // fitnessLevel is deliberately absent until the Phase 3 nullability ruling
    expect(container.textContent!.toLowerCase()).not.toContain('fitness');
    // no numeric value appears anywhere in the empty dossier (jersey #7 aside)
    expect(container.textContent!.replace('#7', '')).not.toMatch(/\d+\.\d/);
  });
});

describe('PlayerInspector — real data renders with provenance', () => {
  it('wellbeing keeps its real names, self-reported label and date', () => {
    state.wellbeing = q({
      playerId: 1, playerName: 'X', painDays: 0,
      checkins: [{ id: 1, playerId: 1, date: '2026-07-16T00:00:00Z', feeling: 3, energy: 4, sleep: 5, hasPain: true, painArea: 'knee', score: 8, createdAt: '' }],
    });
    render(<PlayerInspectorBody {...baseProps} rating={goodRating} />);
    expect(screen.getByText(/Self-reported · \[2026-07-16\]/)).toBeInTheDocument();
    expect(screen.getByText('Energy')).toBeInTheDocument();
    expect(screen.getByText(/Pain reported/)).toBeInTheDocument();
    // never relabeled as fatigue/morale
    expect(document.body.textContent!.toLowerCase()).not.toMatch(/fatigue|morale/);
  });

  it('an injury without a return date says so — no invented dates', () => {
    state.injuries = q([{
      id: 5, playerId: 1, injuryDate: '2026-07-01', injuryType: 'Sprain', bodyPart: 'Ankle',
      severity: 'Moderate', recoveryStatus: 'Recovering', expectedReturnDate: null,
    }]);
    render(<PlayerInspectorBody {...baseProps} rating={goodRating} />);
    expect(screen.getByText(/Sprain · Ankle/)).toBeInTheDocument();
    expect(screen.getByText('Return date not set')).toBeInTheDocument();
  });

  it('trend chips come from computeTrend gates (2 tests can never claim a direction)', () => {
    state.tests = q([
      { id: 1, playerId: 1, metricDefinitionId: 9, metricName: 'Sprint', value: 4.5, unit: 's', testedAt: '2026-06-01T00:00:00Z', testedBy: 'Coach', notes: null, assessmentId: null, normalizedScore: 5 },
      { id: 2, playerId: 1, metricDefinitionId: 9, metricName: 'Sprint', value: 4.3, unit: 's', testedAt: '2026-07-01T00:00:00Z', testedBy: 'Coach', notes: null, assessmentId: null, normalizedScore: 6 },
    ]);
    render(<PlayerInspectorBody {...baseProps} rating={goodRating} />);
    expect(screen.getByText('Sprint')).toBeInTheDocument();
    expect(screen.getByText('Trend needs ≥3 tests')).toBeInTheDocument();
    expect(screen.queryByText('Improving')).not.toBeInTheDocument();
  });

  it('standing claims a band ONLY when a benchmark profile is assigned', () => {
    const tests = [{ id: 1, playerId: 1, metricDefinitionId: 9, metricName: 'Sprint', value: 4.2, unit: 's', testedAt: '2026-07-01T00:00:00Z', testedBy: 'Coach', notes: null, assessmentId: null, normalizedScore: 6 }];
    const values = { 9: { metricDefinitionId: 9, metricName: 'Sprint', unit: 's', inputType: 'Timer', benchmarkLow: 4.8, benchmarkMid: 4.3, benchmarkHigh: 3.9, notes: null } };

    state.tests = q(tests);
    state.benchmarks = q({ playerId: 1, benchmarkProfileId: null, profileName: null, values });
    const first = render(<PlayerInspectorBody {...baseProps} rating={goodRating} />);
    expect(screen.queryByText(/Between Average and Elite/)).not.toBeInTheDocument();
    first.unmount();

    state.benchmarks = q({ playerId: 1, benchmarkProfileId: 3, profileName: 'Junior', values });
    render(<PlayerInspectorBody {...baseProps} rating={goodRating} />);
    expect(screen.getByText('Between Average and Elite')).toBeInTheDocument();
  });

  it('only ACTIVE goals show, capped, with the shared-goals caption', () => {
    state.goals = q([
      { id: 1, title: 'Active goal', status: 'Active', progressPercent: 40, milestones: [] },
      { id: 2, title: 'Done goal', status: 'Achieved', progressPercent: 100, milestones: [] },
    ]);
    render(<PlayerInspectorBody {...baseProps} rating={goodRating} />);
    expect(screen.getByText('Active goal')).toBeInTheDocument();
    expect(screen.queryByText('Done goal')).not.toBeInTheDocument();
    expect(screen.getByText('Shared goals only')).toBeInTheDocument();
  });

  it('a failed request renders load-failed — never "no data"', () => {
    state.tests = { data: undefined, isLoading: false, isError: true };
    render(<PlayerInspectorBody {...baseProps} rating={goodRating} />);
    expect(screen.getByText('Unable to load')).toBeInTheDocument();
    // the failed section must NOT claim not-recorded; wellbeing's is the only one
    expect(screen.getAllByText('Not recorded')).toHaveLength(1);
  });
});
