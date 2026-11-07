import type {} from './fixtures/react.js';
import { test, expect } from '@playwright/test';

test('React StrictMode replays setup safely, updates config, and releases resources on unmount', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/tests/fixtures/react.html');
  await page.locator('#mount-weather').click();
  await expect.poll(() => page.evaluate(() => window.reactHarness.controllers.length)).toBe(2);
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.reactHarness.controllers.map((controller) => controller.getMetrics().state),
      ),
    )
    .toEqual(['destroyed', 'running']);
  await expect(page.locator('[data-fluri-root]')).toHaveCount(1);
  await page.locator('#ordinary-react').click();
  await expect(page.locator('#react-clicks')).toHaveText('1');
  await page.locator('#update-weather').click();
  await expect
    .poll(() => page.evaluate(() => window.reactHarness.getCurrent()?.getConfig().snow.intensity))
    .toBe(0.8);
  await page.locator('#react-pause').click();
  await expect
    .poll(() => page.evaluate(() => window.reactHarness.getCurrent()?.getMetrics().state))
    .toBe('paused');
  await page.locator('#unmount-weather').click();
  await expect(page.locator('[data-fluri-root]')).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.reactHarness.controllers.every(
          (controller) => controller.getMetrics().state === 'destroyed',
        ),
      ),
    )
    .toBe(true);
  const resources = await page.evaluate(() => ({
    current: window.reactHarness.snapshot(),
    baseline: window.reactHarness.baseline,
  }));
  expect(resources.current.mutationObservers).toBe(resources.baseline?.mutationObservers);
  expect(resources.current.resizeObservers).toBe(resources.baseline?.resizeObservers);
  // React adds one delegated invalid-event listener to the newly mounted button. Its own DOM
  // delegation is outside Fluri's lifecycle; verify Fluri's exact listener cleanup in the core fixture.
  await page.locator('#mount-weather').click();
  await expect(page.locator('[data-fluri-root]')).toHaveCount(1);
  await page.evaluate(() => window.reactHarness.unmountRoot());
  await expect(page.locator('[data-fluri-root]')).toHaveCount(0);
  expect(errors).toEqual([]);
});
