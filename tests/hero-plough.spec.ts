import { expect, test } from '@playwright/test';
import type {} from '../apps/website/src/main.js';

const site = 'http://127.0.0.1:4173';
const clockStart = new Date('2026-11-06T12:00:00Z');
// Software-rasterized WebKit executes the same virtual frames more slowly than native builds.
// The cadence and mass assertions below still use the complete simulated time interval.
test.setTimeout(90_000);

test('the hero occasionally ploughs real snow and its cadence pauses with the preview', async ({
  page,
}) => {
  await page.clock.install({ time: clockStart });
  await page.goto(site);
  await page.locator('#snow-scene').scrollIntoViewIfNeeded();
  await expect
    .poll(() => page.evaluate(() => window.__fluriSite?.getMetrics().surfaceCount))
    .toBe(2);
  await page.clock.pauseAt(new Date((await page.evaluate(() => Date.now())) + 1000));
  const initialMass = await page.evaluate(() => {
    const weather = window.__fluriSite;
    if (!weather) throw new Error('The real hero engine did not start');
    weather.updateConfig({
      snow: { enabled: false, accumulation: { meltRate: 0 } },
      performance: { maxFPS: 20, maxDPR: 1, adaptive: false },
    });
    // Stop also clears flakes already in flight, which disabling emission alone does not.
    weather.stop();
    weather.start();
    weather.addSnow(8, '.catching-shelf');
    document.documentElement.dataset.ploughStarts = '0';
    document.documentElement.dataset.ploughCompletions = '0';
    weather.on('plough:start', () => {
      document.documentElement.dataset.ploughStarts = String(
        Number(document.documentElement.dataset.ploughStarts) + 1,
      );
    });
    let initialRouteMass = 0;
    weather.use({
      name: 'hero-plough-mass-observer',
      setup(context) {
        const route = context
          .getSurfaces()
          .find((surface) => surface.element.matches('.catching-shelf'));
        if (!route) throw new Error('The plough route was not registered');
        const routeMass = () => route.profile.reduce((sum, mass) => sum + mass, 0);
        initialRouteMass = routeMass();
        const removeStart = weather.on('plough:start', () => {
          document.documentElement.dataset.routeMassAtPass = String(routeMass());
        });
        const removeComplete = weather.on('plough:complete', (event) => {
          document.documentElement.dataset.ploughCompletions = String(
            Number(document.documentElement.dataset.ploughCompletions) + 1,
          );
          document.documentElement.dataset.routeMassAfterPass = String(routeMass());
          if (
            typeof event === 'object' &&
            event !== null &&
            'mass' in event &&
            typeof event.mass === 'number'
          ) {
            document.documentElement.dataset.ploughedMass = String(event.mass);
          }
        });
        return () => {
          removeStart();
          removeComplete();
        };
      },
    });
    return initialRouteMass;
  });
  expect(initialMass).toBeGreaterThan(0);
  await page.clock.runFor(9000);
  expect(await page.locator('html').getAttribute('data-plough-starts')).toBe('0');
  await page.evaluate(() => window.__fluriSite?.pause());
  await page.clock.runFor(20000);
  expect(await page.locator('html').getAttribute('data-plough-starts')).toBe('0');
  await page.evaluate(() => window.__fluriSite?.resume());
  await page.clock.runFor(3500);
  expect(await page.locator('html').getAttribute('data-plough-starts')).toBe('1');
  await page.clock.runFor(5500);
  expect(await page.locator('html').getAttribute('data-plough-completions')).toBe('1');
  const routeMassAtPass = Number(
    await page.locator('html').getAttribute('data-route-mass-at-pass'),
  );
  expect(routeMassAtPass).toBeGreaterThan(0);
  const ploughedMass = Number(await page.locator('html').getAttribute('data-ploughed-mass'));
  const remainingMass = Number(
    await page.locator('html').getAttribute('data-route-mass-after-pass'),
  );
  expect(ploughedMass).toBeGreaterThan(0);
  expect(remainingMass).toBeLessThan(routeMassAtPass);
  // Granular flow can refill cleared bins behind the vehicle; all stored mass is accounted for.
  expect(ploughedMass + remainingMass).toBeCloseTo(routeMassAtPass, 1);
  await page.clock.runFor(18000);
  expect(await page.locator('html').getAttribute('data-plough-starts')).toBe('1');
});

test('the collection preview does not schedule automatic snowplough passes', async ({ page }) => {
  await page.clock.install({ time: clockStart });
  await page.goto(`${site}/showcase/`);
  await page.locator('#snow-scene').scrollIntoViewIfNeeded();
  await expect
    .poll(() => page.evaluate(() => window.__fluriSite?.getMetrics().surfaceCount))
    .toBe(2);
  await page.clock.pauseAt(new Date((await page.evaluate(() => Date.now())) + 1000));
  await page.evaluate(() => {
    const weather = window.__fluriSite;
    if (!weather) throw new Error('The real showcase engine did not start');
    weather.updateConfig({
      snow: { enabled: false },
      performance: { maxFPS: 20, maxDPR: 1, adaptive: false },
    });
    weather.stop();
    weather.start();
    weather.addSnow(8, '.catching-shelf');
    document.documentElement.dataset.ploughStarts = '0';
    weather.on('plough:start', () => {
      document.documentElement.dataset.ploughStarts = '1';
    });
  });
  await page.clock.runFor(30000);
  expect(await page.locator('html').getAttribute('data-plough-starts')).toBe('0');
});
