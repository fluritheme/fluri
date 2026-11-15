import { describe, expect, it } from 'vitest';
import { Actors, massFromRadius } from '../src/actors/Actors.js';
import { ParticleSystem } from '../src/physics/ParticleSystem.js';
import { resolveConfig } from '../src/config.js';
import type { PluginContext, Surface } from '../src/types.js';

function scene() {
  const surface: Surface = {
    id: 'landing',
    element: {
      hasAttribute: (name: string) => name === 'data-weather-surface',
    } as unknown as Element,
    x: 0,
    y: 280,
    width: 600,
    height: 100,
    angle: 0,
    normal: { x: 0, y: -1 },
    velocity: { x: 0, y: 0 },
    acceleration: { x: 0, y: 0 },
    profile: new Float32Array(60),
    binSize: 10,
    layer: 'content',
    paintOrder: 1,
    clipRegions: [],
    radius: 0,
    material: 'flat',
    maxDepth: 80,
    accumulation: true,
    visible: true,
    confidence: 'high',
    options: {},
  };
  const config = resolveConfig({
    preset: 'playful',
    snow: {
      enabled: false,
      turbulence: 0,
      wind: { base: 0, gusts: false },
      accumulation: { maxDepth: 80, sliding: false, softness: 0 },
    },
  });
  const particles = new ParticleSystem(19);
  const surfaces = [surface];
  const context: PluginContext = {
    getConfig: () => config,
    getSurfaces: () => surfaces,
    emit: () => {},
    spawnClump: (...args) => particles.spawnClump(...args),
  };
  return { actors: new Actors(context), particles, config, surface, surfaces };
}

describe('snowman collapse into real loose snow', () => {
  it('crumbles downwards into small granules, then deposits its conserved mass as a mound', () => {
    const { actors, particles, config, surface } = scene();
    actors.trigger('snowman');
    expect(actors.counts.snowmen).toBe(1);
    const expectedMass = massFromRadius(23) + massFromRadius(23 * 0.74) + massFromRadius(23 * 0.52);
    actors.trigger('snowburst');
    expect(actors.counts.snowmen).toBe(0);
    expect(actors.counts.snowballs).toBe(0);
    expect(particles.particles.length).toBeGreaterThan(80);
    expect(particles.particles.every((particle) => particle.radius <= 3 && particle.vy > 0)).toBe(
      true,
    );
    expect(particles.particles.reduce((sum, particle) => sum + particle.mass, 0)).toBeCloseTo(
      expectedMass,
      8,
    );
    const initialSpread =
      Math.max(...particles.particles.map((particle) => particle.y)) -
      Math.min(...particles.particles.map((particle) => particle.y));
    expect(initialSpread).toBeGreaterThan(60);
    for (let frame = 1; frame <= 360; frame++) {
      actors.update(1 / 60, frame / 60);
      particles.step(1 / 60, frame / 60, 600, 700, config, [surface]);
    }
    const settledMass = surface.profile.reduce((sum, mass) => sum + mass, 0);
    const looseMass = particles.particles.reduce((sum, particle) => sum + particle.mass, 0);
    expect(settledMass).toBeGreaterThan(expectedMass * 0.98);
    expect(settledMass + looseMass).toBeCloseTo(expectedMass, 2);
    expect(actors.counts.snowballs).toBe(0);
    expect(actors.counts.snowmen).toBe(0);
  });

  it('does not release the three packed body balls when its support is jolted away', () => {
    const { actors, particles, surface } = scene();
    actors.trigger('snowman');
    surface.acceleration.x = 1500;
    surface.velocity.x = 70;
    actors.update(1 / 60, 1);
    expect(actors.counts.snowmen).toBe(0);
    expect(actors.counts.snowballs).toBe(0);
    expect(particles.particles.length).toBeGreaterThan(80);
    expect(
      particles.particles.every((particle) => particle.kind === 'clump' && particle.radius <= 3),
    ).toBe(true);
    const meanHorizontalVelocity =
      particles.particles.reduce((sum, particle) => sum + particle.vx * particle.mass, 0) /
      particles.particles.reduce((sum, particle) => sum + particle.mass, 0);
    expect(meanHorizontalVelocity).toBeCloseTo(70, 8);
  });
  it('prefers a stable card over an earlier text heading for a manually added snowman', () => {
    const { actors, particles, surface, surfaces } = scene();
    const heading: Surface = {
      ...surface,
      id: 'heading',
      y: 20,
      shape: 'text',
      profile: new Float32Array(60),
      contour: { offsets: new Float32Array(60).fill(12), step: 10 },
    };
    surfaces.unshift(heading);
    actors.trigger('snowman');
    expect(actors.counts.snowmen).toBe(1);
    actors.trigger('snowburst');
    expect(Math.min(...particles.particles.map((particle) => particle.y))).toBeGreaterThan(150);
  });

  it('never creates an infinite or floating snowman in a text gap, but can use a real glyph footing', () => {
    const { actors, particles, surface } = scene();
    surface.shape = 'text';
    const offsets = new Float32Array(60).fill(Infinity);
    surface.contour = { offsets, step: 10 };
    actors.trigger('snowman', { surface: surface.element });
    expect(actors.counts.snowmen).toBe(0);
    offsets.fill(30, 8, 15);
    actors.trigger('snowman', { surface: surface.element });
    expect(actors.counts.snowmen).toBe(1);
    actors.trigger('snowburst');
    expect(particles.particles.length).toBeGreaterThan(80);
    expect(particles.particles.every((particle) => Number.isFinite(particle.x + particle.y))).toBe(
      true,
    );
    expect(Math.max(...particles.particles.map((particle) => particle.x))).toBeLessThan(160);
  });
});
