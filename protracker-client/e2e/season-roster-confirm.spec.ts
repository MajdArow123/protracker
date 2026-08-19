import { test, expect } from '@playwright/test';
import {
  API,
  authHeaders,
  createPlayer,
  createTeam,
  deleteTeam,
  getPositions,
  registerCoach,
  uiLogin,
  unwrap,
  CoachSession,
} from './helpers';

// Phase 10 §5d: the historical-confirmation journey. A player with a pre-season
// record is a candidate; the coach asserts the joined-from date (nothing pre-filled),
// the Q8 pointer appears, and the S7 backfill preview shows the record moved from
// gap to assignable.
test.describe('season roster confirmation', () => {
  let coach: CoachSession;
  let teamId: number;
  let playerId: number;
  let seasonId: number;

  test.beforeAll(async ({ request }) => {
    coach = await registerCoach(request, 'confirm');
    teamId = await createTeam(request, coach.accessToken, 'E2E Confirm FC');
    const positions = await getPositions(request, coach.accessToken);
    // Created while no season exists -> no auto-stint; the player stays uncovered.
    playerId = await createPlayer(request, coach.accessToken, teamId, positions[0].id, 'E2E Historical Player');
    // A historical record inside the future season's window — unassigned (gap).
    await unwrap(
      await request.post(`${API}/api/match-performance`, {
        headers: authHeaders(coach.accessToken),
        data: { playerId, matchDate: '2020-03-15', opponent: 'E2E Gap FC', performanceRating: 7 },
      }),
      'create match performance'
    );
    const season = await unwrap(
      await request.post(`${API}/api/teams/${teamId}/seasons`, {
        headers: authHeaders(coach.accessToken),
        data: { name: 'E2E Confirm Season', startDate: '2020-01-01', endDate: '2020-06-30', status: 'Active' },
      }),
      'create season'
    );
    seasonId = season.id;
  });

  test.afterAll(async ({ request }) => {
    // Player first (team delete refuses while players exist; cascades stints/records).
    if (playerId) await request.delete(`${API}/api/players/${playerId}`, { headers: authHeaders(coach.accessToken) });
    if (teamId) await deleteTeam(request, coach.accessToken, teamId);
    if (seasonId) await request.delete(`${API}/api/seasons/${seasonId}`, { headers: authHeaders(coach.accessToken) });
  });

  test('coach confirms a historical stint; the pointer leads to a reduced-gap backfill preview', async ({
    page,
    request,
  }) => {
    await uiLogin(page, coach.email, coach.password, '/dashboard');
    await page.goto('/seasons');

    // Expand the season, open the confirmation flow.
    await page.getByText('E2E Confirm Season').click();
    await page.getByRole('button', { name: 'Confirm historical roster' }).click();
    const modal = page.getByRole('dialog');

    // The candidate renders with the labeled activity hint; its date input is BLANK.
    await expect(modal.getByText('E2E Historical Player')).toBeVisible();
    await expect(modal.getByText(/Earliest recorded activity/)).toBeVisible();
    const rowDate = modal.getByLabel('Joined from — E2E Historical Player');
    await expect(rowDate).toHaveValue('');

    // Select the player, apply a bulk date — an explicit coach assertion.
    await modal.getByRole('checkbox', { name: 'E2E Historical Player' }).check();
    await modal.getByLabel('Joined from (apply to selected)').fill('2020-01-15');
    await modal.getByRole('button', { name: 'Apply to selected' }).click();
    await expect(rowDate).toHaveValue('2020-01-15');
    await modal.getByRole('button', { name: 'Confirm 1 entries' }).click();

    // Q8: the pointer appears — and leads to the S7 preview, never auto-executes.
    await expect(modal.getByText(/1 previously unassigned records may now be assignable/)).toBeVisible();
    await modal.getByRole('button', { name: 'Open Backfill preview' }).click();
    const backfill = page.getByRole('dialog');
    await expect(backfill.getByText('Backfill historical records')).toBeVisible();
    // The record moved from gap to assignable: the confirm button counts it.
    await expect(backfill.getByRole('button', { name: 'Assign 1 records' })).toBeVisible();
    await backfill.getByText('Cancel', { exact: true }).click();

    // Server truth: the stint exists, CoachConfirmed, with the asserted date.
    const roster = await unwrap(
      await request.get(`${API}/api/seasons/${seasonId}/roster`, { headers: authHeaders(coach.accessToken) }),
      'season roster'
    );
    expect(roster).toHaveLength(1);
    expect(roster[0].playerId).toBe(playerId);
    expect(roster[0].joinedAt.slice(0, 10)).toBe('2020-01-15');
  });
});
