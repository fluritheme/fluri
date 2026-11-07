import { expect, test } from '@playwright/test';
import type {} from './fixtures/main.js';
test('dense snowfall and full stress surfaces stay bounded while ordinary controls remain usable', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:5173');
  await expect
    .poll(() => page.evaluate(() => window.__fluri?.getMetrics().surfaceCount ?? 0))
    .toBe(3);
  if (await page.locator('#toggle-sidebar').isVisible())
    await page.locator('#toggle-sidebar').click();
  await page.locator('#scene-select').selectOption('stress');
  if (await page.locator('#settings-dialog').isVisible())
    await page.locator('#close-sidebar').click();
  await page.evaluate(() =>
    window.__fluri.updateConfig({
      snow: { intensity: 1, particleCount: 4000, glow: true, accumulation: { maxDepth: 30 } },
      dom: { maxSurfaces: 200 },
      performance: { adaptive: true, maxDPR: 3 },
    }),
  );
  await expect
    .poll(() => page.locator('#stress-grid').locator('[data-weather-surface]').count())
    .toBe(1000);
  await expect
    .poll(() => page.evaluate(() => window.__fluri.getMetrics().surfaceCount))
    .toBeGreaterThan(50);
  await page.evaluate(() => window.__fluri.addSnow(60));
  await page.waitForTimeout(2500);
  const metrics = await page.evaluate(() => window.__fluri.getMetrics());
  expect(metrics.state).toBe('running');
  expect(
    metrics.particleCount,
    'Adaptive ambient density plus the bounded overflow pool',
  ).toBeLessThanOrEqual(1320);
  expect(metrics.quality).toBeGreaterThanOrEqual(0.12);
  await info.attach('Actual dense scene measurements', {
    body: JSON.stringify(metrics, null, 2),
    contentType: 'application/json',
  });
  await page.locator('#reset').click({ timeout: 3000 });
  await expect
    .poll(() => page.evaluate(() => window.__fluri.getConfig().snow.particleCount))
    .toBe(240);
  expect(errors).toEqual([]);
});
