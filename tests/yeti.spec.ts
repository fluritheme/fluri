import { test, expect } from '@playwright/test';
import type { WeatherEventName } from '../packages/core/src/types.js';

test('yeti packs real snow, keeps moving through a scroll, and knocks down a snowman', async ({
  page,
}) => {
  await page.clock.install();
  await page.goto('/tests/fixtures/index.html');
  await page.clock.pauseAt(new Date((await page.evaluate(() => Date.now())) + 100));
  await page.evaluate(() => {
    const shelf = document.querySelector<HTMLElement>('#lower')!;
    shelf.style.cssText =
      'position:absolute;top:400px;left:20px;width:min(420px,calc(100% - 40px));height:90px;margin:0';
    shelf.setAttribute('data-weather-yeti', '');
    window.recreateWeather({
      snow: { enabled: false, accumulation: { sliding: false, softness: 0 } },
      dom: { detection: 'explicit', include: ['#lower'], exclude: ['nav', '#upper', '#clipped'] },
      interactions: {
        snowballs: { enabled: true },
        snowman: { enabled: true },
        yeti: { enabled: true },
      },
      performance: { adaptive: false },
      accessibility: { controls: false },
    });
    window.weather.addSnow(10, '#lower');
    window.weather.trigger('snowman', { selector: '#lower', radius: 18 });
    for (const name of ['yeti:phase', 'yeti:hit', 'yeti:thrown'] as WeatherEventName[]) {
      window.weather.on(name, (data) => window.eventLog.push({ name, data, particles: 0 }));
    }
  });
  for (let step = 0; step < 30; step++) {
    if (await page.evaluate(() => window.weather.getMetrics().yetiPhase === 'packing')) break;
    await page.clock.runFor(300);
  }
  expect(await page.evaluate(() => window.weather.getMetrics().yetiPhase)).toBe('packing');
  expect(await page.evaluate(() => window.weather.getMetrics().snowmanCount)).toBe(1);
  await page.evaluate(() => scrollTo(0, 100));
  await page.clock.runFor(180);
  expect(await page.evaluate(() => window.weather.getMetrics().yetiPhase)).toBe('packing');
  await page.clock.runFor(2600);
  expect(await page.evaluate(() => window.weather.getMetrics().snowmanCount)).toBe(0);
  expect(await page.evaluate(() => window.eventLog.some((e) => e.name === 'yeti:hit'))).toBe(true);
  await page.evaluate(() => window.weather.pause());
  const frozen = await page.evaluate(() => window.weather.getMetrics().yetiPhase);
  await page.clock.runFor(3000);
  expect(await page.evaluate(() => window.weather.getMetrics().yetiPhase)).toBe(frozen);
  await page.evaluate(() =>
    window.weather.updateConfig({ interactions: { yeti: { enabled: false } } }),
  );
  expect(await page.evaluate(() => window.weather.getMetrics().yetiPhase)).toBe('hidden');
  await page.evaluate(() => window.weather.destroy());
  await expect(page.locator('[data-fluri-host]')).toHaveCount(0);
});

test('reduced motion never advances the yeti or throws a snowball', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install();
  await page.goto('/tests/fixtures/index.html');
  await page.clock.pauseAt(new Date((await page.evaluate(() => Date.now())) + 100));
  await page.evaluate(() => {
    window.weather.updateConfig({ interactions: { yeti: { enabled: true } } });
    window.weather.trigger('yeti', { selector: '#upper' });
    window.weather.trigger('snowman', { selector: '#upper' });
  });
  const phase = await page.evaluate(() => window.weather.getMetrics().yetiPhase);
  await page.clock.runFor(20_000);
  expect(await page.evaluate(() => window.weather.getMetrics().yetiPhase)).toBe(phase);
  expect(await page.evaluate(() => window.weather.getMetrics().snowmanCount)).toBe(1);
});
