import { writeFile, mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';
const root = new URL('../', import.meta.url);
function art(width, height) {
  const scale = width / 1280;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 1280 ${height / scale}"><rect width="1280" height="${height / scale}" fill="#4935f5"/><g fill="#fff" font-family="Arial,Helvetica,sans-serif"><text x="58" y="61" font-size="12" letter-spacing="1">WINTER / BY FLURI THEMES</text><text x="1220" y="61" text-anchor="end" font-size="12" letter-spacing="1">CHANGE THE FORECAST.</text><path d="M58 89H1220" stroke="#fff" opacity=".35"/><text x="50" y="335" font-size="265" font-weight="700" letter-spacing="-21">winter.</text><text x="62" y="404" font-size="26" font-weight="500">Real snow. Real surfaces. A little winter for your website.</text>${height / scale > 550 ? '<path d="M58 484H1220" stroke="#fff" opacity=".35"/><text x="62" y="552" font-family="monospace" font-size="20">npm i @fluritheme/fluri</text><text x="1220" y="552" text-anchor="end" font-size="24">winter.fluri.xyz ↗</text>' : '<text x="1220" y="462" text-anchor="end" font-size="18">winter.fluri.xyz ↗</text>'}</g><g fill="#fff" opacity=".65"><circle cx="946" cy="150" r="4"/><circle cx="1100" cy="221" r="6"/><circle cx="854" cy="389" r="3"/><circle cx="1170" cy="405" r="3"/><circle cx="760" cy="117" r="2"/><circle cx="998" cy="348" r="2"/></g></svg>`;
}
const browser = await chromium.launch();
try {
  for (const [name, w, h] of [
    ['assets/readme/banner', 1280, 500],
    ['assets/brand/github-social-preview', 1280, 640],
    ['apps/website/public/art/social-card', 1200, 630],
  ]) {
    await mkdir(new URL(name.slice(0, name.lastIndexOf('/')) + '/', root), { recursive: true });
    const svg = art(w, h);
    await writeFile(new URL(name + '.svg', root), svg);
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    await page.setContent(
      `<style>html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden}svg{display:block}</style>${svg}`,
    );
    await page.screenshot({ path: new URL(name + '.png', root).pathname });
    await page.close();
  }
} finally {
  await browser.close();
}
console.log('Rendered Winter README, GitHub and website social artwork.');
