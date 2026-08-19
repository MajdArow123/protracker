import { test, expect } from '@playwright/test';
import {
  API,
  authHeaders,
  createMatch,
  createTeam,
  deleteTeam,
  registerCoach,
  uiLogin,
  unwrap,
  CoachSession,
} from './helpers';

// Phase 10 S7: the backfill journey. A match recorded BEFORE any season existed is
// honestly unassigned (the season-filtered matches view says so); the owner runs
// Backfill from /seasons (preview -> explicit confirm), and the same filtered view
// then shows the match — assigned by its date through the resolver, never guessed.
test.describe('season backfill', () => {
  let coach: CoachSession;
  let teamId: number;
  let matchId: number;
  let seasonId: number;
  const opponent = `E2E Backfill FC ${Date.now()}`;

  test.beforeAll(async ({ request }) => {
    coach = await registerCoach(request, 'backfill');
    teamId = await createTeam(request, coach.accessToken, 'E2E Backfill Team');
    // Created while NO season exists -> stamped null (NoCoveringSeason at create time).
    matchId = await createMatch(request, coach.accessToken, teamId, {
      opponentName: opponent,
      matchDate: '2020-03-15',
      homeScore: 2,
      awayScore: 1,
    });
    // The covering season arrives afterwards — exactly the S7 backfill scenario.
    const season = await unwrap(
      await request.post(`${API}/api/teams/${teamId}/seasons`, {
        headers: authHeaders(coach.accessToken),
        data: { name: 'E2E Backfill Season', startDate: '2020-01-01', endDate: '2020-06-30', status: 'Active' },
      }),
      'create season'
    );
    seasonId = season.id;
  });

  test.afterAll(async ({ request }) => {
    if (teamId) await deleteTeam(request, coach.accessToken, teamId);
    if (seasonId)
      await request.delete(`${API}/api/seasons/${seasonId}`, { headers: authHeaders(coach.accessToken) });
  });

  test('owner previews and confirms; the unassigned match then shows under its season', async ({
    page,
    request,
  }) => {
    await uiLogin(page, coach.email, coach.password, '/dashboard');

    // Before backfill: the season-filtered matches view honestly reports nothing.
    await page.goto(`/teams/${teamId}?tab=matches`);
    await page.getByLabel('Filter by season').selectOption(String(seasonId));
    await expect(page.getByText('No matches assigned to this season')).toBeVisible();

    // /seasons -> Backfill -> preview names exactly one assignable record.
    await page.goto('/seasons');
    await page.getByRole('button', { name: 'Backfill historical records' }).click();
    const modal = page.getByRole('dialog');
    await expect(modal.getByText('Will be assigned to a season')).toBeVisible();
    await expect(modal.getByText('Will stay unassigned')).toBeVisible();
    await modal.getByRole('button', { name: 'Assign 1 records' }).click();
    await expect(modal.getByText('Backfill complete')).toBeVisible();
    // Two "Close" accessible names exist (the dialog X and the footer button).
    await modal.getByText('Close', { exact: true }).click();

    // Server truth: the filtered read now returns the match.
    const filtered = await unwrap(
      await request.get(`${API}/api/teams/${teamId}/matches?seasonId=${seasonId}`, {
        headers: authHeaders(coach.accessToken),
      }),
      'filtered matches'
    );
    expect(filtered.map((m: { id: number }) => m.id)).toContain(matchId);

    // And the UI shows it under the season filter.
    await page.goto(`/teams/${teamId}?tab=matches`);
    await page.getByLabel('Filter by season').selectOption(String(seasonId));
    await expect(page.getByText(opponent)).toBeVisible();
    await expect(page.getByText('No matches assigned to this season')).toHaveCount(0);
  });
});
