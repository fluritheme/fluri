import { describe, expect, it } from 'vitest';
import { seedDeposits } from '../src/seedDeposits.js';
import { totalMass } from '../src/physics/profiles.js';
import type { Surface } from '../src/types.js';
const support = (): Surface => ({
  id: 'drift',
  element: {} as Element,
  x: 0,
  y: 50,
  width: 300,
  height: 30,
  angle: 0,
  normal: { x: 0, y: -1 },
  velocity: { x: 0, y: 0 },
  acceleration: { x: 0, y: 0 },
  profile: new Float32Array(50),
  binSize: 6,
  layer: 'content',
  paintOrder: 0,
  clipRegions: [],
  radius: 12,
  material: 'flat',
  maxDepth: 80,
  accumulation: true,
  visible: true,
  confidence: 'high',
  options: {},
});
describe('manual seeded snow source', () => {
  it('adds the requested mass without repeating the same cap on different supports', () => {
    const a = support(),
      b = support(),
      c = support();
    const accepted = seedDeposits(a, 3, 80, 123);
    seedDeposits(b, 3, 80, 124);
    seedDeposits(c, 3, 80, 123);
    expect(accepted).toBeCloseTo(900, 2);
    expect(totalMass(a.profile)).toBeCloseTo(900, 2);
    expect([...a.profile]).toEqual([...c.profile]);
    expect([...a.profile]).not.toEqual([...b.profile]);
    const depths = [...a.profile].map((m) => m / a.binSize);
    expect(Math.max(...depths) - Math.min(...depths)).toBeGreaterThan(2);
  });
  it('respects physical capacity and does not mutate zero-volume deposits', () => {
    const a = support();
    expect(seedDeposits(a, 0, 10, 12)).toBe(0);
    expect(totalMass(a.profile)).toBe(0);
    const accepted = seedDeposits(a, 70, 8, 12);
    expect(accepted).toBeCloseTo(2400, 2);
    expect(Math.max(...a.profile)).toBeLessThanOrEqual(48.001);
  });
});
