import type { PluginContext, Surface, Vec2, YetiPhase } from '../types.js';

export interface YetiTarget extends Vec2 {
  support: Surface;
  localX: number;
}
interface Projectile extends Vec2 {
  vx: number;
  vy: number;
  mass: number;
  age: number;
}
export interface YetiWorld {
  targets(): YetiTarget[];
  gather(surface: Surface, x: number, radius: number, mass: number): number;
  hit(from: Vec2, to: Vec2, radius: number, vx: number): boolean;
}
const clamp = (n: number, a: number, b: number): number => Math.max(a, Math.min(b, n));
const radius = (mass: number): number => Math.sqrt(mass / Math.PI);
const offset = (surface?: Surface): Vec2 => {
  const win = surface?.element.ownerDocument?.defaultView;
  return { x: win?.scrollX ?? 0, y: win?.scrollY ?? 0 };
};
const usable = (s: Surface): boolean =>
  s.visible && !s.occluded && s.accumulation && s.width >= 150 && Math.abs(s.angle) < 0.2;

/** A single visitor, one real snowball, and a bounded state machine. No timers or DOM nodes. */
export class Yeti {
  phase: YetiPhase = 'hidden';
  private support: Surface | undefined;
  private x = 0;
  private age = 0;
  private elapsed = 0;
  private held = 0;
  private facing = 1;
  private wait = 0;
  private projectile: Projectile | undefined;
  private target: YetiTarget | undefined;
  constructor(
    private readonly context: PluginContext,
    private readonly world: YetiWorld,
  ) {}
  get state(): Readonly<{ phase: YetiPhase; x: number; y: number; mass: number; flying: boolean }> {
    const point = this.point();
    return {
      phase: this.phase,
      ...point,
      mass: this.held + (this.projectile?.mass ?? 0),
      flying: !!this.projectile,
    };
  }
  private point(): Vec2 {
    const s = this.support;
    if (!s) return { x: 0, y: 0 };
    const depth =
      (s.profile[clamp(Math.floor(this.x / s.binSize), 0, s.profile.length - 1)] ?? 0) / s.binSize;
    return {
      x: s.x + this.x * Math.cos(s.angle) + depth * Math.sin(s.angle),
      y: s.y + this.x * Math.sin(s.angle) - depth * Math.cos(s.angle),
    };
  }
  private change(phase: YetiPhase): void {
    this.phase = phase;
    this.elapsed = 0;
    this.context.emit('yeti:phase', { phase, surfaceId: this.support?.id });
  }
  spawn(preferred?: Surface): void {
    if (!this.context.getConfig().interactions.yeti.enabled || this.support) return;
    const surfaces = this.context.getSurfaces();
    const support =
      preferred && usable(preferred)
        ? preferred
        : (surfaces.find((s) => usable(s) && s.element.hasAttribute('data-weather-yeti')) ??
          surfaces.find(usable));
    if (!support) return;
    const margin = Math.min(
      36 * this.context.getConfig().interactions.yeti.size,
      support.width / 4,
    );
    const localX = support.width * 0.18;
    if (support.exposed?.[Math.floor(localX / support.binSize)] === 0) return;
    this.support = support;
    this.x = clamp(localX, margin, support.width - margin);
    this.age = 0;
    this.wait = 0;
    this.change('arriving');
    this.context.emit('yeti:spawned', { surfaceId: support.id });
  }
  private spill(): void {
    const p = this.point();
    if (this.held > 0) this.context.spawnClump(p.x, p.y - 18, this.held, 0, -25);
    this.held = 0;
    if (this.projectile) {
      const scroll = offset(this.support),
        b = this.projectile;
      this.context.spawnClump(b.x - scroll.x, b.y - scroll.y, b.mass, b.vx, b.vy);
      this.projectile = undefined;
    }
  }
  clear(recycle = false): void {
    if (recycle) this.spill();
    this.support = undefined;
    this.target = undefined;
    this.projectile = undefined;
    this.held = 0;
    this.wait = 0;
    this.phase = 'hidden';
  }
  update(dt: number): void {
    const settings = this.context.getConfig().interactions.yeti;
    if (!settings.enabled) {
      if (this.support) this.clear(true);
      return;
    }
    if (
      this.support &&
      (!this.context.getSurfaces().includes(this.support) ||
        !this.support.accumulation ||
        this.support.width < 150 ||
        Math.abs(this.support.angle) >= 0.2)
    ) {
      this.clear(true);
      return;
    }
    if (!this.support) {
      this.spawn();
      return;
    }
    if (!this.support.visible || this.support.occluded) return;
    dt = clamp(dt, 0, 1 / 15);
    this.elapsed += dt;
    this.age += dt;
    this.wait = Math.max(0, this.wait - dt);
    const s = this.support;
    const point = this.point();
    const scale = settings.size;
    if (this.projectile) {
      const ball = this.projectile,
        scroll = offset(s);
      const from = { x: ball.x - scroll.x, y: ball.y - scroll.y };
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt + 220 * dt * dt;
      ball.vy += 440 * dt;
      ball.age += dt;
      const to = { x: ball.x - scroll.x, y: ball.y - scroll.y };
      if (this.world.hit(from, to, radius(ball.mass), ball.vx)) {
        this.context.spawnClump(to.x, to.y, ball.mass, ball.vx * 0.15, -60);
        this.projectile = undefined;
        this.context.emit('yeti:hit', { surfaceId: s.id });
        this.change('celebrating');
      } else if (ball.age > 1.8 || Math.hypot(to.x - point.x, to.y - point.y) > 1000) {
        this.spill();
        this.context.emit('yeti:miss', { surfaceId: s.id });
        this.change('shrugging');
      }
    }
    switch (this.phase) {
      case 'arriving':
        if (this.elapsed > 1.1) this.change('idle');
        break;
      case 'idle': {
        if (this.wait > 0) break;
        this.target = this.world
          .targets()
          .filter((t) => t.support === s && Math.abs(t.x - point.x) > 65 * scale)[0];
        if (this.target) {
          this.facing = this.target.localX >= this.x ? 1 : -1;
          this.change('sneaking');
        }
        break;
      }
      case 'sneaking': {
        if (
          !this.target ||
          !this.world.targets().some((t) => t.support === s && t.localX === this.target?.localX)
        ) {
          this.change('idle');
          break;
        }
        const stand = clamp(
          this.target.localX - this.facing * 130 * scale,
          30 * scale,
          s.width - 30 * scale,
        );
        const nextX = this.x + clamp(stand - this.x, -38 * dt, 38 * dt);
        const bin = Math.floor(nextX / s.binSize);
        if (s.exposed?.[bin] === 0) {
          this.wait = settings.cooldown;
          this.change('idle');
          break;
        }
        this.x = nextX;
        if (Math.abs(stand - this.x) < 1) this.change('gathering');
        break;
      }
      case 'gathering': {
        const wanted = Math.PI * (6 * scale) ** 2;
        // Never scoop from covered bins or manufacture snow on an empty ledge.
        const bin = Math.floor(this.x / s.binSize);
        if (s.exposed?.[bin] !== 0)
          this.held += this.world.gather(
            s,
            this.x,
            16 * scale,
            Math.min(wanted - this.held, wanted * dt),
          );
        if (this.elapsed > 1.4) {
          if (this.held >= Math.PI * (2 * scale) ** 2) this.change('packing');
          else {
            this.spill();
            this.wait = 3;
            this.change('shrugging');
          }
        }
        break;
      }
      case 'packing':
        if (this.elapsed > 1.05) this.change('aiming');
        break;
      case 'aiming':
        if (this.elapsed > 0.65) this.change('throwing');
        break;
      case 'throwing': {
        if (this.elapsed >= 0.25 && this.held > 0) {
          const target = this.world
            .targets()
            .find((t) => t.support === s && t.localX === this.target?.localX);
          if (!target) {
            this.spill();
            this.change('shrugging');
            break;
          }
          const origin = { x: point.x + this.facing * 24 * scale, y: point.y - 38 * scale };
          const flight = clamp(Math.abs(target.x - origin.x) / 220, 0.55, 0.95);
          const scroll = offset(s);
          this.projectile = {
            x: origin.x + scroll.x,
            y: origin.y + scroll.y,
            vx: (target.x - origin.x) / flight,
            vy: (target.y - origin.y) / flight - 220 * flight,
            age: 0,
            mass: this.held,
          };
          this.held = 0;
          this.context.emit('yeti:thrown', { mass: this.projectile.mass, surfaceId: s.id });
        }
        if (this.elapsed > 0.55) this.change('watching');
        break;
      }
      case 'celebrating':
      case 'shrugging':
        if (this.elapsed > 1.6) {
          this.wait = settings.cooldown;
          this.target = undefined;
          this.change('idle');
        }
        break;
      default:
        break;
    }
  }
  render(ctx: CanvasRenderingContext2D): void {
    if (!this.support) return;
    const point = this.point();
    const scale = this.context.getConfig().interactions.yeti.size;
    ctx.save();
    if (this.support.options.clip !== false)
      for (const clip of this.support.clipRegions) {
        ctx.beginPath();
        ctx.roundRect(clip.x, clip.y, clip.width, clip.height, clip.radius);
        ctx.clip();
      }
    ctx.translate(point.x, point.y);
    ctx.rotate(this.support.angle);
    ctx.scale(scale * this.facing, scale);
    drawYeti(ctx, this.phase, this.elapsed, this.age, radius(this.held) / scale);
    ctx.restore();
    if (this.projectile) {
      const b = this.projectile,
        scroll = offset(this.support);
      ctx.save();
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#9aaec2';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(b.x - scroll.x, b.y - scroll.y, radius(b.mass), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }
}

/** Original vector artwork: furry silhouette, mittens, tiny horns and expressive poses. */
export function drawYeti(
  ctx: CanvasRenderingContext2D,
  phase: YetiPhase,
  elapsed: number,
  age: number,
  ball: number,
): void {
  const gather = phase === 'gathering';
  const pack = phase === 'packing';
  const happy = phase === 'celebrating';
  const shrug = phase === 'shrugging';
  const windup = phase === 'aiming' || (phase === 'throwing' && elapsed < 0.25);
  const release = phase === 'throwing' && elapsed >= 0.25;
  const walk = phase === 'sneaking';
  const arrival = phase === 'arriving' ? Math.min(1, elapsed / 0.85) : 1;
  const bounce = happy
    ? -Math.abs(Math.sin(elapsed * 9)) * 7
    : walk
      ? Math.sin(age * 13) * 1.5
      : Math.sin(age * 2.5) * 0.65;
  ctx.globalAlpha *= arrival;
  ctx.translate(0, (1 - arrival) * 12 + bounce + (gather ? 7 : 0));
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 1.1;
  const shape = (
    x: number,
    y: number,
    rx: number,
    ry: number,
    fill: string,
    stroke = '#a6bac7',
  ): void => {
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  };
  ctx.save();
  ctx.globalAlpha *= 0.14;
  shape(0, -1 - bounce, 21, 3, '#182c48', 'transparent');
  ctx.restore();
  const step = walk ? Math.sin(age * 13) * 4 : 0;
  shape(-10, -4 - step, 8, 5, '#e7f2fa');
  shape(10, -4 + step, 8, 5, '#e7f2fa');
  // A scalloped coat, with rounded tufts rather than a smooth generic circle.
  ctx.fillStyle = '#f6fbff';
  ctx.strokeStyle = '#a6bac7';
  ctx.beginPath();
  ctx.moveTo(-17, -9);
  ctx.bezierCurveTo(-23, -17, -22, -32, -17, -39);
  ctx.lineTo(-19, -43);
  ctx.lineTo(-13, -42);
  ctx.lineTo(-13, -47);
  ctx.lineTo(-7, -45);
  ctx.quadraticCurveTo(-2, -53, 3, -46);
  ctx.lineTo(8, -50);
  ctx.lineTo(10, -44);
  ctx.lineTo(16, -46);
  ctx.lineTo(16, -40);
  ctx.bezierCurveTo(23, -32, 23, -16, 17, -9);
  ctx.quadraticCurveTo(13, -5, 10, -9);
  ctx.quadraticCurveTo(5, -4, 1, -8);
  ctx.quadraticCurveTo(-5, -4, -8, -8);
  ctx.quadraticCurveTo(-13, -4, -17, -9);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffe0b2';
  ctx.strokeStyle = '#bca88e';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 13, -42);
    ctx.quadraticCurveTo(side * 21, -51, side * 16, -53);
    ctx.quadraticCurveTo(side * 13, -49, side * 10, -44);
    ctx.fill();
    ctx.stroke();
  }
  shape(0, -34, 14, 11, '#d6eaf5', '#b6cfdd');
  const blink = Math.sin(age * 1.7) > 0.994 || (happy && Math.sin(elapsed * 6) > 0.3);
  for (const eye of [-5.5, 5.5]) {
    if (blink) {
      ctx.strokeStyle = '#253447';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(eye - 2, -35);
      ctx.quadraticCurveTo(eye, -37, eye + 2, -35);
      ctx.stroke();
    } else {
      shape(eye, -35, 2.3, 3.1, '#253447', '#253447');
      shape(eye + 0.7, -36, 0.6, 0.8, '#fff', '#fff');
    }
  }
  shape(-10, -30, 2.7, 1.5, '#f2b8bc', 'transparent');
  shape(10, -30, 2.7, 1.5, '#f2b8bc', 'transparent');
  ctx.strokeStyle = '#405668';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-3, -28);
  ctx.quadraticCurveTo(0, shrug ? -30 : -24, 3, -28);
  ctx.stroke();
  // Tangerine scarf and a small belly tuft keep the silhouette readable on snow.
  ctx.fillStyle = '#ff7959';
  ctx.strokeStyle = '#db5d46';
  ctx.beginPath();
  ctx.roundRect(-14, -24, 28, 5, 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(8, -21, 5, 12, 1.5);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#c4d7e3';
  ctx.beginPath();
  ctx.moveTo(-5, -17);
  ctx.lineTo(-2, -13);
  ctx.lineTo(0, -16);
  ctx.lineTo(3, -13);
  ctx.lineTo(6, -17);
  ctx.stroke();
  const wave = phase === 'arriving' ? Math.sin(elapsed * 16) * 4 : 0;
  let left = { x: -24, y: -20 },
    right = { x: 24, y: -20 };
  if (gather) {
    left = { x: 2, y: -9 };
    right = { x: 19, y: -7 + Math.sin(age * 15) * 2 };
  }
  if (pack) {
    const squeeze = Math.sin(elapsed * 17) * 2;
    left = { x: 1 + squeeze, y: -20 };
    right = { x: 19 - squeeze, y: -20 };
  }
  if (windup) {
    right = { x: 22, y: -50 };
    left = { x: -21, y: -17 };
  }
  if (release || phase === 'watching') right = { x: 31, y: -36 };
  if (happy) {
    left = { x: -26, y: -42 };
    right = { x: 26, y: -42 };
  }
  if (shrug) {
    left = { x: -27, y: -27 };
    right = { x: 27, y: -27 };
  }
  if (phase === 'arriving') right = { x: 25 + wave, y: -41 };
  ctx.strokeStyle = '#b1c7d5';
  ctx.lineWidth = 8;
  for (const [side, hand] of [
    [-1, left],
    [1, right],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(side * 16, -25);
    ctx.lineTo(hand.x, hand.y);
    ctx.stroke();
  }
  ctx.strokeStyle = '#f6fbff';
  ctx.lineWidth = 6;
  for (const [side, hand] of [
    [-1, left],
    [1, right],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(side * 16, -25);
    ctx.lineTo(hand.x, hand.y);
    ctx.stroke();
  }
  ctx.lineWidth = 0.9;
  if (ball > 0) {
    const bx = windup ? right.x : 10,
      by = windup ? right.y - 4 : gather ? -8 : -21;
    shape(bx, by, ball, ball * (pack ? 0.9 : 1), '#fff', '#9aafbe');
  }
  ctx.lineWidth = 1;
  shape(left.x, left.y, 5, 5, '#edf7ff');
  shape(right.x, right.y, 5, 5, '#edf7ff');
}
