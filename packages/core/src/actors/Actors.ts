import type { PluginContext, Surface, TriggerOptions, TriggerType, Vec2 } from '../types.js';
import { snowYAt } from '../physics/profiles.js';

export interface PointerInput extends Vec2 {
  vx: number;
  vy: number;
  pressed: boolean;
  shiftKey: boolean;
  kind: 'down' | 'move' | 'up' | 'cancel';
  time: number;
}
export interface Snowball extends Vec2 {
  id: number;
  vx: number;
  vy: number;
  radius: number;
  mass: number;
  state: 'gathering' | 'airborne' | 'resting';
  support?: Surface;
  localX: number;
}
interface Snowman {
  balls: Snowball[];
  support: Surface;
  localX: number;
  age: number;
}
interface Plough {
  support: Surface;
  x: number;
  direction: number;
  speed: number;
  mass: number;
  previousBin: number;
  style: 'classic' | 'minimal' | 'festive';
}
export const radiusFromMass = (mass: number): number => Math.sqrt(Math.max(0, mass) / Math.PI);
export const massFromRadius = (radius: number): number => Math.PI * radius * radius;
const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));
const localPoint = (surface: Surface, x: number, y: number): Vec2 => ({
  x: (x - surface.x) * Math.cos(surface.angle) + (y - surface.y) * Math.sin(surface.angle),
  y: -(x - surface.x) * Math.sin(surface.angle) + (y - surface.y) * Math.cos(surface.angle),
});
const worldPoint = (surface: Surface, x: number, y = 0): Vec2 => ({
  x: surface.x + x * Math.cos(surface.angle) - y * Math.sin(surface.angle),
  y: surface.y + x * Math.sin(surface.angle) + y * Math.cos(surface.angle),
});
const clipToSurface = (ctx: CanvasRenderingContext2D, surface: Surface): void => {
  if (surface.options.clip !== false)
    for (const clip of surface.clipRegions) {
      ctx.beginPath();
      ctx.roundRect(clip.x, clip.y, clip.width, clip.height, clip.radius);
      ctx.clip();
    }
};
const depthAt = (surface: Surface, x: number): number =>
  (surface.profile[clamp(Math.floor(x / surface.binSize), 0, surface.profile.length - 1)] ?? 0) /
  surface.binSize;

/** Removes real stored mass, never visual depth. Used by gestures and the plough. */
export function gatherMass(
  surface: Surface,
  localX: number,
  radius: number,
  requested: number,
): number {
  if (!(requested > 0) || !(radius > 0)) return 0;
  let remaining = requested;
  const first = Math.max(0, Math.floor((localX - radius) / surface.binSize));
  const last = Math.min(
    surface.profile.length - 1,
    Math.floor((localX + radius) / surface.binSize),
  );
  for (let bin = first; bin <= last && remaining > 0; bin++) {
    const available = Math.max(0, surface.profile[bin] ?? 0);
    const removed = Math.min(available, remaining);
    surface.profile[bin] = available - removed;
    remaining -= removed;
  }
  return requested - remaining;
}

/** Recognizes coherent loops with bounded history; ordinary straight cursor motion cannot activate it. */
export class CircleRecognizer {
  private points: Array<Vec2 & { time: number }> = [];
  reset(): void {
    this.points.length = 0;
  }
  sample(x: number, y: number, time: number): boolean {
    if (![x, y, time].every(Number.isFinite)) return false;
    this.points.push({ x, y, time });
    this.points = this.points.filter((point) => time - point.time <= 1.4).slice(-96);
    if (this.points.length < 14) return false;
    const duration = time - (this.points[0]?.time ?? time);
    if (duration < 0.3 || duration > 1.4) return false;
    const center = this.points.reduce(
      (sum, point) => ({
        x: sum.x + point.x / this.points.length,
        y: sum.y + point.y / this.points.length,
      }),
      { x: 0, y: 0 },
    );
    const radii = this.points.map((point) => Math.hypot(point.x - center.x, point.y - center.y));
    const mean = radii.reduce((sum, radius) => sum + radius, 0) / radii.length;
    if (
      mean < 8 ||
      mean > 90 ||
      radii.some((radius) => radius < mean * 0.45 || radius > mean * 1.6)
    )
      return false;
    let sweep = 0;
    let absolute = 0;
    for (let index = 1; index < this.points.length; index++) {
      const a = this.points[index - 1];
      const b = this.points[index];
      if (!a || !b) continue;
      const delta = Math.atan2(
        (a.x - center.x) * (b.y - center.y) - (a.y - center.y) * (b.x - center.x),
        (a.x - center.x) * (b.x - center.x) + (a.y - center.y) * (b.y - center.y),
      );
      sweep += delta;
      absolute += Math.abs(delta);
    }
    if (Math.abs(sweep) >= Math.PI * 1.7 && Math.abs(sweep) / Math.max(absolute, 0.001) > 0.85) {
      this.reset();
      return true;
    }
    return false;
  }
}

export class Actors {
  readonly balls: Snowball[] = [];
  private snowmen: Snowman[] = [];
  private ploughs: Plough[] = [];
  private active: Snowball | undefined;
  private nextId = 1;
  private circle = new CircleRecognizer();
  private lastPointer: PointerInput | undefined;
  constructor(private readonly context: PluginContext) {}
  get gathering(): boolean {
    return this.active !== undefined;
  }
  get counts(): { snowballs: number; snowmen: number; ploughs: number } {
    return {
      snowballs: this.balls.length,
      snowmen: this.snowmen.length,
      ploughs: this.ploughs.length,
    };
  }
  get snowballCount(): number {
    return this.balls.length;
  }
  get snowmanCount(): number {
    return this.snowmen.length;
  }

  private selected(options: TriggerOptions): Surface | undefined {
    return this.context
      .getSurfaces()
      .find(
        (surface) =>
          surface.visible &&
          (options.surface
            ? surface.element === options.surface
            : options.selector
              ? surface.element.matches(options.selector)
              : surface.element.hasAttribute('data-weather-surface')),
      );
  }
  private createBall(
    x: number,
    y: number,
    radius: number,
    mass = massFromRadius(radius),
  ): Snowball | undefined {
    const config = this.context.getConfig().interactions.snowballs;
    if (!config.enabled || this.balls.length + this.snowmen.length * 3 >= config.maxCount)
      return undefined;
    const ball: Snowball = {
      id: this.nextId++,
      x,
      y,
      radius: radiusFromMass(mass),
      mass,
      vx: 0,
      vy: 0,
      state: 'airborne',
      localX: 0,
    };
    this.balls.push(ball);
    this.context.emit('snowball:created', { id: ball.id, mass });
    return ball;
  }
  trigger(type: TriggerType, options: TriggerOptions = {}): void {
    const support = this.selected(options);
    if (type === 'snowburst') {
      const matches = (ball: Snowball): boolean =>
        options.surface || options.selector
          ? ball.support === support
          : options.x !== undefined && options.y !== undefined
            ? Math.hypot(ball.x - options.x, ball.y - options.y) <= (options.radius ?? 90)
            : true;
      for (let index = this.balls.length - 1; index >= 0; index--) {
        const ball = this.balls[index];
        if (!ball || !matches(ball)) continue;
        this.fragment(ball);
        if (ball === this.active) this.active = undefined;
        this.balls.splice(index, 1);
      }
      for (let index = this.snowmen.length - 1; index >= 0; index--) {
        const snowman = this.snowmen[index];
        if (!snowman) continue;
        if ((options.surface || options.selector) && snowman.support !== support) continue;
        const point = worldPoint(snowman.support, snowman.localX);
        if (
          options.x !== undefined &&
          options.y !== undefined &&
          Math.hypot(point.x - options.x, point.y - options.y) > (options.radius ?? 120)
        )
          continue;
        let top = -depthAt(snowman.support, snowman.localX);
        for (const ball of snowman.balls) {
          const position = worldPoint(snowman.support, snowman.localX, top - ball.radius);
          this.fragment({ ...ball, ...position });
          top -= ball.radius * 2;
        }
        this.snowmen.splice(index, 1);
        this.context.emit('snowman:removed', {
          surfaceId: snowman.support.id,
          reason: 'break-apart',
        });
      }
    }
    if (type === 'plough') {
      const route = support?.element.hasAttribute('data-plough-route')
        ? support
        : !options.surface && !options.selector
          ? this.context
              .getSurfaces()
              .find(
                (surface) => surface.visible && surface.element.hasAttribute('data-plough-route'),
              )
          : undefined;
      if (
        !route ||
        !route.accumulation ||
        this.ploughs.length >= 2 ||
        this.ploughs.some((actor) => actor.support === route) ||
        Math.abs(route.angle) > 0.35
      )
        return;
      const direction = options.direction === 'left' ? -1 : 1;
      this.ploughs.push({
        support: route,
        x: direction > 0 ? 0 : route.width,
        direction,
        style: options.style ?? 'classic',
        speed: clamp(options.speed ?? Math.max(45, route.width / 4), 10, 600),
        mass: 0,
        previousBin: direction > 0 ? -1 : route.profile.length,
      });
      this.context.emit('plough:start', {
        surfaceId: route.id,
        direction: options.direction ?? 'right',
      });
    }
    if (type === 'snowball') {
      const config = this.context.getConfig().interactions.snowballs;
      const radius = clamp(options.radius ?? 15, config.minRadius, config.maxRadius);
      const localX = support
        ? clamp(
            options.x === undefined
              ? support.width / 2
              : localPoint(support, options.x, options.y ?? support.y).x,
            radius,
            Math.max(radius, support.width - radius),
          )
        : 0;
      const point = support
        ? worldPoint(support, localX, -radius - depthAt(support, localX) - 1)
        : { x: options.x ?? 120, y: options.y ?? 90 };
      // Manual spawning is an explicit snow source, analogous to addSnow(). Deposited mass is reused first.
      if (this.balls.length + this.snowmen.length * 3 >= config.maxCount || !config.enabled) return;
      if (support) gatherMass(support, localX, radius * 2, massFromRadius(radius));
      const ball = this.createBall(point.x, point.y, radius);
      if (ball && support) {
        ball.support = support;
        ball.localX = localX;
        ball.state = 'resting';
      }
    }
    if (
      type === 'snowman' &&
      support &&
      this.context.getConfig().interactions.snowman.enabled &&
      this.snowmen.length < 4
    ) {
      const config = this.context.getConfig().interactions.snowballs;
      if (
        this.balls.length + this.snowmen.length * 3 + 3 > config.maxCount ||
        !config.enabled ||
        support.width < config.minRadius * 6
      )
        return;
      const base = clamp(options.radius ?? 23, config.minRadius, config.maxRadius);
      const localX = support.width / 2;
      let top = -depthAt(support, localX);
      for (const radius of [base, base * 0.74, base * 0.52]) {
        const point = worldPoint(support, localX, top - radius);
        gatherMass(support, localX, base * 2, massFromRadius(radius));
        const ball = this.createBall(point.x, point.y, radius);
        if (ball) {
          ball.support = support;
          ball.localX = localX;
          ball.state = 'resting';
          top -= radius * 2;
        }
      }
      this.assemble();
    }
  }

  pointer(input: PointerInput): void {
    const settings = this.context.getConfig().interactions.snowballs;
    if (!settings.enabled) {
      this.release(true);
      return;
    }
    if (input.kind === 'cancel') {
      this.release(true);
      this.circle.reset();
      return;
    }
    if (input.kind === 'up') {
      this.release(false, input);
      return;
    }
    const hit = this.balls.find(
      (ball) => Math.hypot(input.x - ball.x, input.y - ball.y) <= ball.radius + 8,
    );
    const hoverMode = settings.activation === 'hover-circle';
    const loop = hoverMode && this.circle.sample(input.x, input.y, input.time);
    if ((input.kind === 'down' && input.shiftKey) || loop) {
      if (hit) this.active = hit;
      else {
        const support = this.context
          .getSurfaces()
          .filter((surface) => surface.visible && !surface.occluded && surface.accumulation)
          .map((surface) => {
            const local = localPoint(surface, input.x, input.y);
            const x = clamp(local.x, 0, surface.width);
            const first = Math.max(0, Math.floor((x - 32) / surface.binSize));
            const last = Math.min(
              surface.profile.length - 1,
              Math.floor((x + 32) / surface.binSize),
            );
            const snowy = surface.profile.some(
              (mass, bin) =>
                bin >= first && bin <= last && surface.exposed?.[bin] !== 0 && mass > 0.01,
            );
            const distance = Math.hypot(local.x - x, local.y - snowYAt(surface, x));
            return {
              surface,
              local,
              distance,
              eligible: snowy && local.x >= -12 && local.x <= surface.width + 12 && distance < 36,
            };
          })
          .filter((candidate) => candidate.eligible)
          .sort((a, b) => a.distance - b.distance)[0]?.surface;
        if (support && this.balls.length + this.snowmen.length * 3 < settings.maxCount) {
          const local = localPoint(support, input.x, input.y);
          const mass = gatherMass(support, local.x, 32, massFromRadius(settings.minRadius));
          if (mass > 0) {
            this.active = this.createBall(input.x, input.y, radiusFromMass(mass), mass);
            if (this.active) this.active.state = 'gathering';
          }
        }
      }
      if (this.active) {
        this.active.state = 'gathering';
        delete this.active.support;
      }
    }
    if (this.active) {
      if (!hoverMode && (!input.pressed || !input.shiftKey)) {
        this.release(false, input);
        return;
      }
      const ball = this.active;
      const previous = this.lastPointer;
      const distance = previous ? Math.hypot(input.x - previous.x, input.y - previous.y) : 0;
      for (const surface of this.context.getSurfaces()) {
        if (!surface.visible || !surface.accumulation) continue;
        const local = localPoint(surface, input.x, input.y);
        if (
          local.x < -ball.radius ||
          local.x > surface.width + ball.radius ||
          Math.abs(local.y - snowYAt(surface, clamp(local.x, 0, surface.width))) > ball.radius + 24
        )
          continue;
        const mass = gatherMass(
          surface,
          local.x,
          ball.radius + 12,
          Math.min(massFromRadius(settings.maxRadius) - ball.mass, distance * 5),
        );
        ball.mass += mass;
        ball.radius = radiusFromMass(ball.mass);
      }
      ball.x = input.x;
      ball.y = input.y;
      ball.vx = clamp(input.vx, -1200, 1200);
      ball.vy = clamp(input.vy, -1200, 1200);
      if (hoverMode && previous && input.time - previous.time > 0.7) this.release(false, input);
    }
    this.lastPointer = input;
  }
  private release(cancel: boolean, input?: PointerInput): void {
    if (!this.active) return;
    const ball = this.active;
    ball.state = 'airborne';
    ball.vx = cancel ? 0 : clamp(input?.vx ?? ball.vx, -1200, 1200);
    ball.vy = cancel ? 0 : clamp(input?.vy ?? ball.vy, -1200, 1200);
    this.context.emit('snowball:thrown', { id: ball.id, vx: ball.vx, vy: ball.vy });
    this.active = undefined;
    this.lastPointer = undefined;
  }

  update(dt: number, time: number): void {
    dt = clamp(dt, 0, 1 / 15);
    const surfaces = this.context.getSurfaces();
    const config = this.context.getConfig();
    if (
      this.active &&
      config.interactions.snowballs.activation === 'hover-circle' &&
      time - (this.lastPointer?.time ?? time) > 0.4
    )
      this.release(false);
    for (let index = this.balls.length - 1; index >= 0; index--) {
      const ball = this.balls[index];
      if (!ball || ball === this.active) continue;
      const maxRadius = config.interactions.snowballs.maxRadius;
      if (ball.radius > maxRadius) {
        const excess = ball.mass - massFromRadius(maxRadius);
        this.context.spawnClump(ball.x, ball.y - ball.radius, excess, ball.vx, -25);
        ball.mass -= excess;
        ball.radius = maxRadius;
      }
      const meltRate = config.snow.accumulation.meltRate;
      if (meltRate > 0) {
        ball.radius = Math.max(0, ball.radius - meltRate * dt);
        ball.mass = massFromRadius(ball.radius);
        if (ball.radius < 0.5) {
          this.balls.splice(index, 1);
          continue;
        }
      }
      if (ball.support) {
        if (
          surfaces.includes(ball.support) &&
          ball.support.visible &&
          Math.abs(ball.support.angle) < 0.4 &&
          Math.hypot(ball.support.acceleration.x, ball.support.acceleration.y) < 1000
        ) {
          const point = worldPoint(
            ball.support,
            ball.localX,
            -ball.radius - depthAt(ball.support, ball.localX),
          );
          ball.x = point.x;
          ball.y = point.y;
          continue;
        }
        ball.vx = ball.support.velocity.x;
        ball.vy = ball.support.velocity.y - 30;
        delete ball.support;
        ball.state = 'airborne';
      }
      const previous = { x: ball.x, y: ball.y };
      ball.vy += 440 * dt;
      ball.vx *= Math.exp(-0.13 * dt);
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      let collision: { surface: Surface; localX: number; fraction: number } | undefined;
      for (const surface of surfaces) {
        if (!surface.visible || !surface.accumulation || surface.material === 'no-accumulation')
          continue;
        const a = localPoint(surface, previous.x, previous.y);
        const b = localPoint(surface, ball.x, ball.y);
        const top = -depthAt(surface, b.x);
        if (
          b.y <= a.y ||
          a.y + ball.radius > top + 2 ||
          b.y + ball.radius < top ||
          b.x < 0 ||
          b.x > surface.width
        )
          continue;
        const fraction = clamp((top - ball.radius - a.y) / (b.y - a.y), 0, 1);
        if (!collision || fraction < collision.fraction)
          collision = { surface, localX: a.x + (b.x - a.x) * fraction, fraction };
      }
      if (collision) {
        const surface = collision.surface;
        const point = worldPoint(
          surface,
          collision.localX,
          -ball.radius - depthAt(surface, collision.localX),
        );
        ball.x = point.x;
        ball.y = point.y;
        const nx = -Math.sin(surface.angle);
        const ny = Math.cos(surface.angle);
        const normalSpeed = ball.vx * nx + ball.vy * ny;
        ball.vx -= 1.28 * normalSpeed * nx;
        ball.vy -= 1.28 * normalSpeed * ny;
        ball.vx *= surface.material === 'slippery' ? 0.94 : 0.65;
        if (Math.abs(normalSpeed) < 75 && Math.abs(ball.vx) < 70 && Math.abs(surface.angle) < 0.4) {
          ball.support = surface;
          ball.localX = collision.localX;
          ball.state = 'resting';
          ball.vx = 0;
          ball.vy = 0;
        }
      }
      if (ball.y > 100000 || Math.abs(ball.x) > 100000 || !Number.isFinite(ball.x + ball.y))
        this.balls.splice(index, 1);
      // Released balls leave the scene promptly instead of accumulating invisible entities.
      else if (
        typeof window !== 'undefined' &&
        (ball.y > window.innerHeight + 500 || ball.x < -500 || ball.x > window.innerWidth + 500)
      )
        this.balls.splice(index, 1);
    }
    this.collideBalls();
    this.assemble(config.interactions.snowman.enabled);
    for (let index = this.snowmen.length - 1; index >= 0; index--) {
      const snowman = this.snowmen[index];
      if (!snowman) continue;
      snowman.age += dt;
      const meltRate = config.snow.accumulation.meltRate;
      if (meltRate > 0)
        for (const ball of snowman.balls) {
          ball.radius = Math.max(0, ball.radius - meltRate * dt);
          ball.mass = massFromRadius(ball.radius);
        }
      if ((snowman.balls[0]?.radius ?? 0) < 0.5) {
        this.snowmen.splice(index, 1);
        this.context.emit('snowman:removed', { surfaceId: snowman.support.id, reason: 'melted' });
        continue;
      }
      if (
        !surfaces.includes(snowman.support) ||
        !snowman.support.visible ||
        Math.abs(snowman.support.angle) > 0.4 ||
        Math.hypot(snowman.support.acceleration.x, snowman.support.acceleration.y) > 1000
      ) {
        let top = -depthAt(snowman.support, snowman.localX);
        for (const ball of snowman.balls) {
          const point = worldPoint(snowman.support, snowman.localX, top - ball.radius);
          ball.x = point.x;
          ball.y = point.y;
          ball.vx = snowman.support.velocity.x;
          ball.vy = snowman.support.velocity.y;
          delete ball.support;
          ball.state = 'airborne';
          this.balls.push(ball);
          top -= ball.radius * 2;
        }
        this.snowmen.splice(index, 1);
        this.context.emit('snowman:removed', { surfaceId: snowman.support.id });
      }
    }
    for (let index = this.ploughs.length - 1; index >= 0; index--) {
      const plough = this.ploughs[index];
      if (!plough) continue;
      if (!surfaces.includes(plough.support) || !plough.support.visible) {
        this.spill(plough);
        this.ploughs.splice(index, 1);
        continue;
      }
      plough.x += plough.direction * plough.speed * dt;
      const bin = clamp(
        Math.floor(plough.x / plough.support.binSize),
        0,
        plough.support.profile.length - 1,
      );
      for (
        let cursor = plough.previousBin + plough.direction;
        plough.direction > 0 ? cursor <= bin : cursor >= bin;
        cursor += plough.direction
      ) {
        const mass = plough.support.profile[cursor] ?? 0;
        plough.mass += mass;
        if (cursor >= 0 && cursor < plough.support.profile.length)
          plough.support.profile[cursor] = 0;
      }
      plough.previousBin = bin;
      if (plough.x < 0 || plough.x > plough.support.width) {
        this.spill(plough);
        this.ploughs.splice(index, 1);
        this.context.emit('plough:complete', { surfaceId: plough.support.id, mass: plough.mass });
      }
    }
  }
  private fragment(ball: Snowball): void {
    const count = Math.min(16, Math.max(4, Math.ceil(ball.radius / 2)));
    for (let index = 0; index < count; index++) {
      const angle = (index / count) * Math.PI * 2;
      this.context.spawnClump(
        ball.x + Math.cos(angle) * ball.radius * 0.5,
        ball.y + Math.sin(angle) * ball.radius * 0.5,
        ball.mass / count,
        ball.vx + Math.cos(angle) * 100,
        ball.vy + Math.sin(angle) * 80 - 60,
      );
    }
  }
  private spill(plough: Plough): void {
    if (plough.mass <= 0) return;
    const point = worldPoint(plough.support, clamp(plough.x, 0, plough.support.width));
    const count = Math.min(12, Math.max(1, Math.ceil(plough.mass / 60)));
    for (let index = 0; index < count; index++)
      this.context.spawnClump(
        point.x + plough.direction * (6 + index * 2),
        point.y - 4,
        plough.mass / count,
        plough.direction * (55 + index * 5),
        -35 - index * 4,
      );
  }
  private collideBalls(): void {
    for (let a = 0; a < this.balls.length; a++)
      for (let b = a + 1; b < this.balls.length; b++) {
        const first = this.balls[a];
        const second = this.balls[b];
        if (!first || !second || first === this.active || second === this.active) continue;
        const dx = second.x - first.x;
        const dy = second.y - first.y;
        const distance = Math.hypot(dx, dy);
        const total = first.radius + second.radius;
        if (distance >= total || distance < 0.001 || (first.support && second.support)) continue;
        const nx = dx / distance;
        const ny = dy / distance;
        const lower = dy > 0 ? second : first;
        const upper = dy > 0 ? first : second;
        if (
          (lower.support || lower.state === 'resting') &&
          Math.abs(upper.x - lower.x) < lower.radius * 0.5 &&
          Math.abs(upper.vy) < 160
        ) {
          upper.y = lower.y - total;
          upper.vx = 0;
          upper.vy = 0;
          upper.state = 'resting';
          continue;
        }
        const firstWeight = first.support
          ? 0
          : second.support
            ? 1
            : second.mass / (first.mass + second.mass);
        const secondWeight = second.support
          ? 0
          : first.support
            ? 1
            : first.mass / (first.mass + second.mass);
        first.x -= nx * (total - distance) * firstWeight;
        first.y -= ny * (total - distance) * firstWeight;
        second.x += nx * (total - distance) * secondWeight;
        second.y += ny * (total - distance) * secondWeight;
        const relative = (second.vx - first.vx) * nx + (second.vy - first.vy) * ny;
        if (relative < 0) {
          first.vx += relative * nx * firstWeight * 1.25;
          first.vy += relative * ny * firstWeight * 1.25;
          second.vx -= relative * nx * secondWeight * 1.25;
          second.vy -= relative * ny * secondWeight * 1.25;
        }
      }
  }
  private assemble(enabled = this.context.getConfig().interactions.snowman.enabled): void {
    if (!enabled || this.snowmen.length >= 4) return;
    for (const base of [...this.balls]) {
      if (!base.support || base.state !== 'resting') continue;
      const candidates = this.balls
        .filter(
          (ball) =>
            ball !== base &&
            ball.state === 'resting' &&
            Math.abs(ball.x - base.x) < base.radius * 0.6 &&
            ball.y < base.y &&
            ball.radius <= base.radius * 0.95,
        )
        .sort((a, b) => b.radius - a.radius);
      for (const middle of candidates) {
        if (Math.abs(base.y - middle.y - base.radius - middle.radius) > 9) continue;
        const head = candidates.find(
          (ball) =>
            ball !== middle &&
            ball.radius <= middle.radius * 0.95 &&
            Math.abs(middle.y - ball.y - middle.radius - ball.radius) < 9,
        );
        if (!head) continue;
        const balls = [base, middle, head];
        this.snowmen.push({ balls, support: base.support, localX: base.localX, age: 0 });
        for (const ball of balls) {
          const index = this.balls.indexOf(ball);
          if (index >= 0) this.balls.splice(index, 1);
          this.context.emit('snowball:stacked', { id: ball.id });
        }
        this.context.emit('snowman:created', {
          surfaceId: base.support.id,
          mass: balls.reduce((sum, ball) => sum + ball.mass, 0),
        });
        return;
      }
    }
  }
  render(ctx: CanvasRenderingContext2D, time: number): void {
    for (const ball of this.balls) {
      ctx.save();
      if (ball.support) clipToSurface(ctx, ball.support);
      drawSnowball(ctx, ball.x, ball.y, ball.radius);
      ctx.restore();
    }
    for (const snowman of this.snowmen) {
      ctx.save();
      clipToSurface(ctx, snowman.support);
      const point = worldPoint(
        snowman.support,
        snowman.localX,
        -depthAt(snowman.support, snowman.localX),
      );
      ctx.translate(point.x, point.y);
      ctx.rotate(snowman.support.angle);
      let top = 0;
      for (const ball of snowman.balls) {
        drawSnowball(ctx, 0, top - ball.radius, ball.radius);
        top -= ball.radius * 2;
      }
      const base = snowman.balls[0];
      const middle = snowman.balls[1];
      const head = snowman.balls[2];
      if (base && middle && head) {
        const headY = -base.radius * 2 - middle.radius * 2 - head.radius;
        const blink = Math.sin(time * 0.7 + snowman.localX) > 0.998;
        ctx.fillStyle = '#142334';
        for (const x of [-head.radius * 0.3, head.radius * 0.3]) {
          ctx.beginPath();
          ctx.ellipse(x, headY - head.radius * 0.12, 1.5, blink ? 0.35 : 2, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#f19048';
        ctx.beginPath();
        ctx.moveTo(-1, headY + 1);
        ctx.lineTo(head.radius * 0.75, headY + 3);
        ctx.lineTo(-1, headY + 5);
        ctx.fill();
        ctx.fillStyle = '#ca4764';
        ctx.fillRect(-middle.radius * 0.8, headY + head.radius - 2, middle.radius * 1.6, 5);
        ctx.save();
        ctx.translate(middle.radius * 0.5, headY + head.radius);
        ctx.rotate(Math.sin(time * 1.7) * 0.07);
        ctx.fillRect(0, 0, 5, 14);
        ctx.restore();
        for (let index = 0; index < 3; index++) {
          ctx.fillStyle = '#26384e';
          ctx.beginPath();
          ctx.arc(
            0,
            -base.radius * 2 - middle.radius * 1.5 + index * middle.radius * 0.5,
            1.7,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
        ctx.strokeStyle = '#7e5a41';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        for (const direction of [-1, 1]) {
          const armY = -base.radius * 2 - middle.radius;
          const tipY = armY - 10 - (direction > 0 ? Math.sin(time * 2) * 4 : 0);
          ctx.beginPath();
          ctx.moveTo(direction * middle.radius * 0.8, armY);
          ctx.lineTo(direction * (middle.radius + 15), tipY);
          ctx.lineTo(direction * (middle.radius + 18), tipY - 6);
          ctx.moveTo(direction * (middle.radius + 12), tipY + 1);
          ctx.lineTo(direction * (middle.radius + 18), tipY + 4);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
    for (const plough of this.ploughs) {
      const point = worldPoint(plough.support, plough.x);
      ctx.save();
      clipToSurface(ctx, plough.support);
      ctx.translate(point.x, point.y);
      ctx.rotate(plough.support.angle);
      ctx.scale(plough.direction, 1);
      drawPlough(ctx, plough.style);
      if (plough.mass > 0)
        drawSnowball(
          ctx,
          25 + Math.min(16, radiusFromMass(plough.mass)),
          -Math.min(20, radiusFromMass(plough.mass)),
          Math.min(20, radiusFromMass(plough.mass)),
        );
      ctx.restore();
    }
  }
  clear(): void {
    this.active = undefined;
    this.balls.length = 0;
    this.snowmen.length = 0;
    this.ploughs.length = 0;
    this.circle.reset();
    this.lastPointer = undefined;
  }
  destroy(): void {
    this.clear();
  }
}

export function drawSnowball(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
): void {
  ctx.save();
  const shade = ctx.createRadialGradient(
    x - radius * 0.35,
    y - radius * 0.4,
    radius * 0.1,
    x,
    y,
    radius,
  );
  shade.addColorStop(0, '#ffffff');
  shade.addColorStop(0.7, '#e8f3ff');
  shade.addColorStop(1, '#b2cee9');
  ctx.fillStyle = shade;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
/** Original tiny vector vehicle; no bitmap downloads or third-party artwork. */
export function drawPlough(
  ctx: CanvasRenderingContext2D,
  style: 'classic' | 'minimal' | 'festive' = 'classic',
): void {
  const body = style === 'festive' ? '#bd5269' : style === 'minimal' ? '#bdccdc' : '#efb93c';
  const roof = style === 'festive' ? '#40745d' : style === 'minimal' ? '#e6edf5' : '#f7d85a';
  ctx.fillStyle = '#233349';
  ctx.beginPath();
  ctx.roundRect(-21, -10, 39, 9, 4);
  ctx.fill();
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.roundRect(-17, -24, 20, 18, [5, 5, 0, 0]);
  ctx.fill();
  ctx.fillRect(2, -16, 16, 10);
  ctx.fillStyle = '#bce8f4';
  ctx.fillRect(-13, -21, 11, 10);
  ctx.fillStyle = '#12243a';
  ctx.fillRect(-7, -21, 2, 10);
  ctx.fillStyle = roof;
  ctx.fillRect(-17, -27, 21, 3);
  if (style !== 'minimal') {
    ctx.fillStyle = '#f9b867';
    ctx.beginPath();
    ctx.arc(-5, -29, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  if (style === 'festive') {
    ctx.fillStyle = '#f4e5ba';
    ctx.fillRect(4, -14, 12, 3);
    ctx.fillRect(9, -17, 3, 11);
    ctx.strokeStyle = '#7fc49a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-16, -25);
    ctx.lineTo(1, -25);
    ctx.stroke();
    for (const x of [-14, -8, -2]) {
      ctx.fillStyle = '#ffe2a4';
      ctx.beginPath();
      ctx.arc(x, -24, 1.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.strokeStyle = '#b8d2e1';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(17, -8);
  ctx.lineTo(24, -5);
  ctx.stroke();
  ctx.fillStyle = '#b1c7db';
  ctx.beginPath();
  ctx.moveTo(23, -17);
  ctx.lineTo(29, -16);
  ctx.lineTo(32, -1);
  ctx.lineTo(25, -1);
  ctx.closePath();
  ctx.fill();
  for (const x of [-10, 12]) {
    ctx.fillStyle = '#172334';
    ctx.beginPath();
    ctx.arc(x, -3, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8090a2';
    ctx.beginPath();
    ctx.arc(x, -3, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}
