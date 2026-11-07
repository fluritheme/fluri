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
  let previous: SnowPoint = { x: 0, depth: 0, base: supportYAt(surface, 0) };
  for (let index = 0; index <= count; index++) {
    const x = Math.min(surface.width, index * step);
    const bin = Math.min(surface.profile.length - 1, Math.floor(x / surface.binSize));
    const depth = surface.exposed?.[bin] === 0 ? 0 : Math.max(0, depthAt(surface, x));
    const point = { x, depth, base: supportYAt(surface, x) };
    if (depth > 0.06) {
      if (!current) current = { points: index === 0 ? [] : [previous], peak: 0 };
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
