import { describe, expect, it } from 'vitest';
import { seedDeposits } from '../src/seedDeposits.js';
import { resolveConfig } from '../src/config.js';
import type { Surface } from '../src/types.js';
import {
  ParticleSystem,
  createSurfaceFlowState,
  depthAt,
  deposit,
  settleSurface,
  sweptSurfaceHit,
  totalMass,
} from '../src/physics/index.js';

function shelf(patch: Partial<Surface> = {}): Surface {
  return {
    id: 'surface',
    element: {} as Element,
    x: 100,
    y: 150,
    width: 160,
    height: 40,
    angle: 0,
    normal: { x: 0, y: -1 },
    velocity: { x: 0, y: 0 },
    acceleration: { x: 0, y: 0 },
    profile: new Float32Array(32),
    binSize: 5,
    layer: 'content',
    paintOrder: 0,
    clipRegions: [],
    radius: 0,
    material: 'flat',
    maxDepth: 24,
    accumulation: true,
    visible: true,
    confidence: 'high',
    options: {},
    ...patch,
  };
}
const options = { gravity: 85, softness: 0.6, sliding: true, maxDepth: 24 };
function massCentre(profile: Float32Array): number {
  return (
    profile.reduce((sum, mass, index) => sum + (index + 0.5) * mass, 0) /
    Math.max(1e-12, totalMass(profile))
  );
}
function config() {
  return resolveConfig({
    snow: {
      particleCount: 0,
      gravity: 85,
      turbulence: 0,
      wind: { base: 0, gusts: false },
      accumulation: { softness: 0.6, growthRate: 1, sliding: true, maxDepth: 24 },
    },
    dom: { respectLayers: false },
  });
}

describe('localized physical accumulation', () => {
  it('deposits a normalized local kernel rather than filling one bin or striping the whole edge', () => {
    const profile = new Float32Array(201);
    const accepted = deposit(profile, 5, 502, 30, 24);
    expect(accepted).toBeCloseTo(30, 5);
    expect(totalMass(profile)).toBeCloseTo(30, 5);
    expect(profile.filter((mass) => mass > 1e-4).length).toBeGreaterThan(2);
    expect(profile.filter((mass) => mass > 1e-4).length).toBeLessThan(12);
    expect(profile[0]).toBe(0);
    expect(profile[200]).toBe(0);
    expect(Math.abs(massCentre(profile) * 5 - 502)).toBeLessThan(1);
  });
  it('keeps zero gaps and monotone hills in the collision/render interpolation', () => {
    const surface = shelf({
      profile: new Float32Array([0, 0, 25, 80, 25, 0, 0]),
      width: 35,
      binSize: 5,
    });
    for (let x = 0; x < 7.5; x += 0.1) expect(depthAt(surface, x)).toBe(0);
    let previous = 0;
    for (let x = 7.5; x <= 17.5; x += 0.1) {
      const value = depthAt(surface, x);
      expect(value).toBeGreaterThanOrEqual(previous - 1e-8);
      expect(value).toBeLessThanOrEqual(16);
      previous = value;
    }
    surface.radius = 8;
    expect(depthAt(surface, 0)).toBe(0);
    expect(depthAt(surface, surface.width)).toBe(0);
  });
  it('uses the same curved edge in continuous collisions to within a subpixel tolerance', () => {
    const surface = shelf({
      profile: new Float32Array([0, 5, 100, 20, 0, 80, 0]),
      width: 35,
      binSize: 5,
      radius: 5,
    });
    for (let x = 0.2; x < 35; x += 0.43) {
      const hit = sweptSurfaceHit(
        surface,
        { x: surface.x + x, y: 70 },
        { x: surface.x + x, y: 180 },
      );
      expect(hit).toBeDefined();
      if (hit) expect(Math.abs(70 + 110 * hit.t - hit.point.y)).toBeLessThan(0.22);
    }
  });
  it('rejects opaque-covered edges and individually covered bins', () => {
    const surface = shelf({ occluded: true });
    expect(sweptSurfaceHit(surface, { x: 120, y: 100 }, { x: 120, y: 200 })).toBeUndefined();
    surface.occluded = false;
    surface.exposed = new Uint8Array(32).fill(1);
    surface.exposed[4] = 0;
    expect(sweptSurfaceHit(surface, { x: 122, y: 100 }, { x: 122, y: 200 })).toBeUndefined();
    expect(sweptSurfaceHit(surface, { x: 150, y: 100 }, { x: 150, y: 200 })).toBeDefined();
  });
});

describe('granular settling and coherent avalanches', () => {
  it('releases coherent parcels when a support accelerates downward faster than adhesion can hold', () => {
    const surface = shelf({
      profile: new Float32Array(32).fill(30),
      velocity: { x: 45, y: 200 },
      acceleration: { x: 0, y: 6000 },
    });
    const before = totalMass(surface.profile);
    const state = createSurfaceFlowState();
    const result = settleSurface(surface, 1 / 60, options, state);
    expect(result.detached.length).toBeGreaterThan(0);
    expect(result.detached.length).toBeLessThanOrEqual(6);
    expect(totalMass(surface.profile)).toBe(0);
    expect(result.detached.reduce((sum, parcel) => sum + parcel.mass, 0)).toBeCloseTo(before, 5);
    for (const parcel of result.detached) {
      expect(parcel.mass).toBeGreaterThan(20);
      expect(parcel.vx).toBe(45);
      expect(parcel.vy).toBe(100);
    }
  });
  it('turns an imposed depth-cap reduction into conservative edge discharge', () => {
    const surface = shelf({ profile: new Float32Array(32).fill(30) });
    const before = totalMass(surface.profile);
    const result = settleSurface(
      surface,
      1 / 60,
      { ...options, maxDepth: 1 },
      createSurfaceFlowState(),
    );
    expect([...surface.profile].every((mass) => mass <= 5.00001)).toBe(true);
    expect(totalMass(surface.profile) + result.leftMass + result.rightMass).toBeCloseTo(before, 4);
    expect(result.leftMass + result.rightMass).toBeGreaterThan(500);
  });
  it('retains a stable local drift below material repose instead of diffusing it flat', () => {
    const surface = shelf({ profile: new Float32Array([0, 5, 10, 15, 10, 5, 0]), width: 35 });
    const before = [...surface.profile];
    const state = createSurfaceFlowState();
    for (let frame = 0; frame < 240; frame++) settleSurface(surface, 1 / 60, options, state);
    expect([...surface.profile]).toEqual(before);
    expect(state.velocity).toBe(0);
  });
  it('redistributes an unstable mound conservatively, with sticky snow retaining a steeper slope', () => {
    const flat = shelf({ profile: new Float32Array(32), material: 'flat' });
    flat.profile[15] = 120;
    const sticky = shelf({ profile: new Float32Array(flat.profile), material: 'sticky' });
    const a = createSurfaceFlowState(),
      b = createSurfaceFlowState();
    for (let frame = 0; frame < 240; frame++) {
      settleSurface(flat, 1 / 60, options, a);
      settleSurface(sticky, 1 / 60, options, b);
    }
    expect(totalMass(flat.profile)).toBeCloseTo(120, 3);
    expect(totalMass(sticky.profile)).toBeCloseTo(120, 3);
    expect(flat.profile[15]).toBeLessThan(sticky.profile[15] ?? 0);
    expect(flat.profile[14]).toBeGreaterThan(0);
  });
  it('moves real stored mass downhill and releases it from the lower edge', () => {
    const surface = shelf({
      angle: 0.45,
      material: 'slippery',
      profile: new Float32Array(32).fill(24),
    });
    const before = totalMass(surface.profile),
      centre = massCentre(surface.profile);
    const state = createSurfaceFlowState();
    let discharged = 0;
    for (let frame = 0; frame < 300; frame++) {
      const result = settleSurface(surface, 1 / 60, options, state);
      discharged += result.leftMass + result.rightMass;
    }
    expect(discharged).toBeGreaterThan(before * 0.2);
    expect(massCentre(surface.profile)).toBeGreaterThan(centre);
    expect(totalMass(surface.profile) + discharged).toBeCloseTo(before, 2);
  });
  it('retains support impulse as sliding inertia after acceleration ends', () => {
    const surface = shelf({
      profile: new Float32Array(32).fill(30),
      acceleration: { x: 3000, y: 0 },
    });
    const state = createSurfaceFlowState();
    settleSurface(surface, 1 / 60, options, state);
    const initial = state.velocity;
    surface.acceleration = { x: 0, y: 0 };
    const result = settleSurface(surface, 1 / 60, options, state);
    expect(initial).toBeLessThan(-20);
    expect(state.velocity).toBeLessThan(-20);
    expect(result.movedMass).toBeGreaterThan(0);
  });
  it('gives the same flow for equal simulated time at 60 and 120 steps per second', () => {
    const a = shelf({ angle: 0.3, material: 'slippery', profile: new Float32Array(32).fill(30) });
    const b = shelf({ angle: 0.3, material: 'slippery', profile: new Float32Array(a.profile) });
    const sa = createSurfaceFlowState(),
      sb = createSurfaceFlowState();
    let left = 0,
      right = 0;
    for (let frame = 0; frame < 120; frame++) {
      const result = settleSurface(a, 1 / 60, options, sa);
      left += result.leftMass + result.rightMass;
    }
    for (let frame = 0; frame < 240; frame++) {
      const result = settleSurface(b, 1 / 120, options, sb);
      right += result.leftMass + result.rightMass;
    }
    expect([...a.profile]).toEqual([...b.profile]);
    expect(left).toBeCloseTo(right, 7);
    expect(sa.velocity).toBeCloseTo(sb.velocity, 8);
  });
});

describe('transfer, support velocity, and scoped emission', () => {
  it('emits ambient snow in a scoped rectangle while keeping viewport coordinates', () => {
    const system = new ParticleSystem(99);
    const settings = resolveConfig({
      snow: { particleCount: 200, intensity: 1, wind: { base: 0, gusts: false }, turbulence: 0 },
    });
    const bounds = { x: 420, y: 250, width: 180, height: 160 };
    system.step(1 / 60, 0, 1200, 900, settings, [], 1, bounds);
    expect(system.particles.length).toBeGreaterThan(0);
    for (const particle of system.particles) {
      expect(particle.x).toBeGreaterThanOrEqual(420);
      expect(particle.x).toBeLessThanOrEqual(600);
      expect(particle.y).toBeGreaterThanOrEqual(250);
      expect(particle.y).toBeLessThan(413);
    }
    system.particles.length = 0;
    system.step(1 / 60, 1 / 60, 1200, 900, settings, [], 1, bounds);
    for (const particle of system.particles) {
      expect(particle.y).toBeGreaterThan(200);
      expect(particle.y).toBeLessThan(250);
    }
  });
  it('conserves real snow through a shelf impulse, coherent edge discharge, and lower-shelf landing', () => {
    const system = new ParticleSystem(4);
    const upper = shelf({
      profile: new Float32Array(32).fill(30),
      velocity: { x: 180, y: 0 },
      acceleration: { x: 3000, y: 0 },
    });
    const lower = shelf({
      id: 'lower',
      x: 0,
      y: 350,
      width: 600,
      profile: new Float32Array(120),
      binSize: 5,
      maxDepth: 60,
    });
    const settings = config();
    settings.snow.accumulation.maxDepth = 60;
    const before = totalMass(upper.profile);
    let slides = 0,
      transfers = 0,
      slideMass = 0;
    for (let frame = 0; frame < 240; frame++) {
      const result = system.step(1 / 60, frame / 60, 900, 900, settings, [upper, lower]);
      slides += result.slides;
      transfers += result.transfers;
      slideMass += result.slideMass;
      if (frame === 0) {
        expect(
          system.particles.some((particle) => particle.kind === 'clump' && particle.vx > 100),
        ).toBe(true);
        upper.acceleration = { x: 0, y: 0 };
        upper.velocity = { x: 0, y: 0 };
      }
    }
    const airborne = system.particles.reduce((sum, particle) => sum + particle.mass, 0);
    expect(slides).toBeGreaterThan(0);
    expect(slideMass).toBeGreaterThan(10);
    expect(transfers).toBeGreaterThan(0);
    expect(totalMass(lower.profile)).toBeGreaterThan(10);
    expect(totalMass(upper.profile) + totalMass(lower.profile) + airborne).toBeCloseTo(before, 1);
  });
  it('lets fresh brushed snow pass its source edge before landing on a lower shelf', () => {
    const system = new ParticleSystem(1);
    const upper = shelf();
    const lower = shelf({ id: 'lower', y: 240 });
    const settings = config();
    system.spawnClump(180, 142, 20, 0, 100, upper);
    for (let frame = 0; frame < 120; frame++)
      system.step(1 / 60, frame / 60, 900, 900, settings, [upper, lower]);
    expect(totalMass(upper.profile)).toBe(0);
    expect(totalMass(lower.profile)).toBeCloseTo(20, 4);
  });
  it('moves excess snow along a full shelf to an edge rather than bouncing at the impact point', () => {
    const system = new ParticleSystem(1);
    const upper = shelf({ width: 80, profile: new Float32Array(16), maxDepth: 0 });
    const lower = shelf({
      id: 'lower',
      x: 0,
      y: 330,
      width: 600,
      profile: new Float32Array(120),
      maxDepth: 60,
    });
    system.spawnClump(145, 110, 40, 0, 100);
    const settings = config();
    settings.snow.accumulation.maxDepth = 60;
    let transfers = 0;
    for (let frame = 0; frame < 300; frame++)
      transfers += system.step(1 / 60, frame / 60, 900, 900, settings, [upper, lower]).transfers;
    expect(totalMass(upper.profile)).toBe(0);
    expect(transfers).toBeGreaterThan(0);
    expect(totalMass(lower.profile)).toBeCloseTo(40, 3);
  });
});

describe('measured motion and floating-point stability', () => {
  it('uses the actual prior measured support velocity when frame and simulation intervals differ', () => {
    const support = shelf({
      velocity: { x: 96, y: 188 },
      previousVelocity: { x: 72, y: 140 },
      acceleration: { x: 5760, y: 11520 },
      profile: new Float32Array(32).fill(20),
    });
    const result = settleSurface(support, 1 / 60, options, createSurfaceFlowState());
    expect(result.detached.length).toBeGreaterThan(0);
    for (const parcel of result.detached) {
      expect(parcel.vx).toBe(72);
      expect(parcel.vy).toBe(140);
    }
    expect(
      result.detached.reduce((sum, parcel) => sum + parcel.mass, 0) + totalMass(support.profile),
    ).toBeCloseTo(640, 3);
  });
  it('does not turn one-ULP saturation on fractional-width stationary shelves into phantom clumps', () => {
    const support = shelf({
      width: 327,
      binSize: 327 / 55,
      profile: new Float32Array(55),
      maxDepth: 28,
    });
    seedDeposits(support, 16, 28, 20261105);
    const before = totalMass(support.profile),
      system = new ParticleSystem(7),
      settings = config();
    settings.snow.accumulation.maxDepth = 28;
    for (let step = 0; step < 120; step++)
      system.step(1 / 60, step / 60, 900, 900, settings, [support]);
    expect(system.particles).toHaveLength(0);
    expect(totalMass(support.profile)).toBeCloseTo(before, 2);
  });
});
