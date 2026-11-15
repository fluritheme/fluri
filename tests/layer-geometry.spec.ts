import { expect, test } from '@playwright/test';
import type {} from './fixtures/main.js';

test('inherited rotated and scaled cards keep their actual top edge through scrolling', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html');
  await page.evaluate(() => {
    window.weather.destroy();
    document.body.replaceChildren();
    document.body.style.cssText = 'margin:0;min-height:2400px;background:#faf8f2';
    document.body.innerHTML = `<div id="tilted-parent" style="position:relative;margin:170px 30px;width:320px;height:600px;transform:rotate(3deg) scale(.85);transform-origin:15% 80%;background:#faf8f2">
      <article id="tilted-card" data-weather-surface style="position:absolute;top:150px;left:20px;width:240px;height:170px;background:white;transform:rotate(-2deg);transform-origin:10% 90%">
        <i id="edge-start" style="position:absolute;left:0;top:0;width:0;height:0"></i>
        <i id="edge-end" style="position:absolute;left:240px;top:0;width:0;height:0"></i>
      </article></div>`;
    window.recreateWeather({
      dom: { detection: 'explicit' },
      snow: { particleCount: 0, accumulation: { sliding: false } },
      performance: { adaptive: false },
    });
    window.weather.pause();
    window.weather.addSnow(12);
  });
  const geometry = () =>
    page.evaluate(() => {
      const s = window.inspection
        ?.getSurfaces()
        .find((surface) => surface.element.id === 'tilted-card');
      const a = document.querySelector('#edge-start')?.getBoundingClientRect();
      const b = document.querySelector('#edge-end')?.getBoundingClientRect();
      if (!s || !a || !b) throw new Error('Missing actual transformed card geometry');
      return {
        x: s.x,
        y: s.y,
        angle: s.angle,
        width: s.width,
        actualX: a.x,
        actualY: a.y,
        actualAngle: Math.atan2(b.y - a.y, b.x - a.x),
        actualWidth: Math.hypot(b.x - a.x, b.y - a.y),
        vy: s.velocity.y,
      };
    });
  for (const top of [0, 80, 30, 150, 0]) {
    await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), top);
    await page.waitForTimeout(80);
    const g = await geometry();
    expect(Math.abs(g.x - g.actualX)).toBeLessThan(0.6);
    expect(Math.abs(g.y - g.actualY)).toBeLessThan(0.6);
    // Firefox quantises zero-size marker bounds to 1/60 CSS px. The matrix
    // angle must retain the CSS rotation within 1/512 CSS px at the edge
    // (DOMMatrix serialisation also rounds), while the marker's physical
    // endpoint error stays below two of those layout units.
    expect(Math.abs(g.angle - Math.PI / 180) * g.width).toBeLessThan(1 / 512);
    expect(Math.abs(g.angle - g.actualAngle) * g.actualWidth).toBeLessThan(1 / 30);
    expect(g.width).toBeCloseTo(g.actualWidth, 1);
    expect(Math.abs(g.vy)).toBeLessThan(0.1);
  }
  await page.evaluate(() => {
    window.weather.resume();
    document
      .getElementById('tilted-parent')
      ?.animate(
        [{ transform: 'rotate(3deg) scale(.85)' }, { transform: 'rotate(16deg) scale(.85)' }],
        { duration: 1200, fill: 'forwards' },
      );
  });
  await page.waitForTimeout(150);
  const animated = await geometry();
  expect(Math.abs(animated.angle - animated.actualAngle)).toBeLessThan(0.01);
  expect(Math.abs(animated.angle)).toBeGreaterThan(0.035);
});

test('an opaque parent does not erase snow attached to its nested card', async ({ page }) => {
  await page.goto('/tests/fixtures/index.html');
  const capPixels = await page.evaluate(() => {
    window.weather.destroy();
    document.body.replaceChildren();
    document.body.style.cssText = 'margin:0;background:#fff;min-height:100vh';
    document.body.innerHTML =
      '<article data-weather-surface style="position:absolute;top:40px;left:10px;width:330px;height:400px;background:#1b253d"><article id="nested-card" data-weather-surface style="position:absolute;top:150px;left:25px;width:240px;height:90px;background:#aabbcc;border-radius:8px"></article></article>';
    window.recreateWeather({
      dom: { detection: 'explicit' },
      snow: { particleCount: 0, accumulation: { sliding: false, softness: 0 } },
      performance: { maxDPR: 1 },
    });
    window.weather.pause();
    window.weather.addSnow(18, '#nested-card');
    const canvas = document.querySelector<HTMLCanvasElement>('[data-fluri-layer="content"]');
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) throw new Error('Missing rendered snow canvas');
    const bounds = canvas.getBoundingClientRect(),
      scaleX = canvas.width / bounds.width,
      scaleY = canvas.height / bounds.height;
    const pixels = ctx.getImageData(
      Math.floor((55 - bounds.left) * scaleX),
      Math.floor((165 - bounds.top) * scaleY),
      Math.floor(200 * scaleX),
      Math.floor(26 * scaleY),
    ).data;
    let count = 0;
    for (let i = 0; i < pixels.length; i += 4)
      if ((pixels[i + 3] ?? 0) > 100 && (pixels[i] ?? 0) > 180) count++;
    return count;
  });
  expect(capPixels, 'Child snow remains on top of its opaque containing panel').toBeGreaterThan(
    200,
  );
});

test('opaque yellow overlays occlude shelves while translucent panels do not', async ({ page }) => {
  await page.goto('/tests/fixtures/index.html');
  await page.evaluate(() => {
    window.weather.destroy();
    document.body.replaceChildren();
    document.body.innerHTML =
      '<article id="covered-card" data-weather-surface style="position:absolute;top:120px;left:30px;width:240px;height:60px;background:white"></article><div id="cover" style="position:absolute;z-index:50;top:100px;left:20px;width:260px;height:100px;background:rgb(255,255,0)"></div>';
    window.recreateWeather({ dom: { detection: 'explicit' }, snow: { particleCount: 0 } });
  });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.inspection?.getSurfaces().find((s) => s.element.id === 'covered-card')?.occluded,
      ),
    )
    .toBe(true);
  await page.evaluate(() => {
    const cover = document.getElementById('cover');
    if (cover) cover.style.background = 'rgba(255,255,0,.1)';
  });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.inspection?.getSurfaces().find((s) => s.element.id === 'covered-card')?.occluded,
      ),
    )
    .toBe(false);
});

test('auto detection avoids transparent layout shelves and keeps explicit and bordered surfaces', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html');
  const ids = await page.evaluate(() => {
    window.weather.destroy();
    document.body.replaceChildren();
    document.body.innerHTML =
      '<section id="transparent-wrapper" style="width:320px;height:350px"><nav id="transparent-nav" style="all:unset;display:block;width:200px;height:40px">A few links</nav><article id="bordered-card" style="width:200px;height:80px;border:1px solid black">Card</article><section id="explicit-clear" data-weather-surface style="width:200px;height:80px"></section></section>';
    window.recreateWeather({ dom: { detection: 'auto' }, snow: { particleCount: 0 } });
    return window.inspection?.getSurfaces().map((s) => s.element.id);
  });
  expect(ids).toContain('bordered-card');
  expect(ids).toContain('explicit-clear');
  expect(ids).not.toContain('transparent-wrapper');
  expect(ids).not.toContain('transparent-nav');
});
