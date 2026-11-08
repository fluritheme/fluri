import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import type {} from '../apps/website/src/main.js';

const site = 'http://127.0.0.1:4173';
const routes = [
  '/',
  '/features/',
  '/showcase/',
  '/docs/',
  '/about/',
  '/changelog/',
  '/privacy/',
  '/terms/',
  '/cookies/',
  '/license/',
  '/participate/',
  '/community/',
  '/dashboard/',
  '/404.html',
];

test('every promotional and legal page contains its own prerendered content and search metadata', async ({
  request,
}) => {
  const responses = await Promise.all(routes.map((route) => request.get(`${site}${route}`)));
  const titles = new Set<string>();
  const descriptions = new Set<string>();
  for (const [index, response] of responses.entries()) {
    expect(response.ok(), routes[index]).toBe(true);
    const html = await response.text();
    expect(html.match(/<h1\b/g), routes[index]).toHaveLength(1);
    expect(html).toContain('<main id="main"');
    const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
    const description = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i)?.[1];
    expect(title?.length, routes[index]).toBeGreaterThan(12);
    expect(description?.length, routes[index]).toBeGreaterThan(40);
    expect(titles.has(title ?? ''), routes[index]).toBe(false);
    expect(descriptions.has(description ?? ''), routes[index]).toBe(false);
    titles.add(title ?? '');
    descriptions.add(description ?? '');
    if (routes[index] !== '/404.html') expect(html).toContain('rel="canonical"');
    else expect(html).toMatch(/name="robots"[^>]*content="[^"]*\bnoindex\b/);
    if (routes[index] === '/dashboard/') {
      expect(html).toMatch(/name="robots"[^>]*content="[^"]*\bnoindex\b/);
      expect(html).not.toContain('application/ld+json');
    } else if (routes[index] !== '/404.html') {
      const structured = html.match(
        /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
      )?.[1];
      expect(structured).toBeTruthy();
      const graph = JSON.parse(structured ?? '{}') as { '@graph': { '@type': string }[] };
      expect(graph['@graph'].some((item) => item['@type'] === 'SoftwareSourceCode')).toBe(true);
      expect(html).toContain('https://winter.fluri.xyz/');
    }
  }
});

test('dashboard login recovers from invalid keys, non-JSON errors, and connection failures', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/api/dashboard', (route) =>
    route.fulfill({ status: 401, json: { error: 'Sign in to the dashboard.' } }),
  );
  let failure: { status: number; body: string; contentType: string } | null = null;
  await page.route('**/api/dashboard/login', (route) =>
    failure ? route.fulfill(failure) : route.abort('failed'),
  );
  await page.goto(`${site}/dashboard/`);
  const field = page.getByLabel('Dashboard access key');
  const button = page.getByRole('button', { name: 'Open dashboard' });
  const notice = page.locator('#dashboard-notice');
  await field.fill('x');
  for (const [status, body, expected] of [
    [401, '<html>Authentication failed</html>', 'Invalid dashboard access key.'],
    [503, '<html>Upstream unavailable</html>', 'The service is temporarily unavailable.'],
    [429, '', 'Too many requests. Wait a minute'],
    [200, '<html>Unexpected fallback page</html>', 'The service returned an unexpected response.'],
  ] as const) {
    failure = { status, body, contentType: 'text/html' };
    await button.click();
    await expect(notice).toContainText(expected);
    await expect(button).toBeEnabled();
    await expect(field).toBeVisible();
    await expect(page.locator('#dashboard-content')).toBeHidden();
  }
  failure = null;
  await button.click();
  await expect(notice).toContainText('Could not connect to Fluri.');
  await expect(button).toBeEnabled();
  failure = {
    status: 401,
    body: JSON.stringify({ error: 'Invalid dashboard access key.' }),
    contentType: 'application/json',
  };
  await button.click();
  await expect(notice).toHaveText('Invalid dashboard access key.');
  await expect(button).toBeEnabled();
  await page.getByRole('link', { name: 'Documentation', exact: true }).click();
  await expect(page).toHaveURL(`${site}/docs/`);
  expect(errors).toEqual([]);
});

test('dashboard separates website traffic, genuine zero npm downloads and pending reports on mobile and desktop', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const today = new Date().toISOString().slice(0, 10);
  const start = new Date(Date.parse(today) - 29 * 86400000).toISOString().slice(0, 10);
  const checkedAt = new Date().toISOString();
  await page.route('**/api/dashboard', (route) =>
    route.fulfill({
      json: {
        metrics: {},
        sites: [],
        daily: [],
        versions: [],
      },
    }),
  );
  let fail = false;
  await page.route('**/api/dashboard/growth', (route) =>
    fail
      ? route.fulfill({
          status: 503,
          json: { error: 'Growth statistics are temporarily unavailable.' },
        })
      : route.fulfill({
          json: {
            updatedAt: checkedAt,
            website: {
              start,
              end: today,
              startedAt: checkedAt,
              lastReceivedAt: checkedAt,
              viewsToday: 8,
              views7d: 8,
              views30d: 8,
              daily: [{ date: today, views: 8 }],
              pages: [{ path: '/', views: 8 }],
              referrers: [{ source: 'GitHub', views: 8 }],
            },
            packages: [
              {
                package: '@fluritheme/fluri',
                status: 'available',
                checkedAt,
                start,
                end: today,
                downloads30d: 0,
                downloads7d: 0,
                latestDay: 0,
                daily: Array.from({ length: 30 }, (_, i) => ({
                  date: new Date(Date.parse(start) + i * 86400000).toISOString().slice(0, 10),
                  downloads: 0,
                })),
              },
              {
                package: '@fluritheme/fluri-react',
                status: 'pending',
                checkedAt,
                start: null,
                end: null,
                downloads30d: null,
                downloads7d: null,
                latestDay: null,
                daily: [],
              },
            ],
          },
        }),
  );
  await page.goto(`${site}/dashboard/`);
  await expect(page.getByRole('heading', { name: 'npm downloads', exact: true })).toBeVisible();
  await expect(page.locator('.npm-stat-card').first().locator('dd')).toHaveText(['0', '0', '0']);
  await expect(page.locator('.npm-stat-card').last()).toContainText('Stats pending');
  await expect(page.getByRole('heading', { name: 'Where requests came from' })).toBeVisible();
  await expect(page.locator('#growth-statistics')).toContainText('100.0%');
  const dailyCounts = page.locator('.growth-traffic details');
  await dailyCounts.locator('summary').click();
  await expect(dailyCounts).toHaveAttribute('open', '');
  await expect(dailyCounts).toContainText('Not collected');
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.locator('.growth-traffic details')).toHaveAttribute('open', '');
  await page.locator('.growth-traffic details summary').click();
  await expect(page.getByRole('link', { name: 'Open GitHub traffic report' })).toHaveAttribute(
    'href',
    'https://github.com/fluritheme/fluri/graphs/traffic',
  );
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      `${width}px dashboard`,
    ).toBe(true);
  }
  if (test.info().project.name === 'chromium') {
    await page.screenshot({ path: '/tmp/fluri-dashboard-growth-desktop.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: '/tmp/fluri-dashboard-growth-mobile.png', fullPage: true });
  }
  fail = true;
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.locator('#growth-statistics')).toContainText(
    'Growth statistics are temporarily unavailable.',
  );
  await expect(
    page.getByRole('heading', { name: 'Participating websites', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeEnabled();
  expect(errors).toEqual([]);
});

test('live homepage controls change real snow, move its surface, and persist the pause preference', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(site);
  await expect(page.locator('.custom-pointer')).toHaveCount(0);
  await page.locator('#snow-scene').scrollIntoViewIfNeeded();
  await expect
    .poll(() => page.evaluate(() => window.__fluriSite?.getMetrics().surfaceCount ?? 0))
    .toBe(2);
  await page.locator('#demo-pause').click();
  await expect
    .poll(() => page.evaluate(() => window.__fluriSite?.getMetrics().state))
    .toBe('paused');
  expect(await page.evaluate(() => localStorage.getItem('fluri:motion:v1'))).toBe('off');
  await page.locator('#demo-clear').click();
  await expect.poll(() => page.evaluate(() => window.__fluriSite?.getMetrics().snowMass)).toBe(0);
  await page.locator('#demo-add').click();
  await expect
    .poll(() => page.evaluate(() => window.__fluriSite?.getMetrics().snowMass ?? 0))
    .toBeGreaterThan(0);
  await page.locator('#drag-handle').focus();
  await page.locator('#drag-handle').press('ArrowRight');
  await expect(page.locator('#moving-card')).toHaveCSS('transform', /matrix\(1, 0, 0, 1, 10, 0\)/);
  await page.locator('#drag-handle').press('Home');
  await expect(page.locator('#moving-card')).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
  await page.reload();
  await expect(page.locator('#demo-status')).toHaveText('Preview paused');
  await page.locator('#snow-scene').scrollIntoViewIfNeeded();
  await page.locator('#demo-pause').click();
  await expect
    .poll(() => page.evaluate(() => window.__fluriSite?.getMetrics().state))
    .toBe('running');
  expect(await page.evaluate(() => localStorage.getItem('fluri:motion:v1'))).toBe('on');
  expect(errors).toEqual([]);
});

test('showcase deep links, preset changes, and filters operate on the live engine', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${site}/showcase/?preset=minimal`);
  await expect(page.locator('#selected-name')).toHaveText('Minimal');
  await page.locator('#snow-scene').scrollIntoViewIfNeeded();
  await expect
    .poll(() => page.evaluate(() => window.__fluriSite?.getConfig().preset))
    .toBe('minimal');
  await page.locator('[data-filter="festive"]').click();
  await expect(page.locator('.preset-choice:visible')).toHaveCount(2);
  await expect(page.locator('#filter-status')).toHaveText('2 forecasts to explore');
  await page.locator('[data-preset="christmas-night"]').click();
  await expect(page).toHaveURL(/preset=christmas-night/);
  await expect(page.locator('#selected-name')).toHaveText('Christmas night');
  await expect(page.locator('[data-preset="christmas-night"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect
    .poll(() => page.evaluate(() => window.__fluriSite?.getConfig().preset))
    .toBe('christmas-night');
  await page.locator('[data-filter="all"]').click();
  await expect(page.locator('.preset-choice:visible')).toHaveCount(10);
  expect(errors).toEqual([]);
});

test('framework examples support keyboard tabs and copy the selected code', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          document.documentElement.dataset.copiedCode = text;
        },
      },
    });
  });
  await page.goto(`${site}/docs/`);
  const first = page.locator('#docs-tab-0');
  const stage = page.locator('[data-code-tabs]');
  const initialHeight = (await stage.boundingBox())?.height;
  await first.focus();
  await first.press('ArrowRight');
  await expect(page.locator('#docs-tab-1')).toBeFocused();
  await expect(page.locator('#docs-tab-1')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#docs-panel-0')).toBeHidden();
  await expect(page.locator('#docs-panel-1')).toBeVisible();
  expect((await stage.boundingBox())?.height).toBeCloseTo(initialHeight ?? 0, 1);
  await page.locator('#docs-panel-1 .copy-button').click();
  const selected = await page.locator('#docs-code-1').textContent();
  expect(await page.evaluate(() => document.documentElement.dataset.copiedCode)).toBe(selected);
  await page.locator('#docs-tab-1').press('End');
  await expect(page.locator('#docs-tab-2')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#docs-code-2')).toContainText('onBeforeUnmount');
  expect((await stage.boundingBox())?.height).toBeCloseTo(initialHeight ?? 0, 1);
  await page.locator('#docs-tab-2').press('Home');
  await expect(first).toBeFocused();
});

test('compact navigation is operable and all page layouts stay inside the viewport', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(site);
  const menu = page.locator('#menu-toggle');
  await menu.click();
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#primary-nav')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await expect(menu).toBeFocused();
  await menu.click();
  await page.locator('#primary-nav a[href="/features/"]').click();
  await expect(page).toHaveURL(`${site}/features/`);
  await expect(page.locator('#primary-nav a[aria-current="page"]')).toHaveText('Features');
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['/', '/showcase/', '/docs/', '/cookies/', '/about/']) {
      await page.goto(`${site}${route}`);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        `${width}px ${route}`,
      ).toBe(true);
    }
  }
  expect(errors).toEqual([]);
});

test('reduced-motion visitors get no autoplay and can request a static snow layer', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(site);
  await page.locator('#snow-scene').scrollIntoViewIfNeeded();
  await expect(page.locator('#demo-status')).toHaveText('Reduced motion');
  expect(await page.evaluate(() => window.__fluriSite)).toBeUndefined();
  await page.locator('#demo-add').click();
  await expect
    .poll(() => page.evaluate(() => window.__fluriSite?.getMetrics().snowMass ?? 0))
    .toBeGreaterThan(0);
  expect(await page.evaluate(() => window.__fluriSite?.getMetrics().state)).toBe('paused');
  await page.locator('#demo-pause').click();
  await expect(page.locator('#demo-status')).toHaveText('Reduced motion');
  expect(await page.evaluate(() => window.__fluriSite?.getMetrics().state)).toBe('paused');
});

test('content and legal notices work without JavaScript and downloads contain genuine package archives', async ({
  browser,
  request,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto(`${site}/docs/`);
    await expect(page.getByRole('heading', { name: 'Your first snowfall.' })).toBeVisible();
    await expect(page.locator('a[download][href$=".tgz"]')).toHaveCount(2);
    await page.goto(`${site}/privacy/`);
    await expect(page.locator('main')).toContainText('Frantisek Gejdos');
    expect(
      await page.locator('main a[href="mailto:fluritheme@gmail.com"]').count(),
    ).toBeGreaterThan(0);
    await page.goto(`${site}/license/`);
    const license = await readFile(new URL('../LICENSE', import.meta.url), 'utf8');
    expect(await page.locator('.license-copy').textContent()).toBe(license);
    const manifest = JSON.parse(
      await readFile(new URL('../packages/core/package.json', import.meta.url), 'utf8'),
    ) as { version: string };
    for (const name of ['fluritheme-fluri', 'fluritheme-fluri-react']) {
      const response = await request.get(`${site}/downloads/${name}-${manifest.version}.tgz`);
      expect(response.ok()).toBe(true);
      const bytes = await response.body();
      expect(bytes.length).toBeGreaterThan(1000);
      expect([...bytes.subarray(0, 2)]).toEqual([0x1f, 0x8b]);
    }
    const reference = await request.get(`${site}/reference/api-reference.md`);
    expect(reference.ok()).toBe(true);
    expect(await reference.text()).toContain('createWeather');
  } finally {
    await context.close();
  }
});

test('public discovery files expose useful documentation and exclude private areas', async ({
  request,
}) => {
  const sitemap = await (await request.get(`${site}/sitemap.xml`)).text();
  expect(sitemap).toContain('https://winter.fluri.xyz/community/');
  expect(sitemap).not.toContain('/dashboard/');
  expect(sitemap).not.toContain('/api/');
  const robots = await (await request.get(`${site}/robots.txt`)).text();
  expect(robots).toContain('Disallow: /dashboard/');
  expect(robots).toContain('Disallow: /api/');
  const llms = await (await request.get(`${site}/llms.txt`)).text();
  expect(llms).toContain('https://github.com/fluritheme/fluri');
  expect(llms).toContain('/reference/limitations.md');
  expect(llms).not.toContain('/dashboard/');
});
