import type { EvidenceBasedScore, EvidenceConfidence, MetricCategory } from '../../../types';
import { CONFIDENCE_ORDER, overallConfidence } from '../../evidence/evidenceUtils';

// Pure logic for the read-only lineup view. Everything here is exported and
// unit-tested (src/test/lineupLogic.test.ts) — the honesty gates especially:
// thin data must never render as a bold rating, and zero evidence must never
// render as a numeric 0.0.

// ── Overall rating (the honesty ladder) ─────────────────────────────────────

export type RatingState =
  | { kind: 'none' }
  | {
      kind: 'thin' | 'medium' | 'confident';
      value: number;
      confidence: EvidenceConfidence;
      scoredMetrics: number;
    };

// Same absolute floor as teamCoverage: fewer than 3 scored metrics is an
// anecdote, not an overall — the rating renders muted regardless of confidence.
export const MIN_METRICS_FOR_CONFIDENT_RATING = 3;

export function computeOverallRating(scores: EvidenceBasedScore[]): RatingState {
  // Defensive: only "current" rows carry a player's live rating.
  const current = scores.filter(s => s.assessmentId == null);
  if (current.length === 0) return { kind: 'none' };

  const value = Math.round((current.reduce((sum, s) => sum + s.finalScore, 0) / current.length) * 10) / 10;
  const confidence = overallConfidence(current) ?? 'Low';
  const scoredMetrics = current.length;

  if (scoredMetrics < MIN_METRICS_FOR_CONFIDENT_RATING || confidence === 'Low') {
    return { kind: 'thin', value, confidence, scoredMetrics };
  }
  if (confidence === 'Medium') return { kind: 'medium', value, confidence, scoredMetrics };
  return { kind: 'confident', value, confidence, scoredMetrics };
}

// ── Per-category breakdown (stat panel) ─────────────────────────────────────

export const METRIC_CATEGORIES: MetricCategory[] = ['Physical', 'Technical', 'Tactical', 'Mental', 'Positional'];

export interface CategoryStat {
  category: MetricCategory;
  value: number | null;
  confidence: EvidenceConfidence | null;
}

export function categoryBreakdown(scores: EvidenceBasedScore[]): CategoryStat[] {
  const current = scores.filter(s => s.assessmentId == null);
  return METRIC_CATEGORIES.map(category => {
    const subset = current.filter(s => s.metricCategory === category);
    if (subset.length === 0) return { category, value: null, confidence: null };
    return {
      category,
      value: Math.round((subset.reduce((sum, s) => sum + s.finalScore, 0) / subset.length) * 10) / 10,
      confidence: overallConfidence(subset),
    };
  });
}

// ── Auto-arrangement ────────────────────────────────────────────────────────

export interface LineupPlayer {
  id: number;
  name: string;
  positionId: number | null;
  /** PlayerStatus name; Suspended/Inactive players are never placed on the surface. */
  status: string;
  rating: RatingState;
}

/**
 * "Auto-arranged by rating": value first, then the confidence-aware tiebreak
 * (higher confidence wins a contested slot), then coverage, then name so the
 * arrangement is fully deterministic. No-data players always sort last.
 */
export function compareByRating(a: LineupPlayer, b: LineupPlayer): number {
  const ra = a.rating;
  const rb = b.rating;
  if (ra.kind === 'none' || rb.kind === 'none') {
    if (ra.kind !== 'none') return -1;
    if (rb.kind !== 'none') return 1;
    return a.name.localeCompare(b.name);
  }
  if (rb.value !== ra.value) return rb.value - ra.value;
  const confDiff = CONFIDENCE_ORDER.indexOf(rb.confidence) - CONFIDENCE_ORDER.indexOf(ra.confidence);
  if (confDiff !== 0) return confDiff;
  if (rb.scoredMetrics !== ra.scoredMetrics) return rb.scoredMetrics - ra.scoredMetrics;
  return a.name.localeCompare(b.name);
}

export interface LineSpec {
  id: string;
  /** A position may appear in several lines (volleyball has two OH slots; a beach All-Round fills either slot). */
  positionIds: number[];
  /** Filled first, roster permitting. A line short on players just stays short — never faked from other positions. */
  min: number;
  max: number;
  /** Vertical placement, % from the top of the surface (own goal/basket orientation is per-sport). */
  y: number;
  /** Fixed horizontal placement for single-slot lines; multi-player lines spread evenly instead. */
  x?: number;
  /** Position ids that prefer the outermost slots in the line (e.g. wingers). */
  wide?: number[];
  /** false = excluded from the derived formation string (goalkeepers; all lines in sports with no meaningful shape). */
  countsInShape?: boolean;
  /** Visually distinct slot (volleyball Libero). */
  accent?: boolean;
}

export interface SportLineupLayout {
  kind: 'pitch' | 'court' | 'ladder';
  /** Players drawn on the surface (11 soccer, 5 basketball, …). Ladders have no surface. */
  capacity: number;
  lines: LineSpec[];
  /** CSS aspect-ratio of the surface, e.g. '68 / 105'. */
  aspect: string;
}

export interface PlacedPlayer {
  player: LineupPlayer;
  lineId: string;
  /** % across the surface (LTR — the surface is a fixed spatial diagram). */
  x: number;
  /** % from the top of the surface. */
  y: number;
  /** Mirrors the line's accent flag (Libero styling). */
  accent?: boolean;
}

export interface LineupArrangement {
  placed: PlacedPlayer[];
  /** Pitch-eligible players who didn't get a slot, best-rated first. */
  bench: LineupPlayer[];
  /** Suspended / Inactive players — never placed. */
  excluded: LineupPlayer[];
  /** Players whose position doesn't map to any line — shown in a tray, never dropped. */
  unpositioned: LineupPlayer[];
}

export function assignToSlots(players: LineupPlayer[], layout: SportLineupLayout): LineupArrangement {
  const knownPositions = new Set<number>();
  for (const line of layout.lines) {
    for (const pid of line.positionIds) knownPositions.add(pid);
  }

  const excluded: LineupPlayer[] = [];
  const unpositioned: LineupPlayer[] = [];
  const candidates: LineupPlayer[] = [];
  for (const p of players) {
    if (p.status === 'Suspended' || p.status === 'Inactive') excluded.push(p);
    else if (p.positionId == null || !knownPositions.has(p.positionId)) unpositioned.push(p);
    else candidates.push(p);
  }
  excluded.sort(compareByRating);
  unpositioned.sort(compareByRating);
  candidates.sort(compareByRating);

  // A slot reserved for a role nobody has (e.g. a roster with no goalkeeper)
  // shrinks the drawn group instead of being filled by the wrong position.
  let capacity = layout.capacity;
  for (const line of layout.lines) {
    if (line.countsInShape === false && !candidates.some(p => line.positionIds.includes(p.positionId!))) {
      capacity -= line.min;
    }
  }

  const chosen = new Map<string, LineupPlayer[]>(layout.lines.map(l => [l.id, []]));
  const chosenIds = new Set<number>();
  let placedCount = 0;
  const place = (line: LineSpec, p: LineupPlayer) => {
    chosen.get(line.id)!.push(p);
    chosenIds.add(p.id);
    placedCount++;
  };

  // Pass 1 — line minimums, best-rated eligible player first ("auto-arranged by
  // rating" is the contract — a higher-rated player is never benched in favor of
  // a lower-rated one; the rescue pass below handles stranded specialists by
  // moving flexible players, not by demoting better ones). Lines are visited in
  // layout order, so a position feeding several lines fills the earlier one first
  // (volleyball's best OH takes the front-row slot).
  for (const line of layout.lines) {
    for (const p of candidates) {
      if (chosen.get(line.id)!.length >= line.min || placedCount >= capacity) break;
      if (chosenIds.has(p.id) || !line.positionIds.includes(p.positionId!)) continue;
      place(line, p);
    }
  }

  // Pass 2 — fill remaining capacity: best-rated unplaced player into the first of
  // their lines with room.
  for (const p of candidates) {
    if (placedCount >= capacity) break;
    if (chosenIds.has(p.id)) continue;
    for (const line of layout.lines) {
      if (line.positionIds.includes(p.positionId!) && chosen.get(line.id)!.length < line.max) {
        place(line, p);
        break;
      }
    }
  }

  // Pass 3 — rescue. A specialist can be stranded when a flexible player (e.g. a
  // beach All-Round) took their only slot while another of the flexible player's
  // slots is open: shift the flexible occupant over and seat the specialist. This
  // maximizes placements without ever benching a higher-rated player.
  for (const p of candidates) {
    if (placedCount >= capacity) break;
    if (chosenIds.has(p.id)) continue;
    outer: for (const line of layout.lines) {
      if (!line.positionIds.includes(p.positionId!)) continue;
      for (const q of chosen.get(line.id)!) {
        for (const other of layout.lines) {
          if (other.id === line.id || !other.positionIds.includes(q.positionId!)) continue;
          if (chosen.get(other.id)!.length >= other.max) continue;
          const from = chosen.get(line.id)!;
          from.splice(from.indexOf(q), 1);
          chosen.get(other.id)!.push(q);
          place(line, p);
          break outer;
        }
      }
    }
  }

  const placed: PlacedPlayer[] = [];
  for (const line of layout.lines) {
    placed.push(...arrangeLine(line, chosen.get(line.id)!));
  }
  const bench = candidates.filter(p => !chosenIds.has(p.id));

  return { placed, bench, excluded, unpositioned };
}

// Spread a line's players evenly across the surface width, wide-preferring
// positions (wingers) taking the outermost slots. Single-slot lines with a
// configured x (court sports) sit at that fixed spot.
function arrangeLine(line: LineSpec, players: LineupPlayer[]): PlacedPlayer[] {
  const wideIds = new Set(line.wide ?? []);
  const wide = players.filter(p => p.positionId != null && wideIds.has(p.positionId));
  const central = players.filter(p => !(p.positionId != null && wideIds.has(p.positionId)));
  const left = wide.filter((_, i) => i % 2 === 0);
  const right = wide.filter((_, i) => i % 2 === 1);
  const ordered = [...left, ...central, ...right];

  const n = ordered.length;
  return ordered.map((p, i) => ({
    player: p,
    lineId: line.id,
    x: n === 1 && line.x != null ? line.x : ((i + 1) / (n + 1)) * 100,
    y: line.y,
    accent: line.accent,
  }));
}

// ── Tennis ladder ────────────────────────────────────────────────────────────

export interface LadderResult {
  /** Rankable players, best first. Rankable = has a rating over ≥3 scored metrics — an unproven player can never rank, no matter the value. */
  ranked: LineupPlayer[];
  /** Not enough data to rank — alphabetical, never ordered by their (unreliable) value. */
  unranked: LineupPlayer[];
  /** Suspended / Inactive. */
  excluded: LineupPlayer[];
}

export function buildLadder(players: LineupPlayer[]): LadderResult {
  const excluded: LineupPlayer[] = [];
  const ranked: LineupPlayer[] = [];
  const unranked: LineupPlayer[] = [];
  for (const p of players) {
    if (p.status === 'Suspended' || p.status === 'Inactive') excluded.push(p);
    else if (p.rating.kind !== 'none' && p.rating.scoredMetrics >= MIN_METRICS_FOR_CONFIDENT_RATING) ranked.push(p);
    else unranked.push(p);
  }
  ranked.sort(compareByRating);
  unranked.sort((a, b) => a.name.localeCompare(b.name));
  excluded.sort(compareByRating);
  return { ranked, unranked, excluded };
}

/**
 * The drawn group's line counts (GK excluded), e.g. "4-3-3". This is only ever
 * presented as an *implied* shape — with one position per player we can't
 * distinguish a 4-2-3-1 from a 4-3-3, so we never claim more than the counts.
 */
export function deriveFormation(placed: PlacedPlayer[], layout: SportLineupLayout): string | null {
  const shapeLines = layout.lines.filter(l => l.countsInShape !== false);
  const counts = shapeLines.map(l => placed.filter(p => p.lineId === l.id).length);
  if (counts.filter(c => c > 0).length < 2) return null;
  return counts.join('-');
}
