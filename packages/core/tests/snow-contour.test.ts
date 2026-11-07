import { describe, expect, it } from 'vitest';
import { buildSnowContours } from '../src/rendering/SnowContour.js';
import { depthAt, supportYAt } from '../src/physics/profiles.js';
import type { Surface } from '../src/types.js';
function shelf(profile: number[]): Surface {
  return {
    id: 'shape',
    element: {} as Element,
    x: 0,
    y: 100,
    width: profile.length * 6,
    height: 30,
    angle: 0,
    normal: { x: 0, y: -1 },
    velocity: { x: 0, y: 0 },
    acceleration: { x: 0, y: 0 },
    profile: new Float32Array(profile),
    binSize: 6,
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
  };
}
describe('physical snow silhouette', () => {
  it('draws no baseline or white strip for an empty support', () =>
    expect(buildSnowContours(shelf([0, 0, 0, 0]))).toEqual([]));
  it('keeps brushed gaps open rather than connecting deposits through a uniform strip', () => {
    const surface = shelf([0, 6, 24, 36, 18, 0, 0, 0, 0, 0, 12, 30, 12, 0]);
    const contours = buildSnowContours(surface);
    expect(contours).toHaveLength(2);
    expect(contours[0]?.points.at(-1)?.x).toBeLessThan(contours[1]?.points[0]?.x ?? 0);
    for (const contour of contours)
      for (const point of contour.points)
        expect(point.depth).toBeCloseTo(depthAt(surface, point.x), 8);
  });
  it('does not add scallops or periodic noise to a flat physical deposit', () => {
    const contours = buildSnowContours(shelf(Array.from({ length: 30 }, () => 24)));
    expect(contours).toHaveLength(1);
    const middle = contours[0]?.points.filter((p) => p.x > 20 && p.x < 150) ?? [];
    expect(middle.length).toBeGreaterThan(10);
    expect(
      Math.max(...middle.map((p) => p.depth)) - Math.min(...middle.map((p) => p.depth)),
    ).toBeLessThan(1e-6);
  });
});

it('attaches rounded cap shoulders to the real rounded card rather than a floating horizontal wedge', () => {
  const surface = shelf(Array.from({ length: 40 }, () => 48));
  surface.radius = 14;
  const contour = buildSnowContours(surface)[0];
  expect(contour).toBeDefined();
  const first = contour?.points[0];
  expect(first?.x).toBeGreaterThan(0);
  expect(first?.base).toBeGreaterThan(0);
  for (const point of contour?.points ?? [])
    expect(point.base).toBeCloseTo(supportYAt(surface, point.x), 8);
  expect(supportYAt(surface, 0)).toBe(14);
  expect(supportYAt(surface, 14)).toBe(0);
});
