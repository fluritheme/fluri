import { z } from 'zod';
import type {
  PluginContext,
  Surface,
  TriggerOptions,
  TriggerType,
  WeatherPlugin,
} from './types.js';

interface Attachment {
  enabled?: boolean | undefined;
  selector?: string | undefined;
}
export interface ChristmasOptions {
  lights?:
    | boolean
    | (Attachment & { warmth?: number; spacing?: number; color?: string; twinkle?: boolean });
  garlands?: boolean | (Attachment & { color?: string });
  ornaments?: boolean | (Attachment & { maxCount?: number; palette?: string[] });
  gifts?: boolean | Attachment;
  candyCanes?: boolean | Attachment;
  wreath?: boolean | Attachment;
  icicles?: boolean | Attachment;
  sparkle?: boolean | Attachment;
  frost?: boolean | Attachment;
  palette?: string[];
  plough?:
    | boolean
    | (Attachment & {
        automatic?: boolean;
        interval?: number;
        idleDelay?: number;
        speed?: number;
        direction?: 'left' | 'right';
        style?: 'classic' | 'minimal' | 'festive';
        probability?: number;
      });
}
type Decoration =
  | 'lights'
  | 'garlands'
  | 'ornaments'
  | 'gifts'
  | 'candyCanes'
  | 'wreath'
  | 'icicles'
  | 'sparkle'
  | 'frost';
interface Spark {
  x: number;
  y: number;
  age: number;
  duration: number;
  phase: number;
}
const selectors: Record<Decoration, string> = {
  lights: '[data-holiday-lights]',
  garlands: '[data-holiday-garland]',
  ornaments: '[data-holiday-ornaments]',
  gifts: '[data-holiday-gifts]',
  candyCanes: '[data-holiday-candy-canes]',
  wreath: '[data-holiday-wreath]',
  icicles: '[data-holiday-icicles]',
  sparkle: '[data-holiday-sparkle]',
  frost: '[data-holiday-frost]',
};
const defaultPalette = ['#ffd694', '#ee8c91', '#a4decf', '#b5beff'];
const bounded = (value: number | undefined, fallback: number, min: number, max: number): number =>
  value === undefined || !Number.isFinite(value) ? fallback : Math.max(min, Math.min(max, value));
const noise = (seed: number): number => {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
};

const colorSchema = z.string().regex(/^#(?:[\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/i, 'Use a hex color');
const attachmentShape = {
  enabled: z.boolean().optional(),
  selector: z.string().min(1).max(512).optional(),
};
const attachmentSchema = z.union([z.boolean(), z.object(attachmentShape).strict()]);
const paletteSchema = z.array(colorSchema).min(1).max(16);
const christmasSchema = z
  .object({
    lights: z
      .union([
        z.boolean(),
        z
          .object({
            ...attachmentShape,
            warmth: z.number().finite().min(0).max(1).optional(),
            spacing: z.number().finite().min(16).max(100).optional(),
            color: colorSchema.optional(),
            twinkle: z.boolean().optional(),
          })
          .strict(),
      ])
      .optional(),
    garlands: z
      .union([
        z.boolean(),
        z.object({ ...attachmentShape, color: colorSchema.optional() }).strict(),
      ])
      .optional(),
    ornaments: z
      .union([
        z.boolean(),
        z
          .object({
            ...attachmentShape,
            maxCount: z.number().int().min(0).max(64).optional(),
            palette: paletteSchema.optional(),
          })
          .strict(),
      ])
      .optional(),
    gifts: attachmentSchema.optional(),
    candyCanes: attachmentSchema.optional(),
    wreath: attachmentSchema.optional(),
    icicles: attachmentSchema.optional(),
    sparkle: attachmentSchema.optional(),
    frost: attachmentSchema.optional(),
    palette: paletteSchema.optional(),
    plough: z
      .union([
        z.boolean(),
        z
          .object({
            ...attachmentShape,
            automatic: z.boolean().optional(),
            interval: z.number().finite().min(5).max(3600).optional(),
            idleDelay: z.number().finite().min(0).max(3600).optional(),
            speed: z.number().finite().min(10).max(600).optional(),
            direction: z.enum(['left', 'right']).optional(),
            style: z.enum(['classic', 'minimal', 'festive']).optional(),
            probability: z.number().finite().min(0).max(1).optional(),
          })
          .strict(),
      ])
      .optional(),
  })
  .strict();

/** All decorations require explicit attachment selectors. Never decorates host content automatically. */
export function christmasPack(input: ChristmasOptions = {}): WeatherPlugin {
  const options = christmasSchema.parse(input);
  let context: PluginContext | undefined;
  let sparks: Spark[] = [];
  let timeSinceSpark = 0;
  let sequence = 0;
  let ploughClock = 0;
  let initialPlough = true;
  const plough =
    typeof options.plough === 'object' ? options.plough : { enabled: options.plough === true };
  const palette = options.palette
    ?.filter((color) => typeof color === 'string' && color.length < 128)
    .slice(0, 16);
  const colors = palette?.length ? palette : defaultPalette;
  const lights = typeof options.lights === 'object' ? options.lights : {};
  const garlands = typeof options.garlands === 'object' ? options.garlands : {};
  const ornaments = typeof options.ornaments === 'object' ? options.ornaments : {};
  const settings = (kind: Decoration): Attachment => {
    const value = options[kind];
    return typeof value === 'object' ? value : { enabled: value !== false };
  };
  const attached = (kind: Decoration): readonly Surface[] => {
    const config = settings(kind);
    if (!context || config.enabled === false) return [];
    const selector = config.selector ?? selectors[kind];
    return context
      .getSurfaces()
      .filter((surface) => surface.visible && surface.element.matches(selector));
  };
  const withSurface = (ctx: CanvasRenderingContext2D, surface: Surface, draw: () => void): void => {
    ctx.save();
    for (const clip of surface.clipRegions) {
      ctx.beginPath();
      ctx.roundRect(clip.x, clip.y, clip.width, clip.height, clip.radius);
      ctx.clip();
    }
    ctx.translate(surface.x, surface.y);
    ctx.rotate(surface.angle);
    draw();
    ctx.restore();
  };
  const addSpark = (surface: Surface): void => {
    if (sparks.length >= 96) return;
    const localX = noise(sequence++ + 2) * surface.width;
    sparks.push({
      x: surface.x + localX * Math.cos(surface.angle),
      y: surface.y + localX * Math.sin(surface.angle) - 12 - noise(sequence + 4) * 22,
      age: 0,
      duration: 0.8 + noise(sequence + 7) * 1.5,
      phase: noise(sequence + 8) * Math.PI * 2,
    });
  };
  return {
    name: 'fluri-christmas',
    setup(next) {
      context = next;
      if (plough.enabled !== false && plough.automatic && !next.trigger)
        throw new Error('Automatic Christmas plough requires PluginContext.trigger');
      ploughClock = 0;
      initialPlough = true;
      // Invalid selectors fail at configuration time, never in the animation frame.
      if (typeof document !== 'undefined')
        for (const kind of Object.keys(selectors) as Decoration[])
          document
            .createDocumentFragment()
            .querySelector(settings(kind).selector ?? selectors[kind]);
      if (typeof document !== 'undefined' && plough.selector)
        document.createDocumentFragment().querySelector(plough.selector);
      return () => {
        context = undefined;
        sparks = [];
      };
    },
    update(dt) {
      if (plough.enabled !== false && plough.automatic && context) {
        ploughClock += dt;
        if (
          ploughClock >=
          (initialPlough ? (plough.idleDelay ?? plough.interval ?? 20) : (plough.interval ?? 20))
        ) {
          ploughClock = 0;
          initialPlough = false;
          if (noise(sequence++ + 23) <= (plough.probability ?? 1))
            context.trigger?.('plough', {
              selector: plough.selector ?? '[data-plough-route]',
              ...(plough.direction ? { direction: plough.direction } : {}),
              ...(plough.speed !== undefined ? { speed: plough.speed } : {}),
              ...(plough.style ? { style: plough.style } : {}),
            });
        }
      }
      for (const spark of sparks) {
        spark.age += dt;
        spark.y -= dt * 6;
      }
      sparks = sparks.filter((spark) => spark.age < spark.duration);
      timeSinceSpark += dt;
      if (timeSinceSpark > 0.16) {
        timeSinceSpark %= 0.16;
        for (const surface of attached('sparkle').slice(0, 8)) addSpark(surface);
      }
    },
    trigger(type: TriggerType, trigger: TriggerOptions) {
      if (type !== 'sparkle') return;
      const surfaces =
        context
          ?.getSurfaces()
          .filter(
            (surface) =>
              surface.visible &&
              (trigger.surface
                ? surface.element === trigger.surface
                : trigger.selector
                  ? surface.element.matches(trigger.selector)
                  : surface.element.hasAttribute('data-holiday-sparkle')),
          ) ?? [];
      for (const surface of surfaces) for (let count = 0; count < 8; count++) addSpark(surface);
    },
    render(ctx, time) {
      for (const surface of attached('garlands'))
        withSurface(ctx, surface, () => {
          const sag = Math.min(25, surface.width * 0.045);
          ctx.strokeStyle = garlands.color ?? '#315c4c';
          ctx.lineWidth = 7;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(0, 5);
          ctx.quadraticCurveTo(surface.width / 2, sag * 2 + 5, surface.width, 5);
          ctx.stroke();
          for (let x = 4; x < surface.width; x += 7) {
            const y = 5 + 4 * sag * (x / surface.width) * (1 - x / surface.width);
            ctx.strokeStyle = noise(x) > 0.5 ? '#4b8062' : '#264c40';
            ctx.lineWidth = 1.8;
            for (const direction of [-1, 1]) {
              ctx.beginPath();
              ctx.moveTo(x, y);
              ctx.lineTo(x + 5, y + direction * (5 + noise(x + 2) * 4));
              ctx.stroke();
            }
            if (noise(x + 4) > 0.86) {
              ctx.fillStyle = '#d16a75';
              ctx.beginPath();
              ctx.arc(x, y + 3, 2, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        });
      for (const surface of attached('lights'))
        withSurface(ctx, surface, () => {
          const spacing = bounded(lights.spacing, 32, 16, 100);
          const count = Math.min(80, Math.max(2, Math.floor(surface.width / spacing)));
          const sag = Math.min(22, surface.width * 0.035);
          ctx.strokeStyle = '#56615d';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, 3);
          ctx.quadraticCurveTo(surface.width / 2, sag * 2, surface.width, 3);
          ctx.stroke();
          for (let index = 0; index <= count; index++) {
            const x = (surface.width * index) / count;
            const y = 3 + 4 * sag * (index / count) * (1 - index / count);
            const warm = bounded(lights.warmth, 0.85, 0, 1);
            const color =
              lights.color ??
              (warm > 0.55 ? '#ffd592' : (colors[index % colors.length] ?? '#c9e9ff'));
            const opacity =
              lights.twinkle === false
                ? 1
                : 0.72 + 0.28 * Math.sin(time * (0.6 + noise(index) * 0.6) + index * 2.3) ** 2;
            ctx.globalAlpha = opacity;
            const glow = ctx.createRadialGradient(x, y + 7, 0, x, y + 7, 10);
            glow.addColorStop(0, color);
            glow.addColorStop(1, 'transparent');
            ctx.fillStyle = glow;
            ctx.fillRect(x - 10, y - 3, 20, 20);
            ctx.fillStyle = '#586459';
            ctx.fillRect(x - 1.7, y, 3.4, 4);
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.ellipse(x, y + 6, 2.8, 4, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
          }
        });
      let ornamentCount = 0;
      for (const surface of attached('ornaments'))
        withSurface(ctx, surface, () => {
          const limit = Math.floor(bounded(ornaments.maxCount, 12, 0, 64));
          const ornamentPalette = ornaments.palette?.length ? ornaments.palette : colors;
          for (let x = 32; x < surface.width - 16 && ornamentCount < limit; x += 94) {
            const length = 15 + noise(x) * 14;
            const sway = Math.sin(time * 1.1 + x) * 0.045;
            ctx.save();
            ctx.translate(x, 2);
            ctx.rotate(sway);
            ctx.strokeStyle = '#a2a69b';
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(0, length);
            ctx.stroke();
            const color = ornamentPalette[ornamentCount++ % ornamentPalette.length] ?? '#e9a6ac';
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(0, length + 6, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffffff88';
            ctx.beginPath();
            ctx.ellipse(-2, length + 3, 1.5, 2.4, 0.3, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#c3b17d';
            ctx.fillRect(-2, length - 2, 4, 3);
            ctx.restore();
          }
        });
      for (const surface of attached('gifts'))
        withSurface(ctx, surface, () => {
          for (let index = 0; index < Math.min(3, Math.floor(surface.width / 80)); index++) {
            const x = surface.width - 22 - index * 25;
            const size = 13 + (index % 2) * 3;
            ctx.fillStyle = colors[index % colors.length] ?? '#d98197';
            ctx.fillRect(x - size / 2, -size, size, size);
            ctx.fillStyle = '#fff0c7';
            ctx.fillRect(x - 1.3, -size, 2.6, size);
            ctx.fillRect(x - size / 2 - 1, -size, size + 2, 3);
            ctx.strokeStyle = '#fff0c7';
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.ellipse(x - 3, -size - 2, 3.5, 2, 0.4, 0, Math.PI * 2);
            ctx.ellipse(x + 3, -size - 2, 3.5, 2, -0.4, 0, Math.PI * 2);
            ctx.stroke();
          }
        });
      for (const surface of attached('candyCanes'))
        withSurface(ctx, surface, () => {
          const count = Math.min(3, Math.max(1, Math.floor(surface.width / 110)));
          for (let index = 0; index < count; index++) {
            const x = (surface.width * (index + 1)) / (count + 1) - 6;
            ctx.save();
            ctx.translate(x, -1);
            ctx.rotate(-0.13 + index * 0.11);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            const canePath = (): void => {
              ctx.beginPath();
              ctx.moveTo(0, 0);
              ctx.lineTo(0, -25);
              ctx.arc(6, -25, 6, Math.PI, 0);
              ctx.lineTo(12, -20);
            };
            ctx.strokeStyle = '#d2e3ee';
            ctx.lineWidth = 6;
            canePath();
            ctx.stroke();
            ctx.strokeStyle = '#fffaf4';
            ctx.lineWidth = 5;
            canePath();
            ctx.stroke();
            ctx.setLineDash([3, 5]);
            ctx.lineDashOffset = index * 2;
            ctx.strokeStyle = '#d9637b';
            canePath();
            ctx.stroke();
            ctx.restore();
          }
        });
      for (const surface of attached('icicles'))
        withSurface(ctx, surface, () => {
          const grow = Math.min(1, Math.max(0.1, time / 12));
          ctx.fillStyle = '#c2e7ff99';
          for (let x = 8; x < surface.width - 5; x += 15 + noise(x) * 10) {
            const length = (7 + noise(x + 4) * 20) * grow;
            ctx.beginPath();
            ctx.moveTo(x - 2.5, 1);
            ctx.lineTo(x + 2.5, 1);
            ctx.lineTo(x + noise(x) * 2, length);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#f1fcffa0';
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(x - 1, 2);
            ctx.lineTo(x, length - 2);
            ctx.stroke();
          }
        });
      for (const surface of attached('frost'))
        withSurface(ctx, surface, () => {
          ctx.strokeStyle = '#d3efff70';
          ctx.lineWidth = 0.8;
          for (const edge of [0, surface.width])
            for (let index = 0; index < 8; index++) {
              const sign = edge === 0 ? 1 : -1;
              const x = edge + sign * index * 3.5;
              const y = 2 + index * 0.9;
              ctx.beginPath();
              ctx.moveTo(x, y + 7);
              ctx.lineTo(x + sign * 4, y - 2);
              ctx.moveTo(x + sign * 2, y + 3);
              ctx.lineTo(x - sign * 1, y);
              ctx.moveTo(x + sign * 2, y + 3);
              ctx.lineTo(x + sign * 6, y + 2);
              ctx.stroke();
            }
        });
      for (const surface of attached('wreath'))
        withSurface(ctx, surface, () => {
          const radius = Math.min(19, surface.width / 4, surface.height / 3);
          if (radius < 7) return;
          ctx.save();
          ctx.translate(surface.width / 2, Math.max(radius + 10, surface.height / 2));
          ctx.strokeStyle = '#335c48';
          ctx.lineWidth = 7;
          ctx.beginPath();
          ctx.arc(0, 0, radius, 0, Math.PI * 2);
          ctx.stroke();
          for (let index = 0; index < 24; index++) {
            const angle = (index / 24) * Math.PI * 2;
            ctx.save();
            ctx.rotate(angle);
            ctx.fillStyle = index % 2 ? '#527f55' : '#416c49';
            ctx.beginPath();
            ctx.ellipse(radius, 0, 5, 2, 0.7, 0, Math.PI * 2);
            ctx.fill();
            if (index % 4 === 0) {
              ctx.fillStyle = '#d26b76';
              ctx.beginPath();
              ctx.arc(radius, 0, 1.8, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.restore();
          }
          ctx.fillStyle = '#d4818e';
          ctx.beginPath();
          ctx.moveTo(0, radius);
          ctx.lineTo(-10, radius - 5);
          ctx.lineTo(-10, radius + 5);
          ctx.closePath();
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(0, radius);
          ctx.lineTo(10, radius - 5);
          ctx.lineTo(10, radius + 5);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        });
      for (const spark of sparks) {
        ctx.save();
        ctx.translate(spark.x, spark.y);
        ctx.rotate(spark.phase + spark.age * 0.3);
        ctx.globalAlpha = Math.sin((Math.PI * spark.age) / spark.duration);
        ctx.strokeStyle = '#fff0c4';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-3, 0);
        ctx.lineTo(3, 0);
        ctx.moveTo(0, -3);
        ctx.lineTo(0, 3);
        ctx.stroke();
        ctx.restore();
      }
    },
    destroy() {
      context = undefined;
      sparks = [];
    },
  };
}
