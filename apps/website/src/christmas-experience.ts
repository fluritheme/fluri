import { createWeather, type WeatherController } from '@fluritheme/fluri';
import './christmas.css';

declare global {
  interface Window {
    __fluriChristmas?: { weather: WeatherController };
  }
}
const world = document.getElementById('christmas-world');
if (!world) throw new Error('The snowfall container is missing.');
const weather = createWeather({
  container: world,
  preset: 'gentle-snow',
  seed: 25122026,
  dom: { detection: 'explicit', maxSurfaces: 0 },
  snow: {
    intensity: 0.85,
    particleCount: 260,
    color: '#fffdf7',
    minSize: 1,
    maxSize: 4,
    gravity: 70,
    turbulence: 0.35,
    glow: false,
    parallax: true,
    wind: { base: 0.08, gusts: true, variability: 0.15 },
    accumulation: { enabled: false },
  },
  interactions: { brush: { enabled: false } },
  performance: { adaptive: true, maxDPR: 1.5, maxFPS: 60 },
  accessibility: { reducedMotion: 'respect', controls: false },
});
window.__fluriChristmas = { weather };
weather.start();

let resumeAfterRestore = false;
document.addEventListener('keydown', (event) => {
  if (
    event.code !== 'Space' ||
    (event.target instanceof Element &&
      event.target.closest('a,button,input,textarea,select,[contenteditable]'))
  )
    return;
  event.preventDefault();
  if (weather.getMetrics().state === 'running') weather.pause();
  else {
    // Pressing Space is an explicit request to animate, including with reduced motion enabled.
    weather.updateConfig({ accessibility: { reducedMotion: 'ignore' } });
    weather.resume();
  }
});
addEventListener('pagehide', (event) => {
  if (event.persisted) {
    resumeAfterRestore = weather.getMetrics().state === 'running';
    weather.pause();
  } else {
    weather.destroy();
    delete window.__fluriChristmas;
  }
});
addEventListener('pageshow', (event) => {
  if (event.persisted && resumeAfterRestore) weather.resume();
});
