import type { Surface, Vec2 } from '../types.js';

export const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

/** A small reproducible PRNG: simulation output never depends on Math.random(). */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Surface-local y is positive below its edge; deposits occupy negative local y. */
export function localToWorld(surface: Pick<Surface, 'x' | 'y' | 'angle'>, x: number, y = 0): Vec2 {
  const cosine = Math.cos(surface.angle);
  const sine = Math.sin(surface.angle);
  return { x: surface.x + x * cosine - y * sine, y: surface.y + x * sine + y * cosine };
}

export function worldToLocal(surface: Pick<Surface, 'x' | 'y' | 'angle'>, point: Vec2): Vec2 {
  const cosine = Math.cos(surface.angle);
  const sine = Math.sin(surface.angle);
  const x = point.x - surface.x;
  const y = point.y - surface.y;
  return { x: x * cosine + y * sine, y: -x * sine + y * cosine };
}

export function surfaceNormal(surface: Pick<Surface, 'angle'>): Vec2 {
  return { x: Math.sin(surface.angle), y: -Math.cos(surface.angle) };
}
