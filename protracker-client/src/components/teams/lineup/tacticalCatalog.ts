// Per-sport catalogs of tactical preset KEYS (lineup program Phase 3).
// The server stores these as opaque strings (like SlotKey) — the catalog and
// its human labels live entirely here. Keys are stable API data: never rename
// a key (saved lineups reference it); add new ones instead.
//
// Everything here is PRESENTATION-ONLY coach vocabulary — labels and roles
// feed no calculation anywhere (the blueprint's "explicitly not a simulation"
// rule). i18n: each key maps to `teams.role_{key}` / `teams.tacticalLabel_{key}`
// / `teams.setPiece_{key}` with the English fallback below.

export interface TacticalCatalog {
  /** Per-slot role preset keys. */
  roles: string[];
  /** Whole-lineup tactical label keys (max 6 selectable — the server cap). */
  labels: string[];
  /** Set-piece taker type keys; empty = the set-piece section is hidden. */
  setPieceTypes: string[];
}

const SOCCER: TacticalCatalog = {
  roles: [
    'sweeperKeeper', 'ballPlayingDefender', 'overlappingFullback', 'holdingMidfielder',
    'boxToBox', 'playmaker', 'invertedWinger', 'targetForward', 'poacher',
  ],
  labels: ['highPress', 'lowBlock', 'counterAttack', 'possession', 'directPlay', 'wingPlay'],
  setPieceTypes: ['penalties', 'freeKicks', 'cornersLeft', 'cornersRight', 'longThrows'],
};

const BASKETBALL: TacticalCatalog = {
  roles: ['floorGeneral', 'threeAndD', 'rimProtector', 'slasher', 'stretchBig'],
  labels: ['manToMan', 'zoneDefense', 'fastBreak', 'halfCourtSets', 'fullCourtPress'],
  setPieceTypes: ['technicalFreeThrows', 'jumpBall'],
};

const VOLLEYBALL: TacticalCatalog = {
  roles: ['serveSpecialist', 'blockAnchor', 'backRowAttacker', 'defensiveAnchor'],
  labels: ['aggressiveServing', 'quickTempo', 'serveReceiveFocus', 'highBallSafety'],
  setPieceTypes: [],
};

const BEACH: TacticalCatalog = {
  roles: ['netDominant', 'defensiveSpecialist'],
  labels: ['aggressiveServing', 'splitDefense', 'sideOutFocus'],
  setPieceTypes: [],
};

const NONE: TacticalCatalog = { roles: [], labels: [], setPieceTypes: [] };

// Seeded sport ids (FK-enforced): 1 soccer, 2 basketball, 3 volleyball,
// 4 beach volleyball, 5 tennis (tennis has no lineup edit — empty catalog).
const BY_SPORT: Record<number, TacticalCatalog> = {
  1: SOCCER,
  2: BASKETBALL,
  3: VOLLEYBALL,
  4: BEACH,
  5: NONE,
};

export function tacticalCatalogForSport(sportId: number): TacticalCatalog {
  return BY_SPORT[sportId] ?? NONE;
}

/** English fallbacks for `t('teams.role_{key}', …)` etc. — source of truth for i18n. */
export const TACTICAL_FALLBACKS: Record<string, string> = {
  // roles
  role_sweeperKeeper: 'Sweeper keeper',
  role_ballPlayingDefender: 'Ball-playing defender',
  role_overlappingFullback: 'Overlapping fullback',
  role_holdingMidfielder: 'Holding midfielder',
  role_boxToBox: 'Box-to-box',
  role_playmaker: 'Playmaker',
  role_invertedWinger: 'Inverted winger',
  role_targetForward: 'Target forward',
  role_poacher: 'Poacher',
  role_floorGeneral: 'Floor general',
  role_threeAndD: '3-and-D',
  role_rimProtector: 'Rim protector',
  role_slasher: 'Slasher',
  role_stretchBig: 'Stretch big',
  role_serveSpecialist: 'Serve specialist',
  role_blockAnchor: 'Block anchor',
  role_backRowAttacker: 'Back-row attacker',
  role_defensiveAnchor: 'Defensive anchor',
  role_netDominant: 'Net dominant',
  role_defensiveSpecialist: 'Defensive specialist',
  // labels
  tacticalLabel_highPress: 'High press',
  tacticalLabel_lowBlock: 'Low block',
  tacticalLabel_counterAttack: 'Counter-attack',
  tacticalLabel_possession: 'Possession',
  tacticalLabel_directPlay: 'Direct play',
  tacticalLabel_wingPlay: 'Wing play',
  tacticalLabel_manToMan: 'Man-to-man',
  tacticalLabel_zoneDefense: 'Zone defense',
  tacticalLabel_fastBreak: 'Fast break',
  tacticalLabel_halfCourtSets: 'Half-court sets',
  tacticalLabel_fullCourtPress: 'Full-court press',
  tacticalLabel_aggressiveServing: 'Aggressive serving',
  tacticalLabel_quickTempo: 'Quick tempo',
  tacticalLabel_serveReceiveFocus: 'Serve-receive focus',
  tacticalLabel_highBallSafety: 'High-ball safety',
  tacticalLabel_splitDefense: 'Split defense',
  tacticalLabel_sideOutFocus: 'Side-out focus',
  // set pieces
  setPiece_penalties: 'Penalties',
  setPiece_freeKicks: 'Free kicks',
  setPiece_cornersLeft: 'Corners (left)',
  setPiece_cornersRight: 'Corners (right)',
  setPiece_longThrows: 'Long throws',
  setPiece_technicalFreeThrows: 'Technical free throws',
  setPiece_jumpBall: 'Jump ball',
};

type TFunc = (key: string, fallback: string) => string;

export const roleLabel = (t: TFunc, key: string) =>
  t(`teams.role_${key}`, TACTICAL_FALLBACKS[`role_${key}`] ?? key);
export const tacticalLabelText = (t: TFunc, key: string) =>
  t(`teams.tacticalLabel_${key}`, TACTICAL_FALLBACKS[`tacticalLabel_${key}`] ?? key);
export const setPieceLabel = (t: TFunc, key: string) =>
  t(`teams.setPiece_${key}`, TACTICAL_FALLBACKS[`setPiece_${key}`] ?? key);
