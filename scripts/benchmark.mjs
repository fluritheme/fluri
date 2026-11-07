import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { cpus, platform, release, totalmem } from 'node:os';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = fileURLToPath(new URL('../', import.meta.url));
const port = 5190;
const baseURL = `http://127.0.0.1:${port}`;
const output = fileURLToPath(new URL('../docs/performance-report.json', import.meta.url));
const warmupFrames = 45;
const sampleFrames = 90;
const viewport = { width: 1280, height: 900 };
const seed = 81624;
const cases = [];
for (const requestedElementCount of [100, 500, 2000]) {
  for (const surfaceCount of [0, 50, 200]) cases.push({ requestedElementCount, surfaceCount });
}
// A dedicated server is owned by this run. Refuse to benchmark an unrelated process on the port.
const probe = await fetch(baseURL).then(
  () => true,
  () => false,
);
if (probe)
  throw new Error(`Port ${port} is in use. Stop that server before running the benchmark.`);
const server = spawn(
  process.execPath,
  [
    fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url)),
    '--host',
    '127.0.0.1',
    '--port',
    String(port),
    '--strictPort',
  ],
  { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] },
);
let serverOutput = '';
server.stdout.on('data', (data) => {
  serverOutput += String(data);
});
server.stderr.on('data', (data) => {
  serverOutput += String(data);
});
let browser;
try {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Benchmark server exited: ${serverOutput}`);
    const ready = await fetch(`${baseURL}/packages/core/src/index.ts`).then(
      (response) => response.ok,
      () => false,
    );
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (Date.now() >= deadline)
    throw new Error(`Benchmark server did not become ready: ${serverOutput}`);
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport,
    deviceScaleFactor: 1,
    reducedMotion: 'no-preference',
  });
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.route('**/__fluri_benchmark__', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><html lang="en"><head><meta charset="UTF-8"><title>Fluri synthetic DOM benchmark</title><style>body{margin:0;background:#0b1320;color:#b8d8ed;font-family:system-ui}#scene{position:relative;width:1280px;height:900px;overflow:hidden}.node{position:absolute;width:50px;height:15px;font-size:7px}.surface{background:#1b354c;border:1px solid #3c617b;border-radius:3px}</style></head><body><div id="scene"></div></body></html>',
    }),
  );
  await page.goto(`${baseURL}/__fluri_benchmark__`);
  const results = [];
  for (const scenario of cases) {
    const measured = await page.evaluate(
      async ({ scenario, warmupFrames, sampleFrames, seed }) => {
        const { createWeather } = await import('/packages/core/src/index.ts');
        const scene = document.querySelector('#scene');
        if (!(scene instanceof HTMLElement)) throw new Error('Missing benchmark scene');
        const actualElementCount = Math.max(scenario.requestedElementCount, scenario.surfaceCount);
        scene.replaceChildren();
        const fragment = document.createDocumentFragment();
        for (let index = 0; index < actualElementCount; index++) {
          const node = document.createElement('div');
          const eligible = index < scenario.surfaceCount;
          node.className = eligible ? 'node surface' : 'node';
          if (eligible) node.dataset.weatherSurface = '';
          node.style.left = `${16 + (index % 20) * 62}px`;
          node.style.top = `${100 + (Math.floor(index / 20) % 10) * 70}px`;
          node.textContent = String(index + 1);
          fragment.append(node);
        }
        scene.append(fragment);
        const start = performance.now();
        const weather = createWeather({
          seed,
          container: scene,
          autoStart: false,
          snow: {
            intensity: 1,
            particleCount: 360,
            accumulation: { maxDepth: 12, sliding: false },
          },
          dom: { detection: 'explicit', maxSurfaces: 200 },
          performance: { adaptive: false, maxFPS: 60, maxDPR: 1 },
          accessibility: { controls: false, reducedMotion: 'respect' },
        });
        weather.start();
        const setupMs = performance.now() - start;
        const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
        for (let index = 0; index < warmupFrames; index++) await nextFrame();
        const samples = [];
        let previous = performance.now();
        for (let index = 0; index < sampleFrames; index++) {
          await nextFrame();
          const now = performance.now();
          const metrics = weather.getMetrics();
          samples.push({
            rafIntervalMs: now - previous,
            frameTimeMs: metrics.frameTime,
            simTimeMs: metrics.simTime,
            renderTimeMs: metrics.renderTime,
            geometryScanTimeMs: metrics.geometryScanTime,
            particleCount: metrics.particleCount,
            surfaceCount: metrics.surfaceCount,
            collisionChecks: metrics.collisionChecks,
          });
          previous = now;
        }
        weather.destroy();
        if (scene.querySelector('[data-fluri-root]'))
          throw new Error('Benchmark engine did not clean up its overlay');
        return { actualElementCount, setupMs, samples };
      },
      { scenario, warmupFrames, sampleFrames, seed },
    );
    const percentile = (values, fraction) => {
      const sorted = [...values].sort((a, b) => a - b);
      return Number(
        (
          sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * fraction))] ?? 0
        ).toFixed(4),
      );
    };
    const summarize = (key) => {
      const values = measured.samples.map((sample) => sample[key]);
      return {
        p50: percentile(values, 0.5),
        p95: percentile(values, 0.95),
        min: percentile(values, 0),
        max: percentile(values, 1),
      };
    };
    const fps = measured.samples.map((sample) => 1000 / Math.max(0.001, sample.rafIntervalMs));
    const result = {
      ...scenario,
      actualElementCount: measured.actualElementCount,
      setupMs: Number(measured.setupMs.toFixed(4)),
      rafFps: { p50: percentile(fps, 0.5), p95: percentile(fps, 0.95), p5: percentile(fps, 0.05) },
      rafIntervalMs: summarize('rafIntervalMs'),
      engineFrameTimeMs: summarize('frameTimeMs'),
      simulationMs: summarize('simTimeMs'),
      renderingMs: summarize('renderTimeMs'),
      geometryMs: summarize('geometryScanTimeMs'),
      particleCount: summarize('particleCount'),
      discoveredSurfaceCount: summarize('surfaceCount'),
      collisionChecks: summarize('collisionChecks'),
    };
    if (result.discoveredSurfaceCount.p50 !== scenario.surfaceCount)
      throw new Error(
        `Expected ${scenario.surfaceCount} surfaces, observed ${result.discoveredSurfaceCount.p50}`,
      );
    results.push(result);
    console.log(
      `${scenario.requestedElementCount} requested nodes / ${scenario.surfaceCount} surfaces: ${result.rafFps.p50.toFixed(1)} median RAF fps, ${result.simulationMs.p95.toFixed(2)} ms p95 simulation`,
    );
  }
  if (pageErrors.length)
    throw new Error(`Browser errors during benchmark: ${pageErrors.join('; ')}`);
  const report = {
    generatedAt: new Date().toISOString(),
    method:
      'Synthetic, static DOM scene in headless Chromium. Warmup and measurement use real requestAnimationFrame callbacks; no virtual or accelerated clock. Engine timings come from getMetrics().',
    caveats: [
      'This is one development machine and one browser, not a cross-device guarantee or release threshold.',
      'Background operating-system and other development workloads are not controlled.',
      'The 100-element / 200-surface scenario necessarily uses 200 elements; actualElementCount records this explicitly.',
      'All surfaces are explicit, visible, and static; complex CSS composition and continuously mutating layouts are separate workloads.',
      'RAF fps measures browser callbacks. The engine cap may skip simulation/rendering callbacks; engineFrameTimeMs reports its actual frame spacing.',
      'No baseline regression budget has been asserted from a single run.',
    ],
    environment: {
      os: platform(),
      osRelease: release(),
      architecture: process.arch,
      cpu: cpus()[0]?.model ?? 'unreported',
      logicalCPUs: cpus().length,
      totalMemoryBytes: totalmem(),
      node: process.version,
      chromium: browser.version(),
      headless: true,
      viewport,
      deviceScaleFactor: 1,
      cpuThrottling: 'none',
      mobileEmulation: false,
    },
    configuration: {
      seed,
      particleBudget: 360,
      intensity: 1,
      adaptive: false,
      maxFPS: 60,
      maxDPR: 1,
      warmupFrames,
      sampleFrames,
      surfaceDiscovery: 'explicit',
    },
    results,
  };
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  console.log(`Saved ${output}`);
} finally {
  await browser?.close();
  server.kill('SIGTERM');
  if (server.exitCode === null)
    await Promise.race([
      new Promise((resolve) => server.once('exit', resolve)),
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]);
  if (server.exitCode === null) server.kill('SIGKILL');
}
