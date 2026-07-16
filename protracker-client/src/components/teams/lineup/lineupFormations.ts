// Formation/slot definitions for the editable lineup (Phase 2). A "formation"
// is a fixed list of slots; the server stores only the formation key + slot
// assignments, so these definitions are the single source of slot semantics.
// Coordinates are % on the LTR surface (same space as lineupLayouts).

export interface FormationSlot {
  key: string;
  x: number;
  y: number;
  /** Natural positions for this slot — drives suggestions + the out-of-position hint. */
  naturalPositionIds: number[];
  /** Grouping for formation-change remapping (players stay in their line). */
  lineId: string;
  /** Visually distinct slot (volleyball Libero). */
  accent?: boolean;
}

export interface FormationDef {
  key: string;
  slots: FormationSlot[];
}

const GK: FormationSlot = { key: 'GK', x: 50, y: 89, naturalPositionIds: [1], lineId: 'GK' };

function line(prefix: string, lineId: string, y: number, xs: number[], natural: number[][] | number[]): FormationSlot[] {
  return xs.map((x, i) => ({
    key: `${prefix}${i + 1}`,
    x,
    y,
    naturalPositionIds: Array.isArray(natural[0]) ? (natural as number[][])[i] : (natural as number[]),
    lineId,
  }));
}

// Soccer: 1 GK, 2 DEF, 3 MID, 4 WNG, 5 ST.
export const SOCCER_FORMATIONS: FormationDef[] = [
  {
    key: '4-3-3',
    slots: [GK,
      ...line('D', 'DEF', 71, [18, 38, 62, 82], [2]),
      ...line('M', 'MID', 49, [27, 50, 73], [3]),
      ...line('A', 'ATT', 26, [20, 50, 80], [[4, 5], [5], [4, 5]])],
  },
  {
    key: '4-4-2',
    slots: [GK,
      ...line('D', 'DEF', 71, [18, 38, 62, 82], [2]),
      ...line('M', 'MID', 49, [15, 38, 62, 85], [[3, 4], [3], [3], [3, 4]]),
      ...line('A', 'ATT', 26, [38, 62], [[5, 4], [5, 4]])],
  },
  {
    key: '4-2-3-1',
    slots: [GK,
      ...line('D', 'DEF', 71, [18, 38, 62, 82], [2]),
      ...line('M', 'MID', 55, [38, 62], [3]),
      ...line('W', 'WID', 37, [20, 50, 80], [[4, 3], [3], [4, 3]]),
      ...line('A', 'ATT', 22, [50], [[5]])],
  },
  {
    key: '3-5-2',
    slots: [GK,
      ...line('D', 'DEF', 71, [25, 50, 75], [2]),
      ...line('M', 'MID', 49, [10, 30, 50, 70, 90], [[3, 4], [3], [3], [3], [3, 4]]),
      ...line('A', 'ATT', 26, [38, 62], [[5], [5]])],
  },
  {
    key: '3-4-3',
    slots: [GK,
      ...line('D', 'DEF', 71, [25, 50, 75], [2]),
      ...line('M', 'MID', 49, [15, 38, 62, 85], [[3, 4], [3], [3], [3, 4]]),
      ...line('A', 'ATT', 26, [20, 50, 80], [[4, 5], [5], [4, 5]])],
  },
  {
    key: '5-3-2',
    slots: [GK,
      ...line('D', 'DEF', 71, [10, 30, 50, 70, 90], [2]),
      ...line('M', 'MID', 49, [27, 50, 73], [3]),
      ...line('A', 'ATT', 26, [38, 62], [[5], [5]])],
  },
];

// Court sports have a single fixed shape — same coordinates as the Phase 1 layouts.
const BASKETBALL_FIVE: FormationDef = {
  key: '5',
  slots: [
    { key: 'C', x: 62, y: 24, naturalPositionIds: [10], lineId: 'C' },
    { key: 'PF', x: 28, y: 40, naturalPositionIds: [9], lineId: 'PF' },
    { key: 'SF', x: 82, y: 56, naturalPositionIds: [8], lineId: 'SF' },
    { key: 'SG', x: 18, y: 68, naturalPositionIds: [7], lineId: 'SG' },
    { key: 'PG', x: 50, y: 82, naturalPositionIds: [6], lineId: 'PG' },
  ],
};

const VOLLEYBALL_51: FormationDef = {
  key: '5-1',
  slots: [
    { key: 'OH_F', x: 20, y: 30, naturalPositionIds: [12], lineId: 'FRONT' },
    { key: 'MB_F', x: 50, y: 30, naturalPositionIds: [14], lineId: 'FRONT' },
    { key: 'OPP_F', x: 80, y: 30, naturalPositionIds: [13], lineId: 'FRONT' },
    { key: 'OH_B', x: 20, y: 72, naturalPositionIds: [12], lineId: 'BACK' },
    { key: 'L_B', x: 50, y: 72, naturalPositionIds: [15], lineId: 'BACK', accent: true },
    { key: 'S_B', x: 80, y: 72, naturalPositionIds: [11], lineId: 'BACK' },
  ],
};

const BEACH_PAIR: FormationDef = {
  key: 'pair',
  slots: [
    { key: 'BLK', x: 38, y: 34, naturalPositionIds: [17, 18], lineId: 'BLK' },
    { key: 'DEF', x: 62, y: 68, naturalPositionIds: [16, 18], lineId: 'DEF' },
  ],
};

const BY_SPORT: Record<number, FormationDef[]> = {
  1: SOCCER_FORMATIONS,
  2: [BASKETBALL_FIVE],
  3: [VOLLEYBALL_51],
  4: [BEACH_PAIR],
  // 5 (tennis) intentionally absent — the ladder is read-only, nothing to edit or save.
};

export function formationsForSport(sportId: number): FormationDef[] {
  return BY_SPORT[sportId] ?? [];
}

export function defaultFormation(sportId: number): FormationDef | null {
  return BY_SPORT[sportId]?.[0] ?? null;
}

/** Resolve a stored formation key; unknown keys fall back to the sport default (old saves stay loadable). */
export function formationOrDefault(sportId: number, key: string | null | undefined): FormationDef | null {
  const defs = BY_SPORT[sportId];
  if (!defs) return null;
  return defs.find(f => f.key === key) ?? defs[0];
}

export function isEditableSport(sportId: number): boolean {
  return (BY_SPORT[sportId]?.length ?? 0) > 0;
}
