import { describe, expect, it } from 'vitest';
import {
  Actors,
  CircleRecognizer,
  gatherMass,
  massFromRadius,
  radiusFromMass,
} from '../src/actors/Actors.js';
import { resolveConfig } from '../src/config.js';
import type { PluginContext, Surface, WeatherEventName } from '../src/types.js';

function fixture(route = true) {
  const attributes = new Set(['data-weather-surface', ...(route ? ['data-plough-route'] : [])]);
  const surface: Surface = {
    id: 'shelf',
    element: {
      hasAttribute: (name: string) => attributes.has(name),
      matches: (selector: string) =>
        (selector === '[data-plough-route]' && route) || selector === '[data-weather-surface]',
    } as unknown as Element,
    x: 20,
    y: 200,
    width: 320,
    height: 60,
    angle: 0,
    normal: { x: 0, y: -1 },
    velocity: { x: 0, y: 0 },
    acceleration: { x: 0, y: 0 },
    profile: new Float32Array(32).fill(80),
    binSize: 10,
    layer: 'content',
    paintOrder: 1,
    clipRegions: [],
    radius: 8,
    material: 'flat',
    maxDepth: 24,
    accumulation: true,
    visible: true,
    confidence: 'high',
    options: {},
  };
  const config = resolveConfig({ preset: 'playful' });
  const events: Array<{ name: WeatherEventName; data: unknown }> = [];
  const clumps: number[] = [];
  const context: PluginContext = {
    getConfig: () => config,
    getSurfaces: () => [surface],
    emit: (name, data) => {
      events.push({ name, data });
    },
    spawnClump: (_x, _y, mass) => {
      clumps.push(mass);
    },
  };
  return { surface, config, events, clumps, actors: new Actors(context) };
}

describe('snow actor physics', () => {
  it('converts radius and mass reversibly and conserves mass when gathering', () => {
    const { surface } = fixture();
    const before = surface.profile.reduce((sum, mass) => sum + mass, 0);
    const gathered = gatherMass(surface, 80, 30, 100);
    expect(gathered).toBeCloseTo(100);
    expect(surface.profile.reduce((sum, mass) => sum + mass, 0) + gathered).toBeCloseTo(before);
    expect(radiusFromMass(massFromRadius(17))).toBeCloseTo(17);
    expect(gatherMass(surface, 80, 30, -1)).toBe(0);
  });
  it('requires intentional Shift+press and gathers existing deposits without inventing mass', () => {
    const { surface, actors } = fixture();
    const before = surface.profile.reduce((sum, mass) => sum + mass, 0);
    const input = {
      x: 100,
      y: 192,
      vx: 0,
      vy: 0,
      pressed: true,
      shiftKey: false,
      kind: 'down' as const,
      time: 0,
    };
    actors.pointer(input);
    expect(actors.counts.snowballs).toBe(0);
    actors.pointer({ ...input, shiftKey: true });
    expect(actors.counts.snowballs).toBe(1);
    const gathered = actors.balls[0]?.mass ?? 0;
    expect(surface.profile.reduce((sum, mass) => sum + mass, 0) + gathered).toBeCloseTo(before, 3);
    actors.pointer({
      ...input,
      kind: 'up',
      shiftKey: true,
      pressed: false,
      vx: 160,
      vy: -100,
      time: 0.1,
    });
    expect(actors.balls[0]?.state).toBe('airborne');
    expect(actors.balls[0]?.vx).toBe(160);
  });
  it('does not create gesture snowballs from empty surfaces', () => {
    const { surface, actors } = fixture();
    surface.profile.fill(0);
    actors.pointer({
      x: 100,
      y: 200,
      vx: 0,
      vy: 0,
      pressed: true,
      shiftKey: true,
      kind: 'down',
      time: 0,
    });
    expect(actors.counts.snowballs).toBe(0);
  });
  it('moves resting snowballs with their support and releases them on acceleration', () => {
    const { surface, actors } = fixture();
    actors.trigger('snowball', { radius: 12 });
    const before = actors.balls[0]?.x ?? 0;
    surface.x += 50;
    actors.update(1 / 60, 1);
    expect(actors.balls[0]?.x).toBeCloseTo(before + 50);
    surface.acceleration.x = 2000;
    surface.velocity.x = 100;
    actors.update(1 / 60, 2);
    expect(actors.balls[0]?.state).toBe('airborne');
    expect(actors.balls[0]?.vx).toBeGreaterThan(90);
  });
  it('stacks three compatible balls into one snowman and restores them when support disappears', () => {
    const { actors, surface, events } = fixture();
    actors.trigger('snowman');
    expect(actors.counts).toEqual({ snowballs: 0, snowmen: 1, ploughs: 0 });
    expect(events.filter((event) => event.name === 'snowball:stacked')).toHaveLength(3);
    expect(events.filter((event) => event.name === 'snowman:created')).toHaveLength(1);
    surface.visible = false;
    actors.update(1 / 60, 1);
    expect(actors.counts.snowmen).toBe(0);
    expect(actors.counts.snowballs).toBe(3);
    expect(actors.balls.every((ball) => ball.state === 'airborne')).toBe(true);
  });
  it('breaks balls and snowmen into clumps without losing mass', () => {
    const { actors, clumps } = fixture();
    actors.trigger('snowman');
    actors.trigger('snowball', { radius: 10 });
    const createdMass =
      massFromRadius(23) +
      massFromRadius(23 * 0.74) +
      massFromRadius(23 * 0.52) +
      massFromRadius(10);
    actors.trigger('snowburst');
    expect(actors.counts.snowballs).toBe(0);
    expect(actors.counts.snowmen).toBe(0);
    expect(clumps.reduce((sum, mass) => sum + mass, 0)).toBeCloseTo(createdMass);
  });
  it('releases hover gathering after inactivity using the simulation clock', () => {
    const { actors, config } = fixture();
    config.interactions.snowballs.activation = 'hover-circle';
    actors.pointer({
      x: 100,
      y: 192,
      vx: 0,
      vy: 0,
      pressed: true,
      shiftKey: true,
      kind: 'down',
      time: 5,
    });
    expect(actors.balls[0]?.state).toBe('gathering');
    actors.update(1 / 60, 5.5);
    expect(actors.balls[0]?.state).toBe('airborne');
  });
  it('sheds excess radius as conserved clumps and melts only when configured', () => {
    const { actors, config, clumps } = fixture();
    actors.trigger('snowball', { radius: 18 });
    config.interactions.snowballs.maxRadius = 8;
    actors.update(1 / 60, 1);
    expect(actors.balls[0]?.radius).toBe(8);
    expect((actors.balls[0]?.mass ?? 0) + clumps.reduce((sum, mass) => sum + mass, 0)).toBeCloseTo(
      massFromRadius(18),
    );
    config.snow.accumulation.meltRate = 1;
    actors.update(1 / 60, 2);
    expect(actors.balls[0]?.radius).toBeLessThan(8);
  });
  it('keeps actor count bounded under repeated manual spawning', () => {
    const { actors, config } = fixture();
    config.interactions.snowballs.maxCount = 3;
    for (let count = 0; count < 20; count++) actors.trigger('snowball');
    expect(actors.counts.snowballs).toBe(3);
    actors.clear();
    expect(actors.counts.snowballs).toBe(0);
  });
});

describe('circle recognition', () => {
  it('recognizes a coherent circular gesture and rejects straight movement', () => {
    const circle = new CircleRecognizer();
    let recognized = false;
    for (let index = 0; index <= 48; index++)
      recognized ||= circle.sample(
        100 + Math.cos((index / 48) * Math.PI * 2) * 24,
        100 + Math.sin((index / 48) * Math.PI * 2) * 24,
        index / 60,
      );
    expect(recognized).toBe(true);
    const line = new CircleRecognizer();
    for (let index = 0; index < 100; index++)
      expect(line.sample(index * 2, 20, index / 60)).toBe(false);
  });
  it('rejects tiny jitter, invalid samples, and stale paths', () => {
    const circle = new CircleRecognizer();
    expect(circle.sample(NaN, 0, 0)).toBe(false);
    for (let index = 0; index <= 48; index++)
      expect(circle.sample(Math.cos(index) * 2, Math.sin(index) * 2, index * 0.1)).toBe(false);
  });
});

describe('snowplough', () => {
  it.each(['left', 'right'] as const)(
    'clears only explicit routes and conserves all pushed mass going %s',
    (direction) => {
      const { actors, surface, clumps, events } = fixture();
      const before = surface.profile.reduce((sum, mass) => sum + mass, 0);
      actors.trigger('plough', { direction });
      expect(actors.counts.ploughs).toBe(1);
      for (let index = 0; index < 330; index++) actors.update(1 / 60, index / 60);
      expect(actors.counts.ploughs).toBe(0);
      expect(
        surface.profile.reduce((sum, mass) => sum + mass, 0) +
          clumps.reduce((sum, mass) => sum + mass, 0),
      ).toBeCloseTo(before);
      expect(events.filter((event) => event.name === 'plough:complete')).toHaveLength(1);
    },
  );
  it.each([
    ['classic', '#efb93c'],
    ['minimal', '#bdccdc'],
    ['festive', '#bd5269'],
  ] as const)(
    'renders the requested %s vehicle style without changing its route',
    (style, bodyColor) => {
      const { actors } = fixture();
      actors.trigger('plough', { style });
      const colors: string[] = [];
      const beaconCenters: number[] = [];
      const ctx = new Proxy(
        {},
        {
          set: (_target, key, value: unknown) => {
            if (key === 'fillStyle') colors.push(String(value));
            return true;
          },
          get:
            (_target, name) =>
            (...args: number[]) => {
              if (name === 'arc') beaconCenters.push(args[1] ?? 0);
            },
        },
      ) as CanvasRenderingContext2D;
      actors.render(ctx, 0);
      expect(colors).toContain(bodyColor);
      expect(actors.counts.ploughs).toBe(1);
      expect(beaconCenters.includes(-29)).toBe(style !== 'minimal');
    },
  );
  it('rejects unregistered routes and duplicate ploughs', () => {
    const blocked = fixture(false);
    blocked.actors.trigger('plough');
    expect(blocked.actors.counts.ploughs).toBe(0);
    const allowed = fixture();
    allowed.actors.trigger('plough');
    allowed.actors.trigger('plough');
    expect(allowed.actors.counts.ploughs).toBe(1);
  });
});
