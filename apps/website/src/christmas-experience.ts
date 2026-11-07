import { createWeather, type WeatherController } from '@fluritheme/fluri';
import { christmasPack } from '@fluritheme/fluri/christmas';
import './christmas.css';

interface StoryState {
  playing: boolean;
  elapsed: number;
  chapter: string;
  recording: boolean;
  portrait: boolean;
  duration: number;
}
declare global {
  interface Window {
    __fluriChristmas?: {
      weather: WeatherController;
      replay(): void;
      pause(): void;
      play(): void;
      buildSnowman(): void;
      getState(): StoryState;
    };
  }
}
const element = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Christmas workshop element is missing: ${id}`);
  return found as T;
};
const world = element('christmas-world');
const root = document.documentElement;
const progress = element<HTMLProgressElement>('tour-progress');
const toggle = element<HTMLButtonElement>('tour-toggle');
const status = element('tour-status');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const duration = 36;
let recording = new URLSearchParams(location.search).get('controls') !== '1';
let playing = !reducedMotion.matches;
let elapsed = 0;
let activePhase = 'snow';
let lastTime = 0;
let frame = 0;
let suspended = document.hidden;
let disposed = false;
let manualBall = 0;
const fired = new Set<number>();
const hint = 'H toggles controls. R restarts the effects. Space pauses.';
root.classList.toggle('recording', recording);
root.classList.toggle('show-controls', !recording);
const weather = createWeather({
  container: world,
  preset: 'christmas-classic',
  seed: 25122026,
  dom: { detection: 'explicit', maxSurfaces: 8, include: ['[data-christmas-surface]'] },
  snow: {
    intensity: 0.65,
    particleCount: 170,
    color: '#fff9ed',
    minSize: 0.8,
    maxSize: 2.7,
    glow: false,
    gravity: 54,
    turbulence: 0.28,
    wind: { base: 0.05, gusts: true, variability: 0.1 },
    accumulation: { maxDepth: 18, growthRate: 0.55, meltRate: 0, softness: 0.8 },
  },
  interactions: {
    brush: { enabled: true, activation: 'hover', radius: 20, strength: 0.85 },
    snowballs: { enabled: true, minRadius: 4, maxRadius: 30, maxCount: 12 },
    snowman: { enabled: true },
  },
  performance: { adaptive: true, maxDPR: 1.5, maxFPS: 60 },
  accessibility: { reducedMotion: 'respect', controls: false },
});
weather.use(
  christmasPack({
    lights: { warmth: 0.95, spacing: 24, color: '#ffd58a', twinkle: true },
    garlands: false,
    ornaments: false,
    plough: false,
  }),
);
function syncControls(): void {
  toggle.textContent = playing ? 'Pause snow' : 'Let it snow';
  toggle.setAttribute('aria-pressed', String(playing));
  progress.value = elapsed;
  element('tour-time').textContent = `00:${String(Math.floor(elapsed)).padStart(2, '0')} / 00:36`;
}
function recordingMode(next: boolean): void {
  recording = next;
  root.classList.toggle('recording', next);
  root.classList.toggle('show-controls', !next);
  element('record-toggle').setAttribute('aria-pressed', String(next));
  const url = new URL(location.href);
  if (next) url.searchParams.set('record', '1');
  else url.searchParams.delete('record');
  // Legacy portrait links now open the standard website.
  url.searchParams.delete('portrait');
  history.replaceState(null, '', url);
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
  element('gift-open').textContent = open ? 'Close gift ↙' : 'Open gift ↗';
}
function sparkleAt(target: HTMLElement): void {
  const bounds = target.getBoundingClientRect();
  weather.trigger('sparkle', { x: bounds.left + bounds.width / 2, y: bounds.top });
}
function seedSnow(): void {
  weather.clearAccumulation();
  weather.addSnow(5, '[data-christmas-surface]');
  weather.addSnow(7, '#plough-route');
  weather.addSnow(6, '#snowman-ground');
}
function resetGarden(): void {
  weather.trigger('snowburst');
  weather.clearAccumulation('#snowman-ground');
  weather.addSnow(12, '#snowman-ground');
  manualBall = 0;
  element('garden-message').textContent = 'Snowman garden.';
}
function rollSnowball(index = manualBall++): void {
  const surface = element('snowman-ground');
  const bounds = surface.getBoundingClientRect();
  const fraction = [0.3, 0.5, 0.7][index % 3] ?? 0.5;
  weather.trigger('snowball', {
    surface,
    x: bounds.left + bounds.width * fraction,
    y: bounds.top,
    radius: Math.max(5, Math.min(20, bounds.width * (0.037 - (index % 3) * 0.007))),
  });
  element('garden-message').textContent = 'Snowball created.';
}
function buildSnowman(): void {
  const surface = element('snowman-ground');
  // Clear the garden's existing actors, then assemble real package snowballs on its support.
  weather.trigger('snowburst');
  weather.addSnow(8, '#snowman-ground');
  weather.trigger('snowman', {
    surface,
    radius: Math.max(10, Math.min(25, surface.getBoundingClientRect().width * 0.052)),
  });
}
weather.on('snowman:created', () => {
  element('garden-message').textContent = 'Snowman built.';
});
function runPlough(): void {
  const surface = element('plough-route');
  weather.addSnow(5, '#plough-route');
  weather.trigger('plough', {
    surface,
    direction: 'right',
    speed: Math.min(500, Math.max(45, surface.getBoundingClientRect().width / 3.5)),
    style: 'festive',
  });
}
const sequence: { at: number; id: string; label: string; action(): void }[] = [
  { at: 2.5, id: 'breeze', label: 'A little winter breeze', action: () => weather.trigger('gust') },
  { at: 5, id: 'letter', label: 'A letter opens', action: () => setLetter(true) },
  {
    at: 9,
    id: 'gift',
    label: 'A gift of little wonders',
    action: () => {
      setGift(true);
      sparkleAt(element('christmas-gift'));
    },
  },
  { at: 13, id: 'plough', label: 'Making way for Christmas', action: runPlough },
  { at: 18, id: 'snowball', label: 'Gather a little snow', action: () => rollSnowball(0) },
  { at: 20, id: 'snowball', label: 'One more little snowball', action: () => rollSnowball(1) },
  { at: 22, id: 'snowball', label: 'Three little beginnings', action: () => rollSnowball(2) },
  { at: 25, id: 'snowman', label: 'Hello, little friend', action: buildSnowman },
  {
    at: 30,
    id: 'wonder',
    label: 'A little Christmas magic',
    action: () => sparkleAt(element('snow-garden-spark')),
  },
];
function pause(message = 'Effects paused. Explore the workshop or press Space to continue.'): void {
  playing = false;
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
  status.textContent = hint;
  syncControls();
}
function manual(action: () => void): void {
  pause('Manual mode. The scene stays still; press Play effects to resume the sequence.');
  if (reducedMotion.matches) weather.updateConfig({ accessibility: { reducedMotion: 'ignore' } });
  weather.resume();
  action();
}
function replay(): void {
  if (disposed) return;
  elapsed = 0;
  manualBall = 0;
  fired.clear();
  activePhase = 'snow';
  element('tour-chapter').textContent = 'Let it snow';
  root.dataset.phase = activePhase;
  setLetter(false);
  setGift(false);
  weather.stop();
  weather.start();
  seedSnow();
  element('garden-message').textContent = 'Snowman garden.';
  play();
}
function tick(now: number): void {
  if (disposed) return;
  const dt = lastTime ? Math.min((now - lastTime) / 1000, 0.25) : 0;
  lastTime = now;
  if (playing && !suspended) {
    elapsed += dt;
    if (elapsed >= duration) replay();
    for (const [index, step] of sequence.entries()) {
      if (elapsed >= step.at && !fired.has(index)) {
        fired.add(index);
        activePhase = step.id;
        root.dataset.phase = step.id;
        element('tour-chapter').textContent = step.label;
        step.action();
      }
    }
    syncControls();
  }
  frame = requestAnimationFrame(tick);
}
element('tour-toggle').addEventListener('click', () => (playing ? pause() : play()));
element('tour-replay').addEventListener('click', replay);
element('record-toggle').addEventListener('click', () => recordingMode(!recording));
element('fullscreen-toggle').addEventListener('click', () => {
  if (!document.fullscreenEnabled || typeof root.requestFullscreen !== 'function') {
    status.textContent = 'Use your browser’s fullscreen control.';
    return;
  }
  void (document.fullscreenElement ? document.exitFullscreen() : root.requestFullscreen()).catch(
    () => {
      status.textContent = 'Fullscreen is unavailable in this browser.';
    },
  );
});
element('letter-open').addEventListener('click', () =>
  manual(() => setLetter(!element('christmas-letter').classList.contains('is-open'))),
);
element('gift-open').addEventListener('click', () =>
  manual(() => setGift(!element('christmas-gift').classList.contains('is-unwrapped'))),
);
element('plough-now').addEventListener('click', () => manual(runPlough));
element('snowman-now').addEventListener('click', () => manual(buildSnowman));
element('snowball-now').addEventListener('click', () => manual(() => rollSnowball()));
element('garden-reset').addEventListener('click', () => manual(resetGarden));
element('more-snow').addEventListener('click', () =>
  manual(() => {
    weather.addSnow(3, '[data-christmas-surface]');
    weather.trigger('gust');
  }),
);
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
  }
});
document.addEventListener('visibilitychange', () => {
  suspended = document.hidden;
  lastTime = 0;
  if (suspended) weather.pause();
  else if (playing) weather.resume();
});
reducedMotion.addEventListener('change', () => {
  if (reducedMotion.matches) {
    pause('Reduced motion is respected. Choose Play effects to start the sequence.');
    weather.updateConfig({ accessibility: { reducedMotion: 'respect' } });
  }
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
  buildSnowman,
  getState: () => ({
    playing,
    elapsed,
    chapter: activePhase,
    recording,
    portrait: false,
    duration,
  }),
};
try {
  weather.start();
  seedSnow();
  if (!playing) pause('Reduced motion is respected. Choose Play effects to animate the workshop.');
  element('record-toggle').setAttribute('aria-pressed', String(recording));
  root.dataset.phase = activePhase;
  syncControls();
  frame = requestAnimationFrame(tick);
} catch {
  disposed = true;
  playing = false;
  weather.destroy();
  status.textContent = 'The snow could not start. Reload the workshop to try again.';
  syncControls();
}
