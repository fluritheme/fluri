import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const server = await createServer({
  configFile: false,
  optimizeDeps: { noDiscovery: true },
  server: { host: '127.0.0.1', port: 5198, strictPort: true, hmr: false },
});
await server.listen();
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 970 },
    deviceScaleFactor: 1.5,
  });
  await page.clock.install();
  await page.goto('http://127.0.0.1:5198');
  await page.clock.pauseAt(new Date((await page.evaluate(() => Date.now())) + 100));
  await page.setContent(`<style>
  *{box-sizing:border-box}body{margin:0;background:#4530f5;color:#fff;font-family:Arial,sans-serif;padding:58px 64px 42px}header{display:flex;justify-content:space-between;font:14px monospace;letter-spacing:2px;padding-bottom:22px;border-bottom:1px solid #ffffff60}h1{font-size:72px;letter-spacing:-4px;line-height:1.03;margin:28px 0 14px}h1 em{font-style:normal;color:#ffb990}p{margin:0 0 30px;font-size:22px;color:#e6e2ff}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.scene{height:242px;position:relative;border:1px solid #ffffff55;background:#ffffff08;overflow:hidden}.label{position:absolute;left:20px;top:18px;font:13px monospace;letter-spacing:1.5px}.shelf{position:absolute;left:18px;right:18px;top:186px;height:55px;border-top:1px solid #ffffff60;background:#ffffff08}.shelf span{display:block;margin:20px 14px;font:11px monospace;color:#e6e2ff}footer{display:flex;justify-content:space-between;margin-top:26px;font:14px monospace;letter-spacing:1px}
  </style><header><span>FLURI / WINTER 0.2</span><span>SMALL VISITOR. BIG PLANS.</span></header><h1>Meet your snowman's<br><em>new little problem.</em></h1><p>A cute yeti. Real snow. One mischievous snowball at a time.</p><div class="grid">${['arriving', 'gathering', 'packing', 'aiming', 'throwing', 'celebrating'].map((p, i) => `<section class="scene" id="scene-${i}" data-phase="${p}"><div class="label">0${i + 1} / ${p.toUpperCase()}</div><div class="shelf" data-weather-surface data-weather-yeti><span>${p === 'celebrating' ? 'TIME TO REBUILD.' : 'YOUR WEBSITE. A LITTLE MORE ALIVE.'}</span></div></section>`).join('')}</div><footer><span>npm i @fluritheme/fluri</span><span>winter.fluri.xyz</span></footer>`);
  await page.evaluate(async () => {
    const { createWeather } = await import('/packages/core/src/index.ts');
    window.previewControllers = [];
    for (const scene of document.querySelectorAll('.scene')) {
      const target = scene.dataset.phase;
      const w = createWeather({
        container: scene,
        seed: 17,
        snow: { enabled: false, accumulation: { softness: 0, sliding: false } },
        dom: { detection: 'explicit' },
        interactions: {
          snowballs: { enabled: true },
          snowman: { enabled: true },
          yeti: { enabled: true, size: 1.4 },
        },
        performance: { adaptive: false, maxDPR: 1.5 },
        accessibility: { controls: false },
      });
      let last = '',
        age = 0;
      w.use({
        name: 'capture-pose',
        update(dt) {
          const phase = w.getMetrics().yetiPhase;
          if (phase !== last) {
            last = phase;
            age = 0;
          }
          age += dt;
          const delay = target === 'throwing' ? 0.32 : target === 'gathering' ? 0.8 : 0.35;
          if (phase === target && age >= delay) w.pause();
        },
      });
      w.start();
      w.addSnow(9);
      w.trigger('snowman', { radius: 17 });
      window.previewControllers.push(w);
    }
  });
  await page.clock.runFor(20_000);
  const states = await page.evaluate(() =>
    window.previewControllers.map((w) => ({
      state: w.getMetrics().state,
      phase: w.getMetrics().yetiPhase,
    })),
  );
  if (states.some((s) => s.state !== 'paused')) throw Error(JSON.stringify(states));
  await mkdir('assets/readme', { recursive: true });
  await page.screenshot({ path: 'assets/readme/yeti.png', fullPage: true });
  console.log(JSON.stringify(states));
} finally {
  await browser.close();
  await server.close();
}
