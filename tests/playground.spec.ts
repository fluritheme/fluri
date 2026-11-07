import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import type {} from './fixtures/main.js';

const playground = 'http://127.0.0.1:5173';

test('playground controls operate the real engine and download a validated configuration', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(playground);
  await expect(page.getByRole('heading', { name: 'Winter lab.', exact: true })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.__fluri?.getMetrics().surfaceCount ?? 0))
    .toBe(3);
  // Confirm the default scoped emitter produces visible pixels without addSnow(), bursts, or injected particles.
  await page.waitForTimeout(3000);
  const naturalPixels = await page.evaluate(() => {
    const scene = document.querySelector('#scene')?.getBoundingClientRect();
    if (!scene) throw new Error('Missing live scene');
    let count = 0;
    for (const canvas of document.querySelectorAll<HTMLCanvasElement>('[data-fluri-layer]')) {
      const bounds = canvas.getBoundingClientRect();
      const scaleX = canvas.width / bounds.width;
      const scaleY = canvas.height / bounds.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Missing effect canvas');
      const x = Math.max(0, Math.ceil((scene.left - bounds.left) * scaleX));
      const y = Math.max(0, Math.ceil((scene.top - bounds.top) * scaleY));
      const width = Math.min(canvas.width, Math.floor((scene.right - bounds.left) * scaleX)) - x;
      const height = Math.min(canvas.height, Math.floor((scene.bottom - bounds.top) * scaleY)) - y;
      if (width <= 0 || height <= 0) continue;
      const pixels = ctx.getImageData(x, y, width, height).data;
      for (let index = 3; index < pixels.length; index += 4) if ((pixels[index] ?? 0) > 30) count++;
    }
    return count;
  });
  expect(
    naturalPixels,
    'Visible default snowfall must enter the clipped scene without a manual source',
  ).toBeGreaterThan(25);
  const naturalPath = testInfo.outputPath('fluri-natural-default.png');
  await page.screenshot({ path: naturalPath, fullPage: false, animations: 'disabled' });
  await testInfo.attach('Default scoped snowfall after three seconds without manual snow', {
    path: naturalPath,
    contentType: 'image/png',
  });
  await page.getByRole('button', { name: 'Pause weather' }).click();
  await expect.poll(() => page.evaluate(() => window.__fluri.getMetrics().state)).toBe('paused');
  await page.getByRole('button', { name: 'Resume weather' }).click();
  await expect.poll(() => page.evaluate(() => window.__fluri.getMetrics().state)).toBe('running');
  await page.locator('#add-snow').click();
  expect(await page.evaluate(() => window.__fluri.getMetrics().snowMass)).toBeGreaterThan(0);
  if (await page.locator('#toggle-sidebar').isVisible())
    await page.locator('#toggle-sidebar').click();
  await page.getByRole('tab', { name: 'Weather', exact: true }).click();
  await page.getByLabel('Weather preset').selectOption('minimal');
  expect(await page.evaluate(() => window.__fluri.getConfig().preset)).toBe('minimal');
  await page.getByRole('tab', { name: 'Presets', exact: true }).click();
  const editor = page.getByRole('textbox', { name: 'JSON configuration' });
  const exported = JSON.parse(await editor.inputValue()) as {
    preset: string;
    snow: { intensity: number };
  };
  expect(exported.preset).toBe('minimal');
  expect(exported.snow.intensity).toBe(0.2);
  await editor.fill('{"snow":{"intensity":0.37}}');
  await page.getByRole('button', { name: 'Apply JSON', exact: true }).click();
  expect(await page.evaluate(() => window.__fluri.getConfig().snow.intensity)).toBe(0.37);
  await editor.fill('{"snow":{"intensity":7}}');
  await page.getByRole('button', { name: 'Apply JSON', exact: true }).click();
  await expect(page.locator('#config-error')).not.toBeEmpty();
  expect(await page.evaluate(() => window.__fluri.getConfig().snow.intensity)).toBe(0.37);
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download JSON', exact: true }).click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toBe('fluri.config.json');
  const downloadedPath = await download.path();
  if (!downloadedPath) throw new Error('The browser did not produce an exported file');
  const file = JSON.parse(await readFile(downloadedPath, 'utf8')) as {
    snow: { intensity: number };
    container?: unknown;
  };
  expect(file.snow.intensity).toBe(0.37);
  expect(file.container).toBeUndefined();
  if (await page.locator('#settings-dialog').isVisible())
    await page.locator('#close-sidebar').click();
  await page.locator('#reset').click();
  await page.evaluate(() => {
    window.__fluri.pause();
    window.__fluri.addSnow(3);
  });
  await page.evaluate(() => scrollTo(0, 0));
  const path = testInfo.outputPath('fluri-playground.png');
  await page.screenshot({ path, fullPage: false, animations: 'disabled' });
  await testInfo.attach('Responsive workshop with configured snow', {
    path,
    contentType: 'image/png',
  });
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(
    false,
  );
});

test('mobile workshop has real tap targets, modal settings focus, and usable navigation', async ({
  page,
  isMobile,
  browserName,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(playground);
  await expect
    .poll(() => page.evaluate(() => window.__fluri?.getMetrics().surfaceCount ?? 0))
    .toBe(3);
  const targetSizes = await page.evaluate(() =>
    [
      'export-top',
      'toggle-sidebar',
      'pause',
      'reset',
      'add-snow',
      'dock-ball',
      'dock-plough',
      'shake-surface',
      'dock-clear',
      'festive-toggle',
      'drag-handle',
    ].map((id) => {
      const element = document.getElementById(id);
      if (!element) throw new Error(`Missing primary action ${id}`);
      const rect = element.getBoundingClientRect();
      return { id, width: rect.width, height: rect.height };
    }),
  );
  for (const target of targetSizes) {
    expect(target.width, `${target.id} touch width`).toBeGreaterThanOrEqual(44);
    expect(target.height, `${target.id} touch height`).toBeGreaterThanOrEqual(44);
  }
  if (isMobile && browserName === 'chromium') {
    const session = await page.context().newCDPSession(page);
    const nativeSwipe = async (x: number, y: number, dx: number, dy: number): Promise<void> => {
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x, y, id: 0 }],
      });
      for (let step = 1; step <= 8; step++) {
        await session.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ x: x + (dx * step) / 8, y: y + (dy * step) / 8, id: 0 }],
        });
        await page.waitForTimeout(16);
      }
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    const text = await page.locator('#moving-card p').boundingBox();
    if (!text) throw new Error('Mobile card text is missing');
    const scrollBefore = await page.evaluate(() => scrollY);
    await nativeSwipe(text.x + text.width / 2, text.y + Math.min(20, text.height / 2), 0, -130);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(scrollBefore + 30);
    await page.locator('#drag-handle').scrollIntoViewIfNeeded();
    const handle = await page.locator('#drag-handle').boundingBox();
    if (!handle) throw new Error('Mobile drag handle is missing');
    await nativeSwipe(handle.x + handle.width / 2, handle.y + handle.height / 2, 28, 24);
    await expect
      .poll(() =>
        page.locator('#moving-card').evaluate((element) => getComputedStyle(element).transform),
      )
      .not.toBe('none');
    await page.locator('#drag-handle').focus();
    await page.locator('#drag-handle').press('Home');
    await session.detach();
  }
  const open = page.getByRole('button', { name: 'Open configuration' });
  await open.focus();
  await open.press('Enter');
  const sheet = page.getByRole('dialog', { name: 'Weather settings' });
  await expect(sheet).toBeVisible();
  expect(await sheet.evaluate((element) => element.matches(':modal'))).toBe(true);
  await expect(page.getByRole('button', { name: 'Close configuration' })).toBeFocused();
  const lastControl = sheet
    .locator(
      'button:visible:not([tabindex="-1"]), input:visible, select:visible, textarea:visible, a[href]:visible',
    )
    .last();
  await lastControl.focus();
  await page.keyboard.press('Tab');
  // Native modal tab navigation can briefly focus browser chrome (body is the DOM sentinel).
  // It must never let a background application control take focus.
  expect(
    await sheet.evaluate(
      (element) =>
        element.contains(document.activeElement) || document.activeElement === document.body,
    ),
  ).toBe(true);
  await page.locator('#pause').evaluate((element) => (element as HTMLElement).focus());
  await expect(page.locator('#pause')).not.toBeFocused();
  await page.keyboard.press('Tab');
  expect(await sheet.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(sheet).not.toBeVisible();
  await expect(open).toBeFocused();
  await page.locator('#export-top').focus();
  await page.locator('#export-top').press('Enter');
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('tab', { name: 'Presets', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.getByRole('button', { name: 'Close configuration' }).click();
  await expect(page.locator('#export-top')).toBeFocused();
  await page.locator('#scene-guide').focus();
  await page.locator('#scene-guide').press('Enter');
  const guide = page.locator('#info-dialog');
  await expect(guide).toBeVisible();
  expect(await guide.evaluate((element) => element.matches(':modal'))).toBe(true);
  await page.locator('#dialog-close').click();
  await expect(guide).not.toBeVisible();
  await expect(page.locator('#scene-guide')).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(
    false,
  );
});

test('snow stays off workshop controls while real flakes and bursts run inside the scene', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(playground);
  await expect
    .poll(() => page.evaluate(() => window.__fluri?.getMetrics().particleCount ?? 0))
    .toBeGreaterThan(10);
  await page.locator('#drag-handle').scrollIntoViewIfNeeded();
  const results = await page.evaluate(async () => {
    const ids = ['drag-handle', 'pause', 'reset', 'export-top'];
    const rectangles = ids
      .map((id) => {
        const element = document.getElementById(id);
        if (!element) throw new Error(`Missing control ${id}`);
        return { id, rect: element.getBoundingClientRect() };
      })
      .filter((item) => item.rect.top >= 0 && item.rect.bottom <= innerHeight);
    for (const { rect } of rectangles)
      window.__fluri.trigger('snowburst', {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        radius: 1,
      });
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    return rectangles.map(({ id, rect }) => {
      let alpha = 0;
      for (const canvas of document.querySelectorAll<HTMLCanvasElement>('[data-fluri-layer]')) {
        const bounds = canvas.getBoundingClientRect();
        const scaleX = canvas.width / bounds.width;
        const scaleY = canvas.height / bounds.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Missing effect canvas');
        const pixels = ctx.getImageData(
          Math.floor((rect.left + 3 - bounds.left) * scaleX),
          Math.floor((rect.top + 3 - bounds.top) * scaleY),
          Math.floor((rect.width - 6) * scaleX),
          Math.floor((rect.height - 6) * scaleY),
        ).data;
        for (let index = 3; index < pixels.length; index += 4) alpha += pixels[index] ?? 0;
      }
      return { id, alpha };
    });
  });
  expect(results.some((result) => result.id === 'drag-handle')).toBe(true);
  for (const result of results) expect(result.alpha, `Effect pixels cover ${result.id}`).toBe(0);
  await page.locator('#pause').click();
  expect(await page.evaluate(() => window.__fluri.getMetrics().state)).toBe('paused');
});
