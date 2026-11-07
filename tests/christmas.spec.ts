import { expect, test } from '@playwright/test';
import type {} from '../apps/website/src/christmas-experience';

const site = 'http://127.0.0.1:4173/christmas/';
test.setTimeout(90_000);

test('the Christmas story runs the real package, reveals its scenes, and ploughs accumulated snow', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-11-07T12:00:00Z') });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(site);
  await expect
    .poll(() =>
      page.evaluate(() => window.__fluriChristmas?.weather.getMetrics().surfaceCount ?? 0),
    )
    .toBe(6);
  await page.clock.pauseAt(new Date((await page.evaluate(() => Date.now())) + 100));
  await page.evaluate(() => {
    const story = window.__fluriChristmas!;
    story.weather.updateConfig({
      snow: { particleCount: 30 },
      performance: { maxDPR: 1, maxFPS: 15 },
    });
    document.documentElement.dataset.christmasPloughStarts = '0';
    document.documentElement.dataset.christmasPloughCompletions = '0';
    story.weather.on('plough:start', () => {
      document.documentElement.dataset.christmasPloughStarts = String(
        Number(document.documentElement.dataset.christmasPloughStarts) + 1,
      );
    });
    story.weather.on('plough:complete', (data) => {
      document.documentElement.dataset.christmasPloughCompletions = String(
        Number(document.documentElement.dataset.christmasPloughCompletions) + 1,
      );
      if (typeof data === 'object' && data !== null && 'mass' in data)
        document.documentElement.dataset.christmasPloughedMass = String(data.mass);
    });
  });
  expect(
    await page.evaluate(() => window.__fluriChristmas?.weather.getMetrics().snowMass),
  ).toBeGreaterThan(0);
  await page.clock.runFor(11000);
  expect(await page.evaluate(() => window.__fluriChristmas?.getState().chapter)).toBe('letter');
  await expect(page.locator('#christmas-letter')).toHaveClass(/is-open/);
  await page.clock.runFor(8000);
  expect(await page.evaluate(() => window.__fluriChristmas?.getState().chapter)).toBe('wonder');
  await expect(page.locator('#christmas-gift')).toHaveClass(/is-unwrapped/);
  await page.clock.runFor(6500);
  await expect(page.locator('html')).toHaveAttribute('data-christmas-plough-starts', '1');
  await expect(page.locator('html')).toHaveAttribute('data-christmas-plough-completions', '1');
  expect(
    Number(await page.locator('html').getAttribute('data-christmas-ploughed-mass')),
  ).toBeGreaterThan(0);
  await page.clock.runFor(2000);
  expect(await page.evaluate(() => window.__fluriChristmas?.getState().chapter)).toBe('finale');
  await page.clock.runFor(6000);
  expect(await page.evaluate(() => window.__fluriChristmas?.getState().chapter)).toBe('arrival');
  await expect(page.locator('#christmas-letter')).not.toHaveClass(/is-open/);
  await expect(page.locator('#christmas-gift')).not.toHaveClass(/is-unwrapped/);
  expect(errors).toEqual([]);
});

test('clean recording, pause, replay, and portrait controls work without blocking exploration', async ({
  page,
}) => {
  await page.goto(`${site}?record=1`);
  await expect.poll(() => page.evaluate(() => Boolean(window.__fluriChristmas))).toBe(true);
  await expect(page.locator('.record-controls')).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.locator('.record-controls')).toBeVisible();
  await page.locator('#tour-toggle').click();
  expect(await page.evaluate(() => window.__fluriChristmas?.getState().playing)).toBe(false);
  expect(await page.evaluate(() => window.__fluriChristmas?.weather.getMetrics().state)).toBe(
    'paused',
  );
  await page.locator('#portrait-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-format', 'portrait');
  await expect(page).toHaveURL(/portrait=1/);
  await page.locator('#tour-replay').click();
  expect(await page.evaluate(() => window.__fluriChristmas?.getState().playing)).toBe(true);
  await page.mouse.wheel(0, 300);
  await expect
    .poll(() => page.evaluate(() => window.__fluriChristmas?.getState().playing))
    .toBe(false);
  await page.keyboard.press('h');
  await expect(page.locator('.record-controls')).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.locator('.record-controls')).toBeVisible();
  await page.keyboard.press('r');
  await expect
    .poll(() => page.evaluate(() => window.__fluriChristmas?.getState().chapter))
    .toBe('arrival');
});

test('reduced-motion and small screens retain the complete Christmas experience', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(site);
  await expect.poll(() => page.evaluate(() => Boolean(window.__fluriChristmas))).toBe(true);
  expect(await page.evaluate(() => window.__fluriChristmas?.getState().playing)).toBe(false);
  await page.locator('#letter').scrollIntoViewIfNeeded();
  await page.locator('#letter-open').click();
  await expect(page.locator('#christmas-letter')).toHaveClass(/is-open/);
  await page.locator('#letter-open').click();
  await expect(page.locator('#christmas-letter')).not.toHaveClass(/is-open/);
  await page.locator('#gift-open').click();
  await expect(page.locator('#christmas-gift')).toHaveClass(/is-unwrapped/);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const id of ['arrival', 'letter', 'wonder', 'finale']) {
      await page.locator(`#${id}`).scrollIntoViewIfNeeded();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        `${width}px ${id}`,
      ).toBe(true);
    }
  }
  await page.locator('#tour-toggle').click();
  expect(await page.evaluate(() => window.__fluriChristmas?.getState().playing)).toBe(true);
});
