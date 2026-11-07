import type { Surface } from '../types.js';
import { clamp } from './math.js';
import { deposit } from './profiles.js';

export interface SurfaceFlowState {
  velocity: number;
  leftTravel: number;
  rightTravel: number;
}
export interface SettlingOptions {
  gravity: number;
  softness: number;
  sliding: boolean;
  maxDepth: number;
}
export interface SettlingResult {
  leftMass: number;
  rightMass: number;
  leftVelocity: number;
  rightVelocity: number;
  movedMass: number;
  detached: { localX: number; localY: number; mass: number; vx: number; vy: number }[];
}
export function createSurfaceFlowState(): SurfaceFlowState {
  return { velocity: 0, leftTravel: 0, rightTravel: 0 };
}
const workspaces = new WeakMap<
  SurfaceFlowState,
  { delta: Float64Array; outgoing: Float64Array; transfers: Float64Array }
>();

/** Conservative finite-volume granular flow with material repose and support-frame inertia. */
export function settleSurface(
  surface: Surface,
  dt: number,
  options: SettlingOptions,
  state: SurfaceFlowState = createSurfaceFlowState(),
): SettlingResult {
  const result: SettlingResult = {
    leftMass: 0,
    rightMass: 0,
    leftVelocity: 0,
    rightVelocity: 0,
    movedMass: 0,
    detached: [],
  };
  const profile = surface.profile;
  if (!(dt > 0) || !Number.isFinite(dt) || !profile.length || !(surface.binSize > 0)) return result;
  const binSize = surface.binSize;
  const cosine = Math.cos(surface.angle);
  const sine = Math.sin(surface.angle);
  const gravity = Math.max(0, options.gravity);
  const acceleration = surface.acceleration.x * cosine + surface.acceleration.y * sine;
  const tangential = options.sliding ? gravity * sine - acceleration : 0;
  const effectiveNormal =
    gravity * cosine + surface.acceleration.x * sine - surface.acceleration.y * cosine;
  const normal = Math.max(12, effectiveNormal);
  const repose =
    surface.material === 'sticky' ? 0.92 : surface.material === 'slippery' ? 0.12 : 0.54;
  const kinetic = repose * 0.67;
  const cohesion = surface.material === 'sticky' ? 180 : surface.material === 'slippery' ? 10 : 45;
  if (options.sliding && effectiveNormal < -cohesion) {
    const chunkWidth = Math.max(1, Math.ceil(profile.length / 6));
    for (let first = 0; first < profile.length; first += chunkWidth) {
      let mass = 0,
        weightedX = 0,
        weightedDepth = 0;
      for (let index = first; index < Math.min(profile.length, first + chunkWidth); index++) {
        const value = profile[index] ?? 0;
        mass += value;
        weightedX += (index + 0.5) * binSize * value;
        weightedDepth += (value * value) / binSize;
        profile[index] = 0;
      }
      if (mass > 0)
        result.detached.push({
          localX: weightedX / mass,
          localY: -weightedDepth / (2 * mass),
          mass,
          vx: surface.previousVelocity?.x ?? surface.velocity.x - surface.acceleration.x * dt,
          vy: surface.previousVelocity?.y ?? surface.velocity.y - surface.acceleration.y * dt,
        });
    }
    state.velocity = 0;
    state.leftTravel = 0;
    state.rightTravel = 0;
    return result;
  }
  const stepCount = Math.max(1, Math.ceil(Math.min(dt, 1 / 15) * 120 - 1e-8));
  const step = Math.min(dt, 1 / 15) / stepCount;
  let workspace = workspaces.get(state);
  if (!workspace || workspace.delta.length !== profile.length) {
    workspace = {
      delta: new Float64Array(profile.length),
      outgoing: new Float64Array(profile.length),
      transfers: new Float64Array(Math.max(0, profile.length - 1)),
    };
    workspaces.set(state, workspace);
  }
  const { delta, outgoing, transfers } = workspace;
  for (let substep = 0; substep < stepCount; substep++) {
    if (!options.sliding) state.velocity = 0;
    else if (Math.abs(state.velocity) < 0.2 && Math.abs(tangential) <= repose * normal)
      state.velocity = 0;
    else {
      const direction = Math.sign(state.velocity || tangential);
      const next = state.velocity + (tangential - direction * kinetic * normal) * step;
      state.velocity =
        state.velocity * next < 0 && Math.abs(tangential) <= repose * normal ? 0 : next;
      state.velocity *= Math.exp(-(surface.material === 'sticky' ? 1.4 : 0.22) * step);
      state.velocity = clamp(state.velocity, -650, 650);
    }
    delta.fill(0);
    outgoing.fill(0);
    const relaxation = 1 - Math.exp(-step * (7 + options.softness * 23));
    for (let index = 0; index + 1 < profile.length; index++) {
      const left = profile[index] ?? 0;
      const right = profile[index + 1] ?? 0;
      const difference = (left - right) / binSize;
      const unstable = Math.max(0, Math.abs(difference) - repose * binSize);
      const settling = Math.sign(difference) * unstable * binSize * 0.5 * relaxation;
      const advection = (state.velocity * step) / binSize;
      const flow =
        settling +
        (advection > 0 ? Math.min(0.42, advection) * left : Math.max(-0.42, advection) * right);
      transfers[index] = flow;
      if (flow > 0) outgoing[index] = (outgoing[index] ?? 0) + flow;
      else outgoing[index + 1] = (outgoing[index + 1] ?? 0) - flow;
    }
    for (let index = 0; index + 1 < profile.length; index++) {
      const requested = transfers[index] ?? 0;
      const source = requested >= 0 ? index : index + 1;
      const available = profile[source] ?? 0;
      const scale = Math.min(1, available / Math.max(1e-12, outgoing[source] ?? 0));
      const flow = requested * scale;
      delta[index] = (delta[index] ?? 0) - flow;
      delta[index + 1] = (delta[index + 1] ?? 0) + flow;
      result.movedMass += Math.abs(flow);
    }
    for (let index = 0; index < profile.length; index++)
      profile[index] = Math.max(0, (profile[index] ?? 0) + (delta[index] ?? 0));
    if (options.sliding) {
      state.leftTravel =
        state.velocity < 0 ? Math.min(binSize * 2, state.leftTravel - state.velocity * step) : 0;
      state.rightTravel =
        state.velocity > 0 ? Math.min(binSize * 2, state.rightTravel + state.velocity * step) : 0;
      // A finite cohesion-relaxation interval converts a strong support impulse into edge slip.
      const fractureAcceleration =
        surface.material === 'sticky' ? 2100 : surface.material === 'slippery' ? 700 : 1400;
      if (Math.abs(acceleration) > fractureAcceleration) {
        const travel = (Math.abs(acceleration) - fractureAcceleration) * step * 0.16;
        if (tangential < 0) state.leftTravel += travel;
        else state.rightTravel += travel;
      }
      const release = (index: number, travel: number): number => {
        const mass = profile[index] ?? 0;
        if (travel < binSize * 0.3 || mass <= 0) return 0;
        const parcel = mass * Math.min(1, travel / binSize);
        if (parcel < Math.max(4, binSize * binSize * 0.18) && travel < binSize * 1.8) return 0;
        profile[index] = mass - parcel;
        return mass - (profile[index] ?? 0);
      };
      const left = release(0, state.leftTravel);
      const right = release(profile.length - 1, state.rightTravel);
      result.leftMass += left;
      result.rightMass += right;
      if (left > 0) state.leftTravel = 0;
      if (right > 0) state.rightTravel = 0;
    }
    const maximum = Math.max(0, options.maxDepth) * binSize;
    for (let index = 0; index < profile.length; index++) {
      const capacity = maximum * (surface.packing?.[index] ?? 1);
      const excess = Math.max(0, (profile[index] ?? 0) - capacity);
      // Float32 storage can round a saturated bin one ULP above its double-precision cap.
      // That is numeric noise, not an avalanche or a visible minimum-radius clump.
      const roundoff = Math.max(1e-4, capacity * 2 ** -22);
      if (excess <= roundoff) continue;
      profile[index] = capacity;
      const remainder =
        excess -
        deposit(
          profile,
          binSize,
          (index + 0.5) * binSize,
          excess,
          options.maxDepth,
          surface.packing,
        );
      if (remainder > roundoff) {
        if (state.velocity < 0 || (state.velocity === 0 && index < profile.length / 2))
          result.leftMass += remainder;
        else result.rightMass += remainder;
      }
    }
  }
  result.leftVelocity = Math.min(-12, state.velocity);
  result.rightVelocity = Math.max(12, state.velocity);
  return result;
}
