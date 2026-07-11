// Chart color system. The categorical palette is CVD-validated (dataviz six-checks:
// lightness band, chroma floor, adjacent-pair colorblind separation ≥ 12ΔE, contrast
// ≥ 3:1) against BOTH the dark (#111827) and light (#ffffff) chart surfaces — don't
// swap hues without re-running the validator. Hue intents follow the design spec
// (blue/emerald/violet/amber/red/cyan/orange); lime was replaced by pink because
// lime↔orange fails deutan separation (ΔE 7).

// Fixed categorical order — assign by position, never re-cycle when filtering.
export const CATEGORICAL = [
  '#3b82f6', // blue
  '#059669', // emerald
  '#8b5cf6', // violet
  '#d97706', // amber
  '#ef4444', // red
  '#0891b2', // cyan
  '#ea580c', // orange
  '#db2777', // pink
] as const;

// Stable per-metric colors: the same category always wears the same hue, across
// pages and across sports (shared names like "Passing" stay consistent).
const METRIC_COLORS: Record<string, string> = {
  // Soccer
  'Speed': '#3b82f6',
  'Stamina': '#059669',
  'Passing': '#8b5cf6',
  'Shooting': '#d97706',
  'Defense': '#ef4444',
  'Defending': '#ef4444',
  'Ball Control': '#0891b2',
  'Agility': '#ea580c',
  'Match Performance': '#db2777',
  // Basketball
  'Dribbling': '#0891b2',
  'Ball Handling': '#0891b2',
  'Rebounding': '#059669',
  'Vertical Jump': '#3b82f6',
  'Court Vision': '#8b5cf6',
  'Conditioning': '#059669',
  'Decision Making': '#db2777',
  'Leadership': '#db2777',
  // Volleyball / Beach
  'Serving': '#d97706',
  'Serve': '#d97706',
  'Setting': '#8b5cf6',
  'Blocking': '#ef4444',
  'Spiking': '#ea580c',
  'Attack': '#ea580c',
  'Reaction': '#3b82f6',
  'Jumping': '#3b82f6',
  'Team Communication': '#db2777',
  'Communication': '#db2777',
  'Movement on Sand': '#3b82f6',
  'Sand Movement': '#3b82f6',
  'Digging': '#0891b2',
  'Defensive Coverage': '#0891b2',
  'Jump Endurance': '#059669',
  'Court Positioning': '#8b5cf6',
  'Court Coverage': '#8b5cf6',
  'Wind Adaptation': '#db2777',
  // Tennis
  'Forehand': '#3b82f6',
  'Backhand': '#8b5cf6',
  'Footwork': '#ea580c',
  'Return': '#0891b2',
  'Volley': '#db2777',
  'Match Strategy': '#8b5cf6',
  'Consistency': '#059669',
  'Match Consistency': '#059669',
  'Mental Focus': '#db2777',
  'Mental Toughness': '#db2777',
  'Endurance': '#059669',
};

// Color for a named category; unmapped names take the fixed-order slot for their
// index (stable within one chart's series list).
export function categoryColor(name: string, index = 0): string {
  return METRIC_COLORS[name] ?? CATEGORICAL[index % CATEGORICAL.length];
}

// Canonical 0-10 score banding: red < 5.0 ≤ amber < 7.0 ≤ green.
// SINGLE source of truth for every score badge/bar/ring in the app — never
// hand-roll thresholds per page (that's how 7.0 ended up amber on one page
// and green on another).
export type ScoreTone = 'red' | 'amber' | 'green';

export function scoreTone(value: number): ScoreTone {
  if (value < 5) return 'red';
  if (value < 7) return 'amber';
  return 'green';
}

// Solid hex per tone, for inline styles (text/bars).
export const SCORE_TONE_HEX: Record<ScoreTone, string> = {
  red: '#ef4444',
  amber: '#f59e0b',
  green: '#10b981',
};

export interface ScoreBand {
  id: string;
  from: string;
  to: string;
  solid: string;
}

export const SCORE_BANDS: ScoreBand[] = [
  { id: 'score-red', from: '#ef4444', to: '#fca5a5', solid: '#ef4444' },
  { id: 'score-amber', from: '#f59e0b', to: '#fcd34d', solid: '#f59e0b' },
  { id: 'score-green', from: '#10b981', to: '#6ee7b7', solid: '#10b981' },
];

const BAND_BY_TONE: Record<ScoreTone, ScoreBand> = {
  red: SCORE_BANDS[0],
  amber: SCORE_BANDS[1],
  green: SCORE_BANDS[2],
};

export function scoreBand(value: number): ScoreBand {
  return BAND_BY_TONE[scoreTone(value)];
}

// Confidence status colors (status palette — reserved, never used for series):
// Low = gray, Medium = amber, High = blue, VeryHigh = green.
export const CONFIDENCE_COLORS = {
  Low: '#9ca3af',
  Medium: '#f59e0b',
  High: '#3b82f6',
  VeryHigh: '#10b981',
} as const;

// Chart chrome shared by every chart (recessive grid/axes, both modes).
export const CHART_GRID = { stroke: '#9ca3af', strokeOpacity: 0.18, strokeDasharray: '2 4' };
export const AXIS_TICK = { fontSize: 11, fill: '#6b7280' };
