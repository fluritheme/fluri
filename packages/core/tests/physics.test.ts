import { describe, expect, it } from 'vitest';
import { resolveConfig } from '../src/config.js';
import type { Surface } from '../src/types.js';
import {
  ParticleSystem,
  SurfaceIndex,
  deposit,
  depthAt,
  localToWorld,
  melt,
  remove,
  resizeProfile,
  seededRandom,
  smooth,
  sweptSurfaceHit,
  totalMass,
  worldToLocal,
} from '../src/physics/index.js';

function surface(patch: Partial<Surface> = {}): Surface {
  return {
    id: 'shelf',
    element: {} as Element,
    x: 0,
    y: 100,
    width: 100,
    height: 20,
    angle: 0,
    normal: { x: 0, y: -1 },
    velocity: { x: 0, y: 0 },
    acceleration: { x: 0, y: 0 },
    profile: new Float32Array(10),
    binSize: 10,
    layer: 'content',
    paintOrder: 1,
    clipRegions: [],
    radius: 0,
    material: 'flat',
    maxDepth: 30,
    accumulation: true,
    visible: true,
    confidence: 'high',
    options: {},
    ...patch,
  };
}

function simulationConfig() {
  return resolveConfig({
    snow: {
      particleCount: 0,
      gravity: 0,
      turbulence: 0,
      wind: { base: 0, gusts: false },
      accumulation: { softness: 0, growthRate: 1, sliding: false },
    },
  });
}

describe('deterministic math and coordinate spaces', () => {
  it('reproduces the same seeded stream while distinct seeds differ', () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    const c = seededRandom(43);
    const stream = Array.from({ length: 100 }, () => a());
    expect(stream).toEqual(Array.from({ length: 100 }, () => b()));
    expect(stream).not.toEqual(Array.from({ length: 100 }, () => c()));
    expect(stream.every((value) => value >= 0 && value < 1)).toBe(true);
  });

  it('roundtrips local deposits through rotated and translated support geometry', () => {
    const shelf = surface({ x: 125, y: 64, angle: Math.PI / 5 });
    const world = localToWorld(shelf, 37, -12);
    const local = worldToLocal(shelf, world);
    expect(local.x).toBeCloseTo(37, 10);
    expect(local.y).toBeCloseTo(-12, 10);
    shelf.x += 50;
    shelf.y -= 20;
    const moved = localToWorld(shelf, 37, -12);
    expect(moved.x - world.x).toBeCloseTo(50);
    expect(moved.y - world.y).toBeCloseTo(-20);
  });
});

describe('snow profiles and mass accounting', () => {
  it('returns overflow when the entire profile has reached its depth capacity', () => {
    const profile = new Float32Array(4);
    expect(deposit(profile, 10, 15, 100, 2)).toBeCloseTo(80);
    expect(totalMass(profile)).toBeCloseTo(80);
    expect([...profile]).toEqual([20, 20, 20, 20]);
    expect(deposit(profile, 10, 15, 5, 2)).toBe(0);
  });

  it('conserves profile mass during smoothing, responsive remapping, and removal', () => {
    const profile = new Float32Array([0, 50, 100, 0, 10]);
    const before = totalMass(profile);
    smooth(profile, 1, 25);
    expect(totalMass(profile)).toBeCloseTo(before, 4);
    expect(Math.max(...profile)).toBeLessThan(100);
    const resized = resizeProfile(profile, 13);
    expect(totalMass(resized)).toBeCloseTo(before, 4);
    const removed = remove(resized, 5, 30, 15, 35);
    expect(removed).toBeCloseTo(35, 4);
    expect(totalMass(resized) + removed).toBeCloseTo(before, 4);
    expect([...resized].every((value) => value >= 0)).toBe(true);
  });

  it('interpolates deposited depths and reports intentional melting losses', () => {
    const shelf = surface({ profile: new Float32Array([10, 30]), width: 20, binSize: 10 });
    expect(depthAt(shelf, 0)).toBe(1);
    expect(depthAt(shelf, 10)).toBe(2);
    expect(depthAt(shelf, 20)).toBe(3);
    const lost = melt(shelf.profile, shelf.binSize, 1, 0.5);
    expect(lost).toBe(10);
    expect(totalMass(shelf.profile)).toBe(30);
  });
});

describe('swept collisions and spatial indexing', () => {
  it('catches a particle crossing a thin shelf without landing underneath it', () => {
    const shelf = surface({ height: 1 });
    const hit = sweptSurfaceHit(shelf, { x: 50, y: -100 }, { x: 50, y: 300 }, 2);
    expect(hit?.t).toBeCloseTo(0.495);
    expect(hit?.point).toEqual({ x: 50, y: 100 });
    expect(sweptSurfaceHit(shelf, { x: 50, y: 110 }, { x: 50, y: 50 })).toBeUndefined();
  });

  it('collides with the actual rotated snow edge and respects clipping', () => {
    const shelf = surface({ angle: Math.PI / 6, profile: new Float32Array(10).fill(40) });
    const start = localToWorld(shelf, 50, -30);
    const end = localToWorld(shelf, 50, 30);
    const hit = sweptSurfaceHit(shelf, start, end);
    expect(hit?.x).toBeCloseTo(50);
    expect(hit?.t).toBeCloseTo(26 / 60);
    shelf.clipRegions = [{ x: 200, y: 200, width: 20, height: 20, radius: 0 }];
    expect(sweptSurfaceHit(shelf, start, end)).toBeUndefined();
  });

  it('queries only nearby surfaces and supports a sweep over several cells', () => {
    const near = surface();
    const distant = surface({ id: 'distant', x: 1000, y: 1000 });
    const index = new SurfaceIndex(64);
    index.rebuild([near, distant]);
    expect(index.query({ x: 40, y: 0 }, { x: 40, y: 300 })).toEqual([near]);
    expect(index.query({ x: 900, y: 900 }, { x: 1200, y: 1200 })).toEqual([distant]);
    expect(() => new SurfaceIndex(0)).toThrow(RangeError);
  });
});

describe('particle simulation', () => {
  it('reproduces complete particle state for a fixed seed and timestep', () => {
    const a = new ParticleSystem(7);
    const b = new ParticleSystem(7);
    const config = resolveConfig({ snow: { particleCount: 100, intensity: 0.75 } });
    for (let frame = 0; frame < 120; frame++) {
      a.step(1 / 60, frame / 60, 800, 600, config, []);
      b.step(1 / 60, frame / 60, 800, 600, config, []);
    }
    expect(a.particles).toEqual(b.particles);
    expect(a.particles.length).toBeGreaterThan(50);
  });

  it('transfers a high-speed clump into the nearest lower support without losing mass', () => {
    const system = new ParticleSystem(5);
    const lower = surface({ id: 'lower', y: 150 });
    const upper = surface({ y: 60 });
    system.spawnClump(50, 0, 24, 0, 6000);
    const stats = system.step(1 / 60, 0, 800, 600, simulationConfig(), [lower, upper]);
    expect(totalMass(upper.profile)).toBeCloseTo(24, 5);
    expect(totalMass(lower.profile)).toBe(0);
    expect(system.particles).toHaveLength(0);
    expect(stats.transfers).toBe(1);
  });

  it('keeps capacity overflow airborne instead of silently deleting it', () => {
    const system = new ParticleSystem(5);
    const shelf = surface({ maxDepth: 0 });
    system.spawnClump(50, 0, 24, 0, 6000);
    system.step(1 / 60, 0, 800, 600, simulationConfig(), [shelf]);
    expect(totalMass(shelf.profile)).toBe(0);
    expect(system.particles).toHaveLength(1);
    expect(system.particles[0]?.mass).toBeCloseTo(24);
  });

  it('collides against a vertically moving support in its current coordinate frame', () => {
    const system = new ParticleSystem(5);
    const shelf = surface({ y: 65, velocity: { x: 0, y: -1500 } });
    system.spawnClump(50, 70, 10, 0, 0);
    system.step(1 / 60, 0, 800, 600, simulationConfig(), [shelf]);
    expect(totalMass(shelf.profile)).toBeCloseTo(10);
    expect(system.particles).toHaveLength(0);
  });

  it('conserves mass when an accelerating surface sheds snow into clumps', () => {
    const system = new ParticleSystem(5);
    const shelf = surface({
      profile: new Float32Array(10).fill(100),
      acceleration: { x: 2500, y: 0 },
    });
    const config = simulationConfig();
    config.snow.accumulation.sliding = true;
    system.step(1 / 60, 0, 800, 600, config, [shelf]);
    const airborne = system.particles.reduce((mass, particle) => mass + particle.mass, 0);
    expect(airborne).toBeGreaterThan(0);
    expect(totalMass(shelf.profile) + airborne).toBeCloseTo(1000, 3);
  });

  it('ramps intensity down and clears all runtime particle state', () => {
    const system = new ParticleSystem(5);
    const config = resolveConfig({ snow: { particleCount: 100, intensity: 1 } });
    for (let frame = 0; frame < 90; frame++) system.step(1 / 60, frame / 60, 800, 600, config, []);
    const before = system.particles.length;
    system.setIntensity(0);
    system.step(1 / 60, 2, 800, 600, config, []);
    expect(system.particles.length).toBeGreaterThan(before * 0.8);
    for (let frame = 0; frame < 240; frame++)
      system.step(1 / 60, 2 + frame / 60, 800, 600, config, []);
    expect(system.particles).toHaveLength(0);
    system.spawnClump(20, 20, 10, 0, 0);
    system.clear();
    expect(system.particles).toHaveLength(0);
    expect(() => system.setIntensity(NaN)).toThrow(RangeError);
  });
});
