import { afterEach, describe, expect, it, vi } from 'vitest';
import worker, { downloadBadge } from './site';

afterEach(() => vi.unstubAllGlobals());

const stats = (downloads: unknown = 12345) => ({
  package: '@fluritheme/fluri',
  downloads,
  start: '2026-10-08',
  end: '2026-11-06',
});

describe('README npm download badges', () => {
  it('renders the exact reported count, period, and accessible description', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json(stats()));
    vi.stubGlobal('fetch', fetcher);
    const response = await downloadBadge('@fluritheme/fluri');
    const svg = await response.text();
    expect(svg).toContain('12,345');
    expect(svg).toContain('2026-10-08 through 2026-11-06');
    expect(svg).toContain('NPM DOWNLOADS / 30D');
    expect(response.headers.get('Content-Type')).toContain('image/svg+xml');
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=3600');
    expect(fetcher).toHaveBeenCalledWith(
      'https://api.npmjs.org/downloads/point/last-month/@fluritheme/fluri',
      expect.objectContaining({ redirect: 'manual', signal: expect.any(AbortSignal) }),
    );
  });

  it('displays a real zero without treating it as missing statistics', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(stats(0))));
    expect(await (await downloadBadge('@fluritheme/fluri')).text()).toContain('30D: 0</title>');
  });

  it('confirms a missing package in the registry before labeling it unpublished', async () => {
    const fetcher = vi.fn().mockImplementation(async () => new Response(null, { status: 404 }));
    vi.stubGlobal('fetch', fetcher);
    const response = await downloadBadge('@fluritheme/fluri');
    expect(await response.text()).toContain('not published');
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=300');
    expect(fetcher.mock.calls[1]?.[0]).toBe('https://registry.npmjs.org/%40fluritheme%2Ffluri');
  });

  it('distinguishes a published package whose statistics are not available yet', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response(null, { status: 404 }))
        .mockResolvedValueOnce(Response.json({})),
    );
    expect(await (await downloadBadge('@fluritheme/fluri')).text()).toContain('stats pending');
  });

  it.each([
    stats(-1),
    stats('123'),
    stats(1.5),
    stats(Number.MAX_SAFE_INTEGER + 1),
    { ...stats(), package: 'another-package' },
    { ...stats(), start: '<script/>' },
    null,
  ])('does not invent counts or embed malformed upstream data: %j', async (data) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(data)));
    const response = await downloadBadge('@fluritheme/fluri');
    const svg = await response.text();
    expect(svg).toContain('unavailable');
    expect(svg).not.toContain('<script');
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=60');
  });

  it('renders an honest fallback after upstream errors or timeouts', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new DOMException('Timed out', 'TimeoutError')),
    );
    expect(await (await downloadBadge('@fluritheme/fluri')).text()).toContain('unavailable');
  });

  it('does not follow upstream redirects', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.redirect('https://example.org/'));
    vi.stubGlobal('fetch', fetcher);
    expect(await (await downloadBadge('@fluritheme/fluri')).text()).toContain('unavailable');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]?.[1].redirect).toBe('manual');
  });

  it('cannot be used to fetch arbitrary packages or URLs', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    expect((await downloadBadge('https://example.org/')).status).toBe(404);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('caches one canonical badge across query strings and HEAD requests', async () => {
    const store = new Map<string, Response>();
    const cache = {
      match: vi.fn(async (key: Request) => store.get(key.url)?.clone()),
      put: vi.fn(async (key: Request, response: Response) => {
        store.set(key.url, response);
      }),
    };
    vi.stubGlobal('caches', { open: vi.fn().mockResolvedValue(cache) });
    const fetcher = vi.fn().mockResolvedValue(Response.json(stats()));
    vi.stubGlobal('fetch', fetcher);
    const env = { ASSETS: { fetch: vi.fn() } };
    const first = await worker.fetch(
      new Request('https://fluri.test/readme/npm-downloads.svg?v=1'),
      env,
    );
    expect(await first.text()).toContain('12,345');
    const head = await worker.fetch(
      new Request('https://fluri.test/readme/npm-downloads.svg?v=2', { method: 'HEAD' }),
      env,
    );
    expect(await head.text()).toBe('');
    expect(head.headers.get('Content-Type')).toContain('image/svg+xml');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(cache.put.mock.calls[0]?.[0].url).toBe('https://fluri.test/readme/npm-downloads.svg');
  });

  it('preserves static asset handling and rejects writes to the badge', async () => {
    const env = { ASSETS: { fetch: vi.fn().mockResolvedValue(new Response('existing asset')) } };
    const response = await worker.fetch(new Request('https://fluri.test/playground/'), env);
    expect(await response.text()).toBe('existing asset');
    const rejected = await worker.fetch(
      new Request('https://fluri.test/readme/npm-downloads.svg', { method: 'POST' }),
      env,
    );
    expect(rejected.status).toBe(405);
    expect(rejected.headers.get('Allow')).toBe('GET, HEAD');
  });
});
