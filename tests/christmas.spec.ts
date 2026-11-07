import { expect, test } from '@playwright/test';
import type {} from '../apps/website/src/christmas-experience';

const site = 'http://127.0.0.1:4173/christmas/';
test.setTimeout(90_000);

test('one fixed frame automatically opens the letter and gift, clears snow, and builds a real snowman', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-11-07T12:00:00Z') });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${site}?record=1`);
  await expect
    .poll(() =>
      page.evaluate(() => window.__fluriChristmas?.weather.getMetrics().surfaceCount ?? 0),
    )
    .toBe(5);
  await page.clock.pauseAt(new Date((await page.evaluate(() => Date.now())) + 100));
  const frame = await page.locator('#capture-frame').boundingBox();
  await page.evaluate(() => {
    const story = window.__fluriChristmas!;
    story.weather.updateConfig({
      snow: { particleCount: 24 },
      performance: { maxDPR: 1, maxFPS: 15 },
    });
    document.documentElement.dataset.ploughCompletions = '0';
    document.documentElement.dataset.snowballsCreated = '0';
    story.weather.on('snowball:created', () => {
      document.documentElement.dataset.snowballsCreated = String(
        Number(document.documentElement.dataset.snowballsCreated) + 1,
      );
    });
    story.weather.on('plough:complete', (data) => {
      document.documentElement.dataset.ploughCompletions = String(
        Number(document.documentElement.dataset.ploughCompletions) + 1,
      );
      if (typeof data === 'object' && data !== null && 'mass' in data)
        document.documentElement.dataset.ploughedMass = String(data.mass);
    });
  });
  await page.clock.runFor(7000);
  await expect(page.locator('#christmas-letter')).toHaveClass(/is-open/);
  await page.clock.runFor(4000);
  await expect(page.locator('#christmas-gift')).toHaveClass(/is-unwrapped/);
  await page.clock.runFor(8000);
  await expect(page.locator('html')).toHaveAttribute('data-plough-completions', '1');
  expect(Number(await page.locator('html').getAttribute('data-ploughed-mass'))).toBeGreaterThan(0);
  await page.clock.runFor(8000);
  expect(
    await page.evaluate(() => window.__fluriChristmas?.weather.getMetrics().snowmanCount),
  ).toBe(1);
  expect(
    Number(await page.locator('html').getAttribute('data-snowballs-created')),
  ).toBeGreaterThanOrEqual(6);
  await expect(page.locator('#garden-message')).toContainText('Hello, little friend.');
  expect(await page.evaluate(() => [scrollX, scrollY])).toEqual([0, 0]);
  expect(await page.locator('#capture-frame').boundingBox()).toEqual(frame);
  await page.clock.runFor(10000);
  expect(await page.evaluate(() => window.__fluriChristmas?.getState().elapsed)).toBeLessThan(3);
  await expect(page.locator('#christmas-letter')).not.toHaveClass(/is-open/);
  await expect(page.locator('#christmas-gift')).not.toHaveClass(/is-unwrapped/);
  expect(
    await page.evaluate(() => window.__fluriChristmas?.weather.getMetrics().snowmanCount),
  ).toBe(0);
  expect(await page.evaluate(() => [scrollX, scrollY])).toEqual([0, 0]);
  expect(errors).toEqual([]);
});

test('PC recording always fits one 9:16 crop and never scrolls or hides a station', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${site}?record=1&portrait=1`);
  await expect.poll(() => page.evaluate(() => Boolean(window.__fluriChristmas))).toBe(true);
  for (const [width, height] of [
    [1920, 1080],
    [1440, 900],
    [1366, 768],
    [390, 844],
    [320, 568],
  ]) {
    await page.setViewportSize({ width: width!, height: height! });
    const frame = await page.locator('#capture-frame').boundingBox();
    expect(frame).not.toBeNull();
    expect(frame!.width / frame!.height).toBeCloseTo(9 / 16, 3);
    expect(frame!.x).toBeGreaterThanOrEqual(-1);
    expect(frame!.y).toBeGreaterThanOrEqual(-1);
    expect(frame!.x + frame!.width).toBeLessThanOrEqual(width! + 1);
    expect(frame!.y + frame!.height).toBeLessThanOrEqual(height! + 1);
    for (const selector of [
      '.arrival',
      '.letter-station',
      '.gift-station',
      '#plough-route',
      '.garden-station',
      '.scene-footer',
    ]) {
      const station = await page.locator(selector).boundingBox();
      expect(station, selector).not.toBeNull();
      expect(station!.y, selector).toBeGreaterThanOrEqual(frame!.y - 1);
      expect(station!.y + station!.height, selector).toBeLessThanOrEqual(
        frame!.y + frame!.height + 1,
      );
    }
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <= innerWidth + 1 &&
          document.documentElement.scrollHeight <= innerHeight + 1,
      ),
    ).toBe(true);
  }
  await page.mouse.wheel(0, 900);
  await page.keyboard.press('PageDown');
  expect(await page.evaluate(() => [scrollX, scrollY])).toEqual([0, 0]);
  await page.keyboard.press('Escape');
  await expect(page.locator('.record-controls')).toBeVisible();
  await page.keyboard.press('h');
  await expect(page.locator('.record-controls')).toBeHidden();
  await page.keyboard.press('r');
  expect(await page.evaluate(() => window.__fluriChristmas?.getState().playing)).toBe(true);
});

test('the snowman garden and every manual interaction work on small screens', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${site}?record=1`);
  await expect
    .poll(() => page.evaluate(() => window.__fluriChristmas?.weather.getMetrics().surfaceCount))
    .toBe(5);
  expect(await page.evaluate(() => window.__fluriChristmas?.getState().playing)).toBe(false);
  await page.locator('#letter-open').click();
  await expect(page.locator('#christmas-letter')).toHaveClass(/is-open/);
  await page.locator('#gift-open').click();
  await expect(page.locator('#christmas-gift')).toHaveClass(/is-unwrapped/);
  await page.locator('#snowball-now').click();
  expect(
    await page.evaluate(() => window.__fluriChristmas?.weather.getMetrics().snowballCount),
  ).toBe(1);
  await page.locator('#snowman-now').click();
  expect(
    await page.evaluate(() => window.__fluriChristmas?.weather.getMetrics().snowmanCount),
  ).toBe(1);
  await page.locator('#garden-reset').click();
  expect(
    await page.evaluate(() => window.__fluriChristmas?.weather.getMetrics().snowmanCount),
  ).toBe(0);
  expect(
    await page.evaluate(() => window.__fluriChristmas?.weather.getMetrics().snowballCount),
  ).toBe(0);
  await page.keyboard.press('Escape');
  await page.locator('#tour-toggle').click();
  expect(await page.evaluate(() => window.__fluriChristmas?.getState().playing)).toBe(true);
  await page.locator('#tour-toggle').click();
  expect(await page.evaluate(() => window.__fluriChristmas?.weather.getMetrics().state)).toBe(
    'paused',
  );
});
