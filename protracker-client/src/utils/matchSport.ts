// Sport-aware config for match logging & player stats. Keeps all sport-specific
// language in one place (never hardcode it in components).

export interface MatchStatField {
  key: string;   // stored in PlayerMatchRating.statJson
  label: string; // short column header
  full: string;  // full label for the input
}

// Normalize the various stored sport names to a key we branch on.
export type SportKey = 'soccer' | 'basketball' | 'volleyball' | 'beach' | 'tennis';

export function sportKey(sportName?: string | null): SportKey {
  const s = (sportName ?? '').toLowerCase();
  if (s.includes('basket')) return 'basketball';
  if (s.includes('beach')) return 'beach';
  if (s.includes('volley')) return 'volleyball';
  if (s.includes('tennis')) return 'tennis';
  return 'soccer';
}

// Player stat fields per sport (the union stored as JSON in statJson).
// Keys are aligned with the evidence system's match-stat mapping (backend
// MatchStatRules / frontend matchStatFields.ts) so rated matches auto-import
// straight into evidence-based scores.
const STAT_FIELDS: Record<SportKey, MatchStatField[]> = {
  soccer: [
    { key: 'goals', label: 'G', full: 'Goals' },
    { key: 'assists', label: 'A', full: 'Assists' },
    { key: 'shots', label: 'Sh', full: 'Shots' },
    { key: 'shotsOnTarget', label: 'SoT', full: 'Shots on Target' },
    { key: 'passes', label: 'Pass', full: 'Passes' },
    { key: 'passAccuracy', label: 'Pass%', full: 'Pass Accuracy (%)' },
    { key: 'dribbles', label: 'Drb', full: 'Dribbles' },
    { key: 'tackles', label: 'Tkl', full: 'Tackles' },
    { key: 'interceptions', label: 'Int', full: 'Interceptions' },
    { key: 'distanceKm', label: 'Km', full: 'Distance (km)' },
    { key: 'yellowCards', label: '🟨', full: 'Yellow' },
    { key: 'redCards', label: '🟥', full: 'Red' },
    { key: 'minutesPlayed', label: 'Min', full: 'Minutes' },
  ],
  basketball: [
    { key: 'points', label: 'Pts', full: 'Points' },
    { key: 'rebounds', label: 'Reb', full: 'Rebounds' },
    { key: 'assists', label: 'Ast', full: 'Assists' },
    { key: 'steals', label: 'Stl', full: 'Steals' },
    { key: 'blocks', label: 'Blk', full: 'Blocks' },
    { key: 'turnovers', label: 'TO', full: 'Turnovers' },
    { key: 'fgPercentage', label: 'FG%', full: 'FG %' },
    { key: 'threePercentage', label: '3P%', full: '3P %' },
    { key: 'ftPercentage', label: 'FT%', full: 'FT %' },
    { key: 'minutesPlayed', label: 'Min', full: 'Minutes' },
  ],
  volleyball: [
    { key: 'points', label: 'Pts', full: 'Points' },
    { key: 'kills', label: 'Kills', full: 'Kills' },
    { key: 'errors', label: 'Err', full: 'Errors' },
    { key: 'attempts', label: 'Att', full: 'Attempts' },
    { key: 'serves', label: 'Srv', full: 'Serves' },
    { key: 'aces', label: 'Aces', full: 'Aces' },
    { key: 'serviceErrors', label: 'SrvErr', full: 'Service Errors' },
    { key: 'digs', label: 'Digs', full: 'Digs' },
    { key: 'blocks', label: 'Blk', full: 'Blocks' },
    { key: 'assists', label: 'Ast', full: 'Assists' },
    { key: 'minutesPlayed', label: 'Min', full: 'Minutes' },
  ],
  beach: [
    { key: 'kills', label: 'Kills', full: 'Kills' },
    { key: 'errors', label: 'Err', full: 'Errors' },
    { key: 'attempts', label: 'Att', full: 'Attempts' },
    { key: 'serves', label: 'Srv', full: 'Serves' },
    { key: 'aces', label: 'Aces', full: 'Aces' },
    { key: 'serviceErrors', label: 'SrvErr', full: 'Service Errors' },
    { key: 'digs', label: 'Digs', full: 'Digs' },
    { key: 'blocks', label: 'Blk', full: 'Blocks' },
    { key: 'assists', label: 'Ast', full: 'Assists' },
    { key: 'minutesPlayed', label: 'Min', full: 'Minutes' },
  ],
  tennis: [
    { key: 'aces', label: 'Aces', full: 'Aces' },
    { key: 'doubleFaults', label: 'DF', full: 'Double Faults' },
    { key: 'firstServeIn', label: '1st%', full: 'First Serve (%)' },
    { key: 'winners', label: 'Win', full: 'Winners' },
    { key: 'unforcedErrors', label: 'UE', full: 'Unforced Errors' },
    { key: 'breakPointsSaved', label: 'BP%', full: 'Break Points Saved (%)' },
    { key: 'gamesWon', label: 'Games', full: 'Games Won' },
    { key: 'minutesPlayed', label: 'Min', full: 'Minutes' },
  ],
};

export function statFieldsForSport(sportName?: string | null): MatchStatField[] {
  return STAT_FIELDS[sportKey(sportName)];
}

// When we only know the score format (e.g. athlete match-history rows), map it to a
// representative field set. Sets → volleyball superset (beach is a subset of it).
export function statFieldsForFormat(format?: string | null): MatchStatField[] {
  switch (format) {
    case 'Points': return STAT_FIELDS.basketball;
    case 'Sets': return STAT_FIELDS.volleyball;
    case 'GamesAndSets': return STAT_FIELDS.tennis;
    default: return STAT_FIELDS.soccer;
  }
}

// Score input labels for the log-match modal.
export function scoreLabelsForSport(sportName?: string | null): { for: string; against: string } {
  switch (sportKey(sportName)) {
    case 'basketball': return { for: 'Points For', against: 'Points Against' };
    case 'volleyball':
    case 'beach':
    case 'tennis': return { for: 'Sets Won', against: 'Sets Lost' };
    default: return { for: 'Goals For', against: 'Goals Against' };
  }
}

// Whether this sport uses a set/game detail string, and its placeholder format.
export function setDetailConfig(sportName?: string | null): { enabled: boolean; label: string; placeholder: string } {
  switch (sportKey(sportName)) {
    case 'volleyball':
    case 'beach':
      return { enabled: true, label: 'Set details (optional)', placeholder: 'e.g. 25-20, 25-18, 20-25' };
    case 'tennis':
      return { enabled: true, label: 'Game scores per set (optional)', placeholder: 'e.g. 6-4, 3-6, 7-5' };
    case 'basketball':
      return { enabled: true, label: 'Quarter scores (optional)', placeholder: 'e.g. 24-20, 18-22, 30-25, 26-20' };
    default:
      return { enabled: false, label: '', placeholder: '' };
  }
}

// Unit word for the final score line (e.g. "2 goals", "3 sets").
export function scoreUnit(format?: string | null): string {
  switch (format) {
    case 'Points': return 'pts';
    case 'Sets':
    case 'GamesAndSets': return 'sets';
    default: return '';
  }
}

// Parse the statJson blob safely.
export function parseStatJson(json?: string | null): Record<string, number> {
  if (!json) return {};
  try {
    const obj = JSON.parse(json);
    return typeof obj === 'object' && obj ? obj : {};
  } catch {
    return {};
  }
}
