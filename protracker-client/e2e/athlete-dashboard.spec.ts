import { test, expect } from '@playwright/test';
import {
  API,
  authHeaders,
  createTeam,
  deleteTeam,
  registerAthlete,
  registerCoach,
  uiLogin,
  unwrap,
  CoachSession,
} from './helpers';

// Flow 3: athlete dashboard renders NON-ZERO CountUp values (locks down the
// animation-latch bug fixed in 7a4e50c, where stat cards froze at 0/0.0) and the
// wellbeing check-in wizard submits. Data is created by this test via the API —
// its own coach, team, athlete account, and assessment; no prod seed accounts.
test.describe('athlete dashboard', () => {
  let coach: CoachSession;
  let teamId: number;
  let athlete: { email: string; password: string; playerId: number };

  test.beforeAll(async ({ request }) => {
    coach = await registerCoach(request, 'dash');
    teamId = await createTeam(request, coach.accessToken, 'E2E Dash FC');
    athlete = await registerAthlete(request, coach.accessToken, teamId, 'dash');

    // Assessment with two distinct category scores so Latest Score is real
    // and Best Category ≠ Needs Work.
    const period = await unwrap(
      await request.post(`${API}/api/assessment-periods`, {
        headers: authHeaders(coach.accessToken),
        data: { name: 'E2E Period', startDate: '2026-01-01', endDate: '2026-12-31', teamId },
      }),
      'create assessment period'
    );

    const categories = await unwrap(
      await request.get(`${API}/api/sports/1/stat-categories`, { headers: authHeaders(coach.accessToken) }),
      'get stat categories'
    );
    expect(categories.length).toBeGreaterThanOrEqual(2);

    await unwrap(
      await request.post(`${API}/api/player-assessments`, {
        headers: authHeaders(coach.accessToken),
        data: {
          playerId: athlete.playerId,
          assessmentPeriodId: period.id,
          dateRecorded: new Date().toISOString().slice(0, 10),
          statScores: [
            { playerAssessmentId: 0, sportStatCategoryId: categories[0].id, score: 8.5 },
            { playerAssessmentId: 0, sportStatCategoryId: categories[1].id, score: 6.0 },
          ],
        },
      }),
      'create assessment'
    );
  });

  test.afterAll(async ({ request }) => {
    if (teamId) await deleteTeam(request, coach.accessToken, teamId);
  });

  test('stat cards count up to non-zero values and wellbeing check-in submits', async ({ page }) => {
    await uiLogin(page, athlete.email, athlete.password, '/player-dashboard');

    // CountUp only animates once scrolled into view (IntersectionObserver).
    await page.getByText('Total Assessments').scrollIntoViewIfNeeded();

    // 7a4e50c regression net: the CountUp values must LEAVE zero once data arrives.
    // Latest Score is a CountUp with decimals=1: avg(8.5, 6.0) = 7.3 — a unique
    // string on this page, so it doubles as the "animation actually completed" probe.
    await expect(page.getByText('7.3', { exact: true })).toBeVisible({ timeout: 10_000 });
    // Best Category / Needs Work render the real per-category scores (each value
    // legitimately appears in several places — card, radar, trend chip).
    await expect(page.getByText('8.5', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('6.0', { exact: true }).first()).toBeVisible();
    // Nothing froze at zero (the exact 7a4e50c failure mode).
    await expect(page.getByText('0.0', { exact: true })).toHaveCount(0);

    // Wellbeing wizard: three scales -> no pain -> review -> submit.
    await page.getByText('How are you feeling?').scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: 'Good' }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByText('Energy level')).toBeVisible();
    await page.getByRole('button', { name: 'Great' }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByText('Sleep quality')).toBeVisible();
    await page.getByRole('button', { name: 'Okay' }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'No pain' }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByText('Review & submit')).toBeVisible();
    await page.getByRole('button', { name: 'Submit check-in' }).click();
    await expect(page.getByText("You're checked in for today")).toBeVisible({ timeout: 10_000 });
  });
});
