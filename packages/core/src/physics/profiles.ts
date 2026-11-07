import type { Surface } from '../types.js';
import { clamp } from './math.js';
const depositScratch = new WeakMap<Float32Array, Float64Array>();

export function totalMass(profile: Float32Array): number {
  let mass = 0;
  for (const value of profile) mass += value;
  return mass;
}

/** Interpolate bin centres so the collision edge matches the rendered silhouette. */
export function depthAt(
  surface: Pick<Surface, 'profile' | 'binSize' | 'width'> & { radius?: number },
  x: number,
): number {
  if (!surface.profile.length || surface.binSize <= 0) return 0;
  const position = clamp(x / surface.binSize - 0.5, 0, surface.profile.length - 1);
  const left = Math.floor(position);
  const right = Math.min(left + 1, surface.profile.length - 1);
  const amount = position - left;
  const a = (surface.profile[left] ?? 0) / surface.binSize;
  const b = (surface.profile[right] ?? 0) / surface.binSize;
  const difference = b - a;
  const before = a - (surface.profile[Math.max(0, left - 1)] ?? 0) / surface.binSize;
  const after =
    (surface.profile[Math.min(surface.profile.length - 1, right + 1)] ?? 0) / surface.binSize - b;
  const tangent = (first: number, second: number): number =>
    first * second > 0 ? (2 * first * second) / (first + second) : 0;
  const t2 = amount * amount;
  const t3 = t2 * amount;
  // Shape-preserving cubic interpolation rounds real hills, never inventing periodic ripples.
  let depth =
    (2 * t3 - 3 * t2 + 1) * a +
    (t3 - 2 * t2 + amount) * tangent(before, difference) +
    (-2 * t3 + 3 * t2) * b +
    (t3 - t2) * tangent(difference, after);
  const corner = Math.min(Math.max(0, surface.radius ?? 0), surface.width / 2);
  if (corner > 0) {
    const start = Math.min(corner * 0.32, 6);
    const distance = Math.min(x, surface.width - x);
    const t = clamp((distance - start) / Math.max(0.001, corner - start), 0, 1);
    // Elliptical shoulder has a rounded end, unlike a long triangular smoothstep ramp.
    depth *= Math.sqrt(Math.max(0, 1 - (1 - t) * (1 - t)));
  }
  return Math.max(0, depth);
}

/** Return accepted mass; callers must keep or shed any surplus instead of losing it. */
export function deposit(
  profile: Float32Array,
  binSize: number,
  x: number,
  mass: number,
  maxDepth = Infinity,
  packing?: Float32Array,
): number {
  if (!profile.length || binSize <= 0 || !(mass > 0) || !Number.isFinite(mass)) return 0;
  const maximum = Math.max(0, maxDepth) * binSize;
  const capacityAt = (index: number) => maximum * (packing?.[index] ?? 1);
  let remaining = mass;
  let accepted = 0;
  const centre = clamp(x, 0, profile.length * binSize);
  let spread = Math.max(binSize * 0.72, Math.sqrt(mass) * 0.55);
  let weights = depositScratch.get(profile);
  if (!weights) {
    weights = new Float64Array(profile.length);
    depositScratch.set(profile, weights);
  }
  // Most flakes affect two or three bins. Large impacts expand only after local capacity fills.
  for (let pass = 0; pass < 16 && remaining > 1e-6; pass++) {
    const first = Math.max(0, Math.floor((centre - spread * 2.6) / binSize));
    const last = Math.min(profile.length - 1, Math.floor((centre + spread * 2.6) / binSize));
    let totalWeight = 0;
    weights.fill(0, first, last + 1);
    for (let index = first; index <= last; index++) {
      if ((profile[index] ?? 0) >= capacityAt(index) - 1e-7) continue;
      const offset = ((index + 0.5) * binSize - centre) / spread;
      const weight = Math.exp(-0.5 * offset * offset);
      weights[index] = weight;
      totalWeight += weight;
    }
    if (totalWeight > 0) {
      const available = remaining;
      for (let index = first; index <= last; index++) {
        const weight = weights[index] ?? 0;
        if (!weight) continue;
        const previous = profile[index] ?? 0;
        const requested = Math.min(
          remaining,
          (available * weight) / totalWeight,
          Math.max(0, capacityAt(index) - previous),
        );
        profile[index] = previous + requested;
        const actual = (profile[index] ?? 0) - previous;
        accepted += actual;
        remaining = Math.max(0, remaining - actual);
      }
    }
    spread = Math.min(profile.length * binSize * 2, spread * 1.8);
  }
  return accepted;
}

/** Remove mass within an edge-local brush radius, nearest bins first. */
export function remove(
  profile: Float32Array,
  binSize: number,
  x: number,
  radius: number,
  mass = Infinity,
): number {
  if (!profile.length || binSize <= 0 || radius < 0 || !(mass > 0)) return 0;
  const first = Math.max(0, Math.floor((x - radius) / binSize));
  const last = Math.min(profile.length - 1, Math.floor((x + radius) / binSize));
  const indices: number[] = [];
  for (let index = first; index <= last; index++) indices.push(index);
  indices.sort((a, b) => Math.abs((a + 0.5) * binSize - x) - Math.abs((b + 0.5) * binSize - x));
  let removed = 0;
  for (const index of indices) {
    const previous = profile[index] ?? 0;
    profile[index] = Math.max(0, previous - Math.min(previous, mass - removed));
    removed += previous - (profile[index] ?? 0);
    if (removed >= mass) break;
  }
  return removed;
}

/** Pairwise diffusion conserves area and cannot overshoot even for isolated peaks. */
export function smooth(profile: Float32Array, strength: number, iterations = 1): void {
  const amount = clamp(strength, 0, 1) * 0.25;
  if (amount === 0 || profile.length < 2) return;
  const boundedIterations = Math.min(32, Math.max(0, Math.floor(iterations)));
  for (let iteration = 0; iteration < boundedIterations; iteration++) {
    for (let parity = 0; parity < 2; parity++) {
      for (let index = parity; index + 1 < profile.length; index += 2) {
        const left = profile[index] ?? 0;
        const right = profile[index + 1] ?? 0;
        const transfer = (left - right) * amount;
        profile[index] = left - transfer;
        profile[index + 1] = right + transfer;
      }
    }
  }
}

/** Remap bins on responsive width changes without changing the deposit's mass. */
export function resizeProfile(profile: Float32Array, length: number): Float32Array {
  const next = new Float32Array(Math.max(1, Math.floor(length)));
  if (!profile.length) return next;
  const scale = next.length / profile.length;
  for (let index = 0; index < profile.length; index++) {
    const start = index * scale;
    const end = (index + 1) * scale;
    const mass = profile[index] ?? 0;
    for (let destination = Math.floor(start); destination < Math.ceil(end); destination++) {
      const overlap = Math.max(0, Math.min(end, destination + 1) - Math.max(start, destination));
      if (destination >= 0 && destination < next.length)
        next[destination] = (next[destination] ?? 0) + (mass * overlap) / scale;
    }
  }
  return next;
}

/** Explicit melting is an intentional mass sink, reported by its return value. */
export function melt(profile: Float32Array, binSize: number, rate: number, dt: number): number {
  let removed = 0;
  const amount = Math.max(0, rate * dt * binSize);
  for (let index = 0; index < profile.length; index++) {
    const previous = profile[index] ?? 0;
    profile[index] = Math.max(0, previous - amount);
    removed += previous - (profile[index] ?? 0);
  }
  return removed;
}

/** Actual rounded card shoulder below the horizontal top-edge datum. */
export function supportYAt(surface: Pick<Surface, 'width' | 'radius'>, x: number): number {
  const r = Math.min(Math.max(0, surface.radius), surface.width / 2);
  if (r === 0) return 0;
  const distance = clamp(Math.min(x, surface.width - x), 0, r);
  return r - Math.sqrt(Math.max(0, r * r - (r - distance) * (r - distance)));
}
export function snowYAt(
  surface: Pick<Surface, 'width' | 'radius' | 'profile' | 'binSize'>,
  x: number,
): number {
  return supportYAt(surface, x) - depthAt(surface, x);
}
