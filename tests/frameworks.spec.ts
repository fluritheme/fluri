import { expect, test } from '@playwright/test';

test('Next.js server rendering, hydration, runtime updates, and client navigation work together', async ({
  page,
  request,
}) => {
  const server = await request.get('http://127.0.0.1:5202');
  expect(server.status()).toBe(200);
  const serverHtml = await server.text();
  expect(serverHtml).toContain('Winter, after hydration.');
  expect(serverHtml).not.toMatch(/<(?:div|canvas)[^>]+data-fluri-/);
  const hydrationErrors: string[] = [];
  page.on('console', (message) => {
    if (
      message.type() === 'error' &&
      /hydration|did not match|server rendered/i.test(message.text())
    )
      hydrationErrors.push(message.text());
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://127.0.0.1:5202');
  await expect(page.getByRole('heading', { name: 'Winter, after hydration.' })).toBeVisible();
  await expect(page.locator('[data-fluri-root="effects"]')).toHaveCount(1);
  await expect(page.locator('#state-weather')).toHaveText('running');
  await page.locator('#pause-weather').click();
  await expect(page.locator('#state-weather')).toHaveText('paused');
  const intensity = page.locator('#intensity-weather');
  await intensity.focus();
  await intensity.press('Home');
  await intensity.press('ArrowRight');
  await expect(intensity).toHaveValue('0.01');
  await expect(page.locator('#value-weather')).toHaveText('0.01');
  await page.locator('#pause-weather').click();
  await expect(page.locator('#state-weather')).toHaveText('running');
  await page.locator('#leave-weather').click();
  await expect(page).toHaveURL('http://127.0.0.1:5202/about');
  await expect(page.locator('[data-fluri-root="effects"]')).toHaveCount(0);
  await page.locator('#return-weather').click();
  await expect(page.locator('[data-fluri-root="effects"]')).toHaveCount(1);
  await expect(page.locator('#state-weather')).toHaveText('running');
  await page.reload();
  await expect(page.locator('[data-fluri-root="effects"]')).toHaveCount(1);
  await expect(page.locator('#state-weather')).toHaveText('running');
  expect(errors).toEqual([]);
  expect(hydrationErrors).toEqual([]);
});

test('Vue updates weather reactively and cleans all overlays on unmount', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://127.0.0.1:5203');
  await expect(page.locator('[data-fluri-root="effects"]')).toHaveCount(1);
  await expect(page.locator('#state-weather')).toHaveText('running');
  const intensity = page.locator('#intensity-weather');
  await intensity.focus();
  await intensity.press('Home');
  await intensity.press('ArrowRight');
  await expect(intensity).toHaveValue('0.01');
  await expect(page.locator('#value-weather')).toHaveText('0.01');
  await page.locator('#pause-weather').click();
  await expect(page.locator('#state-weather')).toHaveText('paused');
  await page.locator('#pause-weather').click();
  await expect(page.locator('#state-weather')).toHaveText('running');
  await page.locator('#toggle-weather').click();
  await expect(page.locator('[data-fluri-root="effects"]')).toHaveCount(0);
  await page.locator('#toggle-weather').click();
  await expect(page.locator('[data-fluri-root="effects"]')).toHaveCount(1);
  await expect(page.locator('#state-weather')).toHaveText('running');
  await page.locator('#toggle-weather').click();
  await expect(page.locator('[data-fluri-root="effects"]')).toHaveCount(0);
  expect(errors).toEqual([]);
});
