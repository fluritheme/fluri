import { it, expect } from 'vitest';
import type { Surface } from '../src/types.js';
import { seedDeposits } from '../src/seedDeposits.js';
import { settleSurface, createSurfaceFlowState } from '../src/physics/settling.js';
import { totalMass } from '../src/physics/profiles.js';
it('cohesive snow on stationary glyph shoulders does not diffuse through word gaps into endless droplets', () => {
  const offsets = Float32Array.from({ length: 121 }, (_, x) =>
    x % 40 > 28 ? Infinity : 8 + Math.abs((x % 40) - 14) * 0.4,
  );
  const packing = Float32Array.from({ length: 60 }, (_, i) =>
    Number.isFinite(offsets[i * 2 + 1]!) ? 1 : 0,
  );
  const s: Surface = {
    id: 'letters',
    element: {} as Element,
    x: 0,
    y: 80,
    width: 120,
    height: 50,
    angle: 0,
    normal: { x: 0, y: -1 },
    velocity: { x: 0, y: 0 },
    acceleration: { x: 0, y: 0 },
    profile: new Float32Array(60),
    binSize: 2,
    layer: 'content',
    paintOrder: 0,
    clipRegions: [],
    radius: 0,
    material: 'flat',
    maxDepth: 14,
    accumulation: true,
    visible: true,
    confidence: 'high',
    options: {},
    shape: 'text',
    contour: { offsets, step: 1 },
    packing,
  };
  seedDeposits(s, 5, 14, 7);
  const initial = totalMass(s.profile),
    flow = createSurfaceFlowState();
  let shed = 0;
  for (let i = 0; i < 1800; i++) {
    const result = settleSurface(
      s,
      1 / 60,
      { gravity: 85, softness: 0.6, sliding: true, maxDepth: 14 },
      flow,
    );
    shed += result.leftMass + result.rightMass + result.detached.reduce((n, p) => n + p.mass, 0);
  }
  expect(shed).toBe(0);
  expect(totalMass(s.profile)).toBeCloseTo(initial, 2);
  for (let i = 0; i < packing.length; i++) if (packing[i] === 0) expect(s.profile[i]).toBe(0);
});
