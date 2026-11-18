import { depthAt, supportYAt } from '../physics/profiles.js';
import type { Surface } from '../types.js';

export interface SnowPoint {
  x: number;
  depth: number;
  base: number;
}
export interface SnowContour {
  points: SnowPoint[];
  peak: number;
}

/** Trace the collision profile itself. Empty gaps stay empty; no decorative height is invented. */
export function buildSnowContours(surface: Surface): SnowContour[] {
  if (
    surface.occluded ||
    surface.width <= 0 ||
    surface.binSize <= 0 ||
    surface.profile.length === 0
  )
    return [];
  const step = Math.max(0.5, Math.min(2, surface.binSize / 3));
  const count = Math.ceil(surface.width / step);
  const contours: SnowContour[] = [];
  let current: SnowContour | undefined;
  let previous: SnowPoint | undefined;
  for (let index = 0; index <= count; index++) {
    const x = Math.min(surface.width, index * step);
    const base = supportYAt(surface, x);
    if (
      !Number.isFinite(base) ||
      (surface.contour &&
        surface.packing?.[Math.min(surface.profile.length - 1, Math.floor(x / surface.binSize))] ===
          0)
    ) {
      if (current) {
        const last = current.points[current.points.length - 1];
        if (last) current.points.push({ ...last, depth: 0 });
        if (current.peak > 0.15) contours.push(current);
        current = undefined;
      }
      previous = undefined;
      continue;
    }
    const bin = Math.min(surface.profile.length - 1, Math.floor(x / surface.binSize));
    const depth = surface.exposed?.[bin] === 0 ? 0 : Math.max(0, depthAt(surface, x));
    const point = { x, depth, base };
    if (depth > 0.06) {
      if (!current) current = { points: previous ? [previous] : [{ ...point, depth: 0 }], peak: 0 };
      current.points.push(point);
      current.peak = Math.max(current.peak, depth);
    } else if (current) {
      current.points.push(point);
      if (current.peak > 0.15) contours.push(current);
      current = undefined;
    }
    previous = point;
  }
  if (current && current.peak > 0.15) contours.push(current);
  return contours;
}
