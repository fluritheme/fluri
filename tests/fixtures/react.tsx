import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useFluri } from '../../packages/react/src/index.js';
import type { WeatherController } from '../../packages/core/src/types.js';
import { installResourceAudit } from './audit.js';
import type { ResourceSnapshot } from './audit.js';

declare global {
  interface Window {
    reactHarness: {
      controllers: WeatherController[];
      getCurrent(): WeatherController | undefined;
      snapshot(): ResourceSnapshot;
      baseline: ResourceSnapshot | undefined;
      unmountRoot(): void;
    };
  }
}
const audit = installResourceAudit();
const controllers: WeatherController[] = [];
let baseline: ResourceSnapshot | undefined;
function Snow({ intensity }: { intensity: number }) {
  const weather = useFluri(
    {
      seed: 44,
      snow: { intensity, particleCount: 80 },
      dom: { detection: 'explicit' },
      accessibility: { controls: false },
    },
    (instance) => controllers.push(instance),
  );
  return (
    <button type="button" id="react-pause" onClick={() => weather.current?.pause()}>
      Pause via React hook
    </button>
  );
}
function App() {
  const [mounted, setMounted] = useState(false);
  const [intensity, setIntensity] = useState(0.4);
  const [clicks, setClicks] = useState(0);
  return (
    <main>
      <h1>Actual React Strict Mode integration</h1>
      <button
        id="mount-weather"
        onClick={() => {
          baseline ??= audit.snapshot();
          setMounted(true);
        }}
      >
        Mount weather
      </button>
      <button id="unmount-weather" onClick={() => setMounted(false)}>
        Unmount weather
      </button>
      <button id="update-weather" onClick={() => setIntensity(0.8)}>
        Update intensity
      </button>
      <button id="ordinary-react" onClick={() => setClicks((value) => value + 1)}>
        Ordinary React button: <output id="react-clicks">{clicks}</output>
      </button>
      {mounted && <Snow intensity={intensity} />}
      <article data-weather-surface>React-owned snow surface</article>
    </main>
  );
}
const target = document.querySelector('#react-root');
if (!target) throw new Error('Missing React fixture root');
const root = createRoot(target);
root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);
window.reactHarness = {
  controllers,
  getCurrent: () =>
    [...controllers].reverse().find((controller) => controller.getMetrics().state !== 'destroyed'),
  snapshot: () => audit.snapshot(),
  get baseline() {
    return baseline;
  },
  unmountRoot: () => root.unmount(),
};
