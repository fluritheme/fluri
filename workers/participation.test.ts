import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  hash,
  normalizeDomain,
  participationAPI,
  type Database,
  type Statement,
  type ParticipationEnvironment,
} from './participation';
let sql: DatabaseSync;
let env: ParticipationEnvironment;
const adminKey = 'unit-test-operator-key-with-enough-entropy';
function statement(query: string, values: (string | number | null)[] = []): Statement {
  return {
    bind: (...next) => statement(query, next),
    first: async <T>() => (sql.prepare(query).get(...values) ?? null) as T | null,
    all: async <T>() => ({ results: sql.prepare(query).all(...values) as T[] }),
    run: async () => sql.prepare(query).run(...values),
  };
}
async function request(
  path: string,
  method = 'GET',
  data?: unknown,
  token?: string,
  cookie?: string,
  origin = 'https://fluri.xyz',
) {
  const headers: Record<string, string> = { Origin: origin };
  if (data !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  if (cookie) headers.Cookie = cookie;
  return participationAPI(
    new Request(`https://fluri.xyz${path}`, {
      method,
      headers,
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    }),
    env,
  );
}
const registration = {
  domain: 'winter.example.org',
  displayName: 'Winter',
  contactEmail: 'owner@example.org',
  analyticsEnabled: true,
  showcasePermission: false,
  analyticsAttestation: true,
};
async function register() {
  const response = await request('/api/participation/register', 'POST', registration);
  expect(response.status).toBe(201);
  return response.json() as Promise<{
    site: { id: string };
    managementToken: string;
    verification: { name: string; value: string };
  }>;
}
async function login() {
  const response = await request('/api/dashboard/login', 'POST', { password: adminKey });
  expect(response.status).toBe(200);
  return response.headers.get('Set-Cookie')!.split(';')[0]!;
}
beforeEach(async () => {
  sql = new DatabaseSync(':memory:');
  sql.exec('PRAGMA foreign_keys=ON');
  sql.exec(readFileSync(new URL('../migrations/0001_participation.sql', import.meta.url), 'utf8'));
  const db: Database = {
    prepare: (query) => statement(query),
    batch: async (statements) => {
      sql.exec('BEGIN');
      try {
        for (const item of statements) await item.run();
        sql.exec('COMMIT');
      } catch (error) {
        sql.exec('ROLLBACK');
        throw error;
      }
    },
  };
  env = {
    PARTICIPATION_DB: db,
    API_LIMIT: { limit: async () => ({ success: true }) },
    LOGIN_LIMIT: { limit: async () => ({ success: true }) },
    DASHBOARD_PASSWORD_HASH: await hash(adminKey),
  };
});
afterEach(() => {
  sql.close();
  vi.unstubAllGlobals();
});
describe('participation privacy and permissions', () => {
  it('stores hashed secrets, exports only owner fields, and never exposes private details publicly', async () => {
    const owner = await register();
    const stored = sql.prepare('SELECT * FROM sites').get()!;
    expect(stored.management_hash).toBe(await hash(owner.managementToken));
    expect(stored.management_hash).not.toBe(owner.managementToken);
    const exported = await (
      await request('/api/participation/export', 'GET', undefined, owner.managementToken)
    ).text();
    expect(exported).toContain('owner@example.org');
    expect(exported).not.toContain('management_hash');
    expect(exported).not.toContain(owner.managementToken);
    expect(await (await request('/api/community')).json()).toEqual({ sites: [] });
    expect(
      (await request('/api/participation/site', 'GET', undefined, '0'.repeat(64))).status,
    ).toBe(401);
  });
  it('requires ownership, separate permission and admin review for public listings', async () => {
    const owner = await register(),
      cookie = await login();
    expect(
      (
        await request(
          `/api/dashboard/sites/${owner.site.id}`,
          'PATCH',
          { showcaseApproved: true },
          undefined,
          cookie,
        )
      ).status,
    ).toBe(409);
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ Answer: [{ type: 16, data: `"${owner.verification.value}"` }] }),
        ),
    );
    expect(
      (await request('/api/participation/verify', 'POST', {}, owner.managementToken)).status,
    ).toBe(200);
    expect(
      (
        await request(
          `/api/dashboard/sites/${owner.site.id}`,
          'PATCH',
          { showcaseApproved: true },
          undefined,
          cookie,
        )
      ).status,
    ).toBe(409);
    await request(
      '/api/participation/site',
      'PATCH',
      { ...registration, domain: undefined, showcasePermission: true },
      owner.managementToken,
    );
    expect(
      (
        await request(
          `/api/dashboard/sites/${owner.site.id}`,
          'PATCH',
          { showcaseApproved: true, liveConfirmed: true },
          undefined,
          cookie,
        )
      ).status,
    ).toBe(200);
    expect(await (await request('/api/community')).json()).toEqual({
      sites: [{ domain: registration.domain, displayName: 'Winter' }],
    });
    await request(
      '/api/participation/site',
      'PATCH',
      { ...registration, domain: undefined },
      owner.managementToken,
    );
    expect(await (await request('/api/community')).json()).toEqual({ sites: [] });
  });
  it('reports idempotent aggregate totals, revokes keys, and cascades deletion', async () => {
    const owner = await register();
    expect(
      (await request('/api/participation/reporting-key', 'POST', {}, owner.managementToken)).status,
    ).toBe(409);
    sql.prepare('UPDATE sites SET verified_at=?').run(new Date().toISOString());
    const key = (await (
      await request('/api/participation/reporting-key', 'POST', {}, owner.managementToken)
    ).json()) as { reportingToken: string };
    const report = {
      date: new Date().toISOString().slice(0, 10),
      impressions: 12,
      version: '0.1.0',
      measurement: 'visible-1s',
    };
    expect(
      (await request('/api/participation/report', 'POST', report, key.reportingToken)).status,
    ).toBe(200);
    expect(
      (
        await request(
          '/api/participation/report',
          'POST',
          { ...report, impressions: 17 },
          key.reportingToken,
        )
      ).status,
    ).toBe(200);
    expect(sql.prepare('SELECT SUM(impressions) AS total FROM reports').get()?.total).toBe(17);
    expect(
      (
        await request(
          '/api/participation/report',
          'POST',
          { ...report, visitorId: 'forbidden' },
          key.reportingToken,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await request(
          '/api/participation/report',
          'POST',
          { ...report, impressions: -1 },
          key.reportingToken,
        )
      ).status,
    ).toBe(400);
    await request(
      '/api/participation/site',
      'PATCH',
      { ...registration, domain: undefined, analyticsEnabled: false },
      owner.managementToken,
    );
    expect(
      (await request('/api/participation/report', 'POST', report, key.reportingToken)).status,
    ).toBe(401);
    await request('/api/participation/site', 'DELETE', undefined, owner.managementToken);
    expect(sql.prepare('SELECT COUNT(*) AS n FROM reports').get()?.n).toBe(0);
    expect(
      (await request('/api/participation/site', 'GET', undefined, owner.managementToken)).status,
    ).toBe(401);
  });
  it('isolates dashboard authentication, enforces CSRF, and revokes logout sessions', async () => {
    expect((await request('/api/dashboard')).status).toBe(401);
    expect((await request('/api/dashboard/login', 'POST', { password: 'wrong' })).status).toBe(401);
    expect(
      (
        await request(
          '/api/dashboard/login',
          'POST',
          { password: adminKey },
          undefined,
          undefined,
          'https://other.org',
        )
      ).status,
    ).toBe(403);
    const cookie = await login();
    const response = await request('/api/dashboard', 'GET', undefined, undefined, cookie);
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(
      ((await response.json()) as { metrics: { registeredWebsites: number } }).metrics
        .registeredWebsites,
    ).toBe(0);
    expect((await request('/api/dashboard/logout', 'POST', {}, undefined, cookie)).status).toBe(
      200,
    );
    expect((await request('/api/dashboard', 'GET', undefined, undefined, cookie)).status).toBe(401);
  });
  it('fails closed on rate limits and malformed requests', async () => {
    env.API_LIMIT.limit = async () => ({ success: false });
    expect((await request('/api/participation/register', 'POST', registration)).status).toBe(429);
    env.API_LIMIT.limit = async () => ({ success: true });
    expect(
      (
        await request('/api/participation/register', 'POST', {
          ...registration,
          domain: 'http://localhost/',
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await request('/api/participation/register', 'POST', {
          ...registration,
          analyticsAttestation: false,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await request('/api/participation/register', 'POST', {
          ...registration,
          displayName: 'x'.repeat(5000),
        })
      ).status,
    ).toBe(413);
  });
  it('enforces retention and expires sessions', async () => {
    await register();
    await login();
    sql.exec(
      "UPDATE sites SET created_at='2020-01-01T00:00:00.000Z'; UPDATE admin_sessions SET expires_at='2020-01-01T00:00:00.000Z'",
    );
    await cleanup(env);
    expect(sql.prepare('SELECT COUNT(*) AS n FROM sites').get()?.n).toBe(0);
    expect(sql.prepare('SELECT COUNT(*) AS n FROM admin_sessions').get()?.n).toBe(0);
  });
  it('restricts scheduled cleanup to its independent maintenance key', async () => {
    const key = 'a'.repeat(64);
    env.MAINTENANCE_KEY_HASH = await hash(key);
    const registered = await register();
    expect(
      (await request('/api/maintenance/cleanup', 'POST', {}, registered.managementToken)).status,
    ).toBe(401);
    expect((await request('/api/maintenance/cleanup', 'POST', {}, key)).status).toBe(200);
    expect(
      (await request('/api/participation/site', 'GET', undefined, registered.managementToken))
        .status,
    ).toBe(200);
    expect(
      (await request('/api/maintenance/cleanup', 'POST', { query: 'DELETE FROM sites' }, key))
        .status,
    ).toBe(400);
  });
  it.each([
    '127.0.0.1',
    'https://example.org/path',
    'https://example.org:8443',
    'localhost',
    'https://name:pass@example.org',
    'site.local',
    'https://example.org/?x=1',
  ])('rejects non-public domain input: %s', (value) => {
    expect(() => normalizeDomain(value)).toThrow();
  });
});
