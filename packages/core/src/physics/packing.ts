import { seededRandom } from './math.js';

/** Stable local packing depth: wind-exposed crests and denser hollows have different capacity. */
export function createPackingProfile(length: number, binSize: number, seed: number): Float32Array {
  const random = seededRandom(seed);
  const salts = [random() * 10000, random() * 10000, random() * 10000];
  const noise = (x: number, salt: number): number => {
    const i = Math.floor(x),
      t = x - i,
      s = t * t * (3 - 2 * t);
    const value = (n: number) => {
      const q = Math.sin((n + salt) * 127.1) * 43758.5453123;
      return q - Math.floor(q);
    };
    return value(i) * (1 - s) + value(i + 1) * s;
  };
  return Float32Array.from({ length }, (_, index) => {
    const x = (index + 0.5) * binSize;
    return (
      0.32 +
      0.48 * noise(x / 76, salts[0] ?? 0) +
      0.13 * noise(x / 24, salts[1] ?? 0) +
      0.07 * noise(x / 8, salts[2] ?? 0)
    );
  });
}
