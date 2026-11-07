import { expect, test, type Page } from '@playwright/test';
import type {} from './fixtures/main.js';

async function prepare(page: Page): Promise<void> {
  await page.goto('/tests/fixtures/index.html');
  await expect
    .poll(() => page.evaluate(() => window.weather?.getMetrics().surfaceCount ?? 0))
    .toBeGreaterThan(3);
  await page.evaluate(() => {
    window.weather.updateConfig({
      snow: { particleCount: 0, accumulation: { meltRate: 0, sliding: false } },
      interactions: { brush: { enabled: false }, snowballs: { enabled: true } },
    });
    window.weather.stop();
    window.weather.start();
    const upper = document.querySelector<HTMLElement>('#upper');
    if (!upper) throw new Error('Missing snowy card');
    upper.innerHTML =
      '<strong id="snowy-text">Gather the snow across this line of text.</strong><p>Ordinary page content stays selectable.</p><button id="native-on-snow">Native button</button>';
    upper.style.padding = '8px 12px 25px';
    document.querySelector('#native-on-snow')?.addEventListener('click', () => {
      document.documentElement.dataset.nativeClicks = String(
        Number(document.documentElement.dataset.nativeClicks ?? 0) + 1,
      );
    });
    const paragraph = document.createElement('p');
    paragraph.id = 'ordinary-selection';
    paragraph.style.cssText =
      'position:fixed;left:24px;top:130px;margin:0;z-index:10;font-size:18px;color:white;background:#172c3d;padding:5px;';
    paragraph.textContent = 'Ordinary selection is still native.';
    document.body.append(paragraph);
    document.addEventListener('pointerdown', (event) => {
      document.documentElement.dataset.gatherPointerId = String(event.pointerId);
    });
    window.getSelection()?.removeAllRanges();
    window.weather.addSnow(12, '#upper');
  });
}

async function beginSnowDrag(page: Page): Promise<void> {
  const card = await page.locator('#upper').boundingBox();
  if (!card) throw new Error('Missing snowy card bounds');
  await page.keyboard.down('Shift');
  await page.mouse.move(card.x + 30, card.y + 11);
  await page.mouse.down();
}

test('an accepted Shift snow drag suppresses browser text selection and keeps native controls clickable', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'This modifier gesture uses a physical mouse and keyboard.');
  await prepare(page);
  await beginSnowDrag(page);
  const card = await page.locator('#upper').boundingBox();
  if (!card) throw new Error('Missing snowy card bounds');
  await page.mouse.move(card.x + 190, card.y + 14, { steps: 16 });
  await page.mouse.up();
  await page.keyboard.up('Shift');
  expect(
    await page.evaluate(() => window.eventLog.some((event) => event.name === 'snowball:created')),
  ).toBe(true);
  expect(
    await page.evaluate(() => window.eventLog.some((event) => event.name === 'snowball:thrown')),
  ).toBe(true);
  expect(await page.evaluate(() => window.getSelection()?.toString())).toBe('');
  expect(await page.evaluate(() => document.documentElement.style.userSelect)).toBe('');
  await page.locator('#native-on-snow').click({ modifiers: ['Shift'] });
  expect(await page.locator('html').getAttribute('data-native-clicks')).toBe('1');
});

test('ordinary and Shift selection away from snow remains native', async ({ page, isMobile }) => {
  test.skip(isMobile, 'This selection regression uses a mouse and physical modifier.');
  await prepare(page);
  const text = await page.locator('#ordinary-selection').boundingBox();
  if (!text) throw new Error('Missing ordinary selection text');
  await page.mouse.move(text.x + 8, text.y + 15);
  await page.mouse.down();
  await page.mouse.move(text.x + 180, text.y + 15, { steps: 12 });
  await page.mouse.up();
  expect(
    (await page.evaluate(() => window.getSelection()?.toString() ?? '')).length,
  ).toBeGreaterThan(4);
  await page.evaluate(() => window.getSelection()?.removeAllRanges());
  await page.mouse.click(text.x + 8, text.y + 15);
  await page.keyboard.down('Shift');
  await page.mouse.move(text.x + 25, text.y + 15);
  await page.mouse.down();
  await page.mouse.move(text.x + 200, text.y + 15, { steps: 12 });
  await page.mouse.up();
  await page.keyboard.up('Shift');
  expect(
    (await page.evaluate(() => window.getSelection()?.toString() ?? '')).length,
  ).toBeGreaterThan(4);
  expect(
    await page.evaluate(() => window.eventLog.some((event) => event.name === 'snowball:created')),
  ).toBe(false);
});

test('releasing Shift or losing focus ends selection ownership without leaving page styles behind', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'This cancellation regression uses a physical keyboard modifier.');
  await prepare(page);
  for (const ending of ['shift', 'blur', 'cancel', 'destroy'] as const) {
    await page.evaluate(() => {
      window.weather.stop();
      window.weather.start();
      window.weather.addSnow(12, '#upper');
      window.eventLog.length = 0;
    });
    await beginSnowDrag(page);
    expect(
      await page.evaluate(
        () =>
          !document.dispatchEvent(new Event('selectstart', { bubbles: true, cancelable: true })),
      ),
    ).toBe(true);
    if (ending === 'shift') await page.keyboard.up('Shift');
    else if (ending === 'blur') await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    else if (ending === 'cancel')
      await page.evaluate(() =>
        document.dispatchEvent(
          new PointerEvent('pointercancel', {
            pointerId: Number(document.documentElement.dataset.gatherPointerId),
            bubbles: true,
          }),
        ),
      );
    else await page.evaluate(() => window.weather.destroy());
    expect(
      await page.evaluate(() =>
        document.dispatchEvent(new Event('selectstart', { bubbles: true, cancelable: true })),
      ),
    ).toBe(true);
    expect(await page.evaluate(() => document.documentElement.style.userSelect)).toBe('');
    await page.mouse.up();
    await page.keyboard.up('Shift');
    if (ending !== 'destroy')
      expect(
        await page.evaluate(() =>
          window.eventLog.some((event) => event.name === 'snowball:thrown'),
        ),
      ).toBe(true);
  }
});
