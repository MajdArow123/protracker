import type { TFunction } from 'i18next';

// Per-sport match stat entry fields. Keys MUST match the backend's MatchStatMapping
// (EvidenceScoringEngine) and the documented MatchStatEntry JSON shapes.
// Sport ids: 1=Soccer, 2=Basketball, 3=Volleyball, 4=Beach Volleyball, 5=Tennis.

export interface MatchStatField {
  key: string;
  label: (t: TFunction) => string;
  /** '%' fields are 0-100; 'number' allows decimals; 'int' whole numbers */
  kind: 'int' | 'number' | '%';
}

export const MATCH_STAT_FIELDS: Record<number, MatchStatField[]> = {
  1: [
    { key: 'goals', label: t => t('evidence.stat.goals', 'Goals'), kind: 'int' },
    { key: 'assists', label: t => t('evidence.stat.assists', 'Assists'), kind: 'int' },
    { key: 'shots', label: t => t('evidence.stat.shots', 'Shots'), kind: 'int' },
    { key: 'shotsOnTarget', label: t => t('evidence.stat.shotsOnTarget', 'On Target'), kind: 'int' },
    { key: 'passes', label: t => t('evidence.stat.passes', 'Passes'), kind: 'int' },
    { key: 'passAccuracy', label: t => t('evidence.stat.passAccuracy', 'Pass Accuracy'), kind: '%' },
    { key: 'dribbles', label: t => t('evidence.stat.dribbles', 'Dribbles'), kind: 'int' },
    { key: 'tackles', label: t => t('evidence.stat.tackles', 'Tackles'), kind: 'int' },
    { key: 'interceptions', label: t => t('evidence.stat.interceptions', 'Interceptions'), kind: 'int' },
    { key: 'minutesPlayed', label: t => t('evidence.stat.minutesPlayed', 'Minutes'), kind: 'int' },
    { key: 'distanceKm', label: t => t('evidence.stat.distanceKm', 'Distance (km)'), kind: 'number' },
  ],
  2: [
    { key: 'points', label: t => t('evidence.stat.points', 'Points'), kind: 'int' },
    { key: 'rebounds', label: t => t('evidence.stat.rebounds', 'Rebounds'), kind: 'int' },
    { key: 'assists', label: t => t('evidence.stat.assists', 'Assists'), kind: 'int' },
    { key: 'steals', label: t => t('evidence.stat.steals', 'Steals'), kind: 'int' },
    { key: 'blocks', label: t => t('evidence.stat.blocks', 'Blocks'), kind: 'int' },
    { key: 'fgPercentage', label: t => t('evidence.stat.fgPercentage', 'FG%'), kind: '%' },
    { key: 'threePercentage', label: t => t('evidence.stat.threePercentage', '3P%'), kind: '%' },
    { key: 'ftPercentage', label: t => t('evidence.stat.ftPercentage', 'FT%'), kind: '%' },
    { key: 'turnovers', label: t => t('evidence.stat.turnovers', 'Turnovers'), kind: 'int' },
    { key: 'minutesPlayed', label: t => t('evidence.stat.minutesPlayed', 'Minutes'), kind: 'int' },
  ],
  3: [
    { key: 'kills', label: t => t('evidence.stat.kills', 'Kills'), kind: 'int' },
    { key: 'errors', label: t => t('evidence.stat.errors', 'Errors'), kind: 'int' },
    { key: 'attempts', label: t => t('evidence.stat.attempts', 'Attempts'), kind: 'int' },
    { key: 'killPercentage', label: t => t('evidence.stat.killPercentage', 'Kill %'), kind: '%' },
    { key: 'serves', label: t => t('evidence.stat.serves', 'Serves'), kind: 'int' },
    { key: 'serviceErrors', label: t => t('evidence.stat.serviceErrors', 'Service Errors'), kind: 'int' },
    { key: 'aces', label: t => t('evidence.stat.aces', 'Aces'), kind: 'int' },
    { key: 'digs', label: t => t('evidence.stat.digs', 'Digs'), kind: 'int' },
    { key: 'blocks', label: t => t('evidence.stat.blocks', 'Blocks'), kind: 'int' },
    { key: 'assists', label: t => t('evidence.stat.assists', 'Assists'), kind: 'int' },
  ],
  4: [
    { key: 'kills', label: t => t('evidence.stat.kills', 'Kills'), kind: 'int' },
    { key: 'errors', label: t => t('evidence.stat.errors', 'Errors'), kind: 'int' },
    { key: 'attempts', label: t => t('evidence.stat.attempts', 'Attempts'), kind: 'int' },
    { key: 'serves', label: t => t('evidence.stat.serves', 'Serves'), kind: 'int' },
    { key: 'aces', label: t => t('evidence.stat.aces', 'Aces'), kind: 'int' },
    { key: 'serviceErrors', label: t => t('evidence.stat.serviceErrors', 'Service Errors'), kind: 'int' },
    { key: 'digs', label: t => t('evidence.stat.digs', 'Digs'), kind: 'int' },
    { key: 'blocks', label: t => t('evidence.stat.blocks', 'Blocks'), kind: 'int' },
    { key: 'assists', label: t => t('evidence.stat.assists', 'Assists'), kind: 'int' },
  ],
  5: [
    { key: 'aces', label: t => t('evidence.stat.aces', 'Aces'), kind: 'int' },
    { key: 'doubleFaults', label: t => t('evidence.stat.doubleFaults', 'Double Faults'), kind: 'int' },
    { key: 'firstServeIn', label: t => t('evidence.stat.firstServeIn', '1st Serve In'), kind: '%' },
    { key: 'firstServeWon', label: t => t('evidence.stat.firstServeWon', '1st Serve Won'), kind: '%' },
    { key: 'secondServeWon', label: t => t('evidence.stat.secondServeWon', '2nd Serve Won'), kind: '%' },
    { key: 'breakPointsSaved', label: t => t('evidence.stat.breakPointsSaved', 'BP Saved'), kind: '%' },
    { key: 'winners', label: t => t('evidence.stat.winners', 'Winners'), kind: 'int' },
    { key: 'unforcedErrors', label: t => t('evidence.stat.unforcedErrors', 'Unforced Errors'), kind: 'int' },
    { key: 'gamesWon', label: t => t('evidence.stat.gamesWon', 'Games Won'), kind: 'int' },
  ],
};
