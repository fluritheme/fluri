import { expect, test } from '@playwright/test';
import type {} from './fixtures/main.js';

// Freeze the effect's JavaScript paint clock, not the browser's native scrolling.
// A fixed bitmap fails this even when its geometry is perfect after the next RAF.
test('whole-page deposits follow fast native scroll before the next JavaScript paint', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-11-15T08:00:00Z') });
  await page.goto('/tests/fixtures/index.html');
  await expect.poll(() => page.evaluate(() => Boolean(window.weather))).toBe(true);
  await page.evaluate(() => {
    window.weather.destroy();
    document.body.replaceChildren();
    document.body.style.cssText = 'margin:0;min-height:9000px;background:#eff5f7';
    const shelf = document.createElement('article');
    shelf.id = 'fast-scroll-shelf';
    shelf.dataset.weatherSurface = '';
    shelf.style.cssText =
      'position:absolute;left:35px;top:1100px;width:240px;height:80px;background:#234757';
    document.body.append(shelf);
    window.scrollTo({ top: 900, behavior: 'instant' });
    window.recreateWeather({
      dom: { detection: 'explicit' },
      snow: { particleCount: 0, accumulation: { sliding: false, softness: 0 } },
      interactions: { brush: { enabled: false } },
      performance: { adaptive: false, maxDPR: 1, maxFPS: 10 },
    });
    window.weather.pause();
    window.weather.addSnow(14);
  });
  await page.clock.pauseAt(new Date('2026-11-15T10:00:00Z'));
  const snapshot = () =>
    page.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>('[data-fluri-layer="content"]');
      const shelf = document.querySelector('#fast-scroll-shelf');
      const context = canvas?.getContext('2d');
      if (!canvas || !shelf || !context) throw Error('Missing real snow/support');
      const rect = shelf.getBoundingClientRect(),
        bounds = canvas.getBoundingClientRect();
      const scale = canvas.height / bounds.height;
      const x = Math.floor(
        ((rect.left + rect.width / 2 - bounds.left) * canvas.width) / bounds.width,
      );
      const rows = context.getImageData(x, 0, 1, canvas.height).data;
      let contact = -Infinity;
      for (let y = 0; y < canvas.height; y++) {
        const i = y * 4;
        if ((rows[i + 3] ?? 0) > 100 && (rows[i] ?? 0) > 180 && (rows[i + 1] ?? 0) > 180)
          contact = bounds.top + y / scale;
      }
      return {
        shelfTop: rect.top,
        canvasTop: bounds.top,
        contactOffset: contact - rect.top,
        height: canvas.height,
        viewport: innerHeight,
        pageHeight: document.documentElement.scrollHeight,
        mass: window.weather.getMetrics().snowMass,
      };
    });
  const before = await snapshot();
  expect(Number.isFinite(before.contactOffset)).toBe(true);
  expect(before.height).toBeLessThanOrEqual(before.viewport + 2048);
  expect(before.height).toBeLessThan(before.pageHeight / 2);
  for (const top of [1050, 850, 1130, 930, 980]) {
    await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), top);
    const after = await snapshot();
    expect(after.canvasTop - before.canvasTop).toBeCloseTo(after.shelfTop - before.shelfTop, 2);
    expect(after.contactOffset).toBeCloseTo(before.contactOffset, 2);
    expect(after.mass).toBe(before.mass);
  }
  await page.mouse.move(350, 250);
  for (const deltaY of [60, -60]) {
    const previous = await page.evaluate(() => scrollY);
    await page.mouse.wheel(0, deltaY);
    await expect.poll(() => page.evaluate(() => scrollY)).not.toBe(previous);
    expect((await snapshot()).contactOffset).toBeCloseTo(before.contactOffset, 2);
  }
  await page.clock.runFor(100);
  expect((await snapshot()).contactOffset).toBeCloseTo(before.contactOffset, 1);
});

test('document rendering does not enlarge page dimensions and viewport flakes stay fixed', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html');
  const dimensions = await page.evaluate(() => {
    window.weather.destroy();
    document.body.style.cssText = 'margin:0;min-height:2400px';
    const before = {
      height: document.documentElement.scrollHeight,
      width: document.documentElement.scrollWidth,
    };
    window.recreateWeather({
      snow: { particleCount: 0 },
      performance: { adaptive: false, maxDPR: 1 },
    });
    window.weather.pause();
    const host = document.querySelector<HTMLElement>('[data-fluri-root="effects"]')!;
    const content = host.querySelector<HTMLCanvasElement>('[data-fluri-layer="content"]')!;
    const particles = host.querySelector<HTMLCanvasElement>('[data-fluri-layer="background"]')!;
    const beforeScroll = {
      content: content.getBoundingClientRect().top,
      particles: particles.getBoundingClientRect().top,
    };
    window.scrollTo({ top: 600, behavior: 'instant' });
    const afterScroll = {
      content: content.getBoundingClientRect().top,
      particles: particles.getBoundingClientRect().top,
    };
    const during = {
      height: document.documentElement.scrollHeight,
      width: document.documentElement.scrollWidth,
    };
    window.weather.destroy();
    return {
      before,
      during,
      after: {
        height: document.documentElement.scrollHeight,
        width: document.documentElement.scrollWidth,
      },
      beforeScroll,
      afterScroll,
    };
  });
  expect(dimensions.during).toEqual(dimensions.before);
  expect(dimensions.after).toEqual(dimensions.before);
  expect(dimensions.afterScroll.particles).toBe(dimensions.beforeScroll.particles);
  expect(dimensions.afterScroll.content - dimensions.beforeScroll.content).toBe(-600);
});
