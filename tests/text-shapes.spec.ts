import { test, expect } from '@playwright/test';
import type {} from './fixtures/main.js';
test('transparent multiline headings collect on glyphs, never their full layout rectangle', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html');
  await page.evaluate(() => {
    window.weather.destroy();
    document.body.replaceChildren();
    document.body.style.cssText = 'margin:0;min-height:2600px;background:#faf8f2;color:#302b40';
    document.body.innerHTML =
      '<h1 id="words" style="position:relative;margin:80px 20px 0;width:700px;padding:35px 0;font:700 92px/1.25 Arial,sans-serif;text-align:center">Small words.<br><span style="color:#714de0">Big world.</span></h1>';
    window.recreateWeather({
      dom: { detection: 'auto' },
      snow: { particleCount: 0, accumulation: { sliding: false } },
      performance: { adaptive: false, maxDPR: 1 },
    });
    window.weather.pause();
    window.weather.addSnow(7, '#words');
  });
  const result = await page.evaluate(() => {
    const surfaces = window.inspection!.getSurfaces().filter((s) => s.element.id === 'words');
    return surfaces.map((s) => ({
      shape: s.shape,
      width: s.width,
      y: s.y,
      empty: s.contour?.offsets.some((v) => !Number.isFinite(v)),
      min: s.contour ? Math.min(...s.contour.offsets.filter(Number.isFinite)) : 0,
      max: s.contour ? Math.max(...s.contour.offsets.filter(Number.isFinite)) : 0,
      mass: s.profile.reduce((a, b) => a + b, 0),
    }));
  });
  expect(result).toHaveLength(2);
  for (const line of result) {
    expect(line.shape).toBe('text');
    expect(line.width).toBeLessThan(650);
    expect(line.empty).toBe(true);
    expect(line.max - line.min).toBeGreaterThan(10);
    expect(line.mass).toBeGreaterThan(100);
  }
  expect(result[1]!.y - result[0]!.y).toBeGreaterThan(80);
  await page.screenshot({ path: '/tmp/winter-real-glyph-snow.png' });
});
test('asymmetric elliptical percent corners and individual CSS rotation retain physical geometry', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html');
  const result = await page.evaluate(async () => {
    window.weather.destroy();
    document.body.replaceChildren();
    document.body.style.cssText = 'margin:0;min-height:2400px;background:#faf8f2';
    document.body.innerHTML =
      '<div style="position:absolute;left:100px;top:180px;rotate:7deg;scale:1.1 .9"><article id="shaped" data-weather-surface style="position:relative;width:320px;height:120px;background:#cbbde8;border-radius:0 60% 0 0"><i id="start" style="position:absolute;left:0;top:0"></i><i id="end" style="position:absolute;left:320px;top:0"></i></article></div>';
    window.recreateWeather({
      dom: { detection: 'explicit' },
      snow: { particleCount: 0, accumulation: { sliding: false } },
      performance: { maxDPR: 1 },
    });
    window.weather.pause();
    window.weather.addSnow(8);
    const s = window.inspection!.getSurfaces().find((s) => s.element.id === 'shaped')!;
    const a = document.getElementById('start')!.getBoundingClientRect(),
      b = document.getElementById('end')!.getBoundingClientRect();
    const { supportYAt } = await import('/packages/core/src/physics/profiles.ts' as string);
    return {
      x: s.x,
      y: s.y,
      angle: s.angle,
      expectedAngle: Math.atan2(b.y - a.y, b.x - a.x),
      expectedX: a.x,
      expectedY: a.y,
      width: s.width,
      left: supportYAt(s, 0),
      right: supportYAt(s, s.width),
      corner: s.cornerRadii?.[1],
    };
  });
  expect(result.angle).toBeCloseTo(result.expectedAngle, 4);
  expect(Math.abs(result.x - result.expectedX)).toBeLessThan(0.5);
  expect(Math.abs(result.y - result.expectedY)).toBeLessThan(0.5);
  expect(result.left).toBe(0);
  expect(result.corner!.x).toBeCloseTo(211.2, 1);
  expect(result.right).toBeCloseTo(64.8, 1);
  await page.screenshot({ path: '/tmp/winter-rounded-rotated-snow.png' });
});
test('font changes and responsive wrapping rebuild the glyph silhouette without rectangular ghosts', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html');
  await page.evaluate(() => {
    window.weather.destroy();
    document.body.replaceChildren();
    document.body.style.cssText = 'margin:0;min-height:1800px';
    document.body.innerHTML =
      '<h1 id="responsive" style="margin:100px 20px;width:700px;font:700 70px/1.2 serif">Small winter words</h1>';
    window.recreateWeather({ dom: { detection: 'auto' }, snow: { particleCount: 0 } });
  });
  const before = await page.evaluate(() =>
    window
      .inspection!.getSurfaces()
      .filter((s) => s.element.id === 'responsive')
      .map((s) => ({ width: s.width, ink: s.contour?.offsets.filter(Number.isFinite).length })),
  );
  await page.evaluate(() => {
    document.getElementById('responsive')!.style.cssText =
      'margin:100px 20px;width:300px;font:700 70px/1.2 monospace';
  });
  await expect
    .poll(() =>
      page.evaluate(
        () => window.inspection!.getSurfaces().filter((s) => s.element.id === 'responsive').length,
      ),
    )
    .toBeGreaterThan(before.length);
  const after = await page.evaluate(() =>
    window
      .inspection!.getSurfaces()
      .filter((s) => s.element.id === 'responsive')
      .map((s) => ({
        width: s.width,
        shape: s.shape,
        finite: s.contour?.offsets.some(Number.isFinite),
      })),
  );
  expect(after.every((s) => s.shape === 'text' && s.finite && s.width <= 350)).toBe(true);
});

test('stationary letter caps stay snowy without point streams and unrelated mutations reuse rasterised glyphs', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html');
  const result = await page.evaluate(async () => {
    window.weather.destroy();
    document.body.replaceChildren();
    document.body.style.cssText = 'margin:0;min-height:2000px;background:#faf8f2;color:#302b40';
    document.body.innerHTML =
      '<h1 id="snow-text" style="font:800 92px/1.2 Arial;margin:80px 20px;width:700px">Small words.<br><span style="color:#714de0">Big world.</span></h1><div id="unrelated"></div>';
    window.recreateWeather({
      dom: { detection: 'auto' },
      snow: { particleCount: 0, accumulation: { sliding: true, softness: 0.6 } },
      performance: { adaptive: false, maxDPR: 1 },
    });
    window.weather.addSnow(5, '#snow-text');
    const initial = window
      .inspection!.getSurfaces()
      .filter((s) => s.element.id === 'snow-text')
      .map((s) => s.contour!.offsets);
    for (let i = 0; i < 8; i++) {
      document.getElementById('unrelated')!.className = 'other-' + i;
      await new Promise((resolve) => setTimeout(resolve, 140));
    }
    const surfaces = window.inspection!.getSurfaces().filter((s) => s.element.id === 'snow-text');
    return {
      reused: surfaces.every((s, i) => s.contour!.offsets === initial[i]),
      particles: window.weather.getMetrics().particleCount,
      mass: surfaces.reduce((n, s) => n + s.profile.reduce((a, b) => a + b, 0), 0),
    };
  });
  expect(result.reused).toBe(true);
  expect(result.particles).toBe(0);
  expect(result.mass).toBeGreaterThan(300);
  await page.screenshot({ path: '/tmp/winter-powder-new.png' });
});
