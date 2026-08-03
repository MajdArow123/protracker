// ── Data-honesty taxonomy (lineup program Phase 0) ───────────────────────────

/**
 * Provenance of every displayed value. A value shown to a user is exactly one
 * of these — a coach-entered guess or a calculated proxy must never silently
 * read as a recorded fact. See utils/dataSource.ts for the display rules.
 */
export type DataSource =
  | 'recorded'        // objective, system-captured (test results, match stat entries)
  | 'coach-entered'   // a coach typed/selected it (roles, captain, fitness level)
  | 'player-reported' // the athlete self-submitted it (wellbeing check-in, self-assessment)
  | 'calculated'      // derived from the above with a stated method (evidence FinalScore, trends)
  | 'not-tracked';    // the app does not measure this — explicit empty state, never a default number

/**
 * Why a value is absent. These are semantically distinct claims — never
 * collapse them into one generic dash where the distinction matters.
 */
export type MissingReason =
  | 'not-tracked'     // the app does not measure this at all
  | 'not-recorded'    // measurable, but no data exists (e.g. no check-in today)
  | 'not-set'         // an optional coach-entered field was left empty
  | 'not-enough-data' // data exists but sits below an honesty gate (e.g. <3 tests)
  | 'load-failed';    // the request failed — says nothing about the data itself

/** Optional carrier so provenance can travel with a value in future DTOs. */
export interface Sourced<T> {
  value: T;
  source: DataSource;
}
