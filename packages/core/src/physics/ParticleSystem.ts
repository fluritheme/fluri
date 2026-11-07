import type { Particle, Surface, WeatherConfig } from '../types.js';
import { SurfaceIndex, sweptSurfaceHit } from './collisions.js';
import { clamp, localToWorld, seededRandom } from './math.js';
import { deposit, snowYAt, melt } from './profiles.js';
import { createSurfaceFlowState, settleSurface } from './settling.js';
import type { SurfaceFlowState } from './settling.js';

export interface StepMetrics {
  collisionChecks: number;
  deposits: number;
  transfers: number;
  slides: number;
  slideMass: number;
}
export interface EmissionBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SlidingContact {
  surface: Surface;
  x: number;
  velocity: number;
}

export class ParticleSystem {
  private static readonly transientLimit = 320;
  readonly particles: Particle[] = [];
  private readonly random: () => number;
  private readonly index = new SurfaceIndex();
  private intensity = 0;
  private requestedIntensity: number | undefined;
  private initialized = false;
  private clumpCount = 0;
  private gustStrength = 0;
  private gustRemaining = 0;
  private flowing = new WeakMap<Surface, SurfaceFlowState>();
  private contacts = new WeakMap<Particle, SlidingContact>();
  private sources = new WeakMap<Particle, Surface>();
  private emission: EmissionBounds = { x: 0, y: 0, width: 1, height: 1 };

  constructor(seed = 1) {
    this.random = seededRandom(seed);
  }

  setIntensity(amount: number): void {
    if (!Number.isFinite(amount)) throw new RangeError('Snow intensity must be finite.');
    this.requestedIntensity = clamp(amount, 0, 1);
  }

  gust(strength = 1, duration = 2): void {
    if (!Number.isFinite(strength) || !Number.isFinite(duration))
      throw new RangeError('Gust parameters must be finite.');
    this.gustStrength = clamp(strength, -4, 4);
    this.gustRemaining = clamp(duration, 0, 30);
  }

  clear(): void {
    this.particles.length = 0;
    this.initialized = false;
    this.clumpCount = 0;
    this.intensity = 0;
    this.gustRemaining = 0;
    this.flowing = new WeakMap();
    this.contacts = new WeakMap();
    this.sources = new WeakMap();
  }

  spawnClump(x: number, y: number, mass: number, vx: number, vy: number, source?: Surface): void {
    if (![x, y, mass, vx, vy].every(Number.isFinite) || mass <= 0) return;
    if (this.clumpCount >= ParticleSystem.transientLimit) {
      const clumps = this.particles.filter((p) => p.kind === 'clump');
      // Coalesce parcels under pressure; keep both snow mass and linear momentum.
      let nearest = clumps[0];
      let distance = Infinity;
      for (const candidate of clumps.slice(-32)) {
        const squared = (candidate.x - x) ** 2 + (candidate.y - y) ** 2;
        if (squared < distance) {
          nearest = candidate;
          distance = squared;
        }
      }
      if (nearest) {
        const combinedMass = nearest.mass + mass;
        nearest.x = (nearest.x * nearest.mass + x * mass) / combinedMass;
        nearest.y = (nearest.y * nearest.mass + y * mass) / combinedMass;
        nearest.vx = (nearest.vx * nearest.mass + vx * mass) / combinedMass;
        nearest.vy = (nearest.vy * nearest.mass + vy * mass) / combinedMass;
        nearest.mass = combinedMass;
        nearest.radius = clamp(Math.sqrt(combinedMass / Math.PI), 0.8, 18);
        return;
      }
    }
    const particle: Particle = {
      x,
      y,
      previousX: x,
      previousY: y,
      vx,
      vy,
      radius: clamp(Math.sqrt(mass / Math.PI), 0.8, 18),
      mass,
      opacity: 0.95,
      phase: this.random() * Math.PI * 2,
      depth: 1,
      kind: 'clump',
      age: 0,
      layer: 'foreground',
    };
    this.particles.push(particle);
    this.clumpCount++;
    if (source) this.sources.set(particle, source);
  }

  burst(x: number, y: number, count: number, kind: Particle['kind'] = 'flake'): void {
    if (![x, y, count].every(Number.isFinite)) return;
    const existingTransient = this.particles.reduce(
      (total, particle) => total + Number(particle.kind === kind),
      0,
    );
    const boundedCount = Math.min(
      clamp(Math.floor(count), 0, 300),
      Math.max(0, ParticleSystem.transientLimit - existingTransient),
    );
    for (let index = 0; index < boundedCount; index++) {
      const angle = this.random() * Math.PI * 2;
      const speed = 35 + this.random() * 150;
      const radius = kind === 'sparkle' ? 1 + this.random() * 2 : 0.8 + this.random() * 2.5;
      this.particles.push({
        x,
        y,
        previousX: x,
        previousY: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 40,
        radius,
        mass: kind === 'sparkle' ? 0 : Math.PI * radius * radius,
        opacity: 1,
        phase: this.random() * Math.PI * 2,
        depth: 1,
        kind,
        age: 0,
        layer: 'foreground',
      });
    }
  }

  step(
    dt: number,
    time: number,
    width: number,
    height: number,
    config: WeatherConfig,
    surfaces: readonly Surface[],
    quality = 1,
    emissionBounds?: EmissionBounds,
  ): StepMetrics {
    const metrics: StepMetrics = {
      collisionChecks: 0,
      deposits: 0,
      transfers: 0,
      slides: 0,
      slideMass: 0,
    };
    if (!Number.isFinite(dt) || dt <= 0 || !Number.isFinite(time) || !(width > 0) || !(height > 0))
      return metrics;
    // The engine uses fixed steps. Bounding a direct caller's step prevents resumed-tab explosions.
    dt = Math.min(dt, 1 / 15);
    this.emission = emissionBounds ?? { x: 0, y: 0, width, height };
    const target = config.snow.enabled ? (this.requestedIntensity ?? config.snow.intensity) : 0;
    this.intensity += (target - this.intensity) * (1 - Math.exp(-dt * 2.8));
    const desiredCount = Math.floor(
      config.snow.particleCount *
        clamp(quality, 0, 1) *
        this.intensity *
        Number(this.emission.width > 0 && this.emission.height > 0),
    );
    const gravity = config.snow.gravity;
    const wind =
      config.snow.wind.base * 110 +
      (config.snow.wind.gusts
        ? Math.sin(time * 0.43) * Math.sin(time * 0.17 + 1.8) * config.snow.wind.variability * 85
        : 0);
    const gust =
      this.gustRemaining > 0
        ? Math.sin((Math.min(1, this.gustRemaining) * Math.PI) / 2) * this.gustStrength * 160
        : 0;
    this.gustRemaining = Math.max(0, this.gustRemaining - dt);
    this.clumpCount = this.particles.reduce((n, p) => n + Number(p.kind === 'clump'), 0);
    const accumulation = config.snow.accumulation;
    for (const surface of surfaces) {
      if (!surface.visible || surface.occluded || !surface.accumulation || !accumulation.enabled)
        continue;
      if (accumulation.meltRate > 0)
        melt(surface.profile, surface.binSize, accumulation.meltRate, dt);
      const flow = this.flowing.get(surface) ?? createSurfaceFlowState();
      this.flowing.set(surface, flow);
      const moved = settleSurface(
        surface,
        dt,
        {
          gravity,
          softness: accumulation.softness,
          sliding: accumulation.sliding && accumulation.transferToLowerSurfaces,
          maxDepth: Math.min(surface.maxDepth, accumulation.maxDepth),
        },
        flow,
      );
      for (const parcel of moved.detached) {
        const position = localToWorld(surface, parcel.localX, parcel.localY);
        this.spawnClump(
          position.x - surface.velocity.x * dt,
          position.y - surface.velocity.y * dt,
          parcel.mass,
          parcel.vx,
          parcel.vy,
          surface,
        );
        metrics.slides++;
        metrics.slideMass += parcel.mass;
      }
      for (const side of [-1, 1] as const) {
        const mass = side < 0 ? moved.leftMass : moved.rightMass;
        if (mass <= 0) continue;
        const velocity = side < 0 ? moved.leftVelocity : moved.rightVelocity;
        const radius = clamp(Math.sqrt(mass / Math.PI), 0.8, 18);
        const position = localToWorld(
          surface,
          side < 0 ? -radius - 0.75 : surface.width + radius + 0.75,
          snowYAt(surface, side < 0 ? 0 : surface.width) - radius * 0.25,
        );
        this.spawnClump(
          position.x,
          position.y,
          mass,
          surface.velocity.x + Math.cos(surface.angle) * velocity,
          surface.velocity.y + Math.sin(surface.angle) * velocity + 12,
          surface,
        );
        metrics.slides++;
        metrics.slideMass += mass;
      }
    }
    this.index.rebuild(surfaces);
    let flakeCount = this.particles.reduce(
      (count, particle) => count + Number(particle.kind === 'flake'),
      0,
    );
    while (flakeCount < desiredCount) {
      this.particles.push(this.createFlake(config, !this.initialized));
      flakeCount++;
    }
    this.initialized = true;
    let write = 0;
    const initialCount = this.particles.length;
    for (let index = 0; index < initialCount; index++) {
      const particle = this.particles[index];
      if (!particle) continue;
      // Retire the excess over the smoothed target rather than abruptly hiding all snowfall.
      if (particle.kind === 'flake' && flakeCount > desiredCount) {
        flakeCount--;
        continue;
      }
      particle.previousX = particle.x;
      particle.previousY = particle.y;
      particle.age += dt;
      const contact = this.contacts.get(particle);
      if (contact) {
        const state = this.moveContact(particle, contact, dt, gravity, surfaces, config, metrics);
        if (state === 'attached') {
          this.particles[write++] = particle;
          continue;
        }
        if (state === 'deposited') continue;
      }
      const response = particle.kind === 'clump' ? 0.7 : 1.7 / Math.max(0.3, particle.depth);
      const turbulence = Math.sin(time * 0.95 + particle.phase) * config.snow.turbulence * 23;
      particle.vx +=
        ((wind + gust + turbulence) * particle.depth - particle.vx) *
        (1 - Math.exp(-response * dt));
      if (particle.kind === 'flake') {
        const terminal = 20 + particle.radius * 15 + particle.depth * 22;
        particle.vy += gravity * dt;
        particle.vy += (terminal - particle.vy) * (1 - Math.exp(-dt * 1.4));
      } else particle.vy += gravity * dt * (particle.kind === 'clump' ? 1.5 : 0.3);
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      let alive = true;
      if (
        particle.kind !== 'sparkle' &&
        accumulation.enabled &&
        (particle.kind !== 'clump' || accumulation.transferToLowerSurfaces)
      ) {
        let nearest: ReturnType<typeof sweptSurfaceHit>;
        for (const surface of this.index.query(
          { x: particle.previousX, y: particle.previousY },
          particle,
          particle.radius,
        )) {
          if (!surface.accumulation || surface.occluded || surface.material === 'no-accumulation')
            continue;
          if (this.sources.get(particle) === surface && particle.age < 0.2) continue;
          // Background flakes stay behind the page; they cannot create foreground deposits.
          if (
            config.dom.respectLayers &&
            particle.layer === 'background' &&
            surface.layer !== 'background'
          )
            continue;
          metrics.collisionChecks++;
          // Transform the previous position into the current support's frame.
          const start = {
            x: particle.previousX + surface.velocity.x * dt,
            y: particle.previousY + surface.velocity.y * dt,
          };
          const hit = sweptSurfaceHit(surface, start, particle, particle.radius);
          if (
            hit &&
            (!nearest ||
              hit.t < nearest.t - 1e-6 ||
              (Math.abs(hit.t - nearest.t) <= 1e-6 &&
                surface.paintOrder > nearest.surface.paintOrder))
          )
            nearest = hit;
        }
        if (nearest) {
          const surface = nearest.surface;
          const mass = particle.mass;
          const accepted = deposit(
            surface.profile,
            surface.binSize,
            nearest.x,
            mass,
            Math.min(surface.maxDepth, accumulation.maxDepth),
            surface.packing,
          );
          if (accepted > 0) {
            metrics.deposits++;
            if (particle.kind === 'clump') metrics.transfers++;
          }
          const remaining = Math.max(0, mass - accepted);
          if (remaining < 1e-4) alive = false;
          else {
            // A full shelf supports a coherent rolling clump; it must travel to an edge.
            particle.mass = remaining;
            if (particle.kind !== 'clump') this.clumpCount++;
            particle.kind = 'clump';
            particle.radius = clamp(Math.sqrt(remaining / Math.PI), 0.8, 18);
            particle.layer = surface.layer;
            const position = localToWorld(
              surface,
              nearest.x,
              snowYAt(surface, nearest.x) - particle.radius,
            );
            particle.x = position.x;
            particle.y = position.y;
            const direction = nearest.x < surface.width / 2 ? -1 : 1;
            const tangent =
              (particle.vx - surface.velocity.x) * Math.cos(surface.angle) +
              (particle.vy - surface.velocity.y) * Math.sin(surface.angle);
            const normalSpeed = Math.max(
              0,
              -(
                (particle.vx - surface.velocity.x) * nearest.normal.x +
                (particle.vy - surface.velocity.y) * nearest.normal.y
              ),
            );
            this.contacts.set(particle, {
              surface,
              x: nearest.x,
              velocity: tangent + direction * Math.min(180, Math.max(90, normalSpeed * 0.32)),
            });
          }
        }
      }
      if (particle.kind === 'sparkle') {
        particle.opacity = Math.max(0, 1 - particle.age / 1.8);
        if (particle.age >= 1.8) alive = false;
      }
      if (
        particle.y > this.emission.y + this.emission.height + 60 ||
        particle.x < this.emission.x - Math.max(100, Math.abs(wind) * 2) ||
        particle.x > this.emission.x + this.emission.width + Math.max(100, Math.abs(wind) * 2)
      )
        alive = false;
      if (alive) this.particles[write++] = particle;
      else if (particle.kind === 'flake') flakeCount--;
    }
    this.particles.length = write;
    this.clumpCount = this.particles.reduce((n, p) => n + Number(p.kind === 'clump'), 0);
    if (this.clumpCount > ParticleSystem.transientLimit) {
      const kept: Particle[] = [];
      let count = 0;
      for (const particle of this.particles) {
        if (particle.kind !== 'clump' || kept.length < ParticleSystem.transientLimit) {
          this.particles[count++] = particle;
          if (particle.kind === 'clump') kept.push(particle);
          continue;
        }
        let target = kept[0],
          nearest = Infinity;
        for (let index = Math.max(0, kept.length - 32); index < kept.length; index++) {
          const candidate = kept[index];
          if (!candidate) continue;
          const d = (candidate.x - particle.x) ** 2 + (candidate.y - particle.y) ** 2;
          if (d < nearest) {
            nearest = d;
            target = candidate;
          }
        }
        if (target) {
          const mass = target.mass + particle.mass;
          target.x = (target.x * target.mass + particle.x * particle.mass) / mass;
          target.y = (target.y * target.mass + particle.y * particle.mass) / mass;
          target.vx = (target.vx * target.mass + particle.vx * particle.mass) / mass;
          target.vy = (target.vy * target.mass + particle.vy * particle.mass) / mass;
          target.mass = mass;
          target.radius = clamp(Math.sqrt(mass / Math.PI), 0.8, 18);
        }
      }
      this.particles.length = count;
      this.clumpCount = kept.length;
    }
    return metrics;
  }

  private createFlake(config: WeatherConfig, distribute: boolean): Particle {
    const depth = config.snow.parallax ? 0.45 + this.random() * 0.95 : 1;
    const radius =
      config.snow.minSize + this.random() * Math.max(0, config.snow.maxSize - config.snow.minSize);
    const x = this.emission.x + this.random() * this.emission.width;
    const y = distribute
      ? this.emission.y + this.random() * this.emission.height
      : this.emission.y - 8 - this.random() * 40;
    const layer =
      config.snow.parallax && depth < 0.65 ? 'background' : depth > 1.1 ? 'foreground' : 'content';
    return {
      x,
      y,
      previousX: x,
      previousY: y,
      vx: config.snow.wind.base * 110,
      vy: 20 + radius * 15 + depth * 22,
      radius: radius * depth,
      mass: Math.PI * radius * radius * 2.4 * config.snow.accumulation.growthRate,
      opacity: clamp(0.35 + depth * 0.4, 0.3, 0.95),
      phase: this.random() * Math.PI * 2,
      depth,
      kind: 'flake',
      age: 0,
      layer,
    };
  }

  private moveContact(
    particle: Particle,
    contact: SlidingContact,
    dt: number,
    gravity: number,
    surfaces: readonly Surface[],
    config: WeatherConfig,
    metrics: StepMetrics,
  ): 'attached' | 'airborne' | 'deposited' {
    const support = contact.surface;
    const tangent = { x: Math.cos(support.angle), y: Math.sin(support.angle) };
    const normalLoading =
      gravity * Math.cos(support.angle) +
      support.acceleration.x * Math.sin(support.angle) -
      support.acceleration.y * Math.cos(support.angle);
    const cohesion =
      support.material === 'sticky' ? 180 : support.material === 'slippery' ? 10 : 45;
    if (normalLoading < -cohesion) {
      particle.vx =
        (support.previousVelocity?.x ?? support.velocity.x - support.acceleration.x * dt) +
        tangent.x * contact.velocity;
      particle.vy =
        (support.previousVelocity?.y ?? support.velocity.y - support.acceleration.y * dt) +
        tangent.y * contact.velocity;
      this.contacts.delete(particle);
      this.sources.set(particle, support);
      particle.age = 0;
      metrics.slides++;
      metrics.slideMass += particle.mass;
      return 'airborne';
    }
    const relativeAcceleration =
      gravity * tangent.y - support.acceleration.x * tangent.x - support.acceleration.y * tangent.y;
    const friction =
      (support.material === 'slippery' ? 0.035 : support.material === 'sticky' ? 0.28 : 0.09) *
      Math.max(12, gravity * Math.cos(support.angle));
    const oldVelocity = contact.velocity;
    contact.velocity +=
      (relativeAcceleration - Math.sign(contact.velocity || relativeAcceleration) * friction) * dt;
    if (oldVelocity * contact.velocity < 0 && Math.abs(relativeAcceleration) < friction)
      contact.velocity = 0;
    contact.x += contact.velocity * dt;
    particle.vx = support.velocity.x + tangent.x * contact.velocity;
    particle.vy = support.velocity.y + tangent.y * contact.velocity;
    const position = localToWorld(
      support,
      contact.x,
      snowYAt(support, contact.x) - particle.radius,
    );
    particle.x = position.x;
    particle.y = position.y;
    if (
      !surfaces.includes(support) ||
      !support.visible ||
      contact.x < 0 ||
      contact.x > support.width
    ) {
      this.contacts.delete(particle);
      this.sources.set(particle, support);
      particle.age = 0;
      metrics.slides++;
      metrics.slideMass += particle.mass;
      return 'airborne';
    }
    const cap = Math.min(support.maxDepth, config.snow.accumulation.maxDepth);
    const bin = clamp(Math.floor(contact.x / support.binSize), 0, support.profile.length - 1);
    const localCapacity = cap * (support.packing?.[bin] ?? 1);
    if ((support.profile[bin] ?? 0) / support.binSize < localCapacity * 0.8 && particle.age > 0.1) {
      const accepted = deposit(
        support.profile,
        support.binSize,
        contact.x,
        particle.mass,
        cap,
        support.packing,
      );
      if (accepted > 0) {
        particle.mass = Math.max(0, particle.mass - accepted);
        metrics.deposits++;
        metrics.transfers++;
      }
      if (particle.mass < 1e-4) {
        this.contacts.delete(particle);
        return 'deposited';
      }
      particle.radius = clamp(Math.sqrt(particle.mass / Math.PI), 0.8, 18);
    }
    return 'attached';
  }
}
