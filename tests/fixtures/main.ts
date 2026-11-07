import { createWeather } from '../../packages/core/src/index.js';
import { christmasPack } from '../../packages/core/src/christmas.js';
import type {
  PluginContext,
  Surface,
  WeatherController,
  WeatherEventName,
  WeatherOptions,
} from '../../packages/core/src/types.js';
import { installResourceAudit } from './audit.js';
import type { ResourceSnapshot } from './audit.js';

export interface SurfaceSnapshot {
  id: string;
  elementId: string;
  x: number;
  y: number;
  width: number;
  angle: number;
  mass: number;
  binSize: number;
  bins: number[];
  visible: boolean;
  maxDepth: number;
  layer: string;
  material: string;
  clips: number;
}
declare global {
  interface Window {
    weather: WeatherController;
    fluriExports: { createWeather: typeof createWeather; christmasPack: typeof christmasPack };
    eventLog: { name: WeatherEventName; data?: unknown; particles: number }[];
    captureSurfaces(): SurfaceSnapshot[];
    recreateWeather(options?: WeatherOptions): void;
    resourceAudit: { snapshot(): ResourceSnapshot };
    baselineResources: ResourceSnapshot;
    inspection: PluginContext | undefined;
    clicks: number;
  }
}

window.resourceAudit = installResourceAudit();
window.fluriExports = { createWeather, christmasPack };
window.eventLog = [];
window.clicks = 0;
const ordinary = document.querySelector<HTMLButtonElement>('#ordinary');
ordinary?.addEventListener('click', () => {
  window.clicks++;
  const output = document.querySelector('#click-count');
  if (output) output.textContent = String(window.clicks);
});
document
  .querySelector('#dialog-close')
  ?.addEventListener('click', () => document.querySelector<HTMLDialogElement>('#dialog')?.close());
window.baselineResources = window.resourceAudit.snapshot();
const eventNames: WeatherEventName[] = [
  'ready',
  'start',
  'pause',
  'resume',
  'stop',
  'destroy',
  'error',
  'surface:added',
  'surface:removed',
  'surface:updated',
  'snow:deposit',
  'snow:slide',
  'snow:brush',
  'snow:transfer',
  'snowball:created',
  'snowball:thrown',
  'snowball:stacked',
  'snowman:created',
  'snowman:removed',
  'plough:start',
  'plough:complete',
  'quality:changed',
];
const initial: WeatherOptions = {
  seed: 731,
  snow: {
    particleCount: 120,
    intensity: 0.6,
    accumulation: { sliding: false, softness: 0, maxDepth: 28 },
  },
  dom: { detection: 'explicit', maxSurfaces: 100 },
  interactions: { snowballs: { enabled: true }, snowman: { enabled: true } },
  performance: { adaptive: false },
};
window.captureSurfaces = () =>
  (window.inspection?.getSurfaces() ?? []).map((surface: Surface) => ({
    id: surface.id,
    elementId: surface.element.id,
    x: surface.x,
    y: surface.y,
    width: surface.width,
    angle: surface.angle,
    mass: surface.profile.reduce((sum, value) => sum + value, 0),
    binSize: surface.binSize,
    bins: [...surface.profile],
    visible: surface.visible,
    maxDepth: surface.maxDepth,
    layer: surface.layer,
    material: surface.material,
    clips: surface.clipRegions.length,
  }));
window.recreateWeather = (options: WeatherOptions = initial) => {
  window.weather?.destroy();
  window.eventLog.length = 0;
  window.weather = createWeather(options);
  for (const name of eventNames)
    window.weather.on(name, (data) =>
      window.eventLog.push({ name, data, particles: window.weather.getMetrics().particleCount }),
    );
  window.weather.use({
    name: 'browser-inspection',
    setup(context) {
      window.inspection = context;
      return () => {
        window.inspection = undefined;
      };
    },
  });
  window.weather.start();
};
window.recreateWeather();
