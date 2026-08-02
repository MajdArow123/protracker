import { test, expect } from '@playwright/test';
import {
  API,
  authHeaders,
  createPlayer,
  createTeam,
  deleteTeam,
  getPositions,
  isoDaysFromNow,
  registerCoach,
  uiLogin,
  CoachSession,
} from './helpers';

// Flow 1 (Phase 7a honesty gate): schedule a fixture -> it renders "—" + Upcoming and
// NEVER a 0-0 Draw -> record the real result -> rate a player -> evidence auto-import fired.
test.describe('coach fixtures', () => {
  let coach: CoachSession;
  let teamId: number;
  let playerId: number;

  test.beforeAll(async ({ request }) => {
    coach = await registerCoach(request, 'fixtures');
    teamId = await createTeam(request, coach.accessToken, 'E2E Fixtures FC');
    const positions = await getPositions(request, coach.accessToken);
    playerId = await createPlayer(request, coach.accessToken, teamId, positions[0].id, 'E2E Striker');
  });

  test.afterAll(async ({ request }) => {
    if (teamId) await deleteTeam(request, coach.accessToken, teamId);
  });

  test('scheduled fixture is never a 0-0 Draw; recording the result triggers evidence auto-import', async ({
    page,
    request,
  }) => {
    await uiLogin(page, coach.email, coach.password, '/dashboard');
    await page.goto(`/teams/${teamId}?tab=matches`);

    // Schedule a fixture through the real form.
    await page.getByRole('button', { name: 'Log Match', exact: true }).click();
    const modal = page.getByRole('dialog');
    await modal.getByRole('radio', { name: 'Schedule fixture' }).click();
    // Scheduled mode must not offer score inputs.
    await expect(modal.locator('input[type="number"]')).toHaveCount(0);
    await modal.getByPlaceholder('e.g. Rovers FC').fill('E2E Rovers');
    await modal.locator('input[type="date"]').fill(isoDaysFromNow(7));
    await modal.getByRole('button', { name: 'Schedule Fixture' }).click();
    await expect(modal).toBeHidden();

    // The honesty contract: em-dash + Upcoming chip, never a fabricated scoreline.
    // The score placeholder is the aria-hidden <p> in the match row (other "—"
    // empty-state markers exist elsewhere on the page).
    await expect(page.getByText('Upcoming')).toBeVisible();
    await expect(page.locator('p[aria-hidden="true"]').filter({ hasText: '—' })).toBeVisible();
    await expect(page.getByText('0 - 0')).toHaveCount(0);
    await expect(page.getByText('Draw', { exact: true })).toHaveCount(0);

    // Record the real result via the row action (form reopens in Played mode).
    await page.getByRole('button', { name: 'Record result' }).click();
    const editModal = page.getByRole('dialog');
    await expect(editModal.getByRole('radio', { name: 'Record result' })).toHaveAttribute('aria-checked', 'true');
    const scoreInputs = editModal.locator('input[type="number"]');
    await scoreInputs.nth(0).fill('2');
    await scoreInputs.nth(1).fill('1');
    await editModal.getByRole('button', { name: 'Save Changes' }).click();
    await expect(editModal).toBeHidden();

    // Row now shows the real scoreline and no Upcoming chip.
    await expect(page.getByText('2 - 1')).toBeVisible();
    await expect(page.getByText('Upcoming')).toHaveCount(0);

    // Rate the player with a non-zero stat so evidence auto-import has something to write.
    await page.getByRole('button', { name: 'Rate Players' }).click();
    const rateModal = page.getByRole('dialog');
    await rateModal.locator('input[type="number"]').first().fill('1');
    await rateModal.getByRole('button', { name: 'Save Ratings' }).click();
    await expect(rateModal).toBeHidden();

    // Auto-import is server-side and best-effort — assert it actually fired.
    await expect
      .poll(
        async () => {
          const res = await request.get(`${API}/api/players/${playerId}/match-stats`, {
            headers: authHeaders(coach.accessToken),
          });
          if (!res.ok()) return 'request-failed';
          const body = await res.json();
          const entries = body?.data ?? body ?? [];
          return entries.some((e: { isAutoImported?: boolean }) => e.isAutoImported) ? 'imported' : 'none';
        },
        { timeout: 10_000 }
      )
      .toBe('imported');
  });
});
