import { expect, test } from '@playwright/test';
import type {} from '../apps/website/src/christmas-experience';

const site = 'http://127.0.0.1:4173/christmas/';

test('the minimal page renders only the requested copy over a blurred image and real falling snow', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(site);
  await expect(page.locator('body')).toHaveText(/My Website\s*has now snow\.\s*fluri\.xyz/);
  await expect(page.locator('h1')).toHaveText('My Websitehas now snow.');
  await expect(page.getByRole('link', { name: 'Visit fluri.xyz' })).toHaveAttribute('href', '/');
  expect(
    await page
      .locator('.christmas-background')
      .evaluate((node) => (node as HTMLImageElement).naturalWidth),
  ).toBeGreaterThan(0);
  await expect(page.locator('.christmas-background')).toHaveCSS('filter', /blur\(/);
  await expect
    .poll(() =>
      page.evaluate(() => window.__fluriChristmas?.weather.getMetrics().particleCount ?? 0),
    )
    .toBeGreaterThan(0);
  expect(
    await page.evaluate(() => window.__fluriChristmas?.weather.getMetrics().surfaceCount),
  ).toBe(0);
  for (const [width, height] of [
    [1920, 1080],
    [1440, 900],
    [390, 844],
    [320, 568],
  ]) {
    await page.setViewportSize({ width: width!, height: height! });
    const bounds = await page.locator('.christmas-message').boundingBox();
    const center = bounds!.y + bounds!.height / 2;
    expect(center).toBeCloseTo(height! / 2, 0);
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <= innerWidth &&
          document.documentElement.scrollHeight <= innerHeight,
      ),
    ).toBe(true);
  }
  expect(errors).toEqual([]);
});

test('reduced motion stops autoplay and the keyboard can explicitly enable or pause snow', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${site}?record=1`);
  await expect
    .poll(() => page.evaluate(() => window.__fluriChristmas?.weather.getMetrics().state))
    .toBe('paused');
  expect(
    await page.evaluate(() => window.__fluriChristmas?.weather.getMetrics().particleCount),
  ).toBe(0);
  await page.keyboard.press('Space');
  await expect
    .poll(() =>
      page.evaluate(() => window.__fluriChristmas?.weather.getMetrics().particleCount ?? 0),
    )
    .toBeGreaterThan(0);
  await page.keyboard.press('Space');
  expect(await page.evaluate(() => window.__fluriChristmas?.weather.getMetrics().state)).toBe(
    'paused',
  );
});
