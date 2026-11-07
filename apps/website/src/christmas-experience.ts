import { createWeather, type WeatherController } from '@fluritheme/fluri';
import { christmasPack } from '@fluritheme/fluri/christmas';
import './christmas.css';

interface StoryState {
  playing: boolean;
  elapsed: number;
  chapter: string;
  recording: boolean;
  portrait: boolean;
}
declare global {
  interface Window {
    __fluriChristmas?: {
      weather: WeatherController;
      replay(): void;
      pause(): void;
      play(): void;
      getState(): StoryState;
    };
  }
}
const element = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Christmas story element is missing: ${id}`);
  return found as T;
};
const root = document.documentElement;
const world = element('christmas-world');
const progress = element<HTMLProgressElement>('tour-progress');
const toggle = element<HTMLButtonElement>('tour-toggle');
const status = element('tour-status');
const chapters = [
  { id: 'arrival', label: 'The arrival', at: 0 },
  { id: 'letter', label: 'A little letter', at: 8 },
  { id: 'wonder', label: 'A little surprise', at: 15 },
  { id: 'finale', label: 'Your little winter', at: 26 },
] as const;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const params = new URLSearchParams(location.search);
let recording = params.get('record') === '1';
let portrait = params.get('portrait') === '1';
let elapsed = 0;
let playing = !reducedMotion.matches;
let activeChapter: string = 'arrival';
let lastTime = 0;
let frame = 0;
let suspended = document.hidden;
let disposed = false;
let letterOpened = false;
let giftOpened = false;
let ploughSent = false;
let scrollMove: { from: number; start: number; to: string } | undefined;
const initialHint = 'Automatic 32-second story. H hides controls · R replays · Space pauses.';

root.dataset.format = portrait ? 'portrait' : 'wide';
root.classList.toggle('recording', recording);
function writeURL(): void {
  const url = new URL(location.href);
  if (recording) url.searchParams.set('record', '1');
  else url.searchParams.delete('record');
  if (portrait) url.searchParams.set('portrait', '1');
  else url.searchParams.delete('portrait');
  history.replaceState(null, '', url);
}
function recordingMode(next: boolean): void {
  recording = next;
  root.classList.toggle('recording', next);
  element('record-toggle').setAttribute('aria-pressed', String(next));
  writeURL();
}
function setLetter(open: boolean): void {
  element('christmas-letter').classList.toggle('is-open', open);
  world.querySelector('.letter-paper')?.setAttribute('aria-hidden', String(!open));
  element('letter-open').setAttribute('aria-expanded', String(open));
  element('letter-open').setAttribute(
    'aria-label',
    open ? 'Close your Christmas letter' : 'Open your Christmas letter',
  );
}
function setGift(open: boolean): void {
  element('christmas-gift').classList.toggle('is-unwrapped', open);
  world.querySelector('.gift-message')?.setAttribute('aria-hidden', String(!open));
  element('gift-open').setAttribute('aria-expanded', String(open));
  element('gift-open').innerHTML = open
    ? 'Keep a little wonder <span aria-hidden="true">♡</span>'
    : 'Unwrap a little joy <span aria-hidden="true">↗</span>';
}
const weather = createWeather({
  container: world,
  preset: 'christmas-classic',
  seed: 25122026,
  dom: { detection: 'explicit', maxSurfaces: 12, include: ['[data-christmas-surface]'] },
  snow: {
    intensity: 0.66,
    particleCount: 230,
    color: '#fff9ed',
    minSize: 0.9,
    maxSize: 3.4,
    glow: false,
    gravity: 67,
    turbulence: 0.28,
    wind: { base: 0.09, gusts: true, variability: 0.13 },
    accumulation: { maxDepth: 18, growthRate: 0.65, meltRate: 0, softness: 0.8 },
  },
  interactions: {
    brush: { enabled: true, activation: 'hover', radius: 26, strength: 0.85 },
    snowballs: { enabled: true, maxCount: 4 },
  },
  performance: { adaptive: true, maxDPR: 1.5, maxFPS: 60 },
  accessibility: { reducedMotion: 'respect', controls: false },
});
weather.use(
  christmasPack({
    lights: { warmth: 0.95, spacing: 32, color: '#ffd58a', twinkle: true },
    garlands: false,
    ornaments: false,
    plough: false,
  }),
);
function seedSnow(): void {
  weather.clearAccumulation();
  weather.addSnow(7, '[data-christmas-surface]');
  weather.addSnow(5, '#plough-route');
}
function syncControls(): void {
  toggle.textContent = playing ? 'Pause story' : 'Play story';
  toggle.setAttribute('aria-pressed', String(playing));
  element('tour-chapter').textContent =
    chapters.find((chapter) => chapter.id === activeChapter)?.label ?? 'The arrival';
  progress.value = elapsed;
  element('tour-time').textContent = `00:${String(Math.floor(elapsed)).padStart(2, '0')} / 00:32`;
}
function pause(
  message = 'Story paused. Explore at your own pace, or press Space to continue.',
): void {
  playing = false;
  scrollMove = undefined;
  weather.pause();
  status.textContent = message;
  syncControls();
}
function play(): void {
  if (disposed) return;
  if (reducedMotion.matches) weather.updateConfig({ accessibility: { reducedMotion: 'ignore' } });
  if (weather.getMetrics().state === 'paused') weather.resume();
  else weather.start();
  playing = true;
  lastTime = 0;
  scrollMove = { from: scrollY, start: elapsed, to: activeChapter };
  status.textContent = initialHint;
  syncControls();
}
function targetTop(id: string): number {
  return Math.max(0, element(id).getBoundingClientRect().top + scrollY);
}
function goTo(id: string, instant = false): void {
  activeChapter = id;
  root.dataset.chapter = id;
  if (instant || reducedMotion.matches) {
    scrollTo({ top: targetTop(id), behavior: 'instant' });
    scrollMove = undefined;
  } else scrollMove = { from: scrollY, start: elapsed, to: id };
  syncControls();
}
function runPlough(): void {
  const route = element('plough-route');
  const bounds = route.getBoundingClientRect();
  if (bounds.bottom < 0 || bounds.top > innerHeight) return;
  weather.addSnow(5, '#plough-route');
  weather.trigger('plough', {
    surface: route,
    direction: 'right',
    speed: Math.min(400, Math.max(80, bounds.width / 3.5)),
    style: 'festive',
  });
}
function replay(): void {
  if (disposed) return;
  elapsed = 0;
  letterOpened = giftOpened = ploughSent = false;
  setLetter(false);
  setGift(false);
  weather.stop();
  weather.start();
  seedSnow();
  goTo('arrival', true);
  play();
}
function tick(now: number): void {
  if (disposed) return;
  const dt = lastTime ? Math.min((now - lastTime) / 1000, 0.25) : 0;
  lastTime = now;
  if (playing && !suspended) {
    elapsed += dt;
    if (elapsed >= 32) replay();
    const chapter = [...chapters].reverse().find((candidate) => elapsed >= candidate.at);
    if (chapter && chapter.id !== activeChapter) goTo(chapter.id);
    if (scrollMove) {
      const t = Math.min(1, (elapsed - scrollMove.start) / 1.15);
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      scrollTo({
        top: scrollMove.from + (targetTop(scrollMove.to) - scrollMove.from) * eased,
        behavior: 'instant',
      });
      if (t >= 1) scrollMove = undefined;
    }
    if (!letterOpened && elapsed >= 10) {
      setLetter(true);
      letterOpened = true;
    }
    if (!giftOpened && elapsed >= 17.5) {
      setGift(true);
      const box = element('christmas-gift').getBoundingClientRect();
      weather.trigger('sparkle', { x: box.left + box.width / 2, y: box.top + 30 });
      giftOpened = true;
    }
    if (!ploughSent && elapsed >= 21) {
      runPlough();
      ploughSent = true;
    }
    syncControls();
  }
  frame = requestAnimationFrame(tick);
}
element('tour-toggle').addEventListener('click', () => (playing ? pause() : play()));
element('tour-replay').addEventListener('click', replay);
element('story-replay').addEventListener('click', replay);
element('record-toggle').addEventListener('click', () => recordingMode(!recording));
element('portrait-toggle').addEventListener('click', () => {
  portrait = !portrait;
  root.dataset.format = portrait ? 'portrait' : 'wide';
  element('portrait-toggle').setAttribute('aria-pressed', String(portrait));
  writeURL();
  requestAnimationFrame(() => goTo(activeChapter, true));
});
element('fullscreen-toggle').addEventListener('click', () => {
  if (!document.fullscreenEnabled || typeof root.requestFullscreen !== 'function') {
    status.textContent = 'Fullscreen is unavailable here. Use your browser’s fullscreen control.';
    return;
  }
  void (document.fullscreenElement ? document.exitFullscreen() : root.requestFullscreen()).catch(
    () => {
      status.textContent = 'Fullscreen is unavailable here. Use your browser’s fullscreen control.';
    },
  );
});
element('letter-open').addEventListener('click', () => {
  pause();
  setLetter(!element('christmas-letter').classList.contains('is-open'));
});
element('gift-open').addEventListener('click', () => {
  pause();
  setGift(!element('christmas-gift').classList.contains('is-unwrapped'));
});
element('plough-now').addEventListener('click', () => {
  pause();
  if (reducedMotion.matches) weather.updateConfig({ accessibility: { reducedMotion: 'ignore' } });
  weather.resume();
  runPlough();
});
for (const link of world.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')) {
  link.addEventListener('click', (event) => {
    const id = link.hash.slice(1);
    if (!document.getElementById(id)) return;
    event.preventDefault();
    pause();
    activeChapter = id;
    element(id).scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth' });
    syncControls();
  });
}
function userNavigation(): void {
  if (playing) pause('Story paused while you explore. Press Space or Play story to resume.');
}
addEventListener('wheel', userNavigation, { passive: true });
addEventListener('touchmove', userNavigation, { passive: true });
document.addEventListener('keydown', (event) => {
  if (
    event.target instanceof Element &&
    event.target.closest('input,textarea,select,[contenteditable=true]')
  )
    return;
  if (event.key === 'Escape') recordingMode(false);
  else if (event.key.toLowerCase() === 'h') recordingMode(!recording);
  else if (event.key.toLowerCase() === 'r') replay();
  else if (
    event.code === 'Space' &&
    !(event.target instanceof Element && event.target.closest('button,a'))
  ) {
    event.preventDefault();
    if (playing) pause();
    else play();
  } else if (['PageDown', 'PageUp', 'Home', 'End', 'ArrowDown', 'ArrowUp'].includes(event.key))
    userNavigation();
});
document.addEventListener('visibilitychange', () => {
  suspended = document.hidden;
  lastTime = 0;
  if (suspended) weather.pause();
  else if (playing) weather.resume();
});
reducedMotion.addEventListener('change', () => {
  if (reducedMotion.matches) {
    pause('Reduced motion is respected. Explore the story, or choose Play story to animate.');
    weather.updateConfig({ accessibility: { reducedMotion: 'respect' } });
  }
});
addEventListener('resize', () => {
  if (playing) scrollMove = { from: scrollY, start: elapsed, to: activeChapter };
});
addEventListener('pagehide', (event) => {
  if (event.persisted) {
    suspended = true;
    weather.pause();
  } else {
    disposed = true;
    cancelAnimationFrame(frame);
    weather.destroy();
    delete window.__fluriChristmas;
  }
});
addEventListener('pageshow', (event) => {
  if (event.persisted) {
    suspended = document.hidden;
    lastTime = 0;
    if (playing && !suspended) weather.resume();
  }
});
window.__fluriChristmas = {
  weather,
  replay,
  pause: () => pause(),
  play,
  getState: () => ({ playing, elapsed, chapter: activeChapter, recording, portrait }),
};
try {
  weather.start();
  seedSnow();
  if (!playing)
    pause('Reduced motion is respected. Explore the story, or choose Play story to animate.');
  if (location.hash && chapters.some((chapter) => `#${chapter.id}` === location.hash)) {
    pause();
    activeChapter = location.hash.slice(1);
    goTo(activeChapter, true);
  } else scrollTo({ top: 0, behavior: 'instant' });
  element('portrait-toggle').setAttribute('aria-pressed', String(portrait));
  element('record-toggle').setAttribute('aria-pressed', String(recording));
  root.dataset.chapter = activeChapter;
  syncControls();
  frame = requestAnimationFrame(tick);
} catch {
  disposed = true;
  playing = false;
  weather.destroy();
  status.textContent =
    'The snow could not start. You can still explore the Christmas story. Reload to try again.';
  syncControls();
}
