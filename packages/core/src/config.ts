import { z } from 'zod';
import { isSafeTextureSource } from './rendering/Texture.js';
import type { PresetName, WeatherConfig, WeatherOptions } from './types.js';
const unit = z.number().finite().min(0).max(1);
const positive = (max: number) => z.number().finite().min(0).max(max);
const selector = z.string().min(1).max(512);
const wind = z
  .object({
    base: z.number().finite().min(-5).max(5),
    gusts: z.boolean(),
    variability: positive(5),
  })
  .strict();
export const presetNames = [
  'gentle-snow',
  'winter-magic',
  'snowstorm',
  'frosted-glass',
  'christmas-classic',
  'christmas-night',
  'north-pole',
  'minimal',
  'playful',
  'cinematic',
] as const;
export const configSchema = z
  .object({
    preset: z.enum(presetNames),
    autoStart: z.boolean(),
    seed: z.number().int().min(0).max(4294967295),
    container: z
      .custom<HTMLElement>(
        (v) =>
          typeof v === 'object' &&
          v !== null &&
          'nodeType' in v &&
          v.nodeType === 1 &&
          'style' in v,
        'container must be an HTMLElement',
      )
      .optional(),
    snow: z
      .object({
        enabled: z.boolean(),
        intensity: unit,
        particleCount: z.number().int().min(0).max(4000),
        flakeStyle: z.enum(['soft', 'dot', 'crystal']),
        texture: z
          .string()
          .max(4 * 1024 * 1024)
          .refine(isSafeTextureSource, 'Use an HTTPS, blob, or PNG/JPEG/WebP data texture')
          .nullable()
          .optional(),
        color: z.string().regex(/^#(?:[\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/i, 'Use a hex color'),
        minSize: z.number().min(0.2).max(20),
        maxSize: z.number().min(0.2).max(30),
        gravity: positive(1500),
        turbulence: positive(5),
        glow: z.boolean(),
        parallax: z.boolean(),
        wind,
        accumulation: z
          .object({
            enabled: z.boolean(),
            maxDepth: positive(80),
            growthRate: positive(10),
            softness: unit,
            sliding: z.boolean(),
            transferToLowerSurfaces: z.boolean(),
            meltRate: positive(10),
          })
          .strict(),
      })
      .strict(),
    dom: z
      .object({
        detection: z.enum(['auto', 'explicit']),
        respectLayers: z.boolean(),
        observeMutations: z.boolean(),
        include: z.array(selector).max(32),
        exclude: z.array(selector).max(32),
        maxSurfaces: z.number().int().min(0).max(500),
        removedSurface: z.enum(['shed', 'dispose']),
      })
      .strict(),
    interactions: z
      .object({
        brush: z
          .object({
            enabled: z.boolean(),
            radius: z.number().min(1).max(200),
            strength: positive(5),
            activation: z.enum(['hover', 'press']),
          })
          .strict(),
        snowballs: z
          .object({
            enabled: z.boolean(),
            activation: z.enum(['press-and-drag', 'hover-circle']),
            minRadius: z.number().min(2).max(50),
            maxRadius: z.number().min(4).max(100),
            maxCount: z.number().int().min(0).max(32),
          })
          .strict(),
        snowman: z.object({ enabled: z.boolean(), requiredBalls: z.literal(3) }).strict(),
        yeti: z
          .object({
            enabled: z.boolean(),
            size: z.number().min(0.5).max(2),
            cooldown: z.number().min(5).max(120),
          })
          .strict(),
        pointerVortex: z.object({ enabled: z.boolean() }).strict(),
      })
      .strict(),
    performance: z
      .object({
        adaptive: z.boolean(),
        maxFPS: z.number().int().min(10).max(120),
        preferredQuality: z.enum(['auto', 'low', 'medium', 'high']),
        maxDPR: z.number().min(1).max(3),
      })
      .strict(),
    accessibility: z
      .object({ reducedMotion: z.enum(['respect', 'reduce', 'ignore']), controls: z.boolean() })
      .strict(),
    debug: z.boolean(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.snow.minSize > v.snow.maxSize)
      ctx.addIssue({
        code: 'custom',
        message: 'minSize must not exceed maxSize',
        path: ['snow', 'minSize'],
      });
    if (v.interactions.snowballs.minRadius > v.interactions.snowballs.maxRadius)
      ctx.addIssue({
        code: 'custom',
        message: 'minRadius must not exceed maxRadius',
        path: ['interactions', 'snowballs'],
      });
  });
export const defaults: WeatherConfig = {
  preset: 'gentle-snow',
  autoStart: false,
  seed: 20261105,
  snow: {
    enabled: true,
    intensity: 0.55,
    particleCount: 360,
    flakeStyle: 'soft',
    color: '#f3f7ff',
    minSize: 0.8,
    maxSize: 3.2,
    gravity: 85,
    turbulence: 0.55,
    glow: false,
    parallax: true,
    wind: { base: 0.12, gusts: true, variability: 0.3 },
    accumulation: {
      enabled: true,
      maxDepth: 18,
      growthRate: 0.8,
      softness: 0.6,
      sliding: true,
      transferToLowerSurfaces: true,
      meltRate: 0,
    },
  },
  dom: {
    detection: 'auto',
    respectLayers: true,
    observeMutations: true,
    include: ['[data-weather-surface]'],
    exclude: ['input', 'textarea', 'select', '[contenteditable]', '[data-weather-ignore]'],
    maxSurfaces: 160,
    removedSurface: 'shed',
  },
  interactions: {
    brush: { enabled: true, radius: 28, strength: 0.8, activation: 'hover' },
    snowballs: {
      enabled: false,
      activation: 'press-and-drag',
      minRadius: 6,
      maxRadius: 36,
      maxCount: 12,
    },
    snowman: { enabled: false, requiredBalls: 3 },
    yeti: { enabled: false, size: 1, cooldown: 16 },
    pointerVortex: { enabled: false },
  },
  performance: { adaptive: true, maxFPS: 60, preferredQuality: 'auto', maxDPR: 2 },
  accessibility: { reducedMotion: 'respect', controls: false },
  debug: false,
};
export const defaultConfig = defaults;
export const presets: Record<PresetName, WeatherOptions> = {
  'gentle-snow': { snow: { intensity: 0.4, wind: { base: 0.08 }, accumulation: { maxDepth: 14 } } },
  'winter-magic': {
    snow: { intensity: 0.7, glow: true, parallax: true, accumulation: { maxDepth: 22 } },
  },
  snowstorm: {
    snow: {
      intensity: 1,
      particleCount: 700,
      wind: { base: 1.3, variability: 1 },
      turbulence: 1.3,
      accumulation: { growthRate: 1.8 },
    },
  },
  'frosted-glass': {
    snow: { intensity: 0.15, flakeStyle: 'crystal', accumulation: { maxDepth: 12 } },
  },
  'christmas-classic': { snow: { intensity: 0.55, glow: true, wind: { base: 0.04 } } },
  'christmas-night': {
    snow: { intensity: 0.6, glow: true, color: '#dbeaff', wind: { base: 0.1 } },
  },
  'north-pole': {
    snow: { intensity: 0.85, particleCount: 620, accumulation: { maxDepth: 30 } },
    interactions: { snowballs: { enabled: true }, snowman: { enabled: true } },
  },
  minimal: {
    snow: {
      intensity: 0.2,
      particleCount: 120,
      glow: false,
      flakeStyle: 'dot',
      accumulation: { maxDepth: 8 },
    },
    interactions: { brush: { enabled: false } },
  },
  playful: {
    snow: { intensity: 0.7, accumulation: { maxDepth: 28, growthRate: 1.4 } },
    interactions: {
      snowballs: { enabled: true },
      snowman: { enabled: true },
      pointerVortex: { enabled: true },
    },
  },
  cinematic: {
    snow: {
      intensity: 0.8,
      particleCount: 480,
      glow: true,
      parallax: true,
      maxSize: 4.5,
      wind: { variability: 0.65 },
    },
  },
};
function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && Object.getPrototypeOf(v) === Object.prototype;
}
function merge(base: unknown, patch: unknown, depth = 0): unknown {
  if (depth > 10) throw new TypeError('Configuration nesting is too deep');
  if (!isRecord(patch)) return Array.isArray(patch) ? [...patch] : patch;
  const result: Record<string, unknown> = isRecord(base) ? { ...base } : {};
  for (const [key, value] of Object.entries(patch)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key))
      throw new TypeError('Unsafe configuration key');
    if (value !== undefined) result[key] = merge(result[key], value, depth + 1);
  }
  return result;
}
export function resolveConfig(options: WeatherOptions = {}): WeatherConfig {
  const p = options.preset ?? defaults.preset;
  if (!presetNames.includes(p)) throw new TypeError(`Unknown preset: ${String(p)}`);
  return validateConfig(merge(merge(defaults, presets[p]), options));
}
export function patchConfig(current: WeatherConfig, patch: WeatherOptions): WeatherConfig {
  return validateConfig(merge(current, patch));
}
export function validateConfig(value: unknown): WeatherConfig {
  return configSchema.parse(value);
}
export function cloneConfig(config: WeatherConfig): WeatherConfig {
  return validateConfig(merge({}, config));
}

export const surfaceOptionsSchema = z
  .object({
    priority: z.number().finite().min(-10000).max(10000).optional(),
    accumulation: z.boolean().optional(),
    material: z.enum(['flat', 'slippery', 'sticky', 'no-accumulation']).optional(),
    edge: z.enum(['top', 'bottom']).optional(),
    layer: z.enum(['background', 'content', 'foreground']).optional(),
    clip: z.boolean().optional(),
    maxSnowDepth: z.number().finite().min(0).max(80).optional(),
  })
  .strict();
