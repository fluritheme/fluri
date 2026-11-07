import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const source = new URL('../assets/readme/banner.svg', import.meta.url);
let svg = (await readFile(source, 'utf8')).trimEnd();
svg = svg
  .replace('height="500" viewBox="0 0 1280 500"', 'height="640" viewBox="0 0 1280 640"')
  .replace('<rect width="1280" height="500" rx="24"/>', '<rect width="1280" height="640"/>')
  .replace('x2="1280" y2="500"', 'x2="1280" y2="640"')
  .replace('M0 0h1280v500H0Z', 'M0 0h1280v640H0Z')
  .replace('<rect x=".5" y=".5" width="1279" height="499" rx="23.5" stroke="#d4e3e9"/>', '');
const footer = `<path d="M60 532H1220" stroke="#bfd3dc"/><rect x="60" y="560" width="400" height="44" rx="10" fill="#f6fafb" stroke="#bfd3dc"/><text x="82" y="588" fill="#276471" font-family="ui-monospace,Menlo,Consolas,monospace" font-size="18">npm install @fluritheme/fluri</text><text x="1220" y="590" text-anchor="end" fill="#426d7d" font-family="system-ui,-apple-system,sans-serif" font-size="23" font-weight="600" letter-spacing="-.5">fluri.xyz ↗</text>`;
svg = svg.slice(0, -6) + footer + '</svg>';
await writeFile(new URL('../assets/brand/github-social-preview.svg', import.meta.url), svg);
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 640 },
    deviceScaleFactor: 1,
  });
  await page.setContent(
    `<style>html,body{margin:0;width:1280px;height:640px;overflow:hidden}svg{display:block}</style>${svg}`,
  );
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: new URL('../assets/brand/github-social-preview.png', import.meta.url).pathname,
  });
} finally {
  await browser.close();
}
console.log('Rendered GitHub social preview: 1280 × 640 PNG.');
