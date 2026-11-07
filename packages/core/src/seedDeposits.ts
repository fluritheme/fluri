import { deposit, seededRandom } from './physics/index.js';
import type { Surface } from './types.js';

/** A manual snow source with distinct broad drifts, measured in mean CSS-pixel depth. */
export function seedDeposits(
  surface: Surface,
  amount: number,
  maxDepth: number,
  seed: number,
): number {
  if (!(amount > 0) || surface.width <= 0 || surface.binSize <= 0) return 0;
  const random = seededRandom(seed);
  const count = Math.max(2, Math.ceil(surface.width / 105));
  const drifts = Array.from({ length: count }, (_, index) => ({
    x: ((index + 0.15 + random() * 0.7) / count) * surface.width,
    spread: Math.max(10, Math.min(65, (surface.width / count) * (0.2 + random() * 0.25))),
    strength: 0.4 + random() * 1.2,
  }));
  const weights = Array.from(surface.profile, (_, index) => {
    const x = (index + 0.5) * surface.binSize;
    return drifts.reduce((sum, drift) => {
      const distance = (x - drift.x) / drift.spread;
      return sum + drift.strength * Math.exp(-0.5 * distance * distance);
    }, 0.035);
  });
  const normalization = weights.reduce((sum, weight) => sum + weight, 0);
  const mass = amount * surface.width;
  let accepted = 0;
  for (let index = 0; index < weights.length; index++) {
    accepted += deposit(
      surface.profile,
      surface.binSize,
      (index + 0.5) * surface.binSize,
      (mass * (weights[index] ?? 0)) / normalization,
      maxDepth,
      surface.packing,
    );
  }
  return accepted;
}
