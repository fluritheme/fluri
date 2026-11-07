import { describe, expect, it } from 'vitest';
import { christmasPack } from '../src/christmas.js';
import { resolveConfig } from '../src/config.js';
import type { PluginContext, Surface } from '../src/types.js';

function setup(attached: boolean) {
  const surfaces = [
    {
      visible: true,
      x: 0,
      y: 100,
      width: 200,
      angle: 0,
      element: { matches: () => attached, hasAttribute: () => attached },
    },
  ] as unknown as Surface[];
  const config = resolveConfig();
  const context: PluginContext = {
    getConfig: () => config,
    getSurfaces: () => surfaces,
    emit: () => {},
    spawnClump: () => {},
  };
  return { context, surfaces };
}

describe('Christmas pack lifecycle', () => {
  it('is inert during import and can be set up, updated, triggered, and destroyed repeatedly', () => {
    const plugin = christmasPack({
      lights: false,
      garlands: false,
      ornaments: false,
      gifts: false,
      candyCanes: false,
      wreath: false,
      icicles: false,
      frost: false,
      sparkle: false,
    });
    const { context } = setup(false);
    expect(plugin.name).toBe('fluri-christmas');
    plugin.update?.(1 / 60, 1);
    plugin.trigger?.('sparkle', {});
    const cleanup = plugin.setup?.(context);
    plugin.update?.(1 / 60, 1);
    plugin.destroy?.();
    if (typeof cleanup === 'function') cleanup();
    plugin.destroy?.();
    expect(() => plugin.update?.(1, 2)).not.toThrow();
  });
  it('validates public options before animation starts', () => {
    expect(() => christmasPack({ lights: { color: '#abcde' } })).toThrow();
    expect(() => christmasPack({ lights: { spacing: Infinity } })).toThrow();
    expect(() => christmasPack({ palette: [] })).toThrow();
    expect(() => christmasPack({ plough: { interval: 0.1 } })).toThrow();
    expect(() => christmasPack({ candyCanes: { enabled: 'yes' } } as never)).toThrow();
    expect(() => christmasPack({ plough: { style: 'unknown' } } as never)).toThrow();
    expect(() => christmasPack({ unexpected: true } as never)).toThrow();
  });
  it('automatically schedules real plough triggers and stops after disposal', () => {
    const plugin = christmasPack({
      plough: {
        enabled: true,
        automatic: true,
        idleDelay: 2,
        interval: 5,
        speed: 80,
        style: 'festive',
      },
    });
    const { context } = setup(false);
    const calls: unknown[] = [];
    context.trigger = (...args) => {
      calls.push(args);
    };
    const cleanup = plugin.setup?.(context);
    plugin.update?.(1, 1);
    expect(calls).toHaveLength(0);
    plugin.update?.(1, 2);
    expect(calls).toEqual([
      ['plough', { selector: '[data-plough-route]', speed: 80, style: 'festive' }],
    ]);
    plugin.update?.(4, 6);
    expect(calls).toHaveLength(1);
    plugin.update?.(1, 7);
    expect(calls).toHaveLength(2);
    if (typeof cleanup === 'function') cleanup();
    plugin.update?.(100, 100);
    expect(calls).toHaveLength(2);
  });
  it('rejects automatic plough mode without an engine trigger integration', () => {
    const { context } = setup(false);
    expect(() => christmasPack({ plough: { automatic: true } }).setup?.(context)).toThrow(
      /trigger/,
    );
  });
  it('keeps disabled decorations entirely inert', () => {
    const plugin = christmasPack({
      lights: false,
      garlands: false,
      ornaments: false,
      gifts: false,
      candyCanes: false,
      wreath: false,
      icicles: false,
      frost: false,
      sparkle: false,
    });
    const { context } = setup(true);
    plugin.setup?.(context);
    plugin.update?.(1, 1);
    const calls: string[] = [];
    const ctx = new Proxy(
      {},
      { get: (_target, name) => () => calls.push(String(name)) },
    ) as CanvasRenderingContext2D;
    plugin.render?.(ctx, 1);
    expect(calls).toHaveLength(0);
    plugin.destroy?.();
  });
  it('draws original candy canes only on their explicit clipped attachment', () => {
    const { context, surfaces } = setup(false);
    const surface = surfaces[0];
    if (!surface) throw new Error('Missing test surface');
    surface.clipRegions = [{ x: 0, y: 80, width: 200, height: 100, radius: 4 }];
    surface.element = {
      matches: (selector: string) => selector === '[data-holiday-candy-canes]',
    } as unknown as Element;
    const calls: string[] = [];
    const ctx = new Proxy(
      {},
      { get: (_target, name) => () => calls.push(String(name)) },
    ) as CanvasRenderingContext2D;
    const plugin = christmasPack({ candyCanes: true });
    plugin.setup?.(context);
    plugin.render?.(ctx, 1);
    expect(calls.filter((name) => name === 'clip')).toHaveLength(1);
    expect(calls.filter((name) => name === 'stroke')).toHaveLength(3);
    expect(calls.indexOf('clip')).toBeLessThan(calls.indexOf('translate'));
    plugin.destroy?.();
    calls.length = 0;
    const disabled = christmasPack({ candyCanes: false });
    disabled.setup?.(context);
    disabled.render?.(ctx, 1);
    expect(calls).toHaveLength(0);
    disabled.destroy?.();
  });
  it('never renders decorations on surfaces that do not match explicit selectors', () => {
    const plugin = christmasPack();
    const { context } = setup(false);
    plugin.setup?.(context);
    plugin.update?.(1, 1);
    const ctx = new Proxy(
      {},
      {
        get: (_target, name) => {
          throw new Error(`Unexpected drawing call ${String(name)}`);
        },
      },
    ) as CanvasRenderingContext2D;
    expect(() => plugin.render?.(ctx, 1)).not.toThrow();
    plugin.destroy?.();
  });
});
