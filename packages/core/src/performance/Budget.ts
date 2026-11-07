/** Bound visual density by the visible scene, even if a preset requests thousands of flakes. */
export function particleBudget(
  requested: number,
  area: number,
  coarse: boolean,
  adaptive: boolean,
): number {
  if (!adaptive) return requested;
  const density = Math.max(80, Math.floor(Math.max(0, area) / 1500));
  return Math.max(0, Math.min(requested, coarse ? 320 : 1000, density));
}

/** Respond promptly to sustained slow frames, recover slowly to avoid quality oscillation. */
export class FrameBudget {
  private slow = 0;
  private recovery = 0;
  private work = 0;
  observe(work: number, elapsed: number, target: number, quality: number): number {
    this.work = this.work === 0 ? work : this.work * 0.8 + work * 0.2;
    const pressure = work > target * 0.85 || this.work > target * 0.65 || elapsed > target * 1.65;
    this.slow = pressure ? this.slow + 1 : Math.max(0, this.slow - 1);
    if (work > target * 1.8 || this.slow >= 3) {
      this.slow = 0;
      this.recovery = 0;
      this.work = work > target * 1.8 ? 0 : Math.min(work, target * 0.65);
      return Math.max(0.12, quality * 0.72);
    }
    if (!pressure && this.work < target * 0.35) this.recovery += Math.min(100, elapsed);
    else this.recovery = 0;
    if (this.recovery >= 3000) {
      this.recovery = 0;
      return Math.min(1, quality + 0.05);
    }
    return quality;
  }
}
