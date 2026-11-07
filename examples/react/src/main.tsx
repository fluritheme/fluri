import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useFluri } from '@fluritheme/fluri-react';
import type { WeatherOptions, WeatherState } from '@fluritheme/fluri';
import './style.css';
function WeatherScene() {
  const [intensity, setIntensity] = useState(0.5);
  const options = useMemo<WeatherOptions>(
    () => ({
      preset: 'gentle-snow',
      snow: { intensity },
      dom: { detection: 'explicit' },
      accessibility: { controls: false },
    }),
    [intensity],
  );
  const weather = useFluri(options);
  const [state, setState] = useState<WeatherState>('idle');
  const [particles, setParticles] = useState(0);
  const [appliedIntensity, setAppliedIntensity] = useState(intensity);
  useEffect(() => {
    const update = () => {
      const instance = weather.current;
      if (instance) {
        setState(instance.getMetrics().state);
        setParticles(instance.getMetrics().particleCount);
        setAppliedIntensity(instance.getConfig().snow.intensity);
      }
    };
    update();
    const timer = setInterval(update, 300);
    return () => clearInterval(timer);
  }, [weather]);
  function pause() {
    const instance = weather.current;
    if (!instance) return;
    if (instance.getMetrics().state === 'paused') instance.resume();
    else instance.pause();
    setState(instance.getMetrics().state);
  }
  return (
    <>
      <section className="controls" data-weather-ignore aria-label="React weather controls">
        <label className="control" htmlFor="intensity-weather">
          Intensity
          <input
            id="intensity-weather"
            type="range"
            min="0"
            max="1"
            step=".01"
            value={intensity}
            onChange={(event) => setIntensity(Number(event.target.value))}
          />
          <output id="value-weather">{appliedIntensity.toFixed(2)}</output>
        </label>
        <button id="pause-weather" className="primary" onClick={pause}>
          {state === 'paused' ? 'Resume weather' : 'Pause weather'}
        </button>
        <button onClick={() => weather.current?.addSnow(10)}>Add snow</button>
        <p className="status">
          Engine <output id="state-weather">{state}</output> · {particles} flakes
        </p>
      </section>
      <div className="cards">
        <article className="card" data-weather-surface>
          <span className="eyebrow">REACT-OWNED DOM</span>
          <h2>One hook. One owned instance.</h2>
          <p>
            The hook creates the engine in an effect. Its cleanup destroys the instance when this
            component unmounts, including React Strict Mode replay.
          </p>
        </article>
        <article className="card" data-weather-surface>
          <span className="eyebrow">REACTIVE OPTIONS</span>
          <h2>The forecast follows state.</h2>
          <p>
            Moving the intensity slider updates a memoized options object. The hook applies that
            configuration to the existing controller.
          </p>
        </article>
      </div>
    </>
  );
}
function App() {
  const [mounted, setMounted] = useState(true);
  const [clicks, setClicks] = useState(0);
  return (
    <>
      <header>
        <a className="brand" href="#">
          <span aria-hidden="true">❄</span>fluri
        </a>
        <nav aria-label="Example sections">
          <a href="#live">Live example</a>
          <a href="#lifecycle">Lifecycle</a>
        </nav>
      </header>
      <main id="live">
        <span className="eyebrow">REACT STRICT MODE INTEGRATION</span>
        <h1>
          A component mounts.
          <br />
          Winter arrives.
        </h1>
        <p className="intro">
          The actual Fluri React hook owns the effect. Re-render it, change its options, and unmount
          it to verify that weather follows your component lifecycle.
        </p>
        <div className="controls" data-weather-ignore>
          <button id="toggle-weather" onClick={() => setMounted((value) => !value)}>
            {mounted ? 'Unmount weather' : 'Mount weather'}
          </button>
          <button id="ordinary-react" onClick={() => setClicks((value) => value + 1)}>
            Ordinary React button <output className="click-counter">{clicks}</output>
          </button>
        </div>
        {mounted ? (
          <WeatherScene />
        ) : (
          <div className="notice" role="status">
            Weather unmounted. Its overlay, observers, and listeners have been released. Mount it
            again to create a new instance.
          </div>
        )}
        <section className="guide" id="lifecycle">
          <h2>A real hook, under Strict Mode.</h2>
          <p>
            This application renders inside <code>StrictMode</code>. The <code>useFluri()</code>{' '}
            hook manages setup and cleanup, and its reference exposes the active controller for
            deliberate runtime actions.
          </p>
        </section>
        <p className="footnote">
          Reduced motion is respected. React's own buttons remain clickable beneath
          pointer-transparent weather overlays.
        </p>
      </main>
      <footer>
        <span>@fluritheme/fluri-react · MIT licensed</span>
        <span>Runnable integration example</span>
      </footer>
    </>
  );
}
const target = document.querySelector('#app');
if (!target) throw new Error('Missing React example root');
createRoot(target).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
