import { expect, test } from '@playwright/test';
import type {} from './fixtures/main.js';

test('pale snow keeps a cool visible edge on white backgrounds and adapts after a theme change', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html');
  await page.evaluate(() => {
    window.weather.destroy();
    document.body.replaceChildren();
    document.body.style.cssText = 'margin:0;background:white;min-height:100vh';
    const stage = document.createElement('div');
    stage.id = 'contrast-stage';
    stage.style.cssText =
      'position:fixed;left:0;top:0;width:300px;height:500px;background:transparent';
    const support = document.createElement('article');
    support.id = 'contrast-support';
    support.dataset.weatherSurface = '';
    support.style.cssText =
      'position:absolute;left:30px;top:300px;width:240px;height:70px;border-radius:12px;background:white';
    stage.append(support);
    document.body.append(stage);
    window.recreateWeather({
      container: stage,
      seed: 185,
      snow: {
        particleCount: 140,
        intensity: 1,
        minSize: 3,
        maxSize: 3,
        gravity: 60,
        wind: { base: 0, gusts: false },
        turbulence: 0,
        accumulation: { maxDepth: 16, softness: 0, sliding: false },
      },
      dom: { detection: 'explicit' },
      performance: { adaptive: false, maxDPR: 1 },
    });
  });
  await expect
    .poll(() => page.evaluate(() => window.weather.getMetrics().particleCount))
    .toBeGreaterThan(35);
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    window.weather.pause();
    window.weather.addSnow(16);
  });
  const raster = () =>
    page.evaluate(() => {
      let flakeEdge = 0,
        flakeWhite = 0,
        capEdge = 0,
        capWhite = 0,
        capPixels = 0;
      for (const canvas of document.querySelectorAll<HTMLCanvasElement>('[data-fluri-layer]')) {
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('No canvas');
        const sample = (start: number, height: number, cap: boolean) => {
          const pixels = ctx.getImageData(35, start, 230, height).data;
          for (let i = 0; i < pixels.length; i += 4) {
            if ((pixels[i + 3] ?? 0) < 100) continue;
            const r = pixels[i] ?? 0,
              g = pixels[i + 1] ?? 0,
              b = pixels[i + 2] ?? 0;
            if (cap) capPixels++;
            if (b > r + 10 && r < 200 && b > 100) {
              if (cap) capEdge++;
              else flakeEdge++;
            }
            if (r > 230 && g > 235 && b > 235) {
              if (cap) capWhite++;
              else flakeWhite++;
            }
          }
        };
        sample(10, 210, false);
        sample(275, 25, true);
      }
      return { flakeEdge, flakeWhite, capEdge, capWhite, capPixels };
    });
  const light = await raster();
  expect(light.flakeEdge, 'White flakes have a visible cool outline').toBeGreaterThan(30);
  expect(light.flakeWhite, 'Flake centers remain snowy white').toBeGreaterThan(30);
  expect(light.capEdge, 'The white cap has a visible cool silhouette and base').toBeGreaterThan(
    100,
  );
  expect(light.capWhite, 'Accumulation still contains white highlights').toBeGreaterThan(100);
  await page.evaluate(() => {
    document.body.style.background = '#0b1320';
    const support = document.querySelector<HTMLElement>('#contrast-support');
    if (support) support.style.background = '#24384f';
  });
  await expect.poll(async () => (await raster()).capEdge).toBeLessThan(light.capEdge * 0.6);
  const dark = await raster();
  expect(dark.flakeEdge, 'Dark backgrounds keep the original white flake treatment').toBe(0);
  expect(dark.capPixels).toBeGreaterThan(100);
  await page.evaluate(() => window.weather.destroy());
});

test('custom colored snow retains its selected color on white surfaces', async ({ page }) => {
  await page.goto('/tests/fixtures/index.html');
  await page.evaluate(() => {
    window.weather.updateConfig({
      snow: { particleCount: 0, color: '#dc326f', accumulation: { softness: 0, sliding: false } },
    });
    document.body.style.background = 'white';
    window.weather.pause();
    window.weather.clearAccumulation();
    window.weather.addSnow(18, '#upper');
  });
  const count = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('[data-fluri-layer="content"]');
    const ctx = canvas?.getContext('2d');
    const rect = document.querySelector('#upper')?.getBoundingClientRect();
    if (!canvas || !ctx || !rect) throw new Error('Missing cap');
    const scale = canvas.width / innerWidth;
    const pixels = ctx.getImageData(
      Math.floor((rect.left + 10) * scale),
      Math.floor((rect.top - 20) * scale),
      Math.floor((rect.width - 20) * scale),
      Math.ceil(20 * scale),
    ).data;
    let pink = 0,
      opaque = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if ((pixels[i + 3] ?? 0) > 180) {
        opaque++;
        if ((pixels[i] ?? 0) > 170 && (pixels[i + 1] ?? 0) < 110 && (pixels[i + 2] ?? 0) > 65)
          pink++;
      }
    }
    return { pink, opaque };
  });
  expect(count.pink).toBeGreaterThan(100);
  expect(count.pink / count.opaque).toBeGreaterThan(0.9);
});
