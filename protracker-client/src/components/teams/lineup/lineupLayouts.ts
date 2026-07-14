import type { SportLineupLayout } from './lineupLogic';

// Per-sport surface layouts. Position ids are the seeded reference data
// (ApplicationDbContext.SeedReferenceData) — FK-enforced, so no free-text drift:
//   Soccer:     1 Goalkeeper, 2 Defender, 3 Midfielder, 4 Winger, 5 Striker
//   Basketball: 6 Point Guard, 7 Shooting Guard, 8 Small Forward, 9 Power Forward, 10 Center
//   Volleyball: 11 Setter, 12 Outside Hitter, 13 Opposite Hitter, 14 Middle Blocker, 15 Libero
//   Beach:      16 Defender, 17 Blocker, 18 All-Round Player
//   Tennis:     19-23 (playing styles — ladder, no court)

export const SOCCER_LAYOUT: SportLineupLayout = {
  kind: 'pitch',
  capacity: 11,
  aspect: '68 / 105',
  lines: [
    { id: 'GK', positionIds: [1], min: 1, max: 1, y: 89, countsInShape: false },
    { id: 'DEF', positionIds: [2], min: 3, max: 5, y: 71 },
    { id: 'MID', positionIds: [3], min: 2, max: 5, y: 49 },
    { id: 'ATT', positionIds: [4, 5], min: 1, max: 4, y: 26, wide: [4] },
  ],
};

// Half-court, basket at the top. One slot per position = the starting five.
// countsInShape false everywhere: "1-1-1-1-1" is not a formation claim worth making.
export const BASKETBALL_LAYOUT: SportLineupLayout = {
  kind: 'court',
  capacity: 5,
  aspect: '15 / 14',
  lines: [
    { id: 'C', positionIds: [10], min: 1, max: 1, y: 24, x: 62, countsInShape: false },
    { id: 'PF', positionIds: [9], min: 1, max: 1, y: 40, x: 28, countsInShape: false },
    { id: 'SF', positionIds: [8], min: 1, max: 1, y: 56, x: 82, countsInShape: false },
    { id: 'SG', positionIds: [7], min: 1, max: 1, y: 68, x: 18, countsInShape: false },
    { id: 'PG', positionIds: [6], min: 1, max: 1, y: 82, x: 50, countsInShape: false },
  ],
};

// Own half, net at the top, classic 5-1 display: front row OH-MB-OPP, back row
// OH-Libero-Setter. The Outside Hitter position feeds BOTH OH slots (front first);
// the Libero slot is visually accented (inverted-jersey convention).
export const VOLLEYBALL_LAYOUT: SportLineupLayout = {
  kind: 'court',
  capacity: 6,
  aspect: '9 / 10',
  lines: [
    { id: 'OH_F', positionIds: [12], min: 1, max: 1, y: 30, x: 20, countsInShape: false },
    { id: 'MB_F', positionIds: [14], min: 1, max: 1, y: 30, x: 50, countsInShape: false },
    { id: 'OPP_F', positionIds: [13], min: 1, max: 1, y: 30, x: 80, countsInShape: false },
    { id: 'OH_B', positionIds: [12], min: 0, max: 1, y: 72, x: 20, countsInShape: false },
    { id: 'L_B', positionIds: [15], min: 1, max: 1, y: 72, x: 50, countsInShape: false, accent: true },
    { id: 'S_B', positionIds: [11], min: 1, max: 1, y: 72, x: 80, countsInShape: false },
  ],
};

// Sand court, net at the top: Blocker at the net, Defender deep. An All-Round
// Player (18) can fill either slot.
export const BEACH_LAYOUT: SportLineupLayout = {
  kind: 'court',
  capacity: 2,
  aspect: '8 / 9',
  lines: [
    { id: 'BLK', positionIds: [17, 18], min: 1, max: 1, y: 34, x: 38, countsInShape: false },
    { id: 'DEF', positionIds: [16, 18], min: 1, max: 1, y: 68, x: 62, countsInShape: false },
  ],
};

// Tennis is individual — a ranked ladder (buildLadder), no court surface.
export const TENNIS_LAYOUT: SportLineupLayout = {
  kind: 'ladder',
  capacity: 0,
  aspect: '1 / 1',
  lines: [],
};

export function layoutForSport(sportId: number | undefined): SportLineupLayout | null {
  switch (sportId) {
    case 1: return SOCCER_LAYOUT;
    case 2: return BASKETBALL_LAYOUT;
    case 3: return VOLLEYBALL_LAYOUT;
    case 4: return BEACH_LAYOUT;
    case 5: return TENNIS_LAYOUT;
    default: return null;
  }
}

// Short on-card labels per seeded position id (i18n key suffix — resolved via
// t(`teams.posAbbr_${positionId}`)).
export const POSITION_ABBR_FALLBACK: Record<number, string> = {
  1: 'GK', 2: 'DEF', 3: 'MID', 4: 'WNG', 5: 'ST',
  6: 'PG', 7: 'SG', 8: 'SF', 9: 'PF', 10: 'C',
  11: 'SET', 12: 'OH', 13: 'OPP', 14: 'MB', 15: 'LIB',
  16: 'DEF', 17: 'BLK', 18: 'ALL',
  19: 'SGL', 20: 'DBL', 21: 'BASE', 22: 'S&V', 23: 'ALL',
};

export function positionAbbr(positionId: number | null | undefined, t: (key: string, fallback: string) => string): string {
  if (positionId == null) return '';
  return t(`teams.posAbbr_${positionId}`, POSITION_ABBR_FALLBACK[positionId] ?? '');
}
