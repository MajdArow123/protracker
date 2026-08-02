import { test, expect } from '@playwright/test';
import {
  API,
  authHeaders,
  createMatch,
  createPlayer,
  createTeam,
  deleteTeam,
  getPositions,
  isoDaysFromNow,
  registerCoach,
  uiLogin,
  CoachSession,
} from './helpers';

// Flow 2: open the lineup board from a match -> MatchContextPanel shows REAL
// previous-meeting data (derived from Played history only) -> save a draft ->
// publish -> edit/delete 409 while published (server-verified, like the prod probes).
test.describe('lineup workflow', () => {
  let coach: CoachSession;
  let teamId: number;
  let fixtureId: number;

  test.beforeAll(async ({ request }) => {
    coach = await registerCoach(request, 'lineup');
    teamId = await createTeam(request, coach.accessToken, 'E2E Lineup FC');
    const positions = await getPositions(request, coach.accessToken);
    for (let i = 0; i < 3; i++) {
      await createPlayer(request, coach.accessToken, teamId, positions[i % positions.length].id, `E2E Player ${i + 1}`);
    }
    // Played history vs the same opponent = the "previous meeting"; the upcoming
    // fixture is the reference match the lineup is keyed to.
    await createMatch(request, coach.accessToken, teamId, {
      opponentName: 'E2E Rivals',
      matchDate: isoDaysFromNow(-30),
      status: 'Played',
      homeScore: 3,
      awayScore: 1,
    });
    fixtureId = await createMatch(request, coach.accessToken, teamId, {
      opponentName: 'E2E Rivals',
      matchDate: isoDaysFromNow(5),
      status: 'Scheduled',
    });
  });

  test.afterAll(async ({ request }) => {
    if (teamId) await deleteTeam(request, coach.accessToken, teamId);
  });

  test('match context shows real previous meetings; published lineup locks edit/delete with 409', async ({
    page,
    request,
  }) => {
    await uiLogin(page, coach.email, coach.password, '/dashboard');
    await page.goto(`/teams/${teamId}?tab=lineup&matchId=${fixtureId}`);

    // MatchContextPanel: real Played history only — 1 previous meeting, real scoreline.
    await expect(page.getByText('Previous meetings')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('1 played — 1W · 0D · 0L')).toBeVisible();
    await expect(page.locator('[dir="ltr"]').filter({ hasText: '3 - 1' }).first()).toBeVisible();

    // Save a draft for this match: edit -> change formation (a real mutation) -> save.
    await page.getByRole('button', { name: 'Edit lineup' }).click();
    // Formation chips are role="radio" (the picker is a radiogroup).
    await page.getByRole('radio', { name: '4-4-2' }).click();
    // Once dirty, the Save button's accessible name grows to "Save Unsaved changes"
    // (the amber dot carries an aria-label) — match on the prefix.
    await page.getByRole('button', { name: /^Save\b/ }).click();
    const saveModal = page.getByRole('dialog');
    await expect(saveModal.getByRole('radiogroup', { name: 'Save lineup' })).toBeVisible();
    await saveModal.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Draft', { exact: true })).toBeVisible({ timeout: 15_000 });

    // Publish through the confirm dialog.
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click();
    await expect(page.getByText('Published', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Published — unpublish to edit')).toBeVisible();

    // Server-verified lock: upsert and delete against a Published lineup must 409.
    const lineupRes = await request.get(`${API}/api/teams/${teamId}/lineup?matchId=${fixtureId}`, {
      headers: authHeaders(coach.accessToken),
    });
    const lineup = (await lineupRes.json())?.data;
    expect(lineup?.status).toBe('Published');

    const editAttempt = await request.put(`${API}/api/teams/${teamId}/lineup`, {
      headers: authHeaders(coach.accessToken),
      data: {
        matchResultId: fixtureId,
        baseVersion: lineup.version,
        formation: lineup.formation,
        captainPlayerId: null,
        viceCaptainPlayerId: null,
        notes: null,
        tacticalLabels: [],
        slots: [],
        setPieces: [],
      },
    });
    expect(editAttempt.status()).toBe(409);

    const deleteAttempt = await request.delete(`${API}/api/teams/${teamId}/lineup?matchId=${fixtureId}`, {
      headers: authHeaders(coach.accessToken),
    });
    expect(deleteAttempt.status()).toBe(409);

    // Unpublish so afterAll teardown can cascade cleanly.
    await request.post(`${API}/api/lineups/${lineup.id}/unpublish`, { headers: authHeaders(coach.accessToken) });
  });
});
