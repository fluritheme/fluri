import { cleanup, participationAPI, type ParticipationEnvironment } from './participation';

interface SiteEnvironment extends Partial<ParticipationEnvironment> {
  ASSETS: { fetch(request: Request): Promise<Response> };
}

function isParticipationEnvironment(
  env: SiteEnvironment,
): env is SiteEnvironment & ParticipationEnvironment {
  return Boolean(env.PARTICIPATION_DB && env.API_LIMIT && env.LOGIN_LIMIT);
}

const packages = new Map([
  ['/readme/npm-downloads.svg', '@fluritheme/fluri'],
  ['/readme/npm-downloads-react.svg', '@fluritheme/fluri-react'],
]);

function badge(value: string, description: string, maxAge: number): Response {
  const labelWidth = 134;
  const valueWidth = Math.max(48, value.length * 6.5 + 20);
  const width = labelWidth + valueWidth;
  // Only fixed text, validated dates, and formatted integers reach this SVG.
  const title = `NPM DOWNLOADS / 30D: ${value}`;
  return new Response(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="24" viewBox="0 0 ${width} 24" role="img" aria-labelledby="title description"><title id="title">${title}</title><desc id="description">${description}</desc><clipPath id="r"><rect x=".5" y=".5" width="${width - 1}" height="23" rx="5"/></clipPath><g clip-path="url(#r)"><path fill="#e2edf1" d="M0 0h${labelWidth}v24H0z"/><path fill="#f6fafb" d="M${labelWidth} 0h${valueWidth}v24H${labelWidth}z"/></g><rect x=".5" y=".5" width="${width - 1}" height="23" rx="5" fill="none" stroke="#bfd3dc"/><g font-family="Arial,Helvetica,sans-serif" font-size="9" font-weight="600" text-anchor="middle" dominant-baseline="central"><text x="${labelWidth / 2}" y="12" fill="#536975">NPM DOWNLOADS / 30D</text><text x="${labelWidth + valueWidth / 2}" y="12" fill="#276471">${value}</text></g></svg>`,
    {
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': `public, max-age=${maxAge}`,
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
        'Referrer-Policy': 'no-referrer',
      },
    },
  );
}

export async function downloadBadge(packageName: string): Promise<Response> {
  if (![...packages.values()].includes(packageName)) {
    return new Response('Not found', { status: 404 });
  }
  const unavailable = () =>
    badge('unavailable', `Download statistics for ${packageName} are temporarily unavailable.`, 60);
  const options = () => ({
    signal: AbortSignal.timeout(3000),
    redirect: 'manual' as const,
    headers: { Accept: 'application/json' },
  });
  try {
    const response = await fetch(
      `https://api.npmjs.org/downloads/point/last-month/${packageName}`,
      options(),
    );
    if (response.status === 404) {
      const registry = await fetch(
        `https://registry.npmjs.org/${encodeURIComponent(packageName)}`,
        options(),
      );
      await registry.body?.cancel();
      if (registry.status === 404) {
        return badge(
          'not published',
          `${packageName} is not published on the public npm registry.`,
          300,
        );
      }
      return registry.ok
        ? badge(
            'stats pending',
            `npm has not reported download statistics for ${packageName} yet.`,
            300,
          )
        : unavailable();
    }
    if (!response.ok) return unavailable();
    const data: unknown = await response.json();
    if (
      typeof data !== 'object' ||
      data === null ||
      !('package' in data) ||
      data.package !== packageName ||
      !('downloads' in data) ||
      typeof data.downloads !== 'number' ||
      !Number.isSafeInteger(data.downloads) ||
      data.downloads < 0 ||
      !('start' in data) ||
      typeof data.start !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(data.start) ||
      !('end' in data) ||
      typeof data.end !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(data.end)
    ) {
      return unavailable();
    }
    return badge(
      new Intl.NumberFormat('en-US').format(data.downloads),
      `${packageName}: ${data.downloads} npm package downloads from ${data.start} through ${data.end}. Downloads are not unique users or websites. npm updates its statistics daily.`,
      3600,
    );
  } catch {
    return unavailable();
  }
}

export default {
  async scheduled(_event: unknown, env: SiteEnvironment): Promise<void> {
    if (isParticipationEnvironment(env)) await cleanup(env);
  },
  async fetch(request: Request, env: SiteEnvironment): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      return isParticipationEnvironment(env)
        ? participationAPI(request, env)
        : Response.json(
            { error: 'Participation is temporarily unavailable.' },
            { status: 503, headers: { 'Cache-Control': 'no-store' } },
          );
    }
    const packageName = packages.get(url.pathname);
    if (!packageName) return env.ASSETS.fetch(request);
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
    }
    // A canonical key keeps query parameters and reader headers out of the shared cache.
    const key = new Request(`${url.origin}${url.pathname}`);
    let cache: Cache | undefined;
    try {
      cache = await caches.open('fluri-readme-fluritheme-v1');
    } catch {
      // The badge also works on hosts without a Cache API.
    }
    let response = await cache?.match(key).catch(() => undefined);
    if (!response) {
      response = await downloadBadge(packageName);
      await cache?.put(key, response.clone()).catch(() => undefined);
    }
    return request.method === 'HEAD'
      ? new Response(null, { headers: response.headers, status: response.status })
      : response;
  },
};
