import { describe, expect, it } from 'vitest';
import { FrameBudget, particleBudget } from '../src/performance/Budget.js';
import { createPackingProfile } from '../src/physics/packing.js';
import { deposit, totalMass } from '../src/physics/profiles.js';
import { ParticleSystem } from '../src/physics/ParticleSystem.js';
describe('responsive visual work budgets', () => {
  it('responds to late compositor frames even when JavaScript work looks inexpensive', () => {
    const budget = new FrameBudget();
    let quality = 1;
    for (let frame = 0; frame < 3; frame++) quality = budget.observe(7, 200, 1000 / 60, quality);
    expect(quality).toBeLessThan(0.8);
    for (let frame = 0; frame < 30; frame++) quality = budget.observe(7, 200, 1000 / 60, quality);
    expect(quality).toBe(0.12);
  });
  it('reduces quickly on a long work frame and only recovers after sustained spare capacity', () => {
    const budget = new FrameBudget();
    let quality = budget.observe(50, 50, 1000 / 60, 1);
    expect(quality).toBeLessThan(0.8);
    for (let frame = 0; frame < 60; frame++) quality = budget.observe(1, 16.7, 16.7, quality);
    expect(quality).toBeLessThan(0.8);
    for (let frame = 0; frame < 200; frame++) quality = budget.observe(1, 16.7, 16.7, quality);
    expect(quality).toBeGreaterThan(0.72);
  });
  it('bounds huge preset requests by device and visible scene area without changing zero budgets', () => {
    expect(particleBudget(4000, 1440 * 900, false, true)).toBeLessThanOrEqual(1000);
    expect(particleBudget(4000, 390 * 600, true, true)).toBeLessThanOrEqual(320);
    expect(particleBudget(0, 390 * 600, true, true)).toBe(0);
    expect(particleBudget(4000, 1440 * 900, false, false)).toBe(4000);
  });
  it('bounds repeated brush parcels while conserving their combined mass and momentum', () => {
    const system = new ParticleSystem(13);
    for (let i = 0; i < 2000; i++) system.spawnClump(40 + (i % 20), 80, 3, 100, 20);
    expect(system.particles.length).toBeLessThanOrEqual(320);
    expect(system.particles.reduce((m, p) => m + p.mass, 0)).toBeCloseTo(6000, 4);
    expect(system.particles.reduce((m, p) => m + p.mass * p.vx, 0)).toBeCloseTo(600000, 3);
  });
});
describe('nonuniform full snow packing', () => {
  it('keeps a saturated support irregular in the actual mass profile, within its maximum depth', () => {
    const profile = new Float32Array(100),
      packing = createPackingProfile(100, 6, 47);
    const accepted = deposit(profile, 6, 300, 100000, 16, packing);
    expect(accepted).toBeCloseTo(totalMass(profile), 2);
    const depths = [...profile].map((m) => m / 6);
    expect(Math.max(...depths)).toBeLessThanOrEqual(16.00001);
    expect(Math.max(...depths) - Math.min(...depths)).toBeGreaterThan(2);
    expect(deposit(profile, 6, 200, 100, 16, packing)).toBeLessThan(0.001);
    expect([...packing]).toEqual([...createPackingProfile(100, 6, 47)]);
    expect([...packing]).not.toEqual([...createPackingProfile(100, 6, 48)]);
  });
});
