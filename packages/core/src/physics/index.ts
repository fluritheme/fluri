export { ParticleSystem } from './ParticleSystem.js';
export type { StepMetrics, EmissionBounds } from './ParticleSystem.js';
export { SurfaceIndex, sweptSurfaceHit } from './collisions.js';
export type { SurfaceHit } from './collisions.js';
export { clamp, seededRandom, localToWorld, worldToLocal, surfaceNormal } from './math.js';
export {
  depthAt,
  snowYAt,
  supportYAt,
  deposit,
  remove,
  smooth,
  totalMass,
  resizeProfile,
  melt,
} from './profiles.js';
export { createSurfaceFlowState, settleSurface } from './settling.js';
export type { SurfaceFlowState, SettlingOptions, SettlingResult } from './settling.js';

export { createPackingProfile } from './packing.js';
