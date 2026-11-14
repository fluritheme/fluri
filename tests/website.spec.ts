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
    if (routes[index] !== '/404.html') {
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
  expect(robots).toContain('Disallow: /dashboard');
  expect(robots).toContain('Disallow: /api/');
  const llms = await (await request.get(`${site}/llms.txt`)).text();
  expect(llms).toContain('https://github.com/fluritheme/fluri');
  expect(llms).toContain('/reference/limitations.md');
  expect(llms).not.toContain('/dashboard/');
});
