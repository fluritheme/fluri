import {
  createWeather,
  presetNames,
  type PresetName,
  type WeatherController,
  type WeatherOptions,
  type WeatherMetrics,
} from '@fluritheme/fluri';
import { christmasPack } from '@fluritheme/fluri/christmas';
import './style.css';

declare global {
  interface Window {
    __fluri: WeatherController;
  }
}
const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Fluri playground root is missing.');
const website = import.meta.env.DEV ? 'http://127.0.0.1:5174/' : '../';
const mark =
  '<svg viewBox="0 0 40 40" fill="none" aria-hidden="true"><g stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 3v34M5.3 11.5l29.4 17M5.3 28.5l29.4-17M14 7l6 6 6-6M14 33l6-6 6 6M6 19l8-2-2-8M28 31l-2-8 8-2M6 21l8 2-2 8M28 9l-2 8 8 2"/></g></svg>';
const tabs = [
  ['weather', '❄', 'Weather'],
  ['snow', '≋', 'Snow'],
  ['layers', '▱', 'Layers'],
  ['interactions', '↗', 'Interact'],
  ['christmas', '✧', 'Festive'],
  ['performance', '⌁', 'Quality'],
  ['accessibility', '◉', 'Access'],
  ['presets', '⊞', 'Presets'],
];
app.innerHTML = `
<header class="header" data-weather-ignore>
 <div class="header-left"><a class="brand" href="${website}" aria-label="Winter home">${mark}winter<span class="brand-period">.</span></a></div>
 <nav class="header-nav" id="site-primary-nav" aria-label="Main navigation"><a href="${website}features/">Features</a><a href="${website}showcase/">Showcase</a><a href="${website}docs/">Docs</a><a href="${website}about/">About</a><a href="https://fluri.xyz/">All themes ↗</a><a class="playground-current" href="./" aria-current="page">Playground</a></nav>
 <div class="header-right"><button class="btn btn-primary" id="export-top">Export config <span aria-hidden="true">↗</span></button><button type="button" class="site-menu-toggle" id="site-menu-toggle" aria-label="Open navigation" aria-expanded="false" aria-controls="site-primary-nav"><span></span><span></span></button></div>
</header>
<div class="workspace">
 <aside class="sidebar" id="sidebar" aria-label="Weather configuration" data-weather-ignore>
  <div class="sidebar-title"><div><span class="eyebrow">MAKE IT YOURS</span><h2 id="settings-title">Weather settings</h2></div><button class="icon-btn mobile-controls" id="close-sidebar" aria-label="Close configuration">×</button></div>
  <div class="panel-nav" role="tablist" aria-label="Settings sections">${tabs.map(([id, icon, label], i) => `<button class="panel-tab" id="tab-${id}" data-tab="${id}" role="tab" aria-controls="panel-${id}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}"><span class="tab-icon" aria-hidden="true">${icon}</span>${label}</button>`).join('')}</div>
  <div id="panels"></div>
  <div class="sidebar-footer">Your configuration stays in this browser. Export it whenever your forecast feels right.</div>
 </aside>
 <main class="main">
  <div class="lab-heading" data-weather-ignore><div><span class="eyebrow">A LITTLE WINTER, ON YOUR TERMS</span><h1>Winter <em>lab.</em></h1><p>Real surfaces. A little physics. Make it yours.</p></div><button class="btn btn-quiet desktop-only" id="copy-install"><span aria-hidden="true">⌘</span> Copy install command</button></div>
  <div class="preview-toolbar" data-weather-ignore><div class="scene-picker"><label for="scene-select">Scene</label><select class="scene-select" id="scene-select"><option value="landing">Surface workshop</option><option value="layers">Layer challenge</option><option value="stress">Stress test</option></select></div><div class="toolbar-actions"><button class="btn mobile-controls" id="toggle-sidebar" aria-label="Open configuration" aria-expanded="false" aria-controls="settings-dialog"><span aria-hidden="true">☷</span> Settings</button><button class="btn btn-quiet" id="reset" aria-label="Reset weather"><span aria-hidden="true">↺</span><span class="reset-label">Reset</span></button><button class="btn" id="pause" aria-label="Pause weather">Ⅱ <span>Pause</span></button></div></div>
  <section class="preview" aria-label="Interactive snow workshop">
   <div class="scene" id="scene">
    <div class="scene-intro"><span class="scene-kicker">THE SURFACE WORKSHOP</span><h2><span class="desktop-intro">Snow meets your interface.</span><span class="compact-intro">Snow finds a surface.</span></h2><p>Add a little snow, then move the top surface.</p></div>
    <div class="scene-grid" id="scene-cards">
     <article class="scene-card moving-platform" id="moving-card" data-weather-surface data-holiday-frost data-holiday-icicles><div class="platform-title"><h3>Move this surface</h3><button class="drag-handle" id="drag-handle" aria-label="Drag snow surface. Use arrow keys to move; Home to reset."><span aria-hidden="true">↔</span> Drag</button></div><p>The snow comes along.<br/>A quick move can shake it loose.</p><button class="resize-handle desktop-only" id="resize-handle" aria-label="Resize snow surface by dragging; use left and right arrow keys" title="Resize surface">↘</button></article>
     <article class="scene-card receiving-platform" id="receiving-card" data-weather-surface data-holiday-ornaments data-holiday-lights data-holiday-garland><div class="receiving-icon" aria-hidden="true">↳</div><h3>The catching shelf</h3><p>A new edge to land on.</p></article>
    </div>
    <div id="stress-host" class="hidden"><p class="benchmark-note">1,000 actual DOM nodes. The surface budget controls how many are tracked.</p><div class="stress-grid" id="stress-grid"></div></div>
    <div class="snow-shelf" data-weather-yeti id="snow-shelf" data-weather-surface data-plough-route data-holiday-gifts data-holiday-candy-canes data-holiday-sparkle data-holiday-wreath><span><i aria-hidden="true"></i> A little room for play</span><span class="shelf-route" aria-hidden="true">······················································</span></div>
   </div>
   <div class="workshop-actions" data-weather-ignore><button class="workshop-action action-primary" id="add-snow"><span aria-hidden="true">❄</span>Add snow</button><button class="workshop-action" id="dock-ball"><span aria-hidden="true">◌</span>Snowball</button><button class="workshop-action" id="dock-yeti"><span aria-hidden="true">☃</span>Yeti vs snowman</button><button class="workshop-action" id="dock-plough"><span aria-hidden="true">⇥</span>Snowplough</button><button class="workshop-action" id="shake-surface"><span aria-hidden="true">↔</span>Shake surface</button><button class="workshop-action" id="dock-clear"><span aria-hidden="true">⌫</span>Clear snow</button><button class="workshop-action" id="festive-toggle"><span aria-hidden="true">✧</span>Christmas</button></div>
  </section>
  <div class="preview-footer" data-weather-ignore><div class="engine-status" id="engine-status"><i class="live-dot"></i><span id="status-text">Starting engine</span></div><div class="metrics"><span><strong id="metric-fps">—</strong> fps</span><span><strong id="metric-particles">0</strong> particles</span><span><strong id="metric-surfaces">0</strong> surfaces</span></div></div>
  <div class="interaction-note" data-weather-ignore><p class="touch-instruction">Drag the handle to move the surface. Tap a tool to try it.</p><p class="pointer-instruction">Brush a snowy edge to clear it. <kbd>Shift</kbd> + drag to roll a snowball.</p><button id="scene-guide" class="text-button">Interaction guide ↗</button><button id="scene-about" class="text-button desktop-only">How it works ↗</button></div>
  <footer class="bottom-strip" data-weather-ignore><a href="${website}">Fluri · MIT licensed</a><button id="scene-code" class="text-button">Get this configuration ↗</button></footer>
 </main>
</div>
<dialog class="settings-sheet" id="settings-dialog" aria-labelledby="settings-title" data-weather-ignore></dialog>
<dialog class="modal" id="info-dialog" data-weather-surface data-weather-layer="foreground"><span class="eyebrow" id="dialog-kicker">A CLOSER LOOK</span><h2 id="dialog-title">Winter, with a little intelligence.</h2><p id="dialog-body">Fluri measures supported DOM surfaces and simulates snow in their local space, so deposits can follow the interface.</p><button class="btn btn-primary" id="dialog-close">Back to the snow</button></dialog>
<div class="toast" id="toast" role="status" aria-live="polite"></div>`;

function get<T extends Element>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`Missing playground element: ${selector}`);
  return el;
}
const siteNavigation = get<HTMLElement>('#site-primary-nav');
const siteMenuToggle = get<HTMLButtonElement>('#site-menu-toggle');
function closeSiteNavigation(restoreFocus = false): void {
  siteNavigation.classList.remove('is-open');
  siteMenuToggle.setAttribute('aria-expanded', 'false');
  siteMenuToggle.setAttribute('aria-label', 'Open navigation');
  if (restoreFocus) siteMenuToggle.focus();
}
siteMenuToggle.addEventListener('click', () => {
  const opening = siteMenuToggle.getAttribute('aria-expanded') !== 'true';
  siteNavigation.classList.toggle('is-open', opening);
  siteMenuToggle.setAttribute('aria-expanded', String(opening));
  siteMenuToggle.setAttribute('aria-label', opening ? 'Close navigation' : 'Open navigation');
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && siteMenuToggle.getAttribute('aria-expanded') === 'true')
    closeSiteNavigation(true);
});
document.addEventListener('pointerdown', (event) => {
  if (
    event.target instanceof Node &&
    !siteNavigation.contains(event.target) &&
    !siteMenuToggle.contains(event.target)
  )
    closeSiteNavigation();
});
matchMedia('(min-width: 961px)').addEventListener('change', () => closeSiteNavigation());
const panels = get<HTMLDivElement>('#panels');
function range(
  id: string,
  label: string,
  path: string,
  min: number,
  max: number,
  step: number,
  unit = '',
  ends = '',
) {
  return `<div class="control"><label class="control-label" for="${id}">${label}<output id="${id}-value"></output></label><input id="${id}" type="range" data-path="${path}" min="${min}" max="${max}" step="${step}" data-unit="${unit}"/>${ends ? `<div class="range-labels"><span>${ends.split('|')[0]}</span><span>${ends.split('|')[1]}</span></div>` : ''}</div>`;
}
function toggle(id: string, label: string, path: string) {
  return `<label class="toggle-row" for="${id}"><span>${label}</span><span class="switch"><input id="${id}" type="checkbox" data-path="${path}"/><span></span></span></label>`;
}
function select(id: string, label: string, path: string, options: [string, string][]) {
  return `<div class="control"><label class="control-label" for="${id}">${label}</label><select id="${id}" data-path="${path}">${options.map(([value, text]) => `<option value="${value}">${text}</option>`).join('')}</select></div>`;
}
function section(id: string, title: string, description: string, content: string) {
  return `<section class="panel-content ${id === 'weather' ? 'active' : ''}" id="panel-${id}" role="tabpanel" aria-labelledby="tab-${id}"><h2 class="panel-heading">${title}</h2><p class="panel-description">${description}</p>${content}</section>`;
}
panels.innerHTML = [
  section(
    'weather',
    'A forecast of your own',
    'Find the perfect flurry for your interface.',
    `${select(
      'quick-preset',
      'Weather preset',
      'preset',
      presetNames.map((name) => [name, titleCase(name)]),
    )}${range('intensity', 'Snowfall intensity', 'snow.intensity', 0, 1, 0.01, '', 'A dusting|Winter wonderland')}${range('wind', 'Wind direction & speed', 'snow.wind.base', -1, 1, 0.01, '', '← West|East →')}${range('gust-variability', 'Gust variation', 'snow.wind.variability', 0, 1, 0.01)}${toggle('gusts', 'Natural wind gusts', 'snow.wind.gusts')}<button class="btn" id="dock-gust" style="width:100%;margin-bottom:20px">Send a wind gust ≋</button><div class="section-line"></div>${select(
      'flake-style',
      'Snowflake style',
      'snow.flakeStyle',
      [
        ['soft', 'Soft & fluffy'],
        ['crystal', 'Geometric crystal'],
        ['dot', 'Minimal dot'],
      ],
    )}${range('size', 'Maximum flake size', 'snow.maxSize', 2, 10, 0.1, 'px')}${toggle('glow', 'A soft winter glow', 'snow.glow')}${toggle('parallax', 'Depth & parallax', 'snow.parallax')}<div class="control"><label class="control-label" for="snow-color">Snow color</label><input type="color" id="snow-color" data-path="snow.color"/></div>${range('gravity', 'Gravity', 'snow.gravity', 10, 200, 1)}${range('turbulence', 'Turbulence', 'snow.turbulence', 0, 2, 0.05)}`,
  ),
  section(
    'snow',
    'Snow that settles',
    'Give real interface edges a little winter.',
    `${toggle('accumulation', 'Accumulate on surfaces', 'snow.accumulation.enabled')}${range('depth', 'Maximum pile depth', 'snow.accumulation.maxDepth', 0, 40, 1, 'px')}${range('growth', 'Accumulation speed', 'snow.accumulation.growthRate', 0, 4, 0.05)}${range('softness', 'Pile softness', 'snow.accumulation.softness', 0, 1, 0.01)}${range('melt', 'Melt rate', 'snow.accumulation.meltRate', 0, 5, 0.1)}${toggle('sliding', 'Shed from moving surfaces', 'snow.accumulation.sliding')}${toggle('transfer', 'Transfer to lower surfaces', 'snow.accumulation.transferToLowerSurfaces')}<div class="section-line"></div><div class="panel-buttons"><button class="btn" id="add-all">Add snow</button><button class="btn" id="clear-all">Clear piles</button></div><button class="btn" id="release-card" style="width:100%;margin-top:8px">Shake the draggable card ↔</button><p class="help">Adding snow creates a measured deposit. Brushing and ploughing move that mass back into the scene.</p>`,
  ),
  section(
    'layers',
    'Understands your edges',
    'Inspect the geometry behind the magic.',
    `${select('detection', 'Surface discovery', 'dom.detection', [
      ['auto', 'Automatic + explicit'],
      ['explicit', 'Explicit surfaces only'],
    ])}${toggle('layers', 'Respect visual layers', 'dom.respectLayers')}${toggle('mutations', 'Observe DOM changes', 'dom.observeMutations')}${toggle('debug', 'Show geometry inspector', 'debug')}${range('surface-budget', 'Surface budget', 'dom.maxSurfaces', 10, 500, 10)}<div class="control"><label class="control-label" for="include-selector">Include selector</label><input id="include-selector" type="text" value="[data-weather-surface]" spellcheck="false"/><p class="help">Comma-separated CSS selectors. Explicit overrides take precedence over discovery.</p></div><div class="control"><label class="control-label" for="exclude-selector">Exclude selector</label><input id="exclude-selector" type="text" value="input, textarea, [data-weather-ignore]" spellcheck="false"/></div><button class="btn" id="apply-selectors" style="width:100%">Apply selectors</button><p class="error-text" id="selector-error" role="status"></p><div class="section-line"></div><button class="btn" id="open-layer-modal" style="width:100%">Open a top-layer dialog ↗</button><p class="help">Layering is a best-effort approximation. Native dialogs, complex CSS masks, and cross-origin frames have documented limits.</p>`,
  ),
  section(
    'interactions',
    'Make a little magic',
    'Deliberate gestures. Ordinary browsing stays ordinary.',
    `${toggle('brush', 'Brush snow away', 'interactions.brush.enabled')}${select(
      'brush-activation',
      'Brush activation',
      'interactions.brush.activation',
      [
        ['hover', 'Pointer movement'],
        ['press', 'While pressed'],
      ],
    )}${range('brush-radius', 'Brush radius', 'interactions.brush.radius', 5, 90, 1, 'px')}${range('brush-strength', 'Brush strength', 'interactions.brush.strength', 0.1, 2, 0.05)}<div class="section-line"></div>${toggle('snowballs', 'Interactive snowballs', 'interactions.snowballs.enabled')}${select(
      'ball-activation',
      'Gathering mode',
      'interactions.snowballs.activation',
      [
        ['press-and-drag', 'Shift + press and drag'],
        ['hover-circle', 'Intentional hover circles'],
      ],
    )}${range('ball-size', 'Maximum snowball radius', 'interactions.snowballs.maxRadius', 10, 50, 1, 'px')}${toggle('snowman', 'Build a snowman', 'interactions.snowman.enabled')}${toggle('yeti', 'A mischievous yeti', 'interactions.yeti.enabled')}${range('yeti-size', 'Yeti size', 'interactions.yeti.size', 0.5, 2, 0.1)}${range('yeti-cooldown', 'Time between attempts', 'interactions.yeti.cooldown', 5, 60, 1, 's')}${toggle('vortex', 'Pointer vortex', 'interactions.pointerVortex.enabled')}<div class="panel-buttons"><button class="btn" id="spawn-ball">Snowball</button><button class="btn" id="spawn-man">Snowman</button><button class="btn" id="spawn-yeti">Meet the yeti</button></div><button class="btn" id="break-balls" style="width:100%;margin-top:8px">Break snowballs into snow</button><p class="help">Hold Shift near snow and drag to gather a ball. Release to throw. Stack three compatible balls on a surface to assemble a snowman.</p>`,
  ),
  section(
    'christmas',
    'A little more festive',
    'Decorate deliberate surfaces, one detail at a time.',
    `${['lights', 'garlands', 'ornaments', 'gifts', 'icicles', 'frost', 'sparkle', 'wreath', 'candyCanes'].map((id) => toggle(`christmas-${id}`, titleCase(id), `christmas.${id}`)).join('')}<div class="control"><label class="control-label" for="light-color">Light color</label><input type="color" id="light-color" value="#ffd1a1"/></div>${range('warmth', 'Light warmth', 'christmas.warmth', 0, 1, 0.01)}<div class="section-line"></div><div class="control"><label class="control-label" for="plough-style">Snowplough style</label><select id="plough-style"><option value="classic">Classic yellow</option><option value="minimal">Minimal silver</option><option value="festive">Festive red</option></select></div><div class="control"><label class="control-label" for="plough-speed">Plough speed <output id="plough-speed-value">80 px/s</output></label><input id="plough-speed" type="range" min="20" max="200" step="5" value="80"/></div><button class="btn" id="run-plough" style="width:100%">Send the little snowplough ⇥</button><p class="help">Decorations attach only to labeled demo surfaces. The plough follows the shelf below the cards and pushes its snow off the edge.</p>`,
  ),
  section(
    'performance',
    'A lighter footprint',
    'Real measurements from this browser.',
    `<canvas class="sparkline" id="metrics-chart" width="240" height="55" aria-label="Recent frame rate history" role="img"></canvas><div id="performance-metrics"></div><div class="section-line"></div>${toggle('adaptive', 'Adapt quality automatically', 'performance.adaptive')}${select(
      'quality',
      'Preferred quality',
      'performance.preferredQuality',
      [
        ['auto', 'Automatic'],
        ['low', 'Low'],
        ['medium', 'Medium'],
        ['high', 'High'],
      ],
    )}${range('particles', 'Particle budget', 'snow.particleCount', 0, 1500, 10)}${range('fps', 'Maximum frame rate', 'performance.maxFPS', 15, 120, 5, 'fps')}${range('dpr', 'Pixel ratio limit', 'performance.maxDPR', 1, 3, 0.25)}<button class="btn" id="stress-button" style="width:100%">Open 1,000-element stress scene</button><p class="help">Measurements depend on the device, browser, scene, and settings. They are observations, not performance guarantees.</p>`,
  ),
  section(
    'accessibility',
    'Winter for everyone',
    'Comfort and control come first.',
    `${select('reduced-motion', 'Reduced motion policy', 'accessibility.reducedMotion', [
      ['respect', 'Respect system preference'],
      ['reduce', 'Simplify motion'],
      ['ignore', 'Explicitly allow motion'],
    ])}${toggle('accessible-controls', 'Show visitor pause control', 'accessibility.controls')}${toggle('snow-enabled', 'Enable snowfall', 'snow.enabled')}<p class="help" id="motion-preference"></p><div class="section-line"></div><div class="panel-buttons"><button class="btn" id="stop-engine">Stop</button><button class="btn" id="destroy-engine">Destroy</button><button class="btn" id="start-engine">Start</button></div><p class="help">Stop retains configuration. Destroy releases the instance and its resources. Start creates a fresh instance when needed. The engine pauses automatically in a hidden tab.</p>`,
  ),
  section(
    'presets',
    'Your winter, bottled',
    'Start with a mood. Make it your own.',
    `<div class="preset-grid">${presetNames.map((name) => `<button class="preset-card" data-preset="${name}" data-selected="false"><span>${titleCase(name)}</span><span>↗</span></button>`).join('')}</div><div class="section-line"></div><div class="panel-buttons"><button class="btn" id="save-preset">Save locally</button><button class="btn" id="load-preset">Load saved</button></div><p class="help">Saved in this browser only. Configuration imports are validated before they reach the engine.</p><div class="section-line"></div><div class="config-filename"><span>fluri.config.json</span><span>JSON</span></div><textarea class="panel-code" id="config-editor" aria-label="JSON configuration" spellcheck="false"></textarea><p class="error-text" id="config-error" role="status"></p><div class="panel-buttons"><button class="btn" id="apply-config">Apply JSON</button><button class="btn" id="copy-json">Copy JSON</button></div><div class="panel-buttons" style="margin-top:8px"><button class="btn" id="copy-ts">Copy TypeScript</button><button class="btn" id="download-config">Download JSON</button></div>`,
  ),
].join('');

function titleCase(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(
      /(^|-)(\w)/g,
      (_, prefix: string, letter: string) => `${prefix ? ' ' : ''}${letter.toUpperCase()}`,
    );
}
let weather: WeatherController;
let disposeChristmas: (() => void) | undefined;
let destroyed = false;
let toastTimer: ReturnType<typeof setTimeout> | undefined;
const christmas = {
  lights: false,
  garlands: false,
  ornaments: false,
  gifts: false,
  icicles: false,
  frost: false,
  sparkle: false,
  wreath: false,
  candyCanes: false,
  warmth: 0.85,
};
const initial: WeatherOptions = {
  preset: 'gentle-snow',
  seed: 4242,
  snow: {
    intensity: 0.38,
    particleCount: 240,
    minSize: 0.8,
    maxSize: 2.4,
    glow: false,
    accumulation: { enabled: true, maxDepth: 12, growthRate: 0.65 },
  },
  dom: { detection: 'explicit', maxSurfaces: 100 },
  interactions: {
    brush: { enabled: true },
    snowballs: { enabled: true },
    snowman: { enabled: true },
  },
  accessibility: { controls: false },
};
const scene = get<HTMLDivElement>('#scene');
function create(options: WeatherOptions = initial) {
  weather = createWeather({ ...options, container: scene, autoStart: false });
  window.__fluri = weather;
  destroyed = false;
  weather.start();
  syncControls();
  updateChristmas();
}
function notify(message: string) {
  const el = get<HTMLDivElement>('#toast');
  el.textContent = message;
  el.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('visible'), 3200);
}
async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    notify('Copied. A little winter, ready to go.');
  } catch {
    const field = document.createElement('textarea');
    field.value = text;
    document.body.append(field);
    field.select();
    const success = document.execCommand('copy');
    field.remove();
    notify(
      success
        ? 'Copied to clipboard.'
        : 'Clipboard unavailable. Use the configuration editor to select and copy.',
    );
  }
}
function currentJSON(): string {
  const { container: _container, ...config } = weather.getConfig();
  return JSON.stringify(config, null, 2);
}
function currentTS(): string {
  const enabled = Object.values(christmas).some((value) => value === true);
  const options = {
    lights: {
      enabled: christmas.lights,
      warmth: christmas.warmth,
      color: get<HTMLInputElement>('#light-color').value,
    },
    garlands: christmas.garlands,
    ornaments: christmas.ornaments,
    gifts: christmas.gifts,
    icicles: christmas.icicles,
    frost: christmas.frost,
    sparkle: christmas.sparkle,
    wreath: christmas.wreath,
    candyCanes: christmas.candyCanes,
  };
  const pluginImport = enabled
    ? `import { christmasPack } from '@fluritheme/fluri/christmas';\n`
    : '';
  const pluginSetup = enabled
    ? `\nweather.use(christmasPack(${JSON.stringify(options, null, 2)}));\n`
    : '';
  return `import { createWeather } from '@fluritheme/fluri';\n${pluginImport}\nconst weather = createWeather(${currentJSON()});\n${pluginSetup}\nweather.start();\n\nwindow.addEventListener('pagehide', () => weather.destroy(), { once: true });\n`;
}
function readPath(object: unknown, path: string): unknown {
  let value: unknown = object;
  for (const key of path.split('.')) {
    if (!value || typeof value !== 'object') return undefined;
    value = Reflect.get(value, key);
  }
  return value;
}
function patchPath(path: string, value: unknown): WeatherOptions {
  const keys = path.split('.');
  let result: unknown = value;
  for (const key of keys.reverse()) result = { [key]: result };
  return result as WeatherOptions;
}
function applyPatch(patch: WeatherOptions) {
  try {
    if (destroyed) {
      create(weather.getConfig());
    }
    weather.updateConfig(patch);
    syncControls();
  } catch (error) {
    notify(error instanceof Error ? error.message : 'Could not apply configuration.');
    syncControls();
  }
}
function syncControls() {
  if (!weather) return;
  const config = weather.getConfig();
  for (const input of document.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
    '[data-path]',
  )) {
    const path = input.dataset.path ?? '';
    const value = path.startsWith('christmas.')
      ? readPath({ christmas }, path)
      : readPath(config, path);
    if (input instanceof HTMLInputElement && input.type === 'checkbox')
      input.checked = Boolean(value);
    else if (value !== undefined) input.value = String(value);
    const output = document.getElementById(`${input.id}-value`);
    if (output)
      output.textContent =
        typeof value === 'number'
          ? `${Number(value.toFixed(2))}${input.dataset.unit ?? ''}`
          : String(value ?? '');
  }
  for (const card of document.querySelectorAll<HTMLElement>('[data-preset]'))
    card.dataset.selected = String(card.dataset.preset === config.preset);
  get<HTMLTextAreaElement>('#config-editor').value = currentJSON();
  get<HTMLParagraphElement>('#motion-preference').textContent = matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches
    ? 'Your system currently requests reduced motion. Fluri follows the selected policy.'
    : 'Your system currently allows motion. Reduced-motion visitors retain their preference.';
}
function switchTab(id: string) {
  for (const tab of document.querySelectorAll<HTMLButtonElement>('[data-tab]')) {
    const active = tab.dataset.tab === id;
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
  }
  for (const panel of document.querySelectorAll('.panel-content'))
    panel.classList.toggle('active', panel.id === `panel-${id}`);
  if (id === 'presets') get<HTMLTextAreaElement>('#config-editor').value = currentJSON();
}
function updateChristmas() {
  disposeChristmas?.();
  if (destroyed) return;
  const enabled = Object.values(christmas).some((v) => v === true);
  get<HTMLButtonElement>('#festive-toggle').innerHTML =
    `<span aria-hidden="true">✧</span>${enabled ? 'Winter mode' : 'Christmas'}`;
  get<HTMLButtonElement>('#festive-toggle').setAttribute('aria-pressed', String(enabled));
  if (!enabled) {
    disposeChristmas = undefined;
    return;
  }
  disposeChristmas = weather.use(
    christmasPack({
      lights: {
        enabled: christmas.lights,
        warmth: christmas.warmth,
        color: get<HTMLInputElement>('#light-color').value,
      },
      garlands: christmas.garlands,
      ornaments: christmas.ornaments,
      gifts: christmas.gifts,
      icicles: christmas.icicles,
      frost: christmas.frost,
      sparkle: christmas.sparkle,
      wreath: christmas.wreath,
      candyCanes: christmas.candyCanes,
    }),
  );
}
function festive() {
  const enable = !christmas.lights;
  for (const key of [
    'lights',
    'garlands',
    'ornaments',
    'gifts',
    'icicles',
    'frost',
    'sparkle',
  ] as const)
    christmas[key] = enable;
  updateChristmas();
  syncControls();
  notify(enable ? 'A warmer kind of winter. Christmas mode enabled.' : 'Back to a quiet winter.');
}
function addSnow() {
  if (destroyed) {
    notify('Start the engine to add snow.');
    return;
  }
  weather.addSnow(3, '#moving-card, #receiving-card');
}
function plough() {
  if (destroyed) return;
  weather.addSnow(3, '#snow-shelf');
  weather.trigger('plough', {
    selector: '#snow-shelf',
    direction: 'right',
    speed: Number(get<HTMLInputElement>('#plough-speed').value),
    style: get<HTMLSelectElement>('#plough-style').value as 'classic' | 'minimal' | 'festive',
  });
  notify('The little snowplough is on its way.');
}
function snowball() {
  if (destroyed) return;
  weather.trigger('snowball', { selector: '#snow-shelf', radius: 16 });
  notify('Hold Shift and drag the snowball to roll or throw it.');
}
function meetYeti() {
  if (destroyed) return;
  weather.resume();
  weather.updateConfig({
    interactions: {
      yeti: { enabled: true },
      snowballs: { enabled: true },
      snowman: { enabled: true },
    },
  });
  weather.addSnow(4, '#snow-shelf');
  weather.trigger('yeti', { selector: '#snow-shelf' });
  if (!weather.getMetrics().snowmanCount) weather.trigger('snowman', { selector: '#snow-shelf' });
  syncControls();
  notify('Meet the yeti. Watch it scoop, pack, aim and throw at your snowman.');
}
function snowman() {
  if (destroyed) return;
  weather.trigger('snowman', { selector: '#snow-shelf' });
  notify('A new friend on the snowy shelf.');
}
function showInfo(title: string, body: string, kicker = 'A CLOSER LOOK') {
  closeSidebar(false);
  get('#dialog-title').textContent = title;
  get('#dialog-body').textContent = body;
  get('#dialog-kicker').textContent = kicker;
  get<HTMLDialogElement>('#info-dialog').showModal();
}
function on(id: string, action: () => void) {
  get<HTMLButtonElement>(`#${id}`).addEventListener('click', action);
}
for (const tab of document.querySelectorAll<HTMLButtonElement>('[data-tab]')) {
  tab.addEventListener('click', () => switchTab(tab.dataset.tab ?? 'weather'));
  tab.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const all = [...document.querySelectorAll<HTMLButtonElement>('[data-tab]')];
    const index = all.indexOf(tab);
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? all.length - 1
          : (index + (event.key === 'ArrowRight' ? 1 : -1) + all.length) % all.length;
    const target = all[next];
    if (target) {
      switchTab(target.dataset.tab ?? 'weather');
      target.focus();
    }
  });
}
for (const input of document.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
  '[data-path]',
)) {
  input.addEventListener(
    input instanceof HTMLInputElement && input.type === 'range' ? 'input' : 'change',
    () => {
      const path = input.dataset.path ?? '';
      const value =
        input instanceof HTMLInputElement && input.type === 'checkbox'
          ? input.checked
          : input instanceof HTMLInputElement && input.type === 'range'
            ? Number(input.value)
            : input.value;
      if (path.startsWith('christmas.')) {
        const key = path.split('.')[1];
        if (key && Object.hasOwn(christmas, key)) Reflect.set(christmas, key, value);
        updateChristmas();
        syncControls();
      } else if (path === 'preset') {
        weather.setPreset(input.value as PresetName);
        syncControls();
      } else applyPatch(patchPath(path, value));
    },
  );
}
get<HTMLInputElement>('#light-color').addEventListener('input', updateChristmas);
get<HTMLInputElement>('#plough-speed').addEventListener('input', (event) => {
  get('#plough-speed-value').textContent = `${(event.target as HTMLInputElement).value} px/s`;
});
for (const card of document.querySelectorAll<HTMLButtonElement>('[data-preset]'))
  card.addEventListener('click', () => {
    const name = card.dataset.preset as PresetName;
    weather.setPreset(name);
    if (name.startsWith('christmas') || name === 'north-pole') {
      christmas.lights = true;
      christmas.garlands = true;
      christmas.ornaments = true;
      updateChristmas();
    }
    syncControls();
    notify(`${titleCase(name)} is in the forecast.`);
  });
on('copy-install', () => {
  void copy('npm install @fluritheme/fluri');
});

on('export-top', () => {
  switchTab('presets');
  openSettings();
  get<HTMLTextAreaElement>('#config-editor').focus();
});
on('pause', () => {
  if (destroyed) return;
  const state = weather.getMetrics().state;
  if (state === 'paused') {
    weather.resume();
    notify('The forecast continues.');
  } else {
    weather.pause();
    notify('A quiet moment. Weather paused.');
  }
});
on('reset', () => {
  disposeChristmas?.();
  weather.destroy();
  for (const key of [
    'lights',
    'garlands',
    'ornaments',
    'gifts',
    'icicles',
    'frost',
    'sparkle',
    'wreath',
    'candyCanes',
  ] as const)
    christmas[key] = false;
  create();
  resetCard();
  notify('A fresh forecast. Settings reset.');
});
on('add-snow', addSnow);
on('dock-gust', () => weather.trigger('gust'));

on('add-all', addSnow);
on('clear-all', () => weather.clearAccumulation());
on('dock-clear', () => weather.clearAccumulation());
on('festive-toggle', festive);
on('dock-plough', plough);
on('run-plough', plough);
on('dock-ball', snowball);
on('spawn-ball', snowball);
on('shake-surface', shakeSurface);
on('spawn-man', snowman);
on('spawn-yeti', meetYeti);
on('dock-yeti', meetYeti);
on('break-balls', () => {
  weather.trigger('snowburst');
  notify('Snowballs scattered back into the snowfall.');
});

on('scene-about', () =>
  showInfo(
    'Winter, with a little intelligence.',
    'Fluri measures supported DOM surfaces and keeps snow in their local space. Deposits follow moving cards, and displaced snow can land on another edge. CSS layer ordering is approximated, with explicit overrides for complex layouts.',
  ),
);
on('scene-guide', () =>
  showInfo(
    'A small guide to playing.',
    'Add snow to the two platforms. Drag the labeled handle to move the top platform, or focus the handle and use arrow keys. Shake it to test momentum. On desktop, drag the corner to resize. Hold Shift and drag near snow to gather a ball, then release to throw. Snowman creation is available in Settings → Interact.',
    'A LITTLE PLAY',
  ),
);
on('scene-code', () => {
  switchTab('presets');
  openSettings();
});

on('dialog-close', () => get<HTMLDialogElement>('#info-dialog').close());
on('open-layer-modal', () =>
  showInfo(
    'A layer above the snow.',
    'This is a real native dialog in the browser top layer. Its backdrop and stacking behavior belong to the browser. Fluri preserves native focus and interaction, and documents the limits of rendering across top-layer boundaries.',
    'LAYER CHALLENGE',
  ),
);
const compactLayout = matchMedia('(max-width: 960px)');
const settingsDialog = get<HTMLDialogElement>('#settings-dialog');
const sidebar = get<HTMLElement>('#sidebar');
let settingsOrigin: HTMLElement | null = null;
let priorBodyOverflow = '';
function openSettings() {
  if (!compactLayout.matches) return;
  if (settingsDialog.open) return;
  settingsOrigin = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  priorBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  settingsDialog.showModal();
  get<HTMLButtonElement>('#toggle-sidebar').setAttribute('aria-expanded', 'true');
  get<HTMLButtonElement>('#close-sidebar').focus();
}
function closeSidebar(restoreFocus = true) {
  if (!settingsDialog.open) return;
  const origin = settingsOrigin;
  settingsDialog.close();
  if (restoreFocus)
    requestAnimationFrame(() => {
      // Native dialog closure can restore focus before this frame. Do not steal it
      // back if the user has already moved on to another control.
      const active = document.activeElement;
      if (active === document.body || (active && settingsDialog.contains(active)))
        origin?.focus({ preventScroll: true });
    });
}
function syncSettingsPlacement() {
  if (compactLayout.matches) {
    get<HTMLElement>('#moving-card').style.width = '';
    get<HTMLElement>('#moving-card').style.maxWidth = '';
    if (sidebar.parentElement !== settingsDialog) settingsDialog.append(sidebar);
    sidebar.insertBefore(get('.scene-picker'), get('.panel-nav'));
  } else {
    closeSidebar(false);
    get('.workspace').insertBefore(sidebar, get('.main'));
    get('.preview-toolbar').prepend(get('.scene-picker'));
  }
}
settingsDialog.addEventListener('close', () => {
  document.body.style.overflow = priorBodyOverflow;
  get<HTMLButtonElement>('#toggle-sidebar').setAttribute('aria-expanded', 'false');
});
settingsDialog.addEventListener('click', (event) => {
  const rect = settingsDialog.getBoundingClientRect();
  if (
    event.target === settingsDialog &&
    (event.clientY < rect.top ||
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY > rect.bottom)
  )
    closeSidebar();
});
on('close-sidebar', () => closeSidebar());
on('toggle-sidebar', openSettings);
compactLayout.addEventListener('change', () => {
  syncSettingsPlacement();
  resetCard();
});
syncSettingsPlacement();
on('apply-selectors', () => {
  const error = get('#selector-error');
  try {
    const include = get<HTMLInputElement>('#include-selector').value.trim();
    const exclude = get<HTMLInputElement>('#exclude-selector').value.trim();
    if (include) document.querySelectorAll(include);
    if (exclude) document.querySelectorAll(exclude);
    weather.updateConfig({
      dom: { include: include ? [include] : [], exclude: exclude ? [exclude] : [] },
    });
    error.textContent = '';
    syncControls();
    notify('Surface selectors updated.');
  } catch (cause) {
    error.textContent = cause instanceof Error ? cause.message : 'Invalid selectors.';
  }
});
on('save-preset', () => {
  try {
    localStorage.setItem('fluri:configuration:v1', currentJSON());
    notify('Your forecast is saved in this browser.');
  } catch {
    notify('This browser does not allow local storage. Export JSON instead.');
  }
});
on('load-preset', () => {
  try {
    const saved = localStorage.getItem('fluri:configuration:v1');
    if (!saved) {
      notify('No saved forecast yet. Save your settings first.');
      return;
    }
    const parsed: unknown = JSON.parse(saved);
    weather.updateConfig(parsed as WeatherOptions);
    syncControls();
    notify('Your saved forecast is back.');
  } catch (error) {
    notify(error instanceof Error ? error.message : 'Could not load saved configuration.');
  }
});
on('apply-config', () => {
  const error = get('#config-error');
  try {
    const parsed: unknown = JSON.parse(get<HTMLTextAreaElement>('#config-editor').value);
    weather.updateConfig(parsed as WeatherOptions);
    syncControls();
    error.textContent = '';
    notify('Configuration applied.');
  } catch (cause) {
    error.textContent = cause instanceof Error ? cause.message : 'Invalid configuration.';
  }
});
on('copy-json', () => {
  void copy(currentJSON());
});
on('copy-ts', () => {
  void copy(currentTS());
});
on('download-config', () => {
  const url = URL.createObjectURL(new Blob([currentJSON()], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'fluri.config.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
on('stop-engine', () => {
  weather.stop();
  notify('Weather stopped. Configuration retained.');
});
on('destroy-engine', () => {
  disposeChristmas?.();
  disposeChristmas = undefined;
  weather.destroy();
  destroyed = true;
  notify('Engine destroyed. Canvas, observers, and listeners released.');
});
on('start-engine', () => {
  if (destroyed) {
    const config = weather.getConfig();
    create(config);
  } else weather.start();
  notify('A little winter is back.');
});
function setScene(value: string) {
  const stress = value === 'stress';
  get('#stress-host').classList.toggle('hidden', !stress);
  get('#scene-cards').classList.toggle('hidden', stress);
  if (stress) {
    const grid = get('#stress-grid');
    if (!grid.childElementCount) {
      const fragment = document.createDocumentFragment();
      for (let i = 0; i < 1000; i++) {
        const cell = document.createElement('div');
        cell.className = 'stress-cell';
        cell.dataset.weatherSurface = '';
        cell.textContent = String(i + 1).padStart(4, '0');
        fragment.append(cell);
      }
      grid.append(fragment);
    }
    notify('1,000 real DOM nodes. Open Quality to inspect measurements.');
  }
  if (value === 'layers')
    showInfo(
      'Put the layers to the test.',
      'This native modal sits in the browser top layer. Close it, enable the geometry inspector in Layers, and drag the first card over the others to inspect surface and clipping behavior.',
      'LAYER CHALLENGE',
    );
}
get<HTMLSelectElement>('#scene-select').addEventListener('change', (event) =>
  setScene((event.target as HTMLSelectElement).value),
);
on('stress-button', () => {
  get<HTMLSelectElement>('#scene-select').value = 'stress';
  setScene('stress');
});
const moving = get<HTMLElement>('#moving-card');
const dragHandle = get<HTMLButtonElement>('#drag-handle');
let drag: { id: number; x: number; y: number; originX: number; originY: number } | undefined;
let cardX = 0,
  cardY = 0;
function positionCard(angle = 0) {
  moving.style.transform = `translate(${cardX}px, ${cardY}px) rotate(${angle}deg)`;
  moving.style.zIndex = cardX || cardY ? '3' : '';
}
function resetCard() {
  if (shakeFrame !== undefined) cancelAnimationFrame(shakeFrame);
  shakeFrame = undefined;
  moving.style.width = '';
  moving.style.maxWidth = '';
  cardX = 0;
  cardY = 0;
  positionCard();
}
dragHandle.addEventListener('pointerdown', (event) => {
  if (event.shiftKey || event.button !== 0) return;
  drag = {
    id: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    originX: cardX,
    originY: cardY,
  };
  dragHandle.setPointerCapture(event.pointerId);
});
dragHandle.addEventListener('pointermove', (event) => {
  if (!drag || drag.id !== event.pointerId) return;
  const stage = get<HTMLElement>('#scene-cards');
  const originLeft = moving.offsetLeft;
  const maxX = stage.clientWidth - originLeft - moving.offsetWidth;
  cardX = Math.max(-originLeft + 6, Math.min(maxX - 6, event.clientX - drag.x + drag.originX));
  cardY = Math.max(-18, Math.min(76, event.clientY - drag.y + drag.originY));
  positionCard();
});
function endDrag() {
  drag = undefined;
}
dragHandle.addEventListener('pointerup', endDrag);
dragHandle.addEventListener('pointercancel', endDrag);
dragHandle.addEventListener('keydown', (event) => {
  const movements: Record<string, [number, number]> = {
    ArrowLeft: [-12, 0],
    ArrowRight: [12, 0],
    ArrowUp: [0, -12],
    ArrowDown: [0, 12],
  };
  const movement = movements[event.key];
  if (movement) {
    event.preventDefault();
    const stage = get<HTMLElement>('#scene-cards');
    cardX = Math.max(
      -moving.offsetLeft + 6,
      Math.min(stage.clientWidth - moving.offsetLeft - moving.offsetWidth - 6, cardX + movement[0]),
    );
    cardY = Math.max(-18, Math.min(76, cardY + movement[1]));
    positionCard();
  }
  if (event.key === 'Home') resetCard();
});
let shakeFrame: number | undefined;
function shakeSurface() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    notify(
      'Shake follows your reduced-motion preference. You can still move the surface directly.',
    );
    return;
  }
  if (shakeFrame !== undefined) cancelAnimationFrame(shakeFrame);
  const origin = cardX;
  const started = performance.now();
  const shake = (time: number) => {
    const progress = Math.min(1, (time - started) / 550);
    const amplitude = Math.pow(1 - progress, 2);
    cardX = origin + Math.sin(progress * Math.PI * 10) * 17 * amplitude;
    positionCard(Math.sin(progress * Math.PI * 8) * 3 * amplitude);
    if (progress < 1) shakeFrame = requestAnimationFrame(shake);
    else {
      cardX = origin;
      positionCard();
      shakeFrame = undefined;
    }
  };
  shakeFrame = requestAnimationFrame(shake);
}
on('release-card', shakeSurface);
const resizeHandle = get<HTMLButtonElement>('#resize-handle');
let resizing: { id: number; x: number; width: number } | undefined;
function resizeSurface(width: number) {
  const stage = get<HTMLElement>('#scene-cards');
  moving.style.maxWidth = 'none';
  moving.style.width = `${Math.max(230, Math.min(stage.clientWidth - moving.offsetLeft - 10, width))}px`;
}
resizeHandle.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
  resizing = { id: event.pointerId, x: event.clientX, width: moving.offsetWidth };
  resizeHandle.setPointerCapture(event.pointerId);
});
resizeHandle.addEventListener('pointermove', (event) => {
  if (resizing?.id === event.pointerId) resizeSurface(resizing.width + event.clientX - resizing.x);
});
resizeHandle.addEventListener('pointerup', () => {
  resizing = undefined;
});
resizeHandle.addEventListener('pointercancel', () => {
  resizing = undefined;
});
resizeHandle.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    resizeSurface(moving.offsetWidth + (event.key === 'ArrowRight' ? 15 : -15));
  }
});
const history: number[] = [];
function metrics() {
  const value = weather.getMetrics();
  const state = value.state;
  get('#status-text').textContent =
    state === 'running'
      ? 'Weather is live'
      : state === 'destroyed'
        ? 'Engine destroyed'
        : state === 'paused'
          ? 'Weather paused'
          : state === 'stopped'
            ? 'Weather stopped'
            : 'Engine ready';
  get('#engine-status').classList.toggle('paused', state !== 'running');
  get('#metric-fps').textContent = Number.isFinite(value.fps) ? String(Math.round(value.fps)) : '—';
  get('#metric-particles').textContent = String(value.particleCount);
  get('#metric-surfaces').textContent = String(value.surfaceCount);
  get<HTMLButtonElement>('#pause').innerHTML =
    state === 'paused' ? '▷ <span>Resume</span>' : 'Ⅱ <span>Pause</span>';
  get<HTMLButtonElement>('#pause').setAttribute(
    'aria-label',
    state === 'paused' ? 'Resume weather' : 'Pause weather',
  );
  history.push(value.fps);
  if (history.length > 70) history.shift();
  const canvas = get<HTMLCanvasElement>('#metrics-chart');
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#276471';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    history.forEach((fps, index) => {
      const x = (index / 69) * canvas.width;
      const y = canvas.height - 5 - (Math.min(120, fps) / 120) * (canvas.height - 10);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }
  const rows: [string, keyof WeatherMetrics, string][] = [
    ['Frame time', 'frameTime', 'ms'],
    ['Simulation', 'simTime', 'ms'],
    ['Rendering', 'renderTime', 'ms'],
    ['Geometry scan', 'geometryScanTime', 'ms'],
    ['Collision checks', 'collisionChecks', ''],
    ['Adaptive quality', 'quality', ''],
    ['Effective particle budget', 'particleBudget', ''],
    ['Snow mass', 'snowMass', ''],
    ['Snowballs', 'snowballCount', ''],
    ['Snowmen', 'snowmanCount', ''],
  ];
  const container = get('#performance-metrics');
  container.replaceChildren(
    ...rows.map(([label, key, unit]) => {
      const row = document.createElement('div');
      row.className = 'metric-row';
      const name = document.createElement('span');
      name.textContent = label;
      const number = document.createElement('strong');
      const raw = value[key];
      number.textContent = `${typeof raw === 'number' ? Number(raw.toFixed(2)) : raw}${unit ? ' ' + unit : ''}`;
      row.append(name, number);
      return row;
    }),
  );
}
create();
metrics();
let metricsTimer = setInterval(metrics, 500);
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', syncControls);
window.addEventListener('pagehide', () => {
  if (shakeFrame !== undefined) cancelAnimationFrame(shakeFrame);
  clearInterval(metricsTimer);
  clearTimeout(toastTimer);
  disposeChristmas?.();
  disposeChristmas = undefined;
  weather.destroy();
  destroyed = true;
});
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    create(weather.getConfig());
    metrics();
    metricsTimer = setInterval(metrics, 500);
  }
});
