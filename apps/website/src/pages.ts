import { structuredData } from './seo';
export interface LegalPage {
  path: string;
  title: string;
  description: string;
  label: string;
  sections: { id: string; title: string; html: string }[];
}
export interface WebsiteOptions {
  origin: string;
  version: string;
  legalUpdatedAt: string;
  legalPages: readonly LegalPage[];
}
export interface WebsitePage {
  path: string;
  title: string;
  description: string;
  html: string;
}
export function escapeHTML(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character] ?? character;
  });
}
const arrow = '<span aria-hidden="true">↗</span>';
const flake =
  '<svg viewBox="0 0 40 40" fill="none" aria-hidden="true"><g stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 3v34M5.3 11.5l29.4 17M5.3 28.5l29.4-17M14 7l6 6 6-6M14 33l6-6 6 6M6 19l8-2-2-8M28 31l-2-8 8-2M6 21l8 2-2 8M28 9l-2 8 8 2"/></g></svg>';
const icons = {
  surface:
    '<rect x="3" y="8" width="26" height="17" rx="4"/><path d="M3 8c6-4 8 2 14-1s8-2 12 1M9 15h8M9 19h13"/>',
  wind: '<path d="M3 11h19c7 0 7-8 2-8-3 0-4 2-4 3M3 17h24c5 0 5 7 0 7M3 23h12c6 0 6 7 1 7"/>',
  pointer: '<path d="m8 3 18 16-10 1-5 9-3-26Z"/><path d="m18 20 5 8"/>',
  code: '<path d="m10 8-7 8 7 8M22 8l7 8-7 8M19 4l-6 24"/>',
  control: '<path d="M6 3v26M16 3v26M26 3v26M2 10h8M12 22h8M22 13h8"/>',
  leaf: '<path d="M26 4C7 2 2 11 7 21c8 7 21 2 19-17ZM5 28 22 11M13 21v-7M16 18h7"/>',
};
function icon(key: keyof typeof icons): string {
  return `<svg class="line-icon" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[key]}</svg>`;
}
function button(href: string, label: string, primary = false): string {
  return `<a class="button ${primary ? 'button-dark' : 'button-outline'}" href="${href}">${label}${arrow}</a>`;
}
function sectionTitle(eyebrow: string, title: string, copy = ''): string {
  return `<div class="section-heading"><div><p class="eyebrow">${eyebrow}</p><h2>${title}</h2></div>${copy ? `<p class="section-intro">${copy}</p>` : ''}</div>`;
}
function pageHeading(eyebrow: string, title: string, copy: string): string {
  return `<section class="page-heading container"><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p class="page-intro">${copy}</p></section>`;
}
function codeBlock(code: string, label: string, id: string): string {
  return `<div class="code-block"><div class="code-bar"><span>${label}</span><button class="copy-button" data-copy-target="${id}" aria-label="Copy ${escapeHTML(label)}">Copy <span aria-hidden="true">▢</span></button></div><pre><code id="${id}">${escapeHTML(code)}</code></pre></div>`;
}
const typescript = `import { createWeather } from '@fluritheme/fluri';\n\nconst weather = createWeather({\n  preset: 'gentle-snow',\n  dom: { detection: 'explicit' },\n});\n\nweather.start();\n\n// Release the effect when your page unmounts.\nwindow.addEventListener('pagehide', () => {\n  weather.destroy();\n}, { once: true });`;
const react = `import { useFluri } from '@fluritheme/fluri-react';\n\nexport function WinterPage() {\n  const weather = useFluri({\n    preset: 'gentle-snow',\n    dom: { detection: 'explicit' },\n  });\n\n  return (\n    <article data-weather-surface>\n      <h1>A little winter.</h1>\n      <button onClick={() => weather.current?.pause()}>\n        Pause snow\n      </button>\n    </article>\n  );\n}`;
const vue = `<script setup lang="ts">\nimport { onMounted, onBeforeUnmount } from 'vue';\nimport { createWeather } from '@fluritheme/fluri';\n\nconst weather = createWeather({ preset: 'gentle-snow' });\nonMounted(() => weather.start());\nonBeforeUnmount(() => weather.destroy());\n</script>\n\n<template>\n  <article data-weather-surface>A little winter.</article>\n</template>`;
function frameworkCode(prefix: string): string {
  return `<div class="integration-panel" data-code-tabs><div class="integration-tabs" role="tablist" aria-label="Framework examples">${['TypeScript', 'React', 'Vue'].map((name, index) => `<button type="button" role="tab" id="${prefix}-tab-${index}" aria-selected="${index === 0}" aria-controls="${prefix}-panel-${index}" tabindex="${index === 0 ? 0 : -1}">${name}</button>`).join('')}</div><div class="integration-panels">${[typescript, react, vue].map((code, index) => `<div role="tabpanel" id="${prefix}-panel-${index}" aria-labelledby="${prefix}-tab-${index}" ${index ? 'hidden' : ''}>${codeBlock(code, `${['TypeScript', 'React', 'Vue'][index]} integration`, `${prefix}-code-${index}`)}</div>`).join('')}</div></div>`;
}
function demo(kind: 'hero' | 'showcase' | 'features'): string {
  return `<section class="live-demo ${kind === 'showcase' ? 'showcase-demo' : ''}" aria-label="Live interactive snow preview"><div class="demo-topline"><span><i class="status-dot"></i> <span id="demo-status">Live preview</span></span><span class="demo-top-hint">The real Fluri engine</span></div><div class="snow-scene" id="snow-scene" data-scene="${kind}"><img class="scene-art" src="/art/winter-window.svg" width="1200" height="780" alt="" fetchpriority="${kind === 'hero' ? 'high' : 'auto'}"/><div class="scene-label"><span class="scene-small">A FORECAST OF YOUR OWN</span><strong id="forecast-title">A little winter.<br/>A lot of wonder.</strong></div><article class="snow-card snow-card-main" id="moving-card" data-weather-surface data-weather-snow-depth="18" data-holiday-lights data-holiday-garland><div class="snow-card-top"><span class="tiny-label">LET IT SETTLE</span><button class="drag-handle" id="drag-handle" aria-label="Move snowy card. Drag or use arrow keys; Home to reset."><span aria-hidden="true">↔</span> Move</button></div><h3>Made for your interface.</h3><p>Snow follows the surface.<br/>Give it a little nudge.</p><span class="card-spark" aria-hidden="true">✳</span></article><div class="catching-shelf" data-weather-surface data-weather-snow-depth="12" data-plough-route data-holiday-lights><span>${flake} A soft place to land.</span><span aria-hidden="true">↳</span></div></div><div class="demo-bottom"><div class="demo-tools"><button type="button" id="demo-add">${flake}<span>Add snow</span></button><button type="button" id="demo-gust">${icon('wind')}<span>A little wind</span></button><button type="button" id="demo-clear"><span aria-hidden="true">↺</span><span>Clear</span></button></div><button type="button" class="demo-pause" id="demo-pause" aria-pressed="false">Ⅱ <span>Pause</span></button></div><p class="demo-instruction">Drag the handle to move the card. <span class="desktop-hint">${kind === 'showcase' ? 'Brush an edge to clear the snow.' : 'Brush an edge. Shift + drag to roll a snowball.'}</span></p></section>`;
}
function closing(): string {
  return `<section class="closing container"><div class="closing-flake" aria-hidden="true">${flake}</div><p class="eyebrow">SMALL DETAILS. LASTING IMPRESSIONS.</p><h2>Make room for<br/><em>a little wonder.</em></h2><p>Your website. Your forecast.</p><div class="button-row">${button('/playground/', 'Find your winter', true)}<a class="text-link" href="/docs/">Read the docs <span aria-hidden="true">→</span></a></div></section>`;
}
function home(): string {
  return `<section class="winter-hero"><div class="container winter-meta"><span>01 / WINTER BY FLURI</span><span>CHANGE THE FORECAST.</span><a href="https://fluri.xyz/">ALL THEMES ↗</a></div><div class="container snow-scene winter-snow-scene" id="snow-scene" data-scene="hero"><h1>winter.</h1><div class="winter-hero-story"><div><h2>A QUIETER MORNING.<br/>A LITTLE WINTER MAGIC.</h2><p>Real snow. Real surfaces. A whole new season for your website. Brush a little powder, make a snowball, and let it settle in.</p></div><article class="snow-card snow-card-main winter-live-surface" id="moving-card" data-weather-surface data-weather-snow-depth="18"><div class="snow-card-top"><span class="tiny-label">YOUR INTERFACE. A NEW FORECAST.</span><button class="drag-handle" id="drag-handle" aria-label="Move snowy card. Drag or use arrow keys; Home to reset.">MOVE ↔</button></div><h3>Give it a little nudge.</h3><p>Drag the edge. Brush the snow.<br/>Shift + drag to roll a snowball.</p></article></div><div class="catching-shelf winter-main-link" data-weather-surface data-weather-snow-depth="12" data-plough-route><a href="/playground/">OPEN THE PLAYGROUND <span aria-hidden="true">↗</span></a></div></div><div class="container winter-tools"><div class="demo-tools"><button type="button" id="demo-add">ADD SNOW +</button><button type="button" id="demo-gust">A LITTLE WIND ↗</button><button type="button" id="demo-clear">CLEAR ↺</button></div><button type="button" class="demo-pause" id="demo-pause" aria-pressed="false">Ⅱ <span>Pause</span></button></div><div class="container winter-bottomline"><span><span class="status-dot"></span> <span id="demo-status">LIVE WEATHER</span></span><a href="/docs/">DOCUMENTATION ↗</a><button type="button" data-copy-target="winter-install">npm i @fluritheme/fluri <span aria-hidden="true">⧉</span></button><code id="winter-install" hidden>npm install @fluritheme/fluri</code></div></section>
  <div class="framework-band container"><p>A LITTLE WINTER, IN YOUR STACK.</p><div><span class="framework-word">JavaScript<span class="framework-symbol">JS</span></span><span class="framework-word">TypeScript<span class="framework-symbol">TS</span></span><span class="framework-word"><span class="react-symbol" aria-hidden="true">⚛</span> React</span><span class="framework-word"><span class="vue-symbol" aria-hidden="true">∨</span> Vue</span><span class="framework-word">Next.js</span><span class="framework-word">Your framework<span aria-hidden="true">↗</span></span></div></div>
  <section class="section container" id="how-it-works">${sectionTitle('MORE THAN A FALLING EFFECT', 'Snow with a sense<br/>of <em>where it belongs.</em>', 'Most snow stops at the screen. Fluri gives it a place in your interface — and lets your visitors become part of the forecast.')}<div class="feature-triptych"><article><div class="feature-illustration surface-illustration" aria-hidden="true"><div class="mini-snow"></div><div class="mini-card"><span></span><span></span></div><div class="measurement">surface / local coordinates</div></div><div class="feature-content">${icon('surface')}<h3>It finds your edges.</h3><p>Snow gathers along supported cards, navigation bars, and buttons. Move the element; the snow comes along.</p></div></article><article><div class="feature-illustration pointer-illustration" aria-hidden="true"><div class="pointer-trail"></div><div class="illustration-pointer">${icon('pointer')}</div><span class="powder p1"></span><span class="powder p2"></span><span class="powder p3"></span><span class="powder p4"></span><div class="measurement">brush / gather / throw</div></div><div class="feature-content">${icon('pointer')}<h3>It invites a little play.</h3><p>Brush a fresh edge, gather a snowball, or send a snowplough across a shelf. A small interaction can change the scene.</p></div></article><article><div class="feature-illustration control-illustration" aria-hidden="true"><div><span>Snowfall</span><span>0.65</span><i></i></div><div><span>A little breeze</span><span>0.12</span><i></i></div><div class="measurement">your website / your forecast</div></div><div class="feature-content">${icon('control')}<h3>It feels like your own.</h3><p>Choose from ten presets. Tune the wind, flakes, and snow depth, then export your configuration from the playground.</p></div></article></div><a class="text-link feature-more" href="/features/">Meet the engine behind the atmosphere <span aria-hidden="true">→</span></a></section>
  <section class="night-section"><div class="container night-layout"><div class="night-art"><img src="/art/winter-night.svg" alt="Original illustration of a softly lit cabin in a moonlit winter forest" width="800" height="940" loading="lazy"/><span class="art-caption">A WARMER KIND OF WINTER</span></div><div class="night-copy"><p class="eyebrow">FOR THE SEASON. OR JUST THE FEELING.</p><h2>Quiet mornings.<br/>Festive evenings.<br/><em>Your kind of winter.</em></h2><p>A barely there dusting for a portfolio. A playful snowfall for a launch. A string of warm lights for the season. Start with a mood and make the details yours.</p><div class="mood-chips"><span>Gentle snow</span><span>Winter magic</span><span>Christmas night</span></div>${button('/showcase/', 'Explore the possibilities')}</div></div></section>
  <section class="section container integration-section" id="documentation"><div><p class="eyebrow">A FEW LINES TO THE FIRST FLAKE</p><h2>A small setup.<br/><em>A whole new season.</em></h2><p class="body-large">A framework independent core. Typed configuration. An explicit lifecycle. Start the weather when your page is ready, and clean up when it leaves.</p><a class="text-link" href="/docs/">Build your first snowfall <span aria-hidden="true">→</span></a><div class="integration-notes"><span>${icon('code')} TypeScript native</span><span>${icon('leaf')} No account or API key</span></div></div>${frameworkCode('home')}</section>
  <section class="principles container"><div><p class="eyebrow">A GOOD GUEST ON YOUR WEBSITE</p><h2>Delight, <em>with care.</em></h2></div><div class="principle-list"><article><span>01</span><div><h3>Your interface comes first.</h3><p>Pointer-transparent canvases preserve ordinary clicks and scrolling. Choose exactly which surfaces collect snow.</p></div></article><article><span>02</span><div><h3>Motion is always optional.</h3><p>Reduced-motion preferences are respected, hidden tabs suspend animation, and visitors can pause the preview.</p></div></article><article><span>03</span><div><h3>The forecast stays local.</h3><p>No weather API, geolocation, or engine telemetry. Pointer interaction is processed in browser memory.</p></div></article></div></section>${faq()}${closing()}`;
}
function faq(): string {
  const questions = [
    [
      'Does it work with my framework?',
      'The core uses browser APIs and works independently of your UI framework. Start it after the DOM mounts and destroy it during cleanup. The optional React adapter handles that lifecycle for you. The documentation includes TypeScript, React, and Vue examples.',
    ],
    [
      'Will snow get in the way of my website?',
      'The rendering overlay is pointer-transparent. Normal links, forms, and scrolling remain available. Use explicit surfaces and exclude important content with data-weather-ignore. Always test your own page and target devices.',
    ],
    [
      'Can I use it on a commercial project?',
      'Yes. Fluri uses the MIT license, which permits commercial use, modification, and redistribution while retaining its copyright and license notice. Read the full license for its conditions.',
    ],
    [
      'What about performance on mobile?',
      'Adaptive quality bounds snowfall by visible area and device input class, responds to late frames, and reduces rendering cost under pressure. You can also set particle, surface, DPR, and FPS budgets. Performance depends on your device and page; there is no universal frame-rate guarantee.',
    ],
    [
      'Is this a weather forecast service?',
      'Fluri is an interactive visual effect for websites. It simulates winter locally and does not fetch real weather or your location.',
    ],
  ];
  return `<section class="section container faq-section" id="faq"><div><p class="eyebrow">BEFORE THE FIRST FLAKE</p><h2>A few good<br/><em>questions.</em></h2><a class="text-link" href="/docs/#limitations">Read the practical details <span aria-hidden="true">→</span></a></div><div class="faq-list">${questions.map(([question, answer]) => `<details><summary>${question}<span aria-hidden="true">+</span></summary><p>${answer}</p></details>`).join('')}</div></section>`;
}
function features(): string {
  const capabilities: [keyof typeof icons, string, string][] = [
    [
      'surface',
      'Choose where winter lands.',
      'Automatic discovery for supported edges, or explicit attributes and JavaScript registration for predictable integration. Per-surface material, depth, and layer controls.',
    ],
    [
      'pointer',
      'Make it interactive.',
      'Brushing, gathering, throwing, snowballs, snowmen, and a tiny snowplough. Turn individual interactions on or off to suit your page.',
    ],
    [
      'wind',
      'Give it a forecast.',
      'Ten presets, runtime intensity controls, variable wind, gusts, flake styles, accumulation, and optional custom textures.',
    ],
    [
      'control',
      'Set a sensible budget.',
      'Adaptive ambient density, late-frame response, capped pixel ratio, bounded overflow particles, and inspectable runtime metrics.',
    ],
    [
      'leaf',
      'Respect the person visiting.',
      'Reduced-motion policy, hidden-tab suspension, optional pause controls, and complete teardown of listeners, observers, and overlays.',
    ],
    [
      'code',
      'Build on a typed API.',
      'A framework independent controller, a React adapter, lifecycle events, runtime updates, and a plugin API for your own ideas.',
    ],
  ];
  return `${pageHeading('MEET THE ENGINE', 'A little atmosphere.<br/><em>Real thought underneath.</em>', 'A winter effect should feel like part of your website. Here is how Fluri makes room for the snow without taking over the interface.')}<section class="container feature-demo-layout"><div><span class="detail-index">SURFACES &amp; PHYSICS</span><h2>It settles in.<br/><em>Then goes along.</em></h2><p>Fluri keeps snow in each surface’s local coordinates. Deposits follow translation, supported rotation, scrolling, and responsive geometry. A fast movement can shake some loose.</p><p>Uneven packing, rounded shoulders, wind, and granular flow shape each pile. Snow displaced from one supported edge can fall onto the next.</p><div class="inline-note">Try it here: add snow, then move the card with its handle.</div></div>${demo('features')}</section><section class="section container">${sectionTitle('THE DETAILS YOU CAN WORK WITH', 'Small moments.<br/><em>Useful controls.</em>')}<div class="capability-grid">${capabilities.map(([key, title, text]) => `<article>${icon(key)}<h3>${title}</h3><p>${text}</p></article>`).join('')}</div></section><section class="soft-section"><div class="container festive-feature"><img src="/art/winter-night.svg" width="800" height="940" alt="A warm cabin beneath snowy evergreens" loading="lazy"/><div><p class="eyebrow">A LITTLE EXTRA FOR THE HOLIDAYS</p><h2>Set the lights.<br/><em>Keep the choice.</em></h2><p>The optional Christmas module adds warm lights, garlands, ornaments, frost, icicles, gifts, wreaths, candy canes, and sparkles to the surfaces you label.</p><p>Decorations are deliberate. Add a data attribute where each belongs, and leave the rest of your page alone.</p>${button('/showcase/?preset=christmas-night', 'Try a festive forecast')}</div></div></section><section class="section container boundary-section"><div><p class="eyebrow">BUILT FOR THE BROWSER WE HAVE</p><h2>Thoughtful effects.<br/><em>Honest boundaries.</em></h2></div><div><p>Fluri approximates supported DOM geometry and painting order. It does not reproduce the browser compositor or a three-dimensional snow simulation.</p><p>Complex perspective transforms, arbitrary masks, closed shadow-root internals, cross-origin iframe contents, and some top-layer behavior have limits. Explicit surfaces give you more predictable results.</p><a class="text-link" href="/docs/#limitations">Read the integration limits <span aria-hidden="true">→</span></a></div></section>${closing()}`;
}
const moods = [
  ['gentle-snow', 'Gentle snow', 'A soft dusting. Room to breathe.', 'quiet'],
  ['winter-magic', 'Winter magic', 'A little glow. A little more wonder.', 'atmosphere'],
  ['snowstorm', 'Snowstorm', 'A stronger wind and a busy sky.', 'atmosphere'],
  ['frosted-glass', 'Frosted glass', 'Sparse crystals. A crisp winter morning.', 'quiet'],
  [
    'christmas-classic',
    'Christmas classic',
    'A familiar snowfall, ready for warm lights.',
    'festive',
  ],
  ['christmas-night', 'Christmas night', 'A cool, glowing sky after sunset.', 'festive'],
  ['north-pole', 'North pole', 'Deeper snow and room for snowballs.', 'playful'],
  ['minimal', 'Minimal', 'Small dots. The lightest touch.', 'quiet'],
  ['playful', 'Playful', 'Snowballs, snowmen, and a curious breeze.', 'playful'],
  ['cinematic', 'Cinematic', 'Large flakes, depth, and soft atmosphere.', 'atmosphere'],
] as const;
function showcase(): string {
  return `${pageHeading('THE WINTER COLLECTION', 'Find your<br/><em>kind of snowfall.</em>', 'Ten starting points. An entire season of possibilities. Pick a forecast below and see it running in the live scene.')}<section class="container collection-layout"><div class="collection-preview">${demo('showcase')}<div class="preview-description"><div><p class="eyebrow" id="selected-category">A QUIET START</p><h2 id="selected-name">Gentle snow</h2><p id="selected-description">A soft dusting. Room to breathe.</p></div><button class="button button-outline" id="copy-forecast">Copy configuration ${arrow}</button></div><p class="collection-note">These are live engine presets. The illustration sets the scene; the falling and accumulated snow is simulated. Festive presets also enable explicitly placed lights and garlands in this preview.</p></div><div class="collection-picker"><div class="filter-list" role="group" aria-label="Filter presets">${['all', 'quiet', 'atmosphere', 'festive', 'playful'].map((filter) => `<button class="filter-button" data-filter="${filter}" aria-pressed="${filter === 'all'}">${filter[0]?.toUpperCase()}${filter.slice(1)}</button>`).join('')}</div><div class="preset-list" role="group" aria-label="Choose a snowfall preset">${moods.map(([id, title, description, category], index) => `<button type="button" class="preset-choice" data-preset="${id}" data-category="${category}" aria-pressed="${index === 0}"><span class="preset-thumbnail mood-${category}" aria-hidden="true">${flake}<i></i><i></i><i></i></span><span><strong>${title}</strong><small>${description}</small></span><span class="preset-check" aria-hidden="true">${index === 0 ? '✓' : '↗'}</span></button>`).join('')}</div><p class="filter-status" role="status" id="filter-status">10 forecasts to explore</p><a class="text-link" href="/playground/">Fine-tune everything in the playground <span aria-hidden="true">→</span></a></div></section><section class="section container use-cases">${sectionTitle('A FEW PLACES WINTER FEELS AT HOME', 'Made for moments.<br/><em>Built into your world.</em>')}<div class="use-case-grid"><article><span>PORTFOLIOS &amp; PERSONAL SITES</span><h3>A quiet change of season.</h3><p>Keep your work in focus with a restrained snowfall, explicit surfaces, and a small particle budget.</p><a href="/showcase/?preset=minimal" class="text-link">Try Minimal →</a></article><article><span>LANDING PAGES &amp; LAUNCHES</span><h3>A moment to remember.</h3><p>Let a moving card catch a little snow. Add one playful interaction to a familiar interface.</p><a href="/showcase/?preset=playful" class="text-link">Try Playful →</a></article><article><span>SEASONAL EXPERIENCES</span><h3>A warmer welcome.</h3><p>Turn on a seasonal forecast and decorate selected surfaces with soft lights and garlands.</p><a href="/showcase/?preset=christmas-night" class="text-link">Try Christmas night →</a></article></div></section>${closing()}`;
}
function docs(version: string): string {
  const entries = [
    ['quick-start', 'Quick start'],
    ['frameworks', 'Frameworks'],
    ['surfaces', 'Snowy surfaces'],
    ['configuration', 'Configuration'],
    ['lifecycle', 'Lifecycle & controls'],
    ['christmas', 'Christmas module'],
    ['performance', 'Performance'],
    ['accessibility', 'Accessibility'],
    ['limitations', 'Browser limits'],
  ];
  return `${pageHeading('THE FIELD GUIDE', 'From the first flake<br/><em>to your own forecast.</em>', 'Install the package, choose a surface, and start the weather. Practical documentation for a considered integration.')}<div class="container docs-layout"><aside class="docs-sidebar" aria-label="Documentation contents"><span class="eyebrow">ON THIS PAGE</span><nav>${entries.map(([id, label]) => `<a href="#${id}">${label}</a>`).join('')}</nav><a class="reference-link" href="/reference/api-reference.md" download>Download full API reference ↗</a><span class="docs-version">VERSION ${escapeHTML(version)} · ESM</span></aside><div class="docs-content"><section id="quick-start"><span class="doc-kicker">GETTING STARTED</span><h2>Your first snowfall.</h2><p>Install Fluri from npm. The core works with JavaScript and TypeScript; add the optional adapter for React and Next.js. Versioned package archives are also available below.</p><div class="download-row"><a class="button button-dark" href="/downloads/fluritheme-fluri-${version}.tgz" download>Download core package <span aria-hidden="true">↓</span></a><a class="text-link" href="/downloads/fluritheme-fluri-react-${version}.tgz" download>React adapter ↓</a></div>${codeBlock('npm install @fluritheme/fluri', 'Install from npm', 'install-local')}<p>The core package is <code>@fluritheme/fluri</code>. The optional adapter is <code>@fluritheme/fluri-react</code>. These downloads contain compiled ESM, TypeScript declarations, README, and MIT licensing.</p>${codeBlock(typescript, 'Start in the browser', 'docs-start')}<div class="doc-callout"><strong>Start after the DOM exists.</strong><p>Importing the library and creating an idle controller are safe during server rendering. Call <code>start()</code> in the browser after mount. <code>autoStart</code> defaults to <code>false</code>.</p></div></section><section id="frameworks"><h2>Bring your own framework.</h2><p>The core uses browser APIs. Use the React adapter for automatic lifecycle cleanup, or pair the controller with your framework’s mount and unmount hooks.</p><p>For React, install both packages with React already in your application:</p>${codeBlock('npm install @fluritheme/fluri @fluritheme/fluri-react', 'Install the React adapter', 'install-react')}${frameworkCode('docs')}<p>Next.js integrations belong in a client component with <code>'use client'</code>. The React hook starts after mount and cleans up on unmount; it is safe with Strict Mode setup replay.</p></section><section id="surfaces"><h2>Give snow a place to land.</h2><p>For predictable behavior, choose explicit detection and label the elements you want to collect snow. Keep important controls and dense content clear.</p>${codeBlock('<article data-weather-surface data-weather-snow-depth="14">\n  Snow can settle here.\n</article>\n<section data-weather-ignore>\n  Keep this content clear.\n</section>', 'Choose surfaces in HTML', 'docs-surfaces')}${codeBlock("const unregister = weather.registerSurface(element, {\n  material: 'sticky',\n  maxSnowDepth: 12,\n  layer: 'content',\n});\n\n// Remove this registration when it is no longer needed.\nunregister();", 'Register a surface in JavaScript', 'docs-register')}<p>Supported materials: <code>flat</code>, <code>slippery</code>, <code>sticky</code>, and <code>no-accumulation</code>. Explicit surfaces can override depth, accumulation, layer, and clipping behavior.</p></section><section id="configuration"><h2>Set your forecast.</h2><p>Start from one of the ten presets and override only the values you need. Configuration is validated at runtime and fully typed.</p>${codeBlock("const weather = createWeather({\n  preset: 'gentle-snow',\n  snow: {\n    intensity: 0.45,\n    wind: { base: 0.12, gusts: true },\n    accumulation: { maxDepth: 14 },\n  },\n  dom: { detection: 'explicit', maxSurfaces: 60 },\n  performance: { adaptive: true, maxDPR: 1.5 },\n  accessibility: { reducedMotion: 'respect' },\n});", 'A considered starting point', 'docs-config')}<p>Use the <a href="/playground/">playground</a> to change options live and export validated JSON. The <a href="/reference/api-reference.md">complete API reference</a> documents defaults, ranges, attributes, events, and plugin hooks.</p></section><section id="participation"><h2>Share your website, on your terms.</h2><p>The library has no automatic installation reporting or visitor analytics. Owners can separately register a domain, verify control, and choose whether to share daily aggregate counts or request a public community listing. Website-owner approval does not replace any visitor consent required by the source analytics.</p><p><a href="/participate/">Register or manage a website ↗</a> · <a href="/reference/participation.md">Read the reporting and privacy guide ↗</a></p></section><section id="lifecycle"><h2>Keep control of the weather.</h2><div class="table-scroll"><table><caption>Common controller methods</caption><thead><tr><th>Method</th><th>What it does</th></tr></thead><tbody>${[
    ['start()', 'Create the overlays and start the simulation.'],
    ['pause() / resume()', 'Temporarily pause or resume the effect.'],
    ['stop()', 'Stop the animation and clear its visuals.'],
    ['destroy()', 'Release overlays, listeners, observers, and plugins.'],
    ['setIntensity(0.5)', 'Change snowfall intensity from 0 to 1.'],
    ["setPreset('minimal')", 'Switch preset at runtime.'],
    ['updateConfig(patch)', 'Apply a typed partial configuration.'],
    ['addSnow(8) / clearAccumulation()', 'Add deposited snow or clear it.'],
    ["trigger('gust')", 'Trigger an intentional effect.'],
    ['getMetrics()', 'Read runtime budgets, counts, state, and timings.'],
  ]
    .map(([method, meaning]) => `<tr><td><code>${method}</code></td><td>${meaning}</td></tr>`)
    .join(
      '',
    )}</tbody></table></div><p>Store the controller in your page or component lifecycle. Destroy it when the owning page or component leaves. A destroyed controller cannot be restarted; create a new instance for a new lifecycle.</p></section><section id="christmas"><h2>A little Christmas, on purpose.</h2><p>The Christmas module is a separate import. Choose its effects, then label the surfaces where each should appear.</p>${codeBlock("import { christmasPack } from '@fluritheme/fluri/christmas';\n\nconst removeChristmas = weather.use(christmasPack({\n  lights: { warmth: 0.9 },\n  garlands: true,\n  frost: true,\n}));\n\n// Remove this plugin independently when the season ends.\nremoveChristmas();", 'Enable seasonal effects', 'docs-christmas')}${codeBlock('<nav data-weather-surface\n     data-holiday-lights\n     data-holiday-garland>\n  A warmer welcome.\n</nav>', 'Place the decorations', 'docs-decorations')}<p>Other supported effects include ornaments, gifts, icicles, wreaths, sparkle, and candy canes. See the API reference for each option and attribute.</p></section><section id="performance"><h2>Leave room for the rest of your page.</h2><p>Keep adaptive performance enabled. It bounds the requested snowfall by visible area and device input class, responds to sustained late frames, and reduces rendering detail under pressure. Overflow parcels are bounded and coalesced.</p><ul><li>Start with a gentle or minimal preset and explicit surfaces.</li><li>Use <code>dom.maxSurfaces</code>, <code>snow.particleCount</code>, <code>performance.maxDPR</code>, and <code>performance.maxFPS</code> to set your budget.</li><li>Measure on your own page and physical target devices.</li><li>Inspect <code>getMetrics()</code> or the playground’s Quality panel.</li></ul><p>Performance depends on the browser, device, page styles, and effects. A local benchmark is not a cross-device guarantee.</p></section><section id="accessibility"><h2>Make motion optional.</h2><p>The default <code>accessibility.reducedMotion: 'respect'</code> honors the operating-system reduced-motion preference. Hidden tabs suspend animation. Offer visitors an accessible pause control if you add a continuous effect.</p>${codeBlock("const pause = document.querySelector('button');\npause?.addEventListener('click', () => {\n  const paused = weather.getMetrics().state === 'paused';\n  if (paused) weather.resume();\n  else weather.pause();\n  pause.setAttribute('aria-pressed', String(!paused));\n});", 'Connect your pause button', 'docs-pause')}<p>Snow is decorative. Keep important information in normal HTML, preserve readable contrast, and test keyboard and touch behavior with the effect running.</p></section><section id="limitations"><h2>Know the edges.</h2><p>Fluri uses an approximation of supported DOM geometry, clipping, and paint order. It cannot exactly reproduce arbitrary CSS composition or a true three-dimensional simulation.</p><ul><li>Closed shadow-root internals and cross-origin iframe contents are not inspectable.</li><li>Complex masks, perspective transforms, and some native top layers have limits.</li><li>Automatic surface detection is heuristic; use explicit registration for reliable control.</li><li>Browser emulation does not replace testing on a physical phone.</li></ul><a class="text-link" href="/reference/limitations.md">Read the complete limitations <span aria-hidden="true">↗</span></a></section></div></div>`;
}
function about(): string {
  return `${pageHeading('BEHIND THE SNOW', 'The web can use<br/><em>a little more wonder.</em>', 'Fluri is a small invitation to make an interface feel a little less ordinary. Thoughtful effects, a playful spirit, and room for the person on the other side of the screen.')}<section class="container about-story"><img src="/art/winter-night.svg" width="800" height="940" alt="A warm glow in a quiet winter landscape" loading="lazy"/><div><p class="eyebrow">WHY FLURI EXISTS</p><h2>For the small things<br/><em>people remember.</em></h2><p>A little snow on a familiar card. A cleared path after a brush of the mouse. A warm string of lights at the end of the year. Small details can give a website a sense of place.</p><p>Fluri brings that idea to the web as a TypeScript library: local snow simulation, surfaces that move with your interface, intentional interactions, and explicit controls for the developer.</p><p>It is made to be used thoughtfully. Choose the moments that need a little atmosphere. Keep content readable. Respect motion preferences. Let the rest of your website do its job.</p></div></section><section class="section container about-principles">${sectionTitle('A FEW THINGS WE BUILD AROUND', 'Playful in feeling.<br/><em>Considered in practice.</em>')}<div class="use-case-grid"><article>${icon('surface')}<h3>Belong to the page.</h3><p>Work with the interface people already know. Let the visual effect follow the content and its surfaces.</p></article><article>${icon('control')}<h3>Give people control.</h3><p>Make motion optional and keep the controls useful. A delightful detail should still be a good guest.</p></article><article>${icon('code')}<h3>Keep the doors open.</h3><p>MIT licensing, typed APIs, and readable documentation make it easier to understand, adapt, and build on the library.</p></article></div></section><section class="container contact-panel"><div><p class="eyebrow">SAY HELLO</p><h2>Built by<br/><em>František Gejdoš.</em></h2><p>Founder of <a href="https://fluri.xyz/">Fluri Themes</a>, and creator of Winter and Spider. <a href="https://fluri.xyz/founder/">Meet the founder ↗</a></p><p>Questions, thoughtful feedback, and winter experiments are welcome.</p><a class="text-link" href="mailto:fluritheme@gmail.com">fluritheme@gmail.com ${arrow}</a></div><div class="contact-emblem" aria-hidden="true">${flake}</div></section>${closing()}`;
}
function changelog(version: string): string {
  return `${pageHeading('A GROWING LITTLE FORECAST', 'What’s new<br/><em>in Fluri.</em>', 'Changes to the library, the playground, and the little details that make winter feel at home.')}<section class="container changelog-layout"><aside><span class="release-version">v${version}</span><p>Winter has a new home</p><time datetime="2026-11-08">8 November 2026</time></aside><article class="prose"><h2>A new home. A bolder winter.</h2><p>The website, playground, documentation and private dashboard now live at winter.fluri.xyz, with vivid purple styling and a redesigned live workshop. Fluri Themes has its own collection and founder homepage. Existing package names, APIs and dashboard access remain supported.</p><p>A framework independent snow engine, an interactive workshop, and the controls to make the forecast yours.</p><h3>Snow with somewhere to land</h3><ul><li>Surface-local accumulation with uneven packing profiles and rounded shoulders.</li><li>Supported movement, responsive geometry, clipping, and sampled occlusion.</li><li>Wind, granular flow, displaced snow, and transfer to lower surfaces.</li></ul><h3>A little room to play</h3><ul><li>Pointer brushing, snowballs, snowmen, and a snowplough for designated routes.</li><li>Ten presets and a live playground with configuration export.</li><li>Optional, explicitly placed Christmas decorations.</li></ul><h3>Considered integrations</h3><ul><li>TypeScript APIs, runtime configuration validation, and an optional React adapter.</li><li>Reduced-motion policy, hidden-tab suspension, and complete lifecycle cleanup.</li><li>Adaptive particle density, late-frame quality response, and bounded overflow.</li></ul><p>Install the core and optional React adapter from npm, or download versioned archives from the documentation page.</p>${button('/docs/', 'Explore the release', true)}</article></section>`;
}
function legal(page: LegalPage, updatedAt: string): string {
  return `${pageHeading('THE PRACTICAL DETAILS', page.title, page.description)}<div class="container legal-layout"><aside class="docs-sidebar"><span class="eyebrow">ON THIS PAGE</span><nav aria-label="Page contents">${page.sections.map((section) => `<a href="#${section.id}">${section.title}</a>`).join('')}</nav><span class="docs-version">UPDATED ${escapeHTML(updatedAt.toUpperCase())}</span></aside><article class="prose legal-prose">${page.sections.map((section) => `<section id="${section.id}"><h2>${section.title}</h2>${section.html}</section>`).join('')}</article></div>`;
}
function notFound(): string {
  return `<section class="container not-found"><span class="not-found-flake" aria-hidden="true">${flake}</span><p class="eyebrow">404 · A LITTLE OFF THE TRAIL</p><h1>This page<br/><em>drifted away.</em></h1><p>Let’s find a familiar path back to the snow.</p><div class="button-row">${button('/', 'Back to Fluri', true)}<a class="text-link" href="/showcase/">Explore the forecasts →</a></div></section>`;
}
function header(path: string): string {
  return `<a href="#main" class="skip-link">Skip to content</a><header class="site-header"><div class="container header-inner"><a class="brand" href="/" aria-label="Winter by Fluri home">${flake}<span>winter</span><span class="brand-period">.</span></a><nav id="primary-nav" class="primary-nav" aria-label="Main navigation">${[
    ['features/', 'Features'],
    ['showcase/', 'Showcase'],
    ['docs/', 'Docs'],
    ['about/', 'About'],
  ]
    .map(
      ([href, label]) =>
        `<a href="/${href}" ${path === href ? 'aria-current="page"' : ''}>${label}</a>`,
    )
    .join(
      '',
    )}<a href="https://fluri.xyz/">All themes ↗</a><a class="mobile-playground" href="/playground/">Open playground ${arrow}</a></nav><div class="header-actions"><a class="header-playground" href="/playground/">Playground ${arrow}</a><button type="button" class="menu-toggle" id="menu-toggle" aria-label="Open navigation" aria-expanded="false" aria-controls="primary-nav"><span></span><span></span></button></div></div></header>`;
}
function footer(): string {
  return `<footer class="site-footer"><div class="container footer-grid"><div class="footer-brand"><a class="brand" href="/">${flake}<span>winter</span><span class="brand-period">.</span></a><p>A little winter for the web.<br/>Made with care. Open by nature.</p><button type="button" id="motion-toggle" class="motion-toggle" aria-pressed="false"><span aria-hidden="true">◌</span> <span id="motion-label">Preview motion on</span></button></div><div><h2>Explore</h2><a href="https://fluri.xyz/">Fluri Themes ↗</a><a href="/features/">Features</a><a href="/showcase/">Showcase</a><a href="/playground/">Playground</a><a href="/community/">Community</a></div><div><h2>Build</h2><a href="/docs/">Documentation</a><a href="/changelog/">Changelog</a><a href="/participate/">Share your website</a><a href="/about/">About &amp; contact</a></div><div><h2>The details</h2><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a><a href="/cookies/">Cookies &amp; storage</a><a href="/license/">MIT license</a></div></div><div class="container footer-bottom"><span>© ${new Date().getFullYear()} Fluri contributors</span><span>Made for ordinary websites. And extraordinary little moments.</span><a href="#top">Back to the top ↑</a></div></footer><div class="toast" id="toast" role="status" aria-live="polite"></div>`;
}

function participation(): string {
  return `${pageHeading('WINTER, WITH PERMISSION', 'A place for<br/><em>your snowfall.</em>', 'Register your website, verify your domain, and choose what you share. Your visitors stay on your website.')}<section class="container participation-layout" aria-label="Website participation"><aside class="participation-aside"><span class="eyebrow">YOUR WEBSITE. YOUR CHOICE.</span><h2>A small footprint.<br/><em>A clear picture.</em></h2><ol class="participation-steps"><li><span>01</span><div><strong>Make it yours.</strong><p>Register a domain and confirm ownership with a DNS record.</p></div></li><li><span>02</span><div><strong>Share only totals.</strong><p>Optionally report daily effect impressions from your own lawful measurement.</p></div></li><li><span>03</span><div><strong>Choose to be featured.</strong><p>Public community listings need your separate permission and our review.</p></div></li></ol><a class="text-link" href="/reference/participation.md">Read the participation guide ↗</a><p class="fine-print">The snow library has no automatic reporting. Registration and analytics are optional. <a href="/privacy/">Privacy</a> · <a href="/terms/">Terms</a></p></aside><div class="participation-workspace"><div class="portal-switch" role="group" aria-label="Website access"><button type="button" id="register-tab" aria-pressed="true">Register a site</button><button type="button" id="manage-tab" aria-pressed="false">Manage your site</button></div><p id="participation-notice" class="service-notice" role="status" aria-live="polite"></p><section id="register-panel" class="service-card"><span class="eyebrow">START WITH YOUR DOMAIN</span><h2>Bring your winter.</h2><form id="register-site" class="service-form"><label>Website domain<input name="domain" type="text" inputmode="url" autocomplete="url" required maxlength="253" aria-describedby="domain-help"/></label><p class="field-help" id="domain-help">Enter the domain you control, without a path.</p><label>Website name<input name="displayName" type="text" required maxlength="80" autocomplete="organization"/></label><label>Contact email<input name="contactEmail" type="email" required maxlength="254" autocomplete="email"/></label><label class="check-field"><input name="analyticsEnabled" type="checkbox"/><span><strong>Share aggregate impressions</strong><small>Enable private reporting of daily totals. No browser tracker is added.</small></span></label><label class="check-field"><input name="showcasePermission" type="checkbox"/><span><strong>Consider my site for the community</strong><small>Allow Fluri to publicly link to this domain under its website name after review. Statistics stay private.</small></span></label><label class="check-field"><input name="analyticsAttestation" type="checkbox" required/><span>I am authorized to register this website and agree to the <a href="/terms/">participation terms</a>. Any totals I share come from lawful measurement and contain no visitor data.</span></label><button class="button button-dark" type="submit">Register my website <span aria-hidden="true">↗</span></button></form></section><section id="manage-panel" class="service-card" hidden><span class="eyebrow">WELCOME BACK</span><h2>Your forecast, in hand.</h2><p>Use the management key saved when you registered. It stays in memory for this page only.</p><form id="manage-site" class="service-form"><label>Management key<input name="managementToken" type="password" required autocomplete="off" spellcheck="false"/></label><button class="button button-dark" type="submit">Open my website <span aria-hidden="true">↗</span></button></form><p class="fine-print">Lost the key? Contact <a href="mailto:fluritheme@gmail.com">fluritheme@gmail.com</a> for ownership review.</p></section><section id="owner-workspace" hidden></section></div></section>`;
}
function dashboard(): string {
  return `${pageHeading('THE PRIVATE FORECAST', 'A little winter.<br/><em>A clearer view.</em>', 'Website traffic, npm downloads, and optional community reporting in one place.')}<section class="container dashboard-layout"><p id="dashboard-notice" class="service-notice" role="status" aria-live="polite"></p><section id="dashboard-login" class="service-card dashboard-login"><span class="eyebrow">FLURI OPERATOR ACCESS</span><h2>Welcome back.</h2><p>Sign in to view website traffic, package downloads, and participating websites.</p><form id="dashboard-login-form" class="service-form"><label>Dashboard access key<input name="password" type="password" required autocomplete="current-password"/></label><button class="button button-dark" type="submit">Open dashboard <span aria-hidden="true">↗</span></button></form><p class="fine-print">Protected with a secure, time-limited session. Website management keys cannot access this dashboard.</p></section><section id="dashboard-content" hidden></section></section>`;
}
function community(): string {
  return `${pageHeading('WINTER FINDS A HOME', 'Small details.<br/><em>Real websites.</em>', 'A growing collection of websites whose owners have chosen to share their Fluri integration.')}<section class="container community-section"><div class="community-intro"><div><p class="eyebrow">SHARED BY THEIR OWNERS</p><h2>A little inspiration,<br/><em>out in the world.</em></h2></div><div><p>Every listing has verified domain ownership and separate permission to appear here. Inclusion is reviewed by Fluri; it is not an endorsement by the listed website.</p><a class="button button-outline" href="/participate/">Share your website <span aria-hidden="true">↗</span></a></div></div><p id="community-notice" class="service-notice" role="status" aria-live="polite">Loading the community…</p><div id="community-sites" class="community-grid"></div><noscript><p class="empty-state">Enable JavaScript to load the current collection, or <a href="/participate/">register your website</a>.</p></noscript><div class="community-footnote"><span aria-hidden="true">✳</span><p>Want to explore the effect first? Our <a href="/showcase/">interactive preset showcase</a> has ten different forecasts to try.</p></div></section>`;
}

export function renderWebsite(options: WebsiteOptions): WebsitePage[] {
  const records = [
    {
      path: 'participate/',
      title: 'Participate — Share your winter · Fluri',
      description:
        'Register your website, verify your domain, and choose optional aggregate reporting and a public Fluri community listing.',
      body: participation(),
    },
    {
      path: 'dashboard/',
      title: 'Private dashboard · Fluri',
      description:
        'Private operator access to Fluri website traffic, npm downloads, and aggregate participation reporting.',
      body: dashboard(),
    },
    {
      path: 'community/',
      title: 'Community — Winter in the wild · Fluri',
      description:
        'Explore owner-approved websites using Fluri and share your own snow integration with the community.',
      body: community(),
    },
    {
      path: '',
      title: 'Fluri — Interactive snow effects for JavaScript, TypeScript & React',
      description:
        'Turn ordinary interfaces into little winter landscapes. Explore interactive snowfall, DOM-aware accumulation, and a playful TypeScript snow engine.',
      body: home(),
    },
    {
      path: 'features/',
      title: 'Features — Thoughtful snow for your interface · Fluri',
      description:
        'Discover Fluri’s surface-aware snow, interactions, adaptive performance, accessible motion controls, and optional Christmas effects.',
      body: features(),
    },
    {
      path: 'showcase/',
      title: 'Showcase — Find your kind of winter · Fluri',
      description:
        'Try all ten Fluri snowfall presets in a live interactive preview. From a minimal dusting to a glowing Christmas night, make the forecast yours.',
      body: showcase(),
    },
    {
      path: 'docs/',
      title: 'Documentation — Your first snowfall · Fluri',
      description:
        'Install Fluri, add snowy surfaces, and integrate the TypeScript snow engine with React, Vue, or your own framework. Read configuration and lifecycle guidance.',
      body: docs(options.version),
    },
    {
      path: 'about/',
      title: 'About — Behind the snow · Fluri',
      description:
        'Meet Fluri: a TypeScript snow library by Frantisek Gejdos, built around thoughtful effects, playful details, and an open MIT license.',
      body: about(),
    },
    {
      path: 'changelog/',
      title: 'Changelog — The latest forecast · Fluri',
      description:
        'Follow improvements to Fluri’s snow physics, interactive playground, framework integrations, performance, and seasonal effects.',
      body: changelog(options.version),
    },
    ...options.legalPages.map((page) => ({ ...page, body: legal(page, options.legalUpdatedAt) })),
    {
      path: '404.html',
      title: 'Page not found · Fluri',
      description: 'This page drifted away. Find your way back to Fluri.',
      body: notFound(),
    },
  ];
  return records.map(({ path, title: originalTitle, description, body }) => {
    const title = originalTitle.replace(/Fluri/g, 'Winter by Fluri');
    const canonical =
      options.origin && path !== '404.html' ? new URL(path, `${options.origin}/`).href : '';
    const meta = `<meta property="og:type" content="website"/><meta property="og:site_name" content="Winter by Fluri"/><meta property="og:title" content="${escapeHTML(title)}"/><meta property="og:description" content="${escapeHTML(description)}"/><meta name="twitter:card" content="summary_large_image"/><meta name="twitter:title" content="${escapeHTML(title)}"/><meta name="twitter:description" content="${escapeHTML(description)}"/><meta name="twitter:image" content="${escapeHTML(`${options.origin}/art/social-card.png`)}"/>${canonical ? `<link rel="canonical" href="${escapeHTML(canonical)}"/><meta property="og:url" content="${escapeHTML(canonical)}"/><meta property="og:image" content="${escapeHTML(`${options.origin}/art/social-card.png`)}"/><meta property="og:image:width" content="1200"/><meta property="og:image:height" content="630"/><meta property="og:image:alt" content="Fluri — A little winter for the web"/>` : ''}`;
    return {
      path,
      title,
      description,
      html: `<!doctype html><html lang="en" id="top"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><meta name="theme-color" content="#eff5f7"/><meta name="description" content="${escapeHTML(description)}"/>${path === '404.html' || path === 'dashboard/' ? '<meta name="robots" content="noindex,nofollow"/>' : ''}${meta}${structuredData(options.origin, path, title, description, options.version)}<link rel="icon" href="/fluri.svg" type="image/svg+xml"/><title>${escapeHTML(title)}</title><script type="module" src="/src/main.ts"></script></head><body data-page="${path || 'home'}">${header(path)}<main id="main" tabindex="-1">${body}</main>${footer()}</body></html>`,
    };
  });
}
