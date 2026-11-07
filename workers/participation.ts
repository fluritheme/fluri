export interface Statement {
  bind(...values: (string | number | null)[]): Statement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}
export interface Database {
  prepare(query: string): Statement;
  batch(statements: Statement[]): Promise<unknown>;
}
export interface ParticipationEnvironment {
  PARTICIPATION_DB: Database;
  API_LIMIT: { limit(options: { key: string }): Promise<{ success: boolean }> };
  LOGIN_LIMIT: { limit(options: { key: string }): Promise<{ success: boolean }> };
  DASHBOARD_PASSWORD_HASH?: string;
  MAINTENANCE_KEY_HASH?: string;
}
interface SiteRow {
  id: string;
  domain: string;
  display_name: string;
  contact_email: string;
  management_hash: string;
  reporting_hash: string | null;
  verification_token: string;
  created_at: string;
  verified_at: string | null;
  last_reported_at: string | null;
  live_confirmed_at: string | null;
  analytics_enabled: number;
  showcase_permission: number;
  showcase_approved_at: string | null;
  terms_version: string;
  permission_updated_at: string;
}
class HTTPError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
const cookieName = '__Host-fluri_session';
const policyVersion = '2026-11-07';
const day = 86400000;
const iso = () => new Date().toISOString();
const cutoff = (days: number) => new Date(Date.now() - days * day).toISOString();
const random = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (v) =>
    v.toString(16).padStart(2, '0'),
  ).join('');
export async function hash(value: string): Promise<string> {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))),
    (v) => v.toString(16).padStart(2, '0'),
  ).join('');
}
function constantEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++)
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
function json(value: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return Response.json(value, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'X-Robots-Tag': 'noindex, nofollow',
      ...headers,
    },
  });
}
async function body(request: Request, allowed: string[]): Promise<Record<string, unknown>> {
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    throw new HTTPError(415, 'Use application/json.');
  if (!request.body) throw new HTTPError(400, 'A JSON object is required.');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const next = await reader.read();
    if (next.done) break;
    size += next.value.byteLength;
    if (size > 4096) {
      await reader.cancel();
      throw new HTTPError(413, 'Request is too large.');
    }
    chunks.push(next.value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new HTTPError(400, 'Invalid JSON.');
  }
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !allowed.includes(key))
  )
    throw new HTTPError(400, 'Unexpected fields.');
  return value as Record<string, unknown>;
}
function text(value: unknown, label: string, max: number): string {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.length > max ||
    [...value].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
  )
    throw new HTTPError(400, `Invalid ${label}.`);
  return value.trim();
}
export function normalizeDomain(value: unknown): string {
  const input = text(value, 'domain', 253).toLowerCase();
  let url: URL;
  try {
    url = new URL(input.includes('://') ? input : `https://${input}`);
  } catch {
    throw new HTTPError(400, 'Invalid domain.');
  }
  const domain = url.hostname;
  if (
    url.protocol !== 'https:' ||
    url.port ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    domain.length > 253 ||
    !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain) ||
    /\.(?:localhost|local|internal|test|invalid|example)$/.test(domain)
  )
    throw new HTTPError(400, 'Use a public HTTPS domain without a path.');
  return domain;
}
function settings(data: Record<string, unknown>) {
  const displayName = text(data.displayName, 'website name', 80);
  const contactEmail = text(data.contactEmail, 'contact email', 254);
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(contactEmail))
    throw new HTTPError(400, 'Invalid contact email.');
  if (
    typeof data.analyticsEnabled !== 'boolean' ||
    typeof data.showcasePermission !== 'boolean' ||
    data.analyticsAttestation !== true
  )
    throw new HTTPError(400, 'Accept the participation terms and choose your sharing settings.');
  return {
    displayName,
    contactEmail,
    analyticsEnabled: data.analyticsEnabled,
    showcasePermission: data.showcasePermission,
  };
}
function siteView(row: SiteRow) {
  return {
    id: row.id,
    domain: row.domain,
    displayName: row.display_name,
    contactEmail: row.contact_email,
    createdAt: row.created_at,
    verifiedAt: row.verified_at,
    lastReportedAt: row.last_reported_at,
    liveConfirmedAt: row.live_confirmed_at,
    analyticsEnabled: Boolean(row.analytics_enabled),
    showcasePermission: Boolean(row.showcase_permission),
    showcaseApprovedAt: row.showcase_approved_at,
    termsVersion: row.terms_version,
    permissionUpdatedAt: row.permission_updated_at,
  };
}
function verification(row: SiteRow) {
  return {
    name: `_fluri-verification.${row.domain}`,
    value: `fluri-verification=${row.verification_token}`,
  };
}
function bearer(request: Request): string {
  const value = request.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  if (!value) throw new HTTPError(401, 'A valid access key is required.');
  return value;
}
async function owner(
  request: Request,
  env: ParticipationEnvironment,
  reporting = false,
): Promise<SiteRow> {
  const tokenHash = await hash(bearer(request));
  const column = reporting ? 'reporting_hash' : 'management_hash';
  const site = await env.PARTICIPATION_DB.prepare(`SELECT * FROM sites WHERE ${column} = ?`)
    .bind(tokenHash)
    .first<SiteRow>();
  if (!site) throw new HTTPError(401, 'Invalid or revoked access key.');
  if (reporting && (!site.verified_at || !site.analytics_enabled))
    throw new HTTPError(403, 'Reporting is not enabled for this verified domain.');
  return site;
}
function sessionToken(request: Request): string {
  return (
    request.headers
      .get('cookie')
      ?.split(';')
      .map((v) => v.trim())
      .find((v) => v.startsWith(`${cookieName}=`))
      ?.slice(cookieName.length + 1) ?? ''
  );
}
async function admin(request: Request, env: ParticipationEnvironment): Promise<void> {
  const token = sessionToken(request);
  if (!/^[a-f0-9]{64}$/.test(token)) throw new HTTPError(401, 'Sign in to the dashboard.');
  const session = await env.PARTICIPATION_DB.prepare(
    'SELECT expires_at FROM admin_sessions WHERE token_hash = ? AND expires_at > ?',
  )
    .bind(await hash(token), iso())
    .first();
  if (!session) throw new HTTPError(401, 'Your session has expired. Sign in again.');
}
export async function cleanup(env: ParticipationEnvironment): Promise<void> {
  await env.PARTICIPATION_DB.batch([
    env.PARTICIPATION_DB.prepare('DELETE FROM reports WHERE date < ?').bind(
      cutoff(395).slice(0, 10),
    ),
    env.PARTICIPATION_DB.prepare(
      'DELETE FROM sites WHERE verified_at IS NULL AND created_at < ?',
    ).bind(cutoff(30)),
    env.PARTICIPATION_DB.prepare('DELETE FROM admin_sessions WHERE expires_at <= ?').bind(iso()),
  ]);
}
async function dashboard(env: ParticipationEnvironment) {
  const db = env.PARTICIPATION_DB;
  const sites = (
    await db.prepare('SELECT * FROM sites ORDER BY created_at DESC LIMIT 10001').all<SiteRow>()
  ).results;
  if (sites.length > 10000)
    throw new HTTPError(503, 'Export capacity reached. Contact the operator.');
  const from = cutoff(29).slice(0, 10);
  const daily = (
    await db
      .prepare(
        'SELECT date, SUM(impressions) AS impressions FROM reports WHERE date >= ? GROUP BY date ORDER BY date',
      )
      .bind(from)
      .all<{ date: string; impressions: number }>()
  ).results;
  const versions = (
    await db
      .prepare(
        'SELECT version, COUNT(DISTINCT site_id) AS sites, SUM(impressions) AS impressions FROM reports WHERE date >= ? GROUP BY version ORDER BY impressions DESC',
      )
      .bind(from)
      .all()
  ).results;
  return {
    metrics: {
      registeredWebsites: sites.length,
      verifiedDomains: sites.filter((s) => s.verified_at).length,
      confirmedLiveExamples: sites.filter(
        (s) => s.live_confirmed_at && s.live_confirmed_at >= cutoff(30),
      ).length,
      recentlyReportingWebsites: sites.filter(
        (s) => s.last_reported_at && s.last_reported_at >= cutoff(30),
      ).length,
      showcaseApprovals: sites.filter(
        (s) => s.showcase_approved_at && s.showcase_permission && s.verified_at,
      ).length,
      impressions30d: daily.reduce((sum, d) => sum + d.impressions, 0),
    },
    sites: sites.map(siteView),
    daily,
    versions,
  };
}
async function dnsVerified(row: SiteRow): Promise<boolean> {
  const record = verification(row);
  const url = new URL('https://cloudflare-dns.com/dns-query');
  url.searchParams.set('name', record.name);
  url.searchParams.set('type', 'TXT');
  const response = await fetch(url, {
    headers: { Accept: 'application/dns-json' },
    signal: AbortSignal.timeout(5000),
    redirect: 'manual',
  });
  if (!response.ok) throw new HTTPError(503, 'DNS lookup is temporarily unavailable. Try again.');
  const result: unknown = await response.json();
  if (
    !result ||
    typeof result !== 'object' ||
    !('Answer' in result) ||
    !Array.isArray(result.Answer)
  )
    return false;
  return result.Answer.some((answer: unknown) => {
    if (
      !answer ||
      typeof answer !== 'object' ||
      !('type' in answer) ||
      answer.type !== 16 ||
      !('data' in answer) ||
      typeof answer.data !== 'string'
    )
      return false;
    return answer.data === `"${record.value}"` || answer.data === record.value;
  });
}
export async function participationAPI(
  request: Request,
  env: ParticipationEnvironment,
): Promise<Response> {
  try {
    const url = new URL(request.url),
      path = url.pathname,
      method = request.method;
    if (!env.PARTICIPATION_DB || !env.API_LIMIT || !env.LOGIN_LIMIT)
      throw new HTTPError(503, 'Participation is temporarily unavailable.');
    if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(method))
      throw new HTTPError(405, 'Method not allowed.');
    const origin = request.headers.get('origin');
    if (origin && origin !== url.origin)
      throw new HTTPError(403, 'Cross-origin requests are not permitted.');
    if (method !== 'GET' && path.startsWith('/api/dashboard') && origin !== url.origin)
      throw new HTTPError(403, 'A same-origin request is required.');
    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    const limiter = path === '/api/dashboard/login' ? env.LOGIN_LIMIT : env.API_LIMIT;
    const limitKey = await hash(`${iso().slice(0, 10)}:${ip}`);
    if (!(await limiter.limit({ key: limitKey })).success)
      throw new HTTPError(429, 'Too many requests. Please try again shortly.');
    const db = env.PARTICIPATION_DB;
    if (path === '/api/maintenance/cleanup' && method === 'POST') {
      if (
        !env.MAINTENANCE_KEY_HASH ||
        !constantEqual(await hash(bearer(request)), env.MAINTENANCE_KEY_HASH)
      ) {
        throw new HTTPError(401, 'A valid maintenance key is required.');
      }
      await body(request, []);
      await cleanup(env);
      return json({ ok: true });
    }
    if (path === '/api/community' && method === 'GET') {
      const sites = (
        await db
          .prepare(
            'SELECT domain, display_name AS displayName FROM sites WHERE verified_at IS NOT NULL AND showcase_permission = 1 AND showcase_approved_at IS NOT NULL ORDER BY display_name LIMIT 500',
          )
          .all()
      ).results;
      return json({ sites });
    }
    if (path === '/api/participation/register' && method === 'POST') {
      const data = await body(request, [
        'domain',
        'displayName',
        'contactEmail',
        'analyticsEnabled',
        'showcasePermission',
        'analyticsAttestation',
      ]);
      const domain = normalizeDomain(data.domain),
        config = settings(data);
      if (await db.prepare('SELECT id FROM sites WHERE domain = ?').bind(domain).first())
        throw new HTTPError(
          409,
          'This domain is already registered. Use its management key or contact Fluri for ownership review.',
        );
      const total = await db
        .prepare('SELECT COUNT(*) AS count FROM sites WHERE created_at >= ?')
        .bind(cutoff(1))
        .first<{ count: number }>();
      if ((total?.count ?? 0) >= 500)
        throw new HTTPError(429, 'Registration capacity reached today. Please try tomorrow.');
      const managementToken = random(),
        id = crypto.randomUUID(),
        now = iso();
      await db
        .prepare(
          'INSERT INTO sites (id,domain,display_name,contact_email,management_hash,verification_token,created_at,analytics_enabled,showcase_permission,terms_version,permission_updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
        )
        .bind(
          id,
          domain,
          config.displayName,
          config.contactEmail,
          await hash(managementToken),
          random(),
          now,
          Number(config.analyticsEnabled),
          Number(config.showcasePermission),
          policyVersion,
          now,
        )
        .run();
      const site = await db.prepare('SELECT * FROM sites WHERE id = ?').bind(id).first<SiteRow>();
      if (!site) throw new Error('Registration failed');
      return json({ site: siteView(site), managementToken, verification: verification(site) }, 201);
    }
    if (path === '/api/dashboard/login' && method === 'POST') {
      const data = await body(request, ['password']);
      const password = text(data.password, 'access key', 256);
      if (!env.DASHBOARD_PASSWORD_HASH)
        throw new HTTPError(503, 'Dashboard access is not configured.');
      if (!constantEqual(await hash(password), env.DASHBOARD_PASSWORD_HASH))
        throw new HTTPError(401, 'Invalid dashboard access key.');
      const token = random(),
        expires = new Date(Date.now() + 8 * 3600000).toISOString();
      await db
        .prepare('INSERT INTO admin_sessions (token_hash,expires_at) VALUES (?,?)')
        .bind(await hash(token), expires)
        .run();
      return json({ ok: true }, 200, {
        'Set-Cookie': `${cookieName}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`,
      });
    }
    if (path.startsWith('/api/dashboard')) {
      await admin(request, env);
      if (path === '/api/dashboard/logout' && method === 'POST') {
        await db
          .prepare('DELETE FROM admin_sessions WHERE token_hash = ?')
          .bind(await hash(sessionToken(request)))
          .run();
        return json({ ok: true }, 200, {
          'Set-Cookie': `${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
        });
      }
      if ((path === '/api/dashboard' || path === '/api/dashboard/export') && method === 'GET') {
        return json(
          await dashboard(env),
          200,
          path.endsWith('/export')
            ? { 'Content-Disposition': 'attachment; filename="fluri-dashboard.json"' }
            : {},
        );
      }
      const id = path.match(/^\/api\/dashboard\/sites\/([a-f0-9-]{36})$/)?.[1];
      if (id) {
        const site = await db.prepare('SELECT * FROM sites WHERE id = ?').bind(id).first<SiteRow>();
        if (!site) throw new HTTPError(404, 'Website not found.');
        if (method === 'DELETE') {
          await db.prepare('DELETE FROM sites WHERE id = ?').bind(id).run();
          return json({ ok: true });
        }
        if (method === 'PATCH') {
          const data = await body(request, ['showcaseApproved', 'liveConfirmed']);
          if (!Object.keys(data).length || Object.values(data).some((v) => typeof v !== 'boolean'))
            throw new HTTPError(400, 'Choose valid review settings.');
          if ((data.showcaseApproved || data.liveConfirmed) && !site.verified_at)
            throw new HTTPError(409, 'Verify domain ownership before review.');
          if (data.showcaseApproved && !site.showcase_permission)
            throw new HTTPError(409, 'The owner has not permitted a public listing.');
          await db
            .prepare(
              'UPDATE sites SET showcase_approved_at = ?, live_confirmed_at = ? WHERE id = ?',
            )
            .bind(
              data.showcaseApproved === undefined
                ? site.showcase_approved_at
                : data.showcaseApproved
                  ? iso()
                  : null,
              data.liveConfirmed === undefined
                ? site.live_confirmed_at
                : data.liveConfirmed
                  ? iso()
                  : null,
              id,
            )
            .run();
          return json({ ok: true });
        }
      }
      throw new HTTPError(404, 'Endpoint not found.');
    }
    if (path === '/api/participation/report' && method === 'POST') {
      const site = await owner(request, env, true);
      const data = await body(request, ['date', 'impressions', 'version', 'measurement']);
      const date = text(data.date, 'report date', 10);
      const today = iso().slice(0, 10);
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !Number.isFinite(Date.parse(date)) ||
        new Date(date).toISOString().slice(0, 10) !== date ||
        date > today ||
        date < cutoff(29).slice(0, 10)
      )
        throw new HTTPError(400, 'Report a valid UTC date within the last 30 days.');
      if (
        typeof data.impressions !== 'number' ||
        !Number.isSafeInteger(data.impressions) ||
        data.impressions < 0 ||
        data.impressions > 1000000000 ||
        data.measurement !== 'visible-1s'
      )
        throw new HTTPError(
          400,
          'Provide an aggregate impression count and the visible-1s measurement definition.',
        );
      const version = typeof data.version === 'string' ? data.version.trim() : '';
      if (version.length > 40 || (version && !/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(version)))
        throw new HTTPError(400, 'Use a semantic package version or an empty string.');
      const now = iso();
      await db.batch([
        db
          .prepare(
            'INSERT INTO reports (site_id,date,impressions,version,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(site_id,date) DO UPDATE SET impressions=excluded.impressions,version=excluded.version,updated_at=excluded.updated_at',
          )
          .bind(site.id, date, data.impressions, version, now),
        db.prepare('UPDATE sites SET last_reported_at = ? WHERE id = ?').bind(now, site.id),
      ]);
      return json({ ok: true, date, impressions: data.impressions });
    }
    if (path.startsWith('/api/participation/')) {
      const site = await owner(request, env);
      if (
        (path === '/api/participation/site' || path === '/api/participation/export') &&
        method === 'GET'
      ) {
        const reports = (
          await db
            .prepare(
              'SELECT date,impressions,version FROM reports WHERE site_id = ? ORDER BY date DESC',
            )
            .bind(site.id)
            .all()
        ).results;
        return json(
          { site: siteView(site), verification: verification(site), reports },
          200,
          path.endsWith('/export')
            ? { 'Content-Disposition': 'attachment; filename="fluri-site.json"' }
            : {},
        );
      }
      if (path === '/api/participation/site' && method === 'DELETE') {
        await db.prepare('DELETE FROM sites WHERE id = ?').bind(site.id).run();
        return json({ ok: true });
      }
      if (path === '/api/participation/site' && method === 'PATCH') {
        const config = settings(
          await body(request, [
            'displayName',
            'contactEmail',
            'analyticsEnabled',
            'showcasePermission',
            'analyticsAttestation',
          ]),
        );
        await db
          .prepare(
            'UPDATE sites SET display_name=?,contact_email=?,analytics_enabled=?,showcase_permission=?,reporting_hash=?,showcase_approved_at=?,terms_version=?,permission_updated_at=? WHERE id=?',
          )
          .bind(
            config.displayName,
            config.contactEmail,
            Number(config.analyticsEnabled),
            Number(config.showcasePermission),
            config.analyticsEnabled ? site.reporting_hash : null,
            config.showcasePermission && config.displayName === site.display_name
              ? site.showcase_approved_at
              : null,
            policyVersion,
            iso(),
            site.id,
          )
          .run();
        return json({ ok: true });
      }
      if (path === '/api/participation/verify' && method === 'POST') {
        await body(request, []);
        if (!(await dnsVerified(site)))
          throw new HTTPError(
            409,
            'The verification TXT record was not found. DNS changes may take time to propagate.',
          );
        await db.prepare('UPDATE sites SET verified_at=? WHERE id=?').bind(iso(), site.id).run();
        const updated = await db
          .prepare('SELECT * FROM sites WHERE id=?')
          .bind(site.id)
          .first<SiteRow>();
        if (!updated) throw new HTTPError(404, 'Website not found.');
        return json({ site: siteView(updated) });
      }
      if (path === '/api/participation/reporting-key' && method === 'POST') {
        await body(request, []);
        if (!site.verified_at || !site.analytics_enabled)
          throw new HTTPError(409, 'Verify your domain and enable aggregate reporting first.');
        const token = random();
        await db
          .prepare('UPDATE sites SET reporting_hash=? WHERE id=?')
          .bind(await hash(token), site.id)
          .run();
        return json({ reportingToken: token });
      }
    }
    throw new HTTPError(404, 'Endpoint not found.');
  } catch (error) {
    return error instanceof HTTPError
      ? json({ error: error.message }, error.status)
      : json({ error: 'The service is temporarily unavailable. Please try again.' }, 503);
  }
}
