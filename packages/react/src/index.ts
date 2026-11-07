import { useEffect, useRef } from 'react';
import { createWeather } from '@themes/fluri';
import type { WeatherController, WeatherOptions } from '@themes/fluri';
export type { WeatherController, WeatherOptions } from '@themes/fluri';
/** Owns a browser instance for exactly the lifetime of a mounted component, including Strict Mode replay. */
export function useFluri(
  options: WeatherOptions = {},
  onReady?: (controller: WeatherController) => void,
): { readonly current: WeatherController | null } {
  const controller = useRef<WeatherController | null>(null);
  const initial = useRef(options);
  const callback = useRef(onReady);
  callback.current = onReady;
  useEffect(() => {
    const instance = createWeather({ ...initial.current, autoStart: false });
    controller.current = instance;
    instance.start();
    callback.current?.(instance);
    return () => {
      instance.destroy();
      if (controller.current === instance) controller.current = null;
    };
  }, []);
  useEffect(() => {
    controller.current?.updateConfig({ ...options, autoStart: false });
  }, [options]);
  return controller;
}
export interface FluriProps {
  options?: WeatherOptions;
  onReady?: (controller: WeatherController) => void;
}
/** Render in a client component. No DOM is created during server rendering. */
export function Fluri({ options, onReady }: FluriProps): null {
  useFluri(options, onReady);
  return null;
}
