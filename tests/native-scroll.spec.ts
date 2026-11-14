import { expect, test } from '@playwright/test';
import type {} from './fixtures/main.js';

test('scoped snow stays attached during native page and nested scrolling even before the next JavaScript paint', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-11-14T08:00:00Z') });
  await page.goto('/tests/fixtures/index.html');
  await expect.poll(() => page.evaluate(() => Boolean(window.weather))).toBe(true);
  await page.evaluate(() => {
    window.weather.destroy();
    document.body.replaceChildren();
    document.body.style.cssText = 'margin:0;min-height:2200px;background:#eff5f7';
    const scroller = document.createElement('div');
    scroller.id = 'native-scroll-parent';
    scroller.style.cssText =
      'position:relative;top:120px;margin-left:20px;width:min(320px,calc(100vw - 40px));height:500px;overflow:auto;border:5px solid #819eab';
    const stage = document.createElement('section');
    stage.id = 'native-scroll-scene';
    stage.style.cssText =
      'position:relative;margin-top:70px;height:400px;border:7px solid #a1bdc8;background:#dbe9ee';
    const shelf = document.createElement('article');
    shelf.id = 'native-scroll-shelf';
    shelf.dataset.weatherSurface = '';
    shelf.style.cssText =
      'position:absolute;top:120px;left:20px;width:calc(100% - 40px);height:70px;background:#234757;border-radius:12px';
    const spacer = document.createElement('div');
    spacer.style.height = '500px';
    stage.append(shelf);
    scroller.append(stage, spacer);
    document.body.append(scroller);
    window.recreateWeather({
      container: stage,
      snow: { particleCount: 0, accumulation: { sliding: false, softness: 0 } },
      dom: { detection: 'explicit' },
      interactions: { brush: { enabled: false } },
    });
    window.weather.pause();
    window.weather.addSnow(14);
  });
  await page.clock.pauseAt(new Date('2026-11-14T10:00:00Z'));
  const snapshot = () =>
    page.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>('[data-fluri-layer="content"]');
      const shelf = document.querySelector('#native-scroll-shelf');
      const context = canvas?.getContext('2d');
      if (!canvas || !shelf || !context) throw new Error('Missing real snow canvas or support');
      const bounds = canvas.getBoundingClientRect();
      const rect = shelf.getBoundingClientRect();
      const scale = canvas.height / bounds.height;
      const x = Math.floor(
        ((rect.left + rect.width / 2 - bounds.left) * canvas.width) / bounds.width,
      );
      const rows = context.getImageData(x, 0, 1, canvas.height).data;
      let contact = -Infinity;
      for (let y = 0; y < canvas.height; y++) {
        const index = y * 4;
        if (
          (rows[index + 3] ?? 0) > 100 &&
          (rows[index] ?? 0) > 180 &&
          (rows[index + 1] ?? 0) > 180
        )
          contact = bounds.top + y / scale;
      }
      return {
        mount: canvas.parentElement?.parentElement?.id,
        canvasTop: bounds.top,
        shelfTop: rect.top,
        contactOffset: contact - rect.top,
        mass: window.weather.getMetrics().snowMass,
      };
    });
  const before = await snapshot();
  expect(before.mount).toBe('native-scroll-scene');
  expect(Number.isFinite(before.contactOffset)).toBe(true);
  for (const top of [70, 0, 95, 25]) {
    await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), top);
    const after = await snapshot();
    expect(after.canvasTop - before.canvasTop).toBeCloseTo(after.shelfTop - before.shelfTop, 2);
    expect(after.contactOffset).toBeCloseTo(before.contactOffset, 2);
    expect(after.mass).toBe(before.mass);
  }
  for (const top of [45, 0, 80, 20]) {
    await page.evaluate((top) => {
      const parent = document.querySelector('#native-scroll-parent');
      if (parent) parent.scrollTop = top;
    }, top);
    const after = await snapshot();
    expect(after.canvasTop - before.canvasTop).toBeCloseTo(after.shelfTop - before.shelfTop, 2);
    expect(after.contactOffset).toBeCloseTo(before.contactOffset, 2);
    expect(after.mass).toBe(before.mass);
  }
  await page.clock.runFor(100);
  expect((await snapshot()).contactOffset).toBeCloseTo(before.contactOffset, 1);
});

test('native scoped rendering leaves the host layout and teardown intact', async ({ page }) => {
  await page.goto('/tests/fixtures/index.html');
  const result = await page.evaluate(() => {
    window.weather.destroy();
    const scene = document.createElement('section');
    scene.style.cssText =
      'position:relative;width:260px;height:300px;border:6px solid blue;overflow:hidden';
    scene.innerHTML =
      '<article data-weather-surface style="width:200px;height:50px;background:#234757;margin:60px 20px"></article>';
    document.body.append(scene);
    const snapshot = () => ({
      width: scene.offsetWidth,
      height: scene.offsetHeight,
      style: scene.getAttribute('style'),
    });
    const before = snapshot();
    window.recreateWeather({
      container: scene,
      dom: { detection: 'explicit' },
      snow: { particleCount: 0 },
    });
    const mounted = snapshot();
    const canvas = scene.querySelector<HTMLCanvasElement>('canvas');
    const canvasPixels = canvas?.width ?? 0;
    window.weather.destroy();
    return {
      before,
      mounted,
      after: snapshot(),
      overlays: scene.querySelectorAll('[data-fluri-root]').length,
      canvasPixels,
      viewportPixels: innerWidth * devicePixelRatio,
    };
  });
  expect(result.before).toEqual(result.mounted);
  expect(result.before).toEqual(result.after);
  expect(result.overlays).toBe(0);
  expect(result.canvasPixels).toBeGreaterThan(0);
  expect(result.canvasPixels).toBeLessThan(result.viewportPixels);
});
