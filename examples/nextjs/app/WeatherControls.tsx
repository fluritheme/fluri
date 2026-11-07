'use client';
import { useEffect, useMemo, useState } from 'react';
import { useFluri } from '@fluritheme/fluri-react';
import type { WeatherOptions, WeatherState } from '@fluritheme/fluri';
export default function WeatherControls() {
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
  const [appliedIntensity, setAppliedIntensity] = useState(0.5);
  const [clicks, setClicks] = useState(0);
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
    <section className="controls" data-weather-ignore aria-label="Hydrated weather controls">
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
      <button id="add-snow" onClick={() => weather.current?.addSnow(10)}>
        Add snow
      </button>
      <button id="ordinary-next" onClick={() => setClicks((value) => value + 1)}>
        React clicks{' '}
        <output id="next-clicks" className="click-counter">
          {clicks}
        </output>
      </button>
      <p className="status">
        Engine <output id="state-weather">{state}</output> · {particles} flakes · Hydrated client
        controls
      </p>
    </section>
  );
}
