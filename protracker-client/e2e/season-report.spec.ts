import { test, expect } from '@playwright/test';
import {
  API,
  authHeaders,
  createMatch,
  createPlayer,
  createTeam,
  deleteTeam,
  getPositions,
  registerCoach,
  uiLogin,
  unwrap,
  CoachSession,
} from './helpers';

// Phase 10 §5h: the historical team report. A Lucas-shaped fixture built from
// scratch (e2e never touches prod): pre-season records -> season + coach-asserted
// stint -> backfill execute -> the season-filtered report shows the stint roster,
// stamped counts, season records line, and the Q4 disclosure for what stayed
// unassigned.
test.describe('historical team report', () => {
  let coach: CoachSession;
  let teamId: number;
  let playerId: number;
  let seasonId: number;

  test.beforeAll(async ({ request }) => {
    coach = await registerCoach(request, 'histreport');
    teamId = await createTeam(request, coach.accessToken, 'E2E Hist FC');
    const positions = await getPositions(request, coach.accessToken);
    // Created while no season exists -> everything lands unstamped.
    playerId = await createPlayer(request, coach.accessToken, teamId, positions[0].id, 'E2E Hist Player');
    await createMatch(request, coach.accessToken, teamId, {
      opponentName: 'E2E Hist Opponents', matchDate: '2020-03-15', homeScore: 2, awayScore: 1,
    });
    // One performance inside the future season window (backfillable via the stint),
    // one outside it (stays honestly unassigned -> the disclosure's N).
    for (const matchDate of ['2020-03-20', '2019-05-01']) {
      await unwrap(
        await request.post(`${API}/api/match-performance`, {
          headers: authHeaders(coach.accessToken),
          data: { playerId, matchDate, opponent: 'E2E Hist Opp', performanceRating: 7 },
        }),
        'create match performance'
      );
    }
    const season = await unwrap(
      await request.post(`${API}/api/teams/${teamId}/seasons`, {
        headers: authHeaders(coach.accessToken),
        data: { name: 'E2E Hist Season', startDate: '2020-01-01', endDate: '2020-06-30', status: 'Active' },
      }),
      'create season'
    );
    seasonId = season.id;
    // Coach-asserted stint, then the backfill execute (the §5d/S7 path).
    await unwrap(
      await request.post(`${API}/api/seasons/${seasonId}/roster`, {
        headers: authHeaders(coach.accessToken),
        data: { playerId, teamId, joinedAt: '2020-01-15' },
      }),
      'create stint'
    );
    await unwrap(
      await request.post(`${API}/api/seasons/backfill/execute`, { headers: authHeaders(coach.accessToken) }),
      'backfill execute'
    );
  });

  test.afterAll(async ({ request }) => {
    if (playerId) await request.delete(`${API}/api/players/${playerId}`, { headers: authHeaders(coach.accessToken) });
    if (teamId) await deleteTeam(request, coach.accessToken, teamId);
    if (seasonId) await request.delete(`${API}/api/seasons/${seasonId}`, { headers: authHeaders(coach.accessToken) });
  });

  test('season-filtered report shows stint roster, stamped counts, and the unassigned disclosure', async ({
    page,
  }) => {
    await uiLogin(page, coach.email, coach.password, '/dashboard');
    await page.goto(`/reports/team/${teamId}`);

    // Unfiltered: no season sections.
    await expect(page.getByText('Season roster')).toHaveCount(0);

    await page.getByLabel('Filter by season').selectOption(String(seasonId));

    // The stint roster row: player, asserted dates, stamped counts (the in-window
    // performance was backfilled; the 2019 one stayed unassigned).
    await expect(page.getByText('Season roster')).toBeVisible();
    // The player name appears in several report sections — assert the roster row's span.
    await expect(page.locator('span', { hasText: 'E2E Hist Player' }).first()).toBeVisible();
    await expect(page.getByText(/Jan 15, 2020 – present/)).toBeVisible();
    await expect(page.getByText('0 assessments · 0 tests · 1 match performances')).toBeVisible();

    // Team-context season records (the backfilled match).
    await expect(page.getByText('Season records: 1 matches · 0 training sessions · 0 scheduled sessions')).toBeVisible();

    // Q4 disclosure: exactly one record (the 2019 performance) remains unassigned.
    await expect(page.getByText(/1 of this team's records are not assigned to any season/)).toBeVisible();
  });
});
