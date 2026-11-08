import type { PluginContext, PresetName, WeatherController } from '@fluritheme/fluri';
import './style.css';
import './participation';
import './winter-theme.css';

declare global {
  interface Window {
    __fluriSite?: WeatherController;
  }
}
document.documentElement.classList.add('js');

const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
let motionOff = false;
try {
  motionOff = localStorage.getItem('fluri:motion:v1') === 'off';
} catch {
  /* Storage can be unavailable in private contexts. */
}
let toastTimer: ReturnType<typeof setTimeout> | undefined;
function toast(message: string): void {
  const element = document.querySelector('#toast');
  if (!element) return;
  element.textContent = message;
  element.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove('visible'), 3500);
}
async function copy(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast('Copied. Bring a little winter with you.');
  } catch {
    toast('Clipboard unavailable. Select the visible code and copy it manually.');
  }
}
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-copy-target]')) {
  button.addEventListener('click', () => {
    const id = button.dataset.copyTarget;
    const element = id ? document.getElementById(id) : undefined;
    if (element?.textContent) void copy(element.textContent);
  });
}

const navigation = document.querySelector('#primary-nav');
const menuToggle = document.querySelector<HTMLButtonElement>('#menu-toggle');
function closeNavigation(restoreFocus = false): void {
  navigation?.classList.remove('is-open');
  menuToggle?.setAttribute('aria-expanded', 'false');
  menuToggle?.setAttribute('aria-label', 'Open navigation');
  if (restoreFocus) menuToggle?.focus();
}
menuToggle?.addEventListener('click', () => {
  const opening = menuToggle.getAttribute('aria-expanded') !== 'true';
  navigation?.classList.toggle('is-open', opening);
  menuToggle.setAttribute('aria-expanded', String(opening));
  menuToggle.setAttribute('aria-label', opening ? 'Close navigation' : 'Open navigation');
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && menuToggle?.getAttribute('aria-expanded') === 'true')
    closeNavigation(true);
});
document.addEventListener('pointerdown', (event) => {
  if (
    event.target instanceof Node &&
    !navigation?.contains(event.target) &&
    !menuToggle?.contains(event.target)
  )
    closeNavigation();
});
navigation?.addEventListener('click', (event) => {
  if (event.target instanceof Element && event.target.closest('a')) closeNavigation();
});
matchMedia('(min-width: 641px)').addEventListener('change', () => closeNavigation());

for (const group of document.querySelectorAll<HTMLElement>('[data-code-tabs]')) {
  const tabs = [...group.querySelectorAll<HTMLButtonElement>('[role=tab]')];
  function activate(tab: HTMLButtonElement): void {
    if (tab.getAttribute('aria-selected') === 'true') return;
    for (const candidate of tabs) {
      const selected = candidate === tab;
      candidate.setAttribute('aria-selected', String(selected));
      candidate.tabIndex = selected ? 0 : -1;
      const panel = document.getElementById(candidate.getAttribute('aria-controls') ?? '');
      if (panel) panel.hidden = !selected;
    }
  }
  for (const tab of tabs) {
    tab.addEventListener('click', () => activate(tab));
    tab.addEventListener('keydown', (event) => {
      let index = tabs.indexOf(tab);
      if (event.key === 'ArrowRight') index = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') index = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === 'Home') index = 0;
      else if (event.key === 'End') index = tabs.length - 1;
      else return;
      event.preventDefault();
      const target = tabs[index];
      if (target) {
        activate(target);
        target.focus();
      }
    });
  }
}

const scene = document.querySelector<HTMLElement>('#snow-scene');
let weather: WeatherController | undefined;
let initializing: Promise<WeatherController | undefined> | undefined;
let inView = false;
let destroyed = false;
let selectedPreset: PresetName = 'gentle-snow';
let removeHoliday: (() => void) | undefined;
let holidayRevision = 0;
const presetButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-preset]')];
const requestedPreset = new URLSearchParams(location.search).get('preset');
if (presetButtons.some((button) => button.dataset.preset === requestedPreset))
  selectedPreset = requestedPreset as PresetName;
function motionAllowed(): boolean {
  return !motionOff && !motionQuery.matches;
}
function updateMotionLabels(): void {
  const paused = !motionAllowed();
  document.querySelector('#motion-toggle')?.setAttribute('aria-pressed', String(paused));
  const label = document.querySelector('#motion-label');
  if (label)
    label.textContent = motionQuery.matches
      ? 'Motion reduced by device'
      : motionOff
        ? 'Preview motion off'
        : 'Preview motion on';
  const pause = document.querySelector('#demo-pause');
  pause?.setAttribute('aria-pressed', String(paused));
  const pauseLabel = pause?.querySelector('span');
  if (pauseLabel) pauseLabel.textContent = paused ? 'Resume' : 'Pause';
  const status = document.querySelector('#demo-status');
  if (status)
    status.textContent = motionQuery.matches
      ? 'Reduced motion'
      : motionOff
        ? 'Preview paused'
        : 'Live preview';
}
function reconcileMotion(): void {
  updateMotionLabels();
  if (weather) {
    if (motionAllowed() && inView) weather.resume();
    else weather.pause();
  } else if (scene && inView && motionAllowed()) void ensureWeather();
}
function changeMotion(): void {
  if (motionQuery.matches) {
    toast(
      'Your device’s reduced-motion preference is respected. You can still add a static layer of snow.',
    );
    return;
  }
  motionOff = !motionOff;
  try {
    localStorage.setItem('fluri:motion:v1', motionOff ? 'off' : 'on');
  } catch {
    /* The choice still applies for this page visit. */
  }
  reconcileMotion();
}
document.querySelector('#motion-toggle')?.addEventListener('click', changeMotion);
document.querySelector('#demo-pause')?.addEventListener('click', changeMotion);
motionQuery.addEventListener('change', reconcileMotion);
updateMotionLabels();

async function configureHoliday(controller: WeatherController): Promise<void> {
  const revision = ++holidayRevision;
  removeHoliday?.();
  removeHoliday = undefined;
  if (!selectedPreset.startsWith('christmas')) return;
  const { christmasPack } = await import('@fluritheme/fluri/christmas');
  if (!destroyed && revision === holidayRevision && selectedPreset.startsWith('christmas'))
    removeHoliday = controller.use(christmasPack({ lights: { warmth: 0.9 }, garlands: true }));
}
function installHeroPlough(controller: WeatherController): void {
  if (scene?.dataset.scene !== 'hero') return;
  let untilPass = 12;
  let direction: 'left' | 'right' = 'right';
  let context: PluginContext | undefined;
  controller.use({
    name: 'fluri-hero-snowplough',
    setup(value) {
      context = value;
      return controller.on('plough:complete', () => {
        untilPass = 24;
      });
    },
    update(dt) {
      if (!inView || !motionAllowed()) return;
      untilPass -= dt;
      if (untilPass > 0) return;
      const route = context
        ?.getSurfaces()
        .find((surface) => surface.element.matches('.catching-shelf'));
      if (!route) return;
      // Triggering a plough removes stored snow; it never paints a pretend cleared path.
      // Waiting for deposited mass also avoids sending an empty vehicle over a bare shelf.
      if (!route.accumulation || !route.profile.some((mass) => mass > 0.1)) {
        untilPass = 2;
        return;
      }
      controller.trigger('plough', {
        surface: route.element,
        direction,
        style: 'minimal',
        speed: Math.max(45, route.width / 4.5),
      });
      direction = direction === 'right' ? 'left' : 'right';
      untilPass = 30;
    },
  });
}
async function ensureWeather(): Promise<WeatherController | undefined> {
  if (weather) return weather;
  if (initializing) return initializing;
  if (!scene || destroyed) return undefined;
  initializing = (async () => {
    try {
      const { createWeather } = await import('@fluritheme/fluri');
      if (destroyed) return undefined;
      weather = createWeather({
        container: scene,
        preset: selectedPreset,
        seed: 2026,
        snow: { particleCount: 220, accumulation: { maxDepth: 18, growthRate: 0.6 } },
        dom: { detection: 'explicit', maxSurfaces: 8 },
        performance: { adaptive: true, maxDPR: 1.5, maxFPS: 60 },
        ...(scene.dataset.scene !== 'showcase'
          ? { interactions: { snowballs: { enabled: true }, snowman: { enabled: true } } }
          : {}),
        accessibility: { reducedMotion: 'respect', controls: false },
      });
      window.__fluriSite = weather;
      weather.start();
      if (!motionAllowed() || !inView) weather.pause();
      weather.addSnow(5);
      installHeroPlough(weather);
      await configureHoliday(weather);
      return weather;
    } catch {
      toast('The preview could not start. Refresh the page to try again.');
      return undefined;
    } finally {
      initializing = undefined;
    }
  })();
  return initializing;
}
if (scene) {
  const observer = new IntersectionObserver(
    (entries) => {
      inView = entries.some((entry) => entry.isIntersecting);
      reconcileMotion();
    },
    { rootMargin: '80px 0px', threshold: 0 },
  );
  observer.observe(scene);
  document.querySelector('#demo-add')?.addEventListener('click', () => {
    void ensureWeather().then((controller) => controller?.addSnow(8));
  });
  document.querySelector('#demo-gust')?.addEventListener('click', () => {
    if (!motionAllowed()) {
      toast('Resume the preview to try a little wind.');
      return;
    }
    void ensureWeather().then((controller) => controller?.trigger('gust'));
  });
  document
    .querySelector('#demo-clear')
    ?.addEventListener('click', () => weather?.clearAccumulation());
  window.addEventListener('pagehide', (event) => {
    if (event.persisted) {
      weather?.pause();
      return;
    }
    destroyed = true;
    observer.disconnect();
    clearTimeout(toastTimer);
    removeHoliday?.();
    weather?.destroy();
    delete window.__fluriSite;
  });
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) reconcileMotion();
  });
}

function showPresetChoice(): void {
  for (const button of presetButtons) {
    const selected = button.dataset.preset === selectedPreset;
    button.setAttribute('aria-pressed', String(selected));
    const check = button.querySelector('.preset-check');
    if (check) check.textContent = selected ? '✓' : '↗';
    if (!selected) continue;
    const name = document.querySelector('#selected-name');
    const description = document.querySelector('#selected-description');
    const category = document.querySelector('#selected-category');
    if (name) name.textContent = button.querySelector('strong')?.textContent ?? '';
    if (description) description.textContent = button.querySelector('small')?.textContent ?? '';
    if (category)
      category.textContent = `${button.dataset.category ?? 'winter'} forecast`.toUpperCase();
  }
  scene?.classList.toggle('festive-scene', selectedPreset.startsWith('christmas'));
  const illustration = scene?.querySelector<HTMLImageElement>('.scene-art');
  if (illustration)
    illustration.src = selectedPreset.startsWith('christmas')
      ? '/art/winter-night.svg'
      : '/art/winter-window.svg';
}
showPresetChoice();
for (const button of presetButtons) {
  button.addEventListener('click', () => {
    const preset = button.dataset.preset;
    if (!preset || !presetButtons.some((candidate) => candidate.dataset.preset === preset)) return;
    selectedPreset = preset as PresetName;
    const url = new URL(location.href);
    url.searchParams.set('preset', selectedPreset);
    history.replaceState(null, '', url);
    showPresetChoice();
    void ensureWeather().then(async (controller) => {
      if (!controller) return;
      controller.setPreset(selectedPreset, {
        container: scene ?? undefined,
        dom: { detection: 'explicit', maxSurfaces: 8 },
        performance: { adaptive: true, maxDPR: 1.5 },
        accessibility: { controls: false, reducedMotion: 'respect' },
      });
      await configureHoliday(controller);
      reconcileMotion();
    });
  });
}
for (const filter of document.querySelectorAll<HTMLButtonElement>('[data-filter]')) {
  filter.addEventListener('click', () => {
    const category = filter.dataset.filter;
    for (const button of document.querySelectorAll('[data-filter]'))
      button.setAttribute('aria-pressed', String(button === filter));
    let count = 0;
    for (const preset of presetButtons) {
      preset.hidden = category !== 'all' && preset.dataset.category !== category;
      if (!preset.hidden) count++;
    }
    const status = document.querySelector('#filter-status');
    if (status) status.textContent = `${count} forecasts to explore`;
  });
}
document.querySelector('#copy-forecast')?.addEventListener('click', () => {
  void copy(JSON.stringify({ preset: selectedPreset }, null, 2));
});
window.addEventListener('popstate', () => {
  const preset = new URLSearchParams(location.search).get('preset') ?? 'gentle-snow';
  const target = presetButtons.find((button) => button.dataset.preset === preset);
  target?.click();
});

const handle = document.querySelector<HTMLButtonElement>('#drag-handle');
const card = document.querySelector<HTMLElement>('#moving-card');
let cardX = 0,
  cardY = 0;
let drag: { id: number; x: number; y: number; startX: number; startY: number } | undefined;
function positionCard(): void {
  if (!scene || !card) return;
  const inset = 7;
  const sceneBox = scene.getBoundingClientRect();
  const cardBox = card.getBoundingClientRect();
  // The hero surface may be nested in a flow layout; offsets must use the scene's coordinate space.
  const baseX = cardBox.left - sceneBox.left - cardX;
  const baseY = cardBox.top - sceneBox.top - cardY;
  cardX = Math.max(
    -baseX + inset,
    Math.min(scene.clientWidth - baseX - card.offsetWidth - inset, cardX),
  );
  cardY = Math.max(
    -baseY + inset,
    Math.min(scene.clientHeight - baseY - card.offsetHeight - 60, cardY),
  );
  card.style.transform = `translate(${cardX}px, ${cardY}px)`;
}
handle?.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
  drag = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: cardX, startY: cardY };
  handle.setPointerCapture(event.pointerId);
});
handle?.addEventListener('pointermove', (event) => {
  if (!drag || drag.id !== event.pointerId) return;
  cardX = drag.startX + event.clientX - drag.x;
  cardY = drag.startY + event.clientY - drag.y;
  positionCard();
});
for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'])
  handle?.addEventListener(name, () => {
    drag = undefined;
  });
handle?.addEventListener('keydown', (event) => {
  if (event.key === 'Home') {
    cardX = 0;
    cardY = 0;
  } else if (event.key === 'ArrowLeft') cardX -= 10;
  else if (event.key === 'ArrowRight') cardX += 10;
  else if (event.key === 'ArrowUp') cardY -= 10;
  else if (event.key === 'ArrowDown') cardY += 10;
  else return;
  event.preventDefault();
  positionCard();
});
if (scene) new ResizeObserver(positionCard).observe(scene);
