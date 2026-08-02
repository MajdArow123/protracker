import { APIRequestContext, Page, expect, request as pwRequest } from '@playwright/test';

// API-driven data setup for e2e tests. Every spec registers its OWN accounts
// (unique per-run emails) and creates its own team/players/matches against the
// dedicated e2e database — never production, never the prod seed accounts.
// Raw Playwright requests see the backend's { success, data } envelope (the app's
// axios interceptor unwraps it, but we're below that layer here).

export const API = 'http://localhost:8080';
export const SOCCER_SPORT_ID = 1; // "Football / Soccer" — model-seeded via HasData, stable in any DB

const uniq = () => `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

export async function unwrap(res: { ok(): boolean; status(): number; json(): Promise<any>; text(): Promise<string> }, what: string) {
  if (!res.ok()) throw new Error(`${what} failed: HTTP ${res.status()} ${await res.text()}`);
  const body = await res.json();
  return body?.data ?? body;
}

export interface CoachSession {
  email: string;
  password: string;
  accessToken: string;
  userId: string;
}

export async function registerCoach(request: APIRequestContext, label: string): Promise<CoachSession> {
  const email = `e2e.coach.${label}.${uniq()}@e2e.test`;
  const password = 'E2ePass123';
  const data = await unwrap(
    await request.post(`${API}/api/auth/register`, {
      data: { displayName: `E2E Coach ${label}`, email, password, role: 'Coach' },
    }),
    'register coach'
  );
  return { email, password, accessToken: data.accessToken, userId: data.user.id };
}

export const authHeaders = (token: string) => ({ Authorization: `Bearer ${token}` });

export async function createTeam(request: APIRequestContext, token: string, name: string): Promise<number> {
  const team = await unwrap(
    await request.post(`${API}/api/teams`, {
      headers: authHeaders(token),
      data: { name: `${name} ${uniq()}`, sportId: SOCCER_SPORT_ID },
    }),
    'create team'
  );
  return team.id;
}

export async function getPositions(request: APIRequestContext, token: string): Promise<{ id: number; name: string }[]> {
  return unwrap(
    await request.get(`${API}/api/sports/${SOCCER_SPORT_ID}/positions`, { headers: authHeaders(token) }),
    'get positions'
  );
}

export async function createPlayer(
  request: APIRequestContext,
  token: string,
  teamId: number,
  positionId: number,
  name: string
): Promise<number> {
  const player = await unwrap(
    await request.post(`${API}/api/players`, {
      headers: authHeaders(token),
      data: { fullName: name, age: 20, height: 180, weight: 75, teamId, positionId },
    }),
    'create player'
  );
  return player.id;
}

export async function createMatch(
  request: APIRequestContext,
  token: string,
  teamId: number,
  match: {
    opponentName: string;
    matchDate: string;
    status?: 'Played' | 'Scheduled';
    homeScore?: number;
    awayScore?: number;
    isHome?: boolean;
  }
): Promise<number> {
  const created = await unwrap(
    await request.post(`${API}/api/teams/${teamId}/matches`, {
      headers: authHeaders(token),
      data: {
        isHome: true,
        homeScore: 0,
        awayScore: 0,
        competition: 'League',
        ...match,
      },
    }),
    'create match'
  );
  return created.id;
}

// Registers a real athlete login on the team via the join-code flow and returns ids.
export async function registerAthlete(
  request: APIRequestContext,
  coachToken: string,
  teamId: number,
  label: string
): Promise<{ email: string; password: string; playerId: number; accessToken: string }> {
  const codeDto = await unwrap(
    await request.post(`${API}/api/teams/${teamId}/join-code`, {
      headers: authHeaders(coachToken),
      data: {},
    }),
    'generate join code'
  );
  const validation = await unwrap(
    await request.get(`${API}/api/join-codes/validate/${codeDto.code}`),
    'validate join code'
  );
  const positionId = validation.positions?.[0]?.id;
  const email = `e2e.athlete.${label}.${uniq()}@e2e.test`;
  const password = 'E2ePass123';
  // Register in an ISOLATED request context: the endpoint sets the athlete's
  // HttpOnly auth cookies, and the backend reads the access token from cookies —
  // letting them into the shared jar would silently downgrade every later
  // "coach" call in the spec to athlete identity (observed as 403s).
  const isolated = await pwRequest.newContext();
  try {
    const data = await unwrap(
      await isolated.post(`${API}/api/auth/register-athlete`, {
        data: {
          code: codeDto.code,
          email,
          password,
          fullName: `E2E Athlete ${label}`,
          dateOfBirth: '2005-01-01',
          height: 180,
          weight: 75,
          positionId,
        },
      }),
      'register athlete'
    );
    return { email, password, playerId: data.playerId, accessToken: data.accessToken };
  } finally {
    await isolated.dispose();
  }
}

export async function deleteTeam(request: APIRequestContext, token: string, teamId: number) {
  await request.delete(`${API}/api/teams/${teamId}`, { headers: authHeaders(token) });
}

// UI login through the real form. Lands on the role's home route.
export async function uiLogin(page: Page, email: string, password: string, expectedPath: string) {
  await page.goto('/login');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(new RegExp(expectedPath.replace(/\//g, '\\/')), { timeout: 15_000 });
}

export const isoDaysFromNow = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};
