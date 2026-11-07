import { createWeather, type WeatherController } from '@themes/fluri';
import './style.css';
const root = document.querySelector<HTMLDivElement>('#app');
if (!root) throw new Error('Missing example root');
root.innerHTML = `<header><a class="brand" href="#"><span aria-hidden="true">❄</span>fluri</a><nav aria-label="Example sections"><a href="#live">Live example</a><a href="#lifecycle">Lifecycle</a></nav></header><main id="live"><span class="eyebrow">VANILLA TYPESCRIPT INTEGRATION</span><h1>A little winter.<br/>A real browser lifecycle.</h1><p class="intro">This example imports the actual Fluri package, starts it in the browser, and gives you direct control over its configuration and lifetime.</p><section class="controls" data-weather-ignore aria-label="Weather controls"><label class="control" for="intensity">Intensity<input id="intensity" type="range" min="0" max="1" step=".01" value=".5"/><output id="intensity-value">0.50</output></label><button class="primary" id="pause">Pause weather</button><button id="add-snow">Add snow</button><button id="destroy">Destroy</button><button id="start" disabled>Recreate</button><p class="status" id="status" role="status">Creating weather</p></section><div class="cards"><article class="card" data-weather-surface><span class="eyebrow">REAL SURFACE</span><h2>Snow has somewhere to land.</h2><p>This article is an explicit surface. Add snow to see its local profile, then resize the browser and watch the deposit follow the card.</p></article><article class="card" data-weather-surface><span class="eyebrow">ORDINARY INPUT</span><h2>Your website still works.</h2><p>The overlay is pointer transparent. This ordinary button retains its native click behavior.</p><button id="ordinary">Click counter <output id="clicks" class="click-counter">0</output></button></article></div><section class="guide" id="lifecycle"><h2>Own the instance. Release the resources.</h2><p><code>createWeather()</code> is safe to import without a DOM. Call <code>start()</code> after your page mounts, use <code>updateConfig()</code> for live changes, and call <code>destroy()</code> when the page is removed. Recreate above starts a new instance with the chosen intensity.</p></section><p class="footnote">Reduced-motion preferences are respected. The engine automatically pauses in a hidden tab.</p></main><footer><span>@themes/fluri · MIT licensed</span><span>Runnable integration example</span></footer>`;
function element<T extends Element>(selector: string): T {
  const result = document.querySelector<T>(selector);
  if (!result) throw new Error(`Missing example element ${selector}`);
  return result;
}
let controller: WeatherController;
let intensity = 0.5;
let count = 0;
let alive = true;
function start() {
  controller = createWeather({
    preset: 'gentle-snow',
    autoStart: false,
    snow: { intensity },
    dom: { detection: 'explicit' },
    accessibility: { controls: false },
  });
  controller.start();
  alive = true;
  element<HTMLButtonElement>('#destroy').disabled = false;
  element<HTMLButtonElement>('#start').disabled = true;
  element<HTMLButtonElement>('#pause').disabled = false;
  element<HTMLButtonElement>('#add-snow').disabled = false;
  element('#pause').textContent = 'Pause weather';
  updateStatus();
}
function updateStatus() {
  const metrics = controller.getMetrics();
  element('#status').textContent =
    `Engine ${metrics.state} · ${metrics.particleCount} flakes · ${metrics.surfaceCount} surfaces`;
}
element('#pause').addEventListener('click', () => {
  if (controller.getMetrics().state === 'paused') {
    controller.resume();
    element('#pause').textContent = 'Pause weather';
  } else {
    controller.pause();
    element('#pause').textContent = 'Resume weather';
  }
  updateStatus();
});
element<HTMLInputElement>('#intensity').addEventListener('input', (event) => {
  intensity = Number((event.target as HTMLInputElement).value);
  element('#intensity-value').textContent = intensity.toFixed(2);
  if (alive) controller.setIntensity(intensity);
});
element('#add-snow').addEventListener('click', () => controller.addSnow(10));
element('#ordinary').addEventListener('click', () => {
  count++;
  element('#clicks').textContent = String(count);
});
element('#destroy').addEventListener('click', () => {
  controller.destroy();
  alive = false;
  element<HTMLButtonElement>('#destroy').disabled = true;
  element<HTMLButtonElement>('#start').disabled = false;
  element<HTMLButtonElement>('#pause').disabled = true;
  element<HTMLButtonElement>('#add-snow').disabled = true;
  updateStatus();
});
element('#start').addEventListener('click', start);
start();
let timer = setInterval(updateStatus, 500);
window.addEventListener('pagehide', () => {
  clearInterval(timer);
  controller.destroy();
});
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    if (alive) start();
    timer = setInterval(updateStatus, 500);
  }
});
