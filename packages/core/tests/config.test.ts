import { describe, it, expect } from 'vitest';
import { createWeather } from '../src/index.js';
import { defaults, patchConfig, resolveConfig } from '../src/config.js';
import type { WeatherOptions } from '../src/types.js';
describe('public configuration and SSR lifecycle', () => {
  it('is safe to create and destroy without browser globals', () => {
    const w = createWeather();
    expect(w.getMetrics().state).toBe('idle');
    w.destroy();
    w.destroy();
    expect(w.getMetrics().state).toBe('destroyed');
    expect(() => w.start()).toThrow(/destroyed/);
  });
  it('merges defaults, presets and explicit options', () => {
    const c = resolveConfig({ preset: 'snowstorm', snow: { wind: { base: 0.25 } } });
    expect(c.snow.wind.base).toBe(0.25);
    expect(c.snow.intensity).toBe(1);
    expect(c.snow.accumulation.enabled).toBe(true);
  });
  it('does not share arrays or nested objects with defaults or callers', () => {
    const w = createWeather();
    const c = w.getConfig();
    c.dom.include.push('article');
    c.snow.intensity = 0;
    expect(w.getConfig().snow.intensity).not.toBe(0);
    expect(defaults.dom.include).not.toContain('article');
    w.destroy();
  });
  it('rejects invalid numeric and unknown config inputs atomically', () => {
    const w = createWeather();
    expect(() => w.setIntensity(NaN)).toThrow();
    expect(() => w.setIntensity(5)).toThrow();
    expect(() => w.updateConfig({ snow: { particleCount: 100000 } })).toThrow();
    expect(w.getConfig().snow.particleCount).toBe(360);
    w.destroy();
  });
  it('rejects prototype pollution and incompatible limits', () => {
    const patch: WeatherOptions = JSON.parse('{"__proto__":{"polluted":true}}');
    expect(() => resolveConfig(patch)).toThrow(/Unsafe/);
    expect(() => patchConfig(resolveConfig(), { snow: { minSize: 10, maxSize: 1 } })).toThrow();
    expect({}).not.toHaveProperty('polluted');
  });
  it('supports listener unsubscribe and idempotent cleanup', () => {
    const w = createWeather();
    let called = 0;
    const off = w.on('stop', () => called++);
    w.stop();
    off();
    w.stop();
    expect(called).toBe(1);
    w.destroy();
  });
  it('defers plugin setup until browser initialization', () => {
    let setup = 0,
      destroy = 0;
    const w = createWeather();
    const remove = w.use({
      name: 'test',
      setup() {
        setup++;
      },
      destroy() {
        destroy++;
      },
    });
    expect(setup).toBe(0);
    remove();
    remove();
    expect(destroy).toBe(1);
    w.destroy();
  });
  it('fails clearly when started on a server', () => {
    const w = createWeather();
    expect(() => w.start()).toThrow(/browser/);
    w.destroy();
  });
  it('rejects duplicate plugins and unknown preset names', () => {
    const w = createWeather();
    w.use({ name: 'duplicate' });
    expect(() => w.use({ name: 'duplicate' })).toThrow(/already/);
    expect(() => resolveConfig({ preset: 'invalid' } as unknown as WeatherOptions)).toThrow();
    w.destroy();
  });
});
