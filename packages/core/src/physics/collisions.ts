import type { ClipRect, Surface, Vec2 } from '../types.js';
import { clamp, localToWorld, surfaceNormal, worldToLocal } from './math.js';
import { snowYAt } from './profiles.js';

export interface SurfaceHit {
  surface: Surface;
  t: number;
  x: number;
  point: Vec2;
  normal: Vec2;
}

function insideClip(point: Vec2, clip: ClipRect): boolean {
  if (
    point.x < clip.x ||
    point.x > clip.x + clip.width ||
    point.y < clip.y ||
    point.y > clip.y + clip.height
  )
    return false;
  const radius = Math.max(0, Math.min(clip.radius, clip.width / 2, clip.height / 2));
  const x = point.x - clamp(point.x, clip.x + radius, clip.x + clip.width - radius);
  const y = point.y - clamp(point.y, clip.y + radius, clip.y + clip.height - radius);
  return x * x + y * y <= radius * radius + 1e-6;
}

/** Swept intersections prevent high-speed clumps crossing a one-pixel shelf. */
export function sweptSurfaceHit(
  surface: Surface,
  start: Vec2,
  end: Vec2,
  radius = 0,
): SurfaceHit | undefined {
  if (!surface.visible || surface.occluded || surface.width <= 0) return undefined;
  const a = worldToLocal(surface, start);
  const b = worldToLocal(surface, end);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (
    Math.max(a.y, b.y) + radius < -surface.maxDepth ||
    Math.min(a.y, b.y) - radius > surface.radius
  )
    return undefined;
  if (Math.max(a.x, b.x) < 0 || Math.min(a.x, b.x) > surface.width) return undefined;
  // Each linear profile section is an exact collision segment in local space.
  const startX = Math.max(0, Math.min(a.x, b.x));
  const endX = Math.min(surface.width, Math.max(a.x, b.x));
  // Only sample the crossed interval. Sampling to both far shelf ends made each flake
  // traverse an entire snow profile even when it moved a fraction of one CSS pixel.
  const narrowLeft = Math.max(0, startX - 0.5),
    narrowRight = Math.min(surface.width, endX + 0.5);
  const boundaries = [narrowLeft];
  if (surface.binSize > 0) {
    const first = Math.max(0, Math.ceil(narrowLeft / surface.binSize - 0.5));
    const last = Math.min(
      surface.profile.length - 1,
      Math.floor(narrowRight / surface.binSize - 0.5),
    );
    for (let index = first; index <= last; index++) {
      const x = (index + 0.5) * surface.binSize;
      if (x > narrowLeft && x < narrowRight) boundaries.push(x);
    }
  }
  boundaries.push(narrowRight);
  const sampled: number[] = [];
  const subdivide = (
    left: number,
    right: number,
    leftDepth: number,
    rightDepth: number,
    level: number,
  ): void => {
    const span = right - left;
    let error = 0;
    for (const fraction of [0.25, 0.5, 0.75])
      error = Math.max(
        error,
        Math.abs(
          snowYAt(surface, left + span * fraction) -
            (leftDepth + (rightDepth - leftDepth) * fraction),
        ),
      );
    if (error > 0.16 && level < 5) {
      const middle = (left + right) / 2;
      const middleDepth = snowYAt(surface, middle);
      subdivide(left, middle, leftDepth, middleDepth, level + 1);
      subdivide(middle, right, middleDepth, rightDepth, level + 1);
    } else sampled.push(right);
  };
  for (let index = 0; index + 1 < boundaries.length; index++) {
    const left = boundaries[index] ?? 0;
    const right = boundaries[index + 1] ?? surface.width;
    if (right < startX || left > endX || right - left <= 1e-8) continue;
    if (sampled[sampled.length - 1] !== left) sampled.push(left);
    subdivide(left, right, snowYAt(surface, left), snowYAt(surface, right), 0);
  }
  let best: SurfaceHit | undefined;
  for (let index = 0; index + 1 < sampled.length; index++) {
    const left = sampled[index] ?? 0;
    const right = sampled[index + 1] ?? surface.width;
    if (right < startX || left > endX || right - left <= 1e-8) continue;
    const leftY = snowYAt(surface, left) - radius;
    const rightY = snowYAt(surface, right) - radius;
    const slope = (rightY - leftY) / (right - left);
    const denominator = dy - slope * dx;
    if (denominator <= 1e-8) continue;
    const t = (leftY + slope * (a.x - left) - a.y) / denominator;
    if (t < -1e-7 || t > 1 || (best && t >= best.t)) continue;
    const x = a.x + dx * t;
    if (x < left - 1e-7 || x > right + 1e-7) continue;
    if (
      surface.exposed?.[clamp(Math.floor(x / surface.binSize), 0, surface.profile.length - 1)] === 0
    )
      continue;
    const point = localToWorld(surface, x, snowYAt(surface, x));
    if (
      surface.options.clip !== false &&
      surface.clipRegions.some((clip) => !insideClip(point, clip))
    )
      continue;
    const baseNormal = surfaceNormal(surface);
    const tx = Math.cos(surface.angle);
    const ty = Math.sin(surface.angle);
    const scale = 1 / Math.hypot(1, slope);
    best = {
      surface,
      t: Math.max(0, t),
      x,
      point,
      normal: { x: (baseNormal.x + slope * tx) * scale, y: (baseNormal.y + slope * ty) * scale },
    };
  }
  return best;
}

/** Grid cells contain shelf bounds, never individual flake state. Rebuild on dirty geometry. */
export class SurfaceIndex {
  private readonly cells = new Map<string, Surface[]>();
  private readonly oversized: Surface[] = [];
  private surfaces: readonly Surface[] = [];
  constructor(readonly cellSize = 128) {
    if (!(cellSize >= 8) || !Number.isFinite(cellSize))
      throw new RangeError('SurfaceIndex cell size must be finite and at least 8.');
  }

  rebuild(surfaces: readonly Surface[]): void {
    this.cells.clear();
    this.oversized.length = 0;
    this.surfaces = surfaces.filter((surface) => surface.visible && surface.width > 0);
    for (const surface of this.surfaces) {
      const end = localToWorld(surface, surface.width);
      const depth = Math.max(surface.maxDepth, 0);
      const x1 = Math.floor((Math.min(surface.x, end.x) - depth) / this.cellSize);
      const x2 = Math.floor((Math.max(surface.x, end.x) + depth) / this.cellSize);
      const y1 = Math.floor((Math.min(surface.y, end.y) - depth) / this.cellSize);
      const y2 = Math.floor((Math.max(surface.y, end.y) + depth) / this.cellSize);
      // Malformed external surfaces must not allocate an unbounded spatial grid.
      if ((x2 - x1 + 1) * (y2 - y1 + 1) > 4096) {
        this.oversized.push(surface);
        continue;
      }
      for (let x = x1; x <= x2; x++)
        for (let y = y1; y <= y2; y++) {
          const key = `${x},${y}`;
          const cell = this.cells.get(key);
          if (cell) cell.push(surface);
          else this.cells.set(key, [surface]);
        }
    }
  }

  query(start: Vec2, end: Vec2, radius = 0): Surface[] {
    const x1 = Math.floor((Math.min(start.x, end.x) - radius) / this.cellSize);
    const x2 = Math.floor((Math.max(start.x, end.x) + radius) / this.cellSize);
    const y1 = Math.floor((Math.min(start.y, end.y) - radius) / this.cellSize);
    const y2 = Math.floor((Math.max(start.y, end.y) + radius) / this.cellSize);
    if ((x2 - x1 + 1) * (y2 - y1 + 1) > 4096) return [...this.surfaces];
    const found = new Set<Surface>(this.oversized);
    for (let x = x1; x <= x2; x++)
      for (let y = y1; y <= y2; y++) {
        for (const surface of this.cells.get(`${x},${y}`) ?? []) found.add(surface);
      }
    return [...found];
  }
}
