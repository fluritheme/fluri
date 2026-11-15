/** Canonical Fluri migration. Files/API remain on their original worker. */
export function consolidated(request: Request, slug: string): Response | null {
  const u = new URL(request.url);
  if (
    ![
      'winter.fluri.xyz',
      'spider.fluri.xyz',
      'grinch.fluri.xyz',
      'cat.fluri.xyz',
      'ghost.fluri.xyz',
      'rain.fluri.xyz',
      'builders.fluri.xyz',
      'origami.fluri.xyz',
    ].includes(u.hostname)
  )
    return null;
  const p = u.pathname;
  if (p === '/robots.txt')
    return new Response(
      'User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /dashboard/\nSitemap: https://fluri.xyz/sitemap.xml\n',
      {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'public, max-age=3600',
        },
      },
    );
  if (!['GET', 'HEAD'].includes(request.method) || p.startsWith('/api/')) return null;
  const legal: Record<string, string> = {
    terms: 'terms',
    privacy: 'privacy',
    cookies: 'cookies',
    license: 'license',
    'commercial-license': 'license',
  };
  const first = p.split('/')[1] ?? '';
  let target: string | undefined;
  if (p === '/sitemap.xml' || p === '/sitemap-index.xml') target = '/sitemap.xml';
  else if (/^\/dashboard(?:\/|$)/.test(p)) target = '/dashboard/';
  else if (p === '/' || p === '/index.html') target = '/' + slug + '/';
  else if (legal[first] && !/\.[a-z0-9]+$/i.test(p)) target = '/legal/' + legal[first] + '/';
  else if (/^\/playground\/?$/.test(p)) target = '/' + slug + '/#playground';
  else if (/^\/(docs|reference|framer)(\/guide)?\/?$/.test(p)) target = '/docs/';
  else if (/^\/(features|showcase|community)\/?$/.test(p)) target = '/' + slug + '/';
  else if (/^\/about\/?$/.test(p)) target = '/founder/';
  else if (/^\/(changelog|downloads|readme)\/?$/.test(p)) target = '/legacy/';
  else if (/^\/participate\/?$/.test(p)) target = '/docs/';
  if (!target) return null;
  const destination = new URL(target, 'https://fluri.xyz');
  if (!target.includes('dashboard')) {
    for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'ref']) {
      const value = u.searchParams.get(key);
      if (value && value.length <= 120) destination.searchParams.set(key, value);
    }
  }
  return new Response(null, {
    status: 308,
    headers: {
      Location: destination.href,
      'Cache-Control': target.includes('dashboard') ? 'no-store' : 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
      ...(target.includes('dashboard') ? { 'X-Robots-Tag': 'noindex, nofollow' } : {}),
    },
  });
}
