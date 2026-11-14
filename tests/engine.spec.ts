import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type {} from './fixtures/main.js';

async function ready(page: Page): Promise<void> {
  await page.goto('/tests/fixtures/index.html');
  await expect
    .poll(() => page.evaluate(() => window.weather?.getMetrics().surfaceCount ?? 0))
    .toBeGreaterThan(3);
}

test.beforeEach(async ({ page }) => {
  await ready(page);
});

test('renders real snowfall while preserving underlying clicks and DPR sizing', async ({
  page,
}) => {
  await expect
    .poll(() => page.evaluate(() => window.weather.getMetrics().particleCount))
    .toBeGreaterThan(0);
  await expect(page.locator('[data-fluri-root="effects"] canvas')).toHaveCount(3);
  const canvasState = await page.evaluate(() => {
    const host = document.querySelector<HTMLElement>('[data-fluri-root="effects"]');
    return {
      inert: host?.inert,
      hidden: host?.getAttribute('aria-hidden'),
      pointer: host && getComputedStyle(host).pointerEvents,
      canvases: [...document.querySelectorAll<HTMLCanvasElement>('[data-fluri-layer]')].map(
        (canvas) => ({
          width: canvas.width,
          height: canvas.height,
          expectedWidth: Math.round(innerWidth * Math.min(devicePixelRatio, 2)),
          expectedHeight: Math.round(innerHeight * Math.min(devicePixelRatio, 2)),
        }),
      ),
    };
  });
  expect(canvasState.inert).toBe(true);
  expect(canvasState.hidden).toBe('true');
  expect(canvasState.pointer).toBe('none');
  for (const canvas of canvasState.canvases) {
    expect(canvas.width).toBe(canvas.expectedWidth);
    expect(canvas.height).toBe(canvas.expectedHeight);
  }
  await page.getByRole('button', { name: 'Click me' }).click();
  await expect(page.locator('#click-count')).toHaveText('1');
  await page.setViewportSize({ width: 720, height: 640 });
  await expect
    .poll(() =>
      page.evaluate(() => document.querySelector<HTMLCanvasElement>('[data-fluri-layer]')?.width),
    )
    .toBe(await page.evaluate(() => Math.round(720 * Math.min(devicePixelRatio, 2))));
  await page.evaluate(() => window.weather.pause());
  const paused = await page.evaluate(() => window.weather.getMetrics());
  await page.waitForTimeout(150);
  const later = await page.evaluate(() => window.weather.getMetrics());
  expect(later.state).toBe('paused');
  expect(later.particleCount).toBe(paused.particleCount);
  expect(later.fps).toBe(paused.fps);
  await page.evaluate(() => {
    window.weather.resume();
    window.weather.stop();
  });
  expect(await page.evaluate(() => window.weather.getMetrics().particleCount)).toBe(0);
});

test('repeated lifecycle releases native observers, live listeners, overlays, and plugins', async ({
  page,
}) => {
  const audit = await page.evaluate(() => {
    window.weather.destroy();
    const before = window.resourceAudit.snapshot();
    let setups = 0;
    let cleanups = 0;
    let destroys = 0;
    const iterations = [];
    for (let index = 0; index < 12; index++) {
      const engine = window.fluriExports.createWeather({
        snow: { particleCount: 0 },
        accessibility: { controls: true },
      });
      engine.use({
        name: `cleanup-${index}`,
        setup() {
          setups++;
          const listener = () => undefined;
          document.addEventListener('fluri-test-observation', listener);
          return () => {
            cleanups++;
            document.removeEventListener('fluri-test-observation', listener);
          };
        },
        destroy() {
          destroys++;
        },
      });
      engine.start();
      engine.start();
      engine.pause();
      engine.resume();
      engine.stop();
      engine.start();
      engine.destroy();
      engine.destroy();
      iterations.push(window.resourceAudit.snapshot());
    }
    return {
      baseline: window.baselineResources,
      before,
      iterations,
      setups,
      cleanups,
      destroys,
      overlays: document.querySelectorAll('[data-fluri-root]').length,
    };
  });
  expect(audit.before).toEqual(audit.baseline);
  for (const iteration of audit.iterations) expect(iteration).toEqual(audit.before);
  expect(audit.setups).toBe(12);
  expect(audit.cleanups).toBe(12);
  expect(audit.destroys).toBe(12);
  expect(audit.overlays).toBe(0);
});

test('deposits follow translation, rotation, responsive width, and sticky scrolling', async ({
  page,
}) => {
  await page.evaluate(() => {
    window.weather.updateConfig({
      snow: { particleCount: 0, accumulation: { sliding: false, softness: 0 } },
    });
    window.weather.addSnow(10, '#upper');
  });
  const before = await page.evaluate(() =>
    window.captureSurfaces().find((surface) => surface.elementId === 'upper'),
  );
  expect(before?.mass).toBeGreaterThan(0);
  await page.locator('#upper').evaluate((element) => {
    (element as HTMLElement).style.transform = 'translate(38px, 22px) rotate(8deg)';
  });
  await expect
    .poll(() =>
      page.evaluate(() =>
        Math.abs(
          window.captureSurfaces().find((surface) => surface.elementId === 'upper')?.angle ?? 0,
        ),
      ),
    )
    .toBeGreaterThan(0.1);
  const transformed = await page.evaluate(() =>
    window.captureSurfaces().find((surface) => surface.elementId === 'upper'),
  );
  expect(transformed?.id).toBe(before?.id);
  expect(transformed?.mass).toBeCloseTo(before?.mass ?? 0, 2);
  expect(transformed?.x).not.toBe(before?.x);
  await page.locator('#upper').evaluate((element) => {
    (element as HTMLElement).style.width = '230px';
  });
  await expect
    .poll(() =>
      page.evaluate(
        () => window.captureSurfaces().find((surface) => surface.elementId === 'upper')?.width ?? 0,
      ),
    )
    .toBeLessThan(250);
  const resized = await page.evaluate(() => {
    const surface = window.captureSurfaces().find((item) => item.elementId === 'upper');
    const emitted = window.eventLog.reduce((sum, event) => {
      if (event.name !== 'snow:slide' || !event.data || typeof event.data !== 'object') return sum;
      const data = event.data as { surfaceId?: string; mass?: number };
      return data.surfaceId === surface?.id && typeof data.mass === 'number'
        ? sum + data.mass
        : sum;
    }, 0);
    window.weather.pause();
    return { surface, emitted };
  });
  expect(resized.surface?.mass ?? 0).toBeLessThan(before?.mass ?? 0);
  expect(resized.emitted).toBeGreaterThan(0);
  expect((resized.surface?.mass ?? 0) + resized.emitted).toBeCloseTo(before?.mass ?? 0, 1);
  const widthBeforeGrowth = resized.surface?.width ?? 0;
  await page.locator('#upper').evaluate((element, width) => {
    (element as HTMLElement).style.width = `${width}px`;
  }, before?.width ?? 420);
  await expect
    .poll(() =>
      page.evaluate(
        () => window.captureSurfaces().find((surface) => surface.elementId === 'upper')?.width ?? 0,
      ),
    )
    .toBeGreaterThan(widthBeforeGrowth + 20);
  const grown = await page.evaluate(() =>
    window.captureSurfaces().find((surface) => surface.elementId === 'upper'),
  );
  expect(grown?.mass).toBeCloseTo(resized.surface?.mass ?? 0, 1);
  const addedAreaMass =
    grown?.bins.reduce(
      (sum, mass, index) =>
        sum + ((index + 0.5) * grown.binSize > widthBeforeGrowth + 8 ? mass : 0),
      0,
    ) ?? 0;
  expect(
    addedAreaMass,
    'Growing a surface must expose a bare extension rather than stretch existing snow',
  ).toBe(0);
  await page.evaluate(() => window.weather.resume());
  await page.evaluate(() => scrollTo(0, 400));
  await expect
    .poll(() =>
      page.evaluate(() =>
        Math.round(
          window.captureSurfaces().find((surface) => surface.elementId === 'sticky')?.y ?? -1,
        ),
      ),
    )
    .toBe(12);
  const geometry = await page.evaluate(() => {
    const sticky = window.captureSurfaces().find((surface) => surface.elementId === 'sticky');
    return {
      engine: sticky?.y,
      browser: document.querySelector('#sticky')?.getBoundingClientRect().top,
    };
  });
  expect(geometry.engine).toBeCloseTo(geometry.browser ?? -1, 1);
});

test('registerSurface overrides attributes, and mutation removal sheds real snow', async ({
  page,
}) => {
  await page.evaluate(() => {
    window.weather.updateConfig({ snow: { particleCount: 0 } });
    const card = document.createElement('article');
    card.id = 'inserted';
    card.dataset.weatherSurface = '';
    card.dataset.weatherSnowDepth = '2';
    card.style.cssText =
      'position:fixed;left:30px;top:160px;width:150px;height:40px;background:#25415e';
    document.querySelector('#dynamic')?.append(card);
    window.weather.registerSurface(card, {
      maxSnowDepth: 14,
      material: 'sticky',
      layer: 'foreground',
    });
  });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.captureSurfaces().find((surface) => surface.elementId === 'inserted')?.maxDepth,
      ),
    )
    .toBe(14);
  const registration = await page.evaluate(() =>
    window.captureSurfaces().find((surface) => surface.elementId === 'inserted'),
  );
  expect(registration?.material).toBe('sticky');
  expect(registration?.layer).toBe('foreground');
  await page.evaluate(() => window.weather.addSnow(12, '#inserted'));
  const mass = await page.evaluate(
    () => window.captureSurfaces().find((surface) => surface.elementId === 'inserted')?.mass ?? 0,
  );
  expect(mass).toBeGreaterThan(300);
  await page.locator('#inserted').evaluate((element) => element.remove());
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.captureSurfaces().some((surface) => surface.elementId === 'inserted'),
      ),
    )
    .toBe(false);
  expect(
    await page.evaluate(() => window.eventLog.some((event) => event.name === 'surface:removed')),
  ).toBe(true);
  expect(
    await page.evaluate(
      () => window.eventLog.find((event) => event.name === 'surface:removed')?.particles ?? 0,
    ),
  ).toBeGreaterThan(0);
});

test('scrolling moves deposited snow with its support without a physical avalanche', async ({
  page,
}) => {
  await page.evaluate(() => {
    window.weather.updateConfig({
      snow: { particleCount: 0, accumulation: { sliding: true, softness: 0 } },
      interactions: { brush: { enabled: false } },
    });
    window.weather.addSnow(16, '#upper');
  });
  const before = await page.evaluate(
    () => window.captureSurfaces().find((surface) => surface.elementId === 'upper')?.mass ?? 0,
  );
  await page.evaluate(() => scrollTo(0, 220));
  await expect
    .poll(() =>
      page.evaluate(() =>
        Math.round(
          window.captureSurfaces().find((surface) => surface.elementId === 'upper')?.y ?? 0,
        ),
      ),
    )
    .toBe(
      await page
        .locator('#upper')
        .evaluate((element) => Math.round(element.getBoundingClientRect().top)),
    );
  await page.waitForTimeout(200);
  expect(
    await page.evaluate(
      () => window.captureSurfaces().find((surface) => surface.elementId === 'upper')?.mass ?? 0,
    ),
  ).toBeCloseTo(before, 2);
  expect(await page.evaluate(() => window.weather.getMetrics().particleCount)).toBe(0);
});

test('nested scrolling preserves piles on ordinary, fixed, and sticky surfaces', async ({
  page,
}) => {
  await page.evaluate(() => {
    const scroller = document.createElement('div');
    scroller.id = 'nested-scroller';
    scroller.style.cssText =
      'position:fixed;top:150px;left:20px;width:280px;height:280px;overflow:auto;background:#14253a;z-index:5';
    const content = document.createElement('div');
    content.style.cssText = 'height:1000px;padding-top:20px';
    const sticky = document.createElement('div');
    sticky.id = 'nested-sticky';
    sticky.dataset.weatherSurface = '';
    sticky.style.cssText = 'position:sticky;top:10px;width:220px;height:40px;background:#385676';
    const shelf = document.createElement('div');
    shelf.id = 'nested-shelf';
    shelf.dataset.weatherSurface = '';
    shelf.style.cssText = 'margin-top:100px;width:240px;height:45px;background:#385676';
    const fixed = document.createElement('div');
    fixed.id = 'fixed-shelf';
    fixed.dataset.weatherSurface = '';
    fixed.style.cssText =
      'position:fixed;top:90px;left:30px;width:180px;height:35px;background:#385676';
    content.append(sticky, shelf);
    scroller.append(content);
    document.body.append(scroller, fixed);
    window.weather.updateConfig({
      snow: { particleCount: 0, accumulation: { sliding: true, softness: 0 } },
      interactions: { brush: { enabled: false } },
    });
  });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window
            .captureSurfaces()
            .filter((surface) =>
              ['nested-sticky', 'nested-shelf', 'fixed-shelf'].includes(surface.elementId),
            ).length,
      ),
    )
    .toBe(3);
  await page.evaluate(() => {
    window.weather.addSnow(14, '#nested-sticky, #nested-shelf, #fixed-shelf');
  });
  const before = await page.evaluate(() =>
    window
      .captureSurfaces()
      .filter((surface) =>
        ['nested-sticky', 'nested-shelf', 'fixed-shelf'].includes(surface.elementId),
      ),
  );
  await page.locator('#nested-scroller').evaluate((element) => {
    element.scrollTop = 110;
  });
  await page.evaluate(() => scrollTo(0, 100));
  await expect
    .poll(() =>
      page.evaluate(
        () => window.captureSurfaces().find((surface) => surface.elementId === 'nested-shelf')?.y,
      ),
    )
    .toBe(
      await page
        .locator('#nested-shelf')
        .evaluate((element) => element.getBoundingClientRect().top),
    );
  await page.waitForTimeout(200);
  const after = await page.evaluate(() =>
    window
      .captureSurfaces()
      .filter((surface) =>
        ['nested-sticky', 'nested-shelf', 'fixed-shelf'].includes(surface.elementId),
      ),
  );
  for (const original of before) {
    const current = after.find((surface) => surface.elementId === original.elementId);
    expect(current?.mass).toBeCloseTo(original.mass, 2);
  }
  expect(after.find((surface) => surface.elementId === 'fixed-shelf')?.y).toBe(90);
  expect(await page.evaluate(() => window.weather.getMetrics().particleCount)).toBe(0);
});

test('scroll attachment redraws between capped simulation frames, including scoped previews', async ({
  page,
}) => {
  for (const scoped of [false, true]) {
    await page.evaluate((scoped) => {
      scrollTo({ top: 0, behavior: 'instant' });
      const main = document.querySelector<HTMLElement>('main');
      if (!main) throw new Error('Missing fixture content');
      window.recreateWeather({
        ...(scoped ? { container: main } : {}),
        seed: 731,
        snow: { particleCount: 0, accumulation: { sliding: false, softness: 0, maxDepth: 20 } },
        interactions: { brush: { enabled: false } },
        dom: { detection: 'explicit' },
        performance: { adaptive: false, maxFPS: 15 },
      });
      window.weather.addSnow(14, '#upper');
    }, scoped);
    const measurements = await page.evaluate(async () => {
      const surface = document.querySelector('#upper');
      const canvas = document.querySelector<HTMLCanvasElement>('[data-fluri-layer="content"]');
      const ctx = canvas?.getContext('2d');
      if (!surface || !canvas || !ctx) throw new Error('Missing snow support or canvas');
      const scale = canvas.width / innerWidth;
      const initialMass = window.captureSurfaces().find((item) => item.elementId === 'upper')?.mass;
      const samples: { geometryError: number; snowContactOffset: number }[] = [];
      for (let index = 0; index < 16; index++) {
        scrollTo({ top: index * 7, behavior: 'instant' });
        await new Promise(requestAnimationFrame);
        const rect = surface.getBoundingClientRect();
        const measured = window.captureSurfaces().find((item) => item.elementId === 'upper');
        const x = Math.floor((rect.left + rect.width / 2) * scale);
        const start = Math.floor((rect.top - 25) * scale);
        const pixels = ctx.getImageData(x, start, 1, Math.ceil(60 * scale)).data;
        let lastSnowRow = -Infinity;
        for (let row = 0; row < pixels.length / 4; row++) {
          const at = row * 4;
          if (
            (pixels[at + 3] ?? 0) > 90 &&
            (pixels[at] ?? 0) > 180 &&
            (pixels[at + 1] ?? 0) > 180 &&
            (pixels[at + 2] ?? 0) > 180
          )
            lastSnowRow = (start + row) / scale;
        }
        samples.push({
          geometryError: Math.abs((measured?.y ?? -Infinity) - rect.top),
          snowContactOffset: lastSnowRow - rect.top,
        });
      }
      return {
        samples,
        initialMass,
        finalMass: window.captureSurfaces().find((item) => item.elementId === 'upper')?.mass,
      };
    });
    expect(measurements.finalMass).toBeCloseTo(measurements.initialMass ?? 0, 2);
    for (const sample of measurements.samples) {
      expect(sample.geometryError, scoped ? 'scoped geometry' : 'document geometry').toBeLessThan(
        1,
      );
      expect(
        sample.snowContactOffset,
        'The painted snow still meets the actual support',
      ).toBeGreaterThan(-3);
      expect(
        sample.snowContactOffset,
        'No stale deposit floats below the scrolled support',
      ).toBeLessThan(2);
    }
  }
});

test('paused deposits follow layout and scroll without running physics or resuming motion', async ({
  page,
}) => {
  await page.evaluate(() => {
    window.weather.updateConfig({
      snow: { particleCount: 0, accumulation: { sliding: true, softness: 0 } },
      interactions: { brush: { enabled: false } },
    });
    window.weather.addSnow(16, '#upper');
    window.weather.pause();
  });
  const before = await page.evaluate(() => ({
    metrics: window.weather.getMetrics(),
    surface: window.captureSurfaces().find((surface) => surface.elementId === 'upper'),
  }));
  await page.locator('#upper').evaluate((element) => {
    (element as HTMLElement).style.transform = 'translate(28px, 34px)';
  });
  await expect
    .poll(() =>
      page.evaluate(() =>
        Math.abs(
          (window.captureSurfaces().find((surface) => surface.elementId === 'upper')?.x ?? -10000) -
            (document.querySelector('#upper')?.getBoundingClientRect().left ?? 0),
        ),
      ),
    )
    // DOMMatrix fallback reconstructs fractional boxes from integer offsetWidth/offsetHeight.
    .toBeLessThan(0.6);
  await page.evaluate(() => scrollTo(0, 120));
  await expect
    .poll(() =>
      page.evaluate(() =>
        Math.abs(
          (window.captureSurfaces().find((surface) => surface.elementId === 'upper')?.y ?? -10000) -
            (document.querySelector('#upper')?.getBoundingClientRect().top ?? 0),
        ),
      ),
    )
    .toBeLessThan(0.6);
  const after = await page.evaluate(() => ({
    metrics: window.weather.getMetrics(),
    surface: window.captureSurfaces().find((surface) => surface.elementId === 'upper'),
  }));
  expect(after.metrics.state).toBe('paused');
  expect(after.metrics.fps).toBe(before.metrics.fps);
  expect(after.metrics.particleCount).toBe(before.metrics.particleCount);
  expect(after.surface?.mass).toBeCloseTo(before.surface?.mass ?? 0, 2);
  await page.evaluate(() => window.weather.resume());
  await page.waitForTimeout(150);
  expect(
    await page.evaluate(
      () => window.captureSurfaces().find((surface) => surface.elementId === 'upper')?.mass ?? 0,
    ),
  ).toBeCloseTo(before.surface?.mass ?? 0, 2);
  const resumed = await page.evaluate(() => ({
    count: window.weather.getMetrics().particleCount,
    particles: (Reflect.get(window.weather, 'particles') as { particles: unknown[] }).particles,
    surfaces: window.inspection?.getSurfaces().map((s) => ({
      id: s.id,
      width: s.width,
      binSize: s.binSize,
      velocity: s.velocity,
      acceleration: s.acceleration,
      maxMass: Math.max(...s.profile),
      mass: s.profile.reduce((a, b) => a + b, 0),
    })),
  }));
  expect(resumed.count, JSON.stringify(resumed)).toBe(0);
});

test('tracks open shadow-root surfaces and excludes unregistered closed-root internals', async ({
  page,
}) => {
  await page.evaluate(() => {
    const host = document.querySelector('#shadow-host');
    const root = host?.attachShadow({ mode: 'open' });
    const shelf = document.createElement('div');
    shelf.id = 'open-shadow-shelf';
    shelf.dataset.weatherSurface = '';
    shelf.style.cssText =
      'position:fixed;top:200px;left:30px;width:200px;height:40px;background:#36506e';
    root?.append(shelf);
    const closedHost = document.createElement('div');
    document.body.append(closedHost);
    const closed = closedHost.attachShadow({ mode: 'closed' });
    const hiddenShelf = shelf.cloneNode(true) as HTMLElement;
    hiddenShelf.id = 'closed-shadow-shelf';
    closed.append(hiddenShelf);
    window.weather.updateConfig({ debug: true });
  });
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.captureSurfaces().some((surface) => surface.elementId === 'open-shadow-shelf'),
      ),
    )
    .toBe(true);
  expect(
    await page.evaluate(() =>
      window.captureSurfaces().some((surface) => surface.elementId === 'closed-shadow-shelf'),
    ),
  ).toBe(false);
});

test('native dialog remains focusable, clickable, and dismissible above the overlay', async ({
  page,
}) => {
  await page.evaluate(() => document.querySelector<HTMLDialogElement>('#dialog')?.showModal());
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close dialog' })).toBeFocused();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.evaluate(() => document.querySelector<HTMLDialogElement>('#dialog')?.showModal());
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('treats an iframe as an opaque explicit surface and preserves native frame input', async ({
  page,
}) => {
  await page.evaluate(() => {
    const iframe = document.createElement('iframe');
    iframe.id = 'opaque-frame';
    iframe.dataset.weatherSurface = '';
    iframe.style.cssText =
      'position:fixed;top:180px;right:20px;width:240px;height:120px;background:white;border:0';
    iframe.srcdoc =
      '<!doctype html><html lang="en"><body><details><summary>Open frame content</summary><p data-weather-surface id="frame-internal">Native frame interaction works.</p></details></body></html>';
    document.body.append(iframe);
  });
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.captureSurfaces().some((surface) => surface.elementId === 'opaque-frame'),
      ),
    )
    .toBe(true);
  expect(
    await page.evaluate(() =>
      window.captureSurfaces().some((surface) => surface.elementId === 'frame-internal'),
    ),
  ).toBe(false);
  await page.frameLocator('#opaque-frame').getByText('Open frame content').click();
  await expect(
    page.frameLocator('#opaque-frame').getByText('Native frame interaction works.'),
  ).toBeVisible();
});

test('snow silhouettes remain inside their real overflow clipping region', async ({ page }) => {
  await page.locator('#clip').scrollIntoViewIfNeeded();
  await page.evaluate(() => {
    window.recreateWeather({
      snow: { particleCount: 0, accumulation: { sliding: false } },
      dom: { detection: 'explicit' },
    });
    window.weather.pause();
    window.weather.addSnow(14, '#clipped');
  });
  const pixels = await page.evaluate(() => {
    const clip = document.querySelector('#clip')?.getBoundingClientRect();
    const edge = document.querySelector('#clipped')?.getBoundingClientRect();
    const canvas = document.querySelector<HTMLCanvasElement>('[data-fluri-layer="content"]');
    if (!clip || !edge || !canvas) throw new Error('Clipping scene is incomplete');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D unavailable');
    const dpr = canvas.width / innerWidth;
    const alpha = (x: number, y: number) =>
      context.getImageData(Math.floor(x * dpr), Math.floor(y * dpr), 1, 1).data[3] ?? 0;
    return {
      inside: alpha(clip.right - 25, edge.top - 3),
      outside: alpha(clip.right + 8, edge.top - 3),
    };
  });
  expect(pixels.inside).toBeGreaterThan(0);
  expect(pixels.outside).toBe(0);
});

test('respects reduced motion and resumes only when the system policy allows it', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => page.evaluate(() => window.weather.getMetrics().state)).toBe('paused');
  await page.evaluate(() => window.weather.stop());
  await page.evaluate(() => window.weather.start());
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => window.weather.getMetrics().particleCount)).toBe(0);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect
    .poll(() => page.evaluate(() => window.weather.getMetrics().particleCount))
    .toBeGreaterThan(0);
  await page.evaluate(() => window.weather.updateConfig({ accessibility: { controls: true } }));
  await page.getByRole('button', { name: 'Pause snow' }).click();
  await expect.poll(() => page.evaluate(() => window.weather.getMetrics().state)).toBe('paused');
  await page.getByRole('button', { name: 'Resume snow' }).click();
  await expect.poll(() => page.evaluate(() => window.weather.getMetrics().state)).toBe('running');
});

test('isolates a failed plugin and still cleans its resources', async ({ page }) => {
  const result = await page.evaluate(async () => {
    let cleanup = 0;
    let destroy = 0;
    window.weather.use({
      name: 'failure-probe',
      setup() {
        return () => {
          cleanup++;
        };
      },
      update() {
        throw new Error('Expected plugin failure probe');
      },
      destroy() {
        destroy++;
      },
    });
    await new Promise<void>((resolve) => {
      const off = window.weather.on('error', () => {
        off();
        resolve();
      });
    });
    return {
      cleanup,
      destroy,
      errors: window.eventLog.filter((event) => event.name === 'error').length,
      state: window.weather.getMetrics().state,
    };
  });
  expect(result).toEqual({ cleanup: 1, destroy: 1, errors: 1, state: 'running' });
  await expect(page.locator('[data-fluri-root="effects"]')).toHaveCount(1);
});

test('render, trigger, setup, and teardown plugin failures remain isolated', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  const result = await page.evaluate(() => {
    let rendersCleaned = 0;
    let triggersCleaned = 0;
    let trailingDestroyed = 0;
    window.weather.use({
      name: 'render-failure',
      setup() {
        return () => {
          rendersCleaned++;
        };
      },
      render() {
        throw new Error('Expected render failure');
      },
    });
    window.weather.addSnow(1);
    window.weather.use({
      name: 'trigger-failure',
      setup() {
        return () => {
          triggersCleaned++;
        };
      },
      trigger() {
        throw new Error('Expected trigger failure');
      },
    });
    window.weather.trigger('gust');
    window.weather.use({
      name: 'setup-failure',
      setup() {
        throw new Error('Expected setup failure');
      },
    });
    const dispose = window.weather.use({
      name: 'teardown-failure',
      setup() {
        return () => {
          throw new Error('Expected cleanup failure');
        };
      },
      destroy() {
        throw new Error('Expected destroy failure');
      },
    });
    dispose();
    window.weather.use({
      name: 'destroy-failure',
      destroy() {
        throw new Error('Expected lifecycle destroy failure');
      },
    });
    window.weather.use({
      name: 'after-failure',
      destroy() {
        trailingDestroyed++;
      },
    });
    const stateBefore = window.weather.getMetrics().state;
    window.weather.destroy();
    return {
      rendersCleaned,
      triggersCleaned,
      trailingDestroyed,
      stateBefore,
      stateAfter: window.weather.getMetrics().state,
      errors: window.eventLog.filter((event) => event.name === 'error').length,
      resources: window.resourceAudit.snapshot(),
      baseline: window.baselineResources,
    };
  });
  expect(result.rendersCleaned).toBe(1);
  expect(result.triggersCleaned).toBe(1);
  expect(result.trailingDestroyed).toBe(1);
  expect(result.stateBefore).toBe('running');
  expect(result.stateAfter).toBe('destroyed');
  expect(result.errors).toBeGreaterThanOrEqual(6);
  expect(result.resources).toEqual(result.baseline);
  expect(pageErrors).toEqual([]);
});

test('stopped effects remain clear through resize and configuration changes', async ({ page }) => {
  await page.evaluate(() => {
    window.weather.use(
      window.fluriExports.christmasPack({ lights: { enabled: true, twinkle: false }, gifts: true }),
    );
    window.weather.addSnow(12);
    window.weather.stop();
    window.weather.updateConfig({ snow: { color: '#ffffff' } });
  });
  await page.setViewportSize({ width: 780, height: 700 });
  const alpha = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLCanvasElement>('[data-fluri-layer]')].reduce(
      (sum, canvas) => {
        const pixels = canvas
          .getContext('2d')
          ?.getImageData(0, 0, canvas.width, canvas.height).data;
        if (pixels)
          for (let index = 3; index < pixels.length; index += 4) sum += pixels[index] ?? 0;
        return sum;
      },
      0,
    ),
  );
  expect(alpha).toBe(0);
  expect(await page.evaluate(() => window.weather.getMetrics().state)).toBe('stopped');
});

test('brushes deposited mass using genuine pointer movement', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Hover brushing is intentionally disabled for touch pointers.');
  await page.evaluate(() => {
    window.weather.updateConfig({
      snow: { particleCount: 0 },
      interactions: { brush: { strength: 2, radius: 45 } },
    });
    window.weather.addSnow(18, '#upper');
  });
  const card = await page.locator('#upper').boundingBox();
  expect(card).not.toBeNull();
  if (!card) throw new Error('Upper shelf is not measurable');
  const before = await page.evaluate(
    () => window.captureSurfaces().find((surface) => surface.elementId === 'upper')?.mass ?? 0,
  );
  await page.mouse.move(card.x + 4, card.y - 4);
  await page.mouse.move(card.x + card.width - 4, card.y - 4, { steps: 18 });
  await expect
    .poll(() => page.evaluate(() => window.eventLog.some((event) => event.name === 'snow:brush')))
    .toBe(true);
  const after = await page.evaluate(
    () => window.captureSurfaces().find((surface) => surface.elementId === 'upper')?.mass ?? 0,
  );
  expect(after).toBeLessThan(before);
});

test('an intentional Shift drag gathers and throws snow without taking page input', async ({
  page,
  isMobile,
}) => {
  test.skip(
    isMobile,
    'This gesture uses a physical keyboard modifier and mouse; touch uses explicit controls.',
  );
  await page.evaluate(() => {
    window.weather.updateConfig({
      snow: { particleCount: 0 },
      interactions: { brush: { enabled: false } },
    });
    window.weather.addSnow(18, '#upper');
  });
  const upper = await page.locator('#upper').boundingBox();
  if (!upper) throw new Error('Upper shelf is missing');
  await page.keyboard.down('Shift');
  await page.mouse.move(upper.x + 35, upper.y - 8);
  await page.mouse.down();
  await page.mouse.move(upper.x + Math.min(upper.width - 25, 150), upper.y - 12, { steps: 14 });
  await page.mouse.up();
  await page.keyboard.up('Shift');
  expect(
    await page.evaluate(() => window.eventLog.some((event) => event.name === 'snowball:created')),
  ).toBe(true);
  expect(
    await page.evaluate(() => window.eventLog.some((event) => event.name === 'snowball:thrown')),
  ).toBe(true);
  await page.getByRole('button', { name: 'Click me' }).click();
  await expect(page.locator('#click-count')).toHaveText('1');
});

test('pointer release on ignored controls or beyond a scoped scene releases the snowball', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'This regression exercises a physical mouse drag with a keyboard modifier.');
  await page.evaluate(() => {
    window.weather.updateConfig({
      snow: { particleCount: 0 },
      interactions: { brush: { enabled: false } },
    });
    window.weather.addSnow(18, '#upper');
    document.querySelector('#sticky')?.setAttribute('data-weather-ignore', '');
  });
  let upper = await page.locator('#upper').boundingBox();
  if (!upper) throw new Error('Upper shelf is missing');
  await page.keyboard.down('Shift');
  await page.mouse.move(upper.x + 45, upper.y - 6);
  await page.mouse.down();
  await page.mouse.move(40, 42);
  await page.mouse.up();
  await page.keyboard.up('Shift');
  expect(
    await page.evaluate(() => window.eventLog.some((event) => event.name === 'snowball:thrown')),
  ).toBe(true);
  await page.evaluate(() => {
    const main = document.querySelector('main');
    if (!main) throw new Error('Main scene is missing');
    window.recreateWeather({
      container: main,
      snow: { particleCount: 0, accumulation: { sliding: false } },
      dom: { detection: 'explicit' },
      interactions: { snowballs: { enabled: true }, brush: { enabled: false } },
    });
    window.weather.addSnow(18, '#upper');
  });
  upper = await page.locator('#upper').boundingBox();
  if (!upper) throw new Error('Upper shelf is missing');
  await page.keyboard.down('Shift');
  await page.mouse.move(upper.x + 45, upper.y - 6);
  await page.mouse.down();
  await page.mouse.move(2, 2);
  await page.mouse.up();
  await page.keyboard.up('Shift');
  expect(
    await page.evaluate(() => window.eventLog.some((event) => event.name === 'snowball:thrown')),
  ).toBe(true);
  await page.getByRole('button', { name: 'Click me' }).click();
  await expect(page.locator('#click-count')).toHaveText('1');
});

test('creates physical snowballs and a snowman, and ploughs an explicit route', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.clock.install({ time: new Date('2026-11-14T08:00:00Z') });
  await page.clock.pauseAt(new Date('2026-11-14T10:00:00Z'));
  await page.locator('#lower').scrollIntoViewIfNeeded();
  await page.evaluate(() => {
    window.weather.updateConfig({
      snow: { enabled: false, particleCount: 0 },
      performance: { maxFPS: 20, maxDPR: 1, adaptive: false },
      interactions: { brush: { enabled: false } },
    });
    // Reset timestamps and clear ambient particles before replaying fixed-step actor physics.
    window.weather.stop();
    window.weather.start();
    window.weather.addSnow(18, '#lower');
    window.weather.trigger('snowball', { selector: '#lower', radius: 12 });
  });
  await expect.poll(() => page.evaluate(() => window.weather.getMetrics().snowballCount)).toBe(1);
  await page.evaluate(() => window.weather.trigger('snowman', { selector: '#lower', radius: 20 }));
  await expect.poll(() => page.evaluate(() => window.weather.getMetrics().snowmanCount)).toBe(1);
  await page.evaluate(() => {
    window.weather.addSnow(18, '#lower');
    window.weather.trigger('plough', { selector: '#lower', direction: 'right' });
  });
  await expect
    .poll(() => page.evaluate(() => window.eventLog.some((event) => event.name === 'plough:start')))
    .toBe(true);
  const massBefore = await page.evaluate(
    () => window.captureSurfaces().find((surface) => surface.elementId === 'lower')?.mass ?? 0,
  );
  await page.clock.runFor(5_000);
  await expect
    .poll(
      () => page.evaluate(() => window.eventLog.some((event) => event.name === 'plough:complete')),
      { timeout: 12_000 },
    )
    .toBe(true);
  const massAfter = await page.evaluate(
    () => window.captureSurfaces().find((surface) => surface.elementId === 'lower')?.mass ?? 0,
  );
  expect(massAfter).toBeLessThan(massBefore * 0.5);
});

test('captures original festive assets and clipped snowy geometry with a frozen seeded scene', async ({
  page,
}, testInfo) => {
  await page.evaluate(() => {
    scrollTo(0, 0);
    window.recreateWeather({
      seed: 731,
      snow: {
        particleCount: 0,
        intensity: 0,
        accumulation: { sliding: false, softness: 0, maxDepth: 28 },
      },
      dom: { detection: 'explicit' },
      interactions: { snowballs: { enabled: true }, snowman: { enabled: true } },
    });
    window.weather.pause();
    window.weather.use(
      window.fluriExports.christmasPack({
        lights: { enabled: true, twinkle: false },
        garlands: true,
        gifts: true,
        ornaments: true,
        icicles: true,
        frost: true,
      }),
    );
    window.weather.addSnow(14);
  });
  expect(
    await page.evaluate(
      () => window.captureSurfaces().find((surface) => surface.elementId === 'clipped')?.clips,
    ),
  ).toBeGreaterThan(0);
  const surface = await page.evaluate(() =>
    window.captureSurfaces().find((surface) => surface.elementId === 'upper'),
  );
  expect(surface?.mass).toBeGreaterThan(0);
  const canvasPixels = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('[data-fluri-layer="content"]');
    const pixels = canvas?.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height).data;
    if (!pixels) return 0;
    let opaque = 0;
    for (let index = 3; index < pixels.length; index += 4) if ((pixels[index] ?? 0) > 0) opaque++;
    return opaque;
  });
  expect(canvasPixels).toBeGreaterThan(500);
  const path = testInfo.outputPath('fluri-festive-geometry.png');
  await page.screenshot({ path, fullPage: false, animations: 'disabled' });
  await testInfo.attach('Frozen festive geometry', { path, contentType: 'image/png' });
});

test('the default engine makes no external network requests', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) external.push(url.href);
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => window.weather.getMetrics().particleCount))
    .toBeGreaterThan(10);
  await page.evaluate(() => {
    window.weather.trigger('snowburst');
    window.weather.use(window.fluriExports.christmasPack());
    window.weather.addSnow(8);
  });
  await page.waitForTimeout(250);
  expect(external).toEqual([]);
});

test('custom PNG textures render real pixels and decode failures preserve snowfall', async ({
  page,
}) => {
  await page.evaluate(() => {
    window.eventLog.length = 0;
    window.weather.updateConfig({
      snow: {
        texture: 'data:image/png;base64,AAAA',
        minSize: 6,
        maxSize: 8,
        glow: false,
        parallax: false,
      },
    });
  });
  await expect
    .poll(() =>
      page.evaluate(() => window.eventLog.filter((event) => event.name === 'error').length),
    )
    .toBeGreaterThan(0);
  await expect
    .poll(() => page.evaluate(() => window.weather.getMetrics().particleCount))
    .toBeGreaterThan(0);
  expect(await page.evaluate(() => window.weather.getMetrics().state)).toBe('running');
  await page.evaluate(() => {
    const asset = document.createElement('canvas');
    asset.width = 4;
    asset.height = 4;
    const context = asset.getContext('2d');
    if (!context) throw new Error('Canvas 2D unavailable');
    context.fillStyle = '#00ffff';
    context.fillRect(0, 0, 4, 4);
    window.eventLog.length = 0;
    window.weather.updateConfig({ snow: { texture: asset.toDataURL('image/png') } });
  });
  await expect
    .poll(() =>
      page.evaluate(() => {
        let cyan = 0;
        for (const canvas of document.querySelectorAll<HTMLCanvasElement>('[data-fluri-layer]')) {
          const pixels = canvas
            .getContext('2d')
            ?.getImageData(0, 0, canvas.width, canvas.height).data;
          if (!pixels) continue;
          for (let index = 0; index < pixels.length; index += 4)
            if (
              (pixels[index] ?? 255) < 20 &&
              (pixels[index + 1] ?? 0) > 230 &&
              (pixels[index + 2] ?? 0) > 230 &&
              (pixels[index + 3] ?? 0) > 10
            )
              cyan++;
        }
        return cyan;
      }),
    )
    .toBeGreaterThan(5);
  expect(
    await page.evaluate(() => window.eventLog.filter((event) => event.name === 'error').length),
  ).toBe(0);
});
