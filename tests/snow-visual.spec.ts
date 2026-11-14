import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type {} from './fixtures/main.js';

/** A real DOM scene with no ambient emitter makes mass transfer and raster contours measurable. */
async function controlledScene(page: Page): Promise<void> {
  await page.goto('/tests/fixtures/index.html');
  await expect.poll(() => page.evaluate(() => Boolean(window.weather))).toBe(true);
  await page.evaluate(() => {
    window.weather.destroy();
    const stage = document.createElement('div');
    stage.id = 'physical-scene';
    stage.style.cssText =
      'position:fixed;left:24px;top:90px;width:min(320px,calc(100vw - 48px));height:520px;background:#0b1320;z-index:1000';
    const upper = document.createElement('article');
    upper.id = 'cap-upper';
    upper.dataset.weatherSurface = '';
    upper.style.cssText =
      'position:absolute;left:20px;top:130px;width:calc(100% - 40px);height:55px;background:#24384f;border-radius:12px';
    const lower = document.createElement('article');
    lower.id = 'cap-lower';
    lower.dataset.weatherSurface = '';
    lower.style.cssText =
      'position:absolute;left:0;top:350px;width:100%;height:55px;background:#24384f;border-radius:12px';
    stage.append(upper, lower);
    document.body.append(stage);
    window.recreateWeather({
      container: stage,
      seed: 481,
      snow: {
        particleCount: 0,
        gravity: 360,
        turbulence: 0,
        wind: { base: 0, gusts: false },
        accumulation: { maxDepth: 28, sliding: false, softness: 0 },
      },
      dom: { detection: 'explicit' },
      interactions: { brush: { enabled: false } },
      performance: { adaptive: false },
    });
  });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window
            .captureSurfaces()
            .filter(
              (surface) =>
                ['cap-upper', 'cap-lower'].includes(surface.elementId) && surface.visible,
            ).length,
      ),
    )
    .toBe(2);
}

async function capRaster(
  page: Page,
): Promise<{ contour: number[]; alphaInGap: number; sideAlpha: number; centerAlpha: number }> {
  return page.evaluate(() => {
    const shelf = document.querySelector('#cap-upper')?.getBoundingClientRect();
    const canvas = document.querySelector<HTMLCanvasElement>('[data-fluri-layer="content"]');
    const ctx = canvas?.getContext('2d');
    if (!shelf || !canvas || !ctx) throw new Error('The real surface canvas is unavailable');
    const bounds = canvas.getBoundingClientRect();
    const scaleX = canvas.width / bounds.width;
    const scaleY = canvas.height / bounds.height;
    const alpha = (x: number, y: number): number =>
      ctx.getImageData(
        Math.floor((x - bounds.left) * scaleX),
        Math.floor((y - bounds.top) * scaleY),
        1,
        1,
      ).data[3] ?? 0;
    const contour: number[] = [];
    for (let x = 12; x < shelf.width - 12; x++) {
      let depth = 0;
      for (let y = 38; y >= 1; y--)
        if (alpha(shelf.left + x, shelf.top - y) > 80) {
          depth = y;
          break;
        }
      contour.push(depth);
    }
    let alphaInGap = 0;
    let sideAlpha = 0;
    let centerAlpha = 0;
    for (let x = -8; x <= 8; x++)
      for (let y = 2; y <= 28; y++)
        alphaInGap += alpha(shelf.left + shelf.width / 2 + x, shelf.top - y);
    for (let x = 24; x < 55; x++)
      for (let y = 2; y <= 28; y++) sideAlpha += alpha(shelf.left + x, shelf.top - y);
    for (let x = -2; x <= 2; x++)
      for (let y = 2; y <= 28; y++)
        centerAlpha += alpha(shelf.left + shelf.width / 2 + x, shelf.top - y);
    return { contour, alphaInGap, sideAlpha, centerAlpha };
  });
}

test('deposited mass renders broad organic caps, and genuinely empty bins leave a transparent gap', async ({
  page,
}, testInfo) => {
  await controlledScene(page);
  await page.evaluate(() => {
    window.weather.pause();
    window.weather.addSnow(20, '#cap-upper');
  });
  const before = await capRaster(page);
  const smoothed = before.contour.map((_, index, values) => {
    const neighborhood = values.slice(Math.max(0, index - 3), Math.min(values.length, index + 4));
    return neighborhood.reduce((sum, value) => sum + value, 0) / neighborhood.length;
  });
  let turns = 0;
  let direction = 0;
  for (let index = 5; index < smoothed.length - 5; index++) {
    const delta = (smoothed[index + 5] ?? 0) - (smoothed[index - 5] ?? 0);
    const current = Math.abs(delta) > 0.9 ? Math.sign(delta) : 0;
    if (current && direction && current !== direction) turns++;
    if (current) direction = current;
  }
  expect(Math.max(...smoothed) - Math.min(...smoothed)).toBeGreaterThan(2);
  expect(
    turns,
    'A cap must not repeat a small scalloped hill at every few mass bins',
  ).toBeLessThanOrEqual(8);
  const mass = await page.evaluate(() => {
    const surface = window.inspection
      ?.getSurfaces()
      .find((item) => item.element.id === 'cap-upper');
    if (!surface) throw new Error('Measured snow profile is missing');
    const before = surface.profile.reduce((sum, value) => sum + value, 0);
    const center = Math.floor(surface.profile.length / 2);
    for (let bin = center - 4; bin <= center + 4; bin++)
      if (bin >= 0 && bin < surface.profile.length) surface.profile[bin] = 0;
    window.weather.updateConfig({ debug: false });
    return { before, after: surface.profile.reduce((sum, value) => sum + value, 0) };
  });
  const after = await capRaster(page);
  expect(mass.after).toBeLessThan(mass.before);
  expect(after.alphaInGap, 'Empty mass bins must not be joined by an artificial white strip').toBe(
    0,
  );
  expect(after.sideAlpha).toBeGreaterThan(10000);
  const screenshot = testInfo.outputPath('organic-snow-and-empty-gap.png');
  await page.screenshot({ path: screenshot, animations: 'disabled' });
  await testInfo.attach('Mass-driven organic cap with a transparent cleared gap', {
    path: screenshot,
    contentType: 'image/png',
  });
});

test('an opaque DOM cover prevents invisible supports from collecting snow, and uncovering restores contact', async ({
  page,
}) => {
  await controlledScene(page);
  await page.evaluate(() => {
    const stage = document.querySelector('#physical-scene');
    const cover = document.createElement('div');
    cover.id = 'opaque-cover';
    cover.style.cssText =
      'position:absolute;left:8px;top:70px;width:calc(100% - 16px);height:150px;background:#4a395b;z-index:10';
    stage?.append(cover);
  });
  // Observe the actual measured cover before launching a particle; fixed delays hide observer races.
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.inspection?.getSurfaces().find((surface) => surface.element.id === 'cap-upper')
            ?.occluded ?? false,
      ),
    )
    .toBe(true);
  await page.evaluate(() => {
    const upper = window.inspection
      ?.getSurfaces()
      .find((surface) => surface.element.id === 'cap-upper');
    if (!upper) throw new Error('Covered support is missing');
    window.inspection?.spawnClump(upper.x + upper.width / 2, upper.y - 55, 120, 0, 180);
  });
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            window.captureSurfaces().find((surface) => surface.elementId === 'cap-lower')?.mass ??
            0,
        ),
      { timeout: 6000 },
    )
    .toBeGreaterThan(115);
  expect(
    await page.evaluate(
      () =>
        window.captureSurfaces().find((surface) => surface.elementId === 'cap-upper')?.mass ?? 0,
    ),
  ).toBe(0);
  await page.locator('#opaque-cover').evaluate((element) => element.remove());
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.inspection?.getSurfaces().find((surface) => surface.element.id === 'cap-upper')
            ?.occluded ?? false,
      ),
    )
    .toBe(false);
  await page.evaluate(() => {
    const upper = window.inspection
      ?.getSurfaces()
      .find((surface) => surface.element.id === 'cap-upper');
    if (!upper) throw new Error('Uncovered support is missing');
    window.inspection?.spawnClump(upper.x + upper.width / 2, upper.y - 55, 120, 0, 180);
  });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.captureSurfaces().find((surface) => surface.elementId === 'cap-upper')?.mass ?? 0,
      ),
    )
    .toBeGreaterThan(115);
});

test('real animated surface acceleration sheds existing snow and lands it on a lower DOM shelf', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  await page.clock.install({ time: new Date('2026-11-14T08:00:00Z') });
  await controlledScene(page);
  await page.clock.pauseAt(new Date('2026-11-14T10:00:00Z'));
  await page.evaluate(() => {
    window.weather.updateConfig({
      snow: { accumulation: { sliding: true, transferToLowerSurfaces: true } },
    });
    window.weather.addSnow(22, '#cap-upper');
    const samples: unknown[] = [];
    Reflect.set(window, '__shakeSamples', samples);
    let ticks = 0;
    window.weather.use({
      name: 'shake-diagnostics',
      update() {
        if (++ticks % 4 !== 0 || samples.length >= 120) return;
        const system = Reflect.get(window.weather, 'particles') as
          | { particles?: Array<{ x: number; y: number; vx: number; vy: number; mass: number }> }
          | undefined;
        samples.push({
          time: performance.now(),
          surfaces: window.captureSurfaces().map((surface) => ({
            id: surface.elementId,
            x: surface.x,
            y: surface.y,
            mass: surface.mass,
          })),
          parcels: system?.particles?.slice(0, 6).map((parcel) => ({
            x: parcel.x,
            y: parcel.y,
            vx: parcel.vx,
            vy: parcel.vy,
            mass: parcel.mass,
          })),
          count: system?.particles?.length,
        });
      },
    });
  });
  const before = await page.evaluate(
    () => window.captureSurfaces().find((surface) => surface.elementId === 'cap-upper')?.mass ?? 0,
  );
  expect(before).toBeGreaterThan(1000);
  await page.evaluate(() => {
    const card = document.querySelector<HTMLElement>('#cap-upper');
    if (!card) throw new Error('Moving support is missing');
    Reflect.set(window, '__shakeComplete', false);
    let started = 0;
    const animate = (timestamp: number): void => {
      if (!started) started = timestamp;
      const elapsed = (timestamp - started) / 1000;
      card.style.transform = `translate(${Math.sin(elapsed * 20) * 5}px, ${Math.sin(elapsed * 27) * 8}px)`;
      if (elapsed < 0.65) requestAnimationFrame(animate);
      else {
        card.style.transform = '';
        Reflect.set(window, '__shakeComplete', true);
      }
    };
    requestAnimationFrame(animate);
  });
  // Replay native RAF callbacks at a fixed cadence, so support acceleration and parcel
  // trajectories do not depend on the host machine's scheduling phase.
  await page.clock.runFor(1000);
  expect(await page.evaluate(() => Reflect.get(window, '__shakeComplete'))).toBe(true);
  await page.clock.runFor(3000);
  try {
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              window.captureSurfaces().find((surface) => surface.elementId === 'cap-lower')?.mass ??
              0,
          ),
        { timeout: 7000 },
      )
      .toBeGreaterThan(before * 0.05);
  } catch (error) {
    const samples = await page.evaluate(() => Reflect.get(window, '__shakeSamples'));
    await testInfo.attach('Actual shake parcel diagnostics', {
      body: JSON.stringify(samples, null, 2),
      contentType: 'application/json',
    });
    throw error;
  }
  const inheritedSpeeds = await page.evaluate(() => {
    const samples = Reflect.get(window, '__shakeSamples') as
      Array<{ parcels?: Array<{ vx: number; vy: number }> }> | undefined;
    const first = samples?.find((sample) => (sample.parcels?.length ?? 0) > 0);
    return first?.parcels?.map((parcel) => Math.hypot(parcel.vx, parcel.vy)) ?? [];
  });
  expect(inheritedSpeeds.length, 'A measured shake must detach real parcels').toBeGreaterThan(0);
  expect(
    Math.max(...inheritedSpeeds),
    'A smooth 5px/8px shake must not amplify measured support velocity into thousands of pixels per second',
  ).toBeLessThan(800);
  const after = await page.evaluate(() => ({
    upper: window.captureSurfaces().find((surface) => surface.elementId === 'cap-upper')?.mass ?? 0,
    lower: window.captureSurfaces().find((surface) => surface.elementId === 'cap-lower')?.mass ?? 0,
    events: window.eventLog.map((event) => event.name),
  }));
  expect(after.upper).toBeLessThan(before * 0.95);
  expect(after.upper + after.lower).toBeLessThanOrEqual(before * 1.005);
  expect(after.events).toContain('snow:slide');
  expect(after.events).toContain('snow:transfer');
});

test('a genuine downward brush leaves a visible clean gap and sends its snow to the receiving shelf', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'Hover brushing requires a physical pointer; mobile has explicit controls.');
  await controlledScene(page);
  await page.evaluate(() => {
    window.weather.updateConfig({
      interactions: { brush: { enabled: true, radius: 22, strength: 5 } },
    });
    window.weather.addSnow(20, '#cap-upper');
  });
  const shelf = await page.locator('#cap-upper').boundingBox();
  if (!shelf) throw new Error('Brush support is not measurable');
  const before = await page.evaluate(
    () => window.captureSurfaces().find((surface) => surface.elementId === 'cap-upper')?.mass ?? 0,
  );
  await page.mouse.move(shelf.x + shelf.width / 2, shelf.y - 65);
  await page.mouse.move(shelf.x + shelf.width / 2, shelf.y + 5, { steps: 7 });
  await expect
    .poll(() => page.evaluate(() => window.eventLog.some((event) => event.name === 'snow:brush')))
    .toBe(true);
  await page.evaluate(() =>
    window.weather.updateConfig({ interactions: { brush: { enabled: false } } }),
  );
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            window.captureSurfaces().find((surface) => surface.elementId === 'cap-lower')?.mass ??
            0,
        ),
      { timeout: 6000 },
    )
    .toBeGreaterThan(50);
  await page.evaluate(() => window.weather.pause());
  const after = await capRaster(page);
  const mass = await page.evaluate(
    () => window.captureSurfaces().find((surface) => surface.elementId === 'cap-upper')?.mass ?? 0,
  );
  expect(mass).toBeLessThan(before * 0.95);
  expect(after.centerAlpha).toBe(0);
  expect(after.sideAlpha).toBeGreaterThan(10000);
  expect(
    await page.evaluate(() => window.eventLog.some((event) => event.name === 'snow:transfer')),
  ).toBe(true);
});

test('a full snowpack retains real packing variation and rounded attached shoulders', async ({
  page,
}, info) => {
  await controlledScene(page);
  await page.evaluate(() => {
    window.weather.pause();
    window.weather.addSnow(80, '#cap-upper');
  });
  const raster = await capRaster(page);
  const interior = raster.contour.slice(20, -20);
  expect(
    Math.max(...interior) - Math.min(...interior),
    'Saturated snow must retain ridges rather than flatten into a perfect bar',
  ).toBeGreaterThan(3);
  const box = await page.locator('#cap-upper').boundingBox();
  if (!box) throw new Error('No physical support');
  const path = info.outputPath('full-snowpack-rounded-shoulders.png');
  await page.screenshot({
    path,
    clip: { x: Math.max(0, box.x - 4), y: box.y - 38, width: box.width + 8, height: 90 },
  });
  await info.attach('Full physical snowpack with rounded shoulders', {
    path,
    contentType: 'image/png',
  });
});
