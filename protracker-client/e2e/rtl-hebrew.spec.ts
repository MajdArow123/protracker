import { test, expect } from '@playwright/test';
import {
  createMatch,
  createTeam,
  deleteTeam,
  isoDaysFromNow,
  registerCoach,
  uiLogin,
  CoachSession,
} from './helpers';

// Flow 4 (regression net for the Phase 7a bidi bug): in Hebrew, a scoreline like
// "3 - 1" was visually reversed to "1 - 3" by the bidi algorithm until the element
// got dir="ltr". The DOM text is identical either way — the dir attribute IS the fix,
// so that's what this test pins, on an asymmetric score where reversal would lie.
test.describe('RTL smoke (Hebrew)', () => {
  let coach: CoachSession;
  let teamId: number;

  test.beforeAll(async ({ request }) => {
    coach = await registerCoach(request, 'rtl');
    teamId = await createTeam(request, coach.accessToken, 'E2E RTL FC');
    await createMatch(request, coach.accessToken, teamId, {
      opponentName: 'E2E Bidi FC',
      matchDate: isoDaysFromNow(-3),
      status: 'Played',
      homeScore: 3,
      awayScore: 1,
    });
  });

  test.afterAll(async ({ request }) => {
    if (teamId) await deleteTeam(request, coach.accessToken, teamId);
  });

  test('Hebrew flips the document to RTL but scorelines stay LTR', async ({ page }) => {
    await uiLogin(page, coach.email, coach.password, '/dashboard');

    // Switch to Hebrew via the navbar language switcher.
    await page.getByRole('button', { name: 'Change language' }).click();
    await page.getByRole('button', { name: 'עברית' }).click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'he');

    // The scoreline renders in correct order: the element carries dir="ltr" and
    // the text is our-score-first ("3 - 1", never "1 - 3").
    await page.goto(`/teams/${teamId}?tab=matches`);
    const scoreline = page.locator('p[dir="ltr"]').filter({ hasText: '3 - 1' });
    await expect(scoreline).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('1 - 3')).toHaveCount(0);
    // Document is still RTL around it — the mirroring and the LTR island coexist.
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });
});
