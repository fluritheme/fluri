export interface Vec2 {
  x: number;
  y: number;
}
export type DeepPartial<T> = T extends Element
  ? T
  : T extends readonly unknown[]
    ? T
    : T extends object
      ? { [K in keyof T]?: DeepPartial<T[K]> }
      : T;
export type PresetName =
  | 'gentle-snow'
  | 'winter-magic'
  | 'snowstorm'
  | 'frosted-glass'
  | 'christmas-classic'
  | 'christmas-night'
  | 'north-pole'
  | 'minimal'
  | 'playful'
  | 'cinematic';
export type Layer = 'background' | 'content' | 'foreground';
export type Material = 'flat' | 'slippery' | 'sticky' | 'no-accumulation';
export interface WeatherConfig {
  preset: PresetName;
  autoStart: boolean;
  seed: number;
  container?: HTMLElement | undefined;
  snow: {
    enabled: boolean;
    intensity: number;
    particleCount: number;
    flakeStyle: 'soft' | 'dot' | 'crystal';
    texture?: string | null | undefined;
    color: string;
    minSize: number;
    maxSize: number;
    gravity: number;
    turbulence: number;
    glow: boolean;
    parallax: boolean;
    wind: { base: number; gusts: boolean; variability: number };
    accumulation: {
      enabled: boolean;
      maxDepth: number;
      growthRate: number;
      softness: number;
      sliding: boolean;
      transferToLowerSurfaces: boolean;
      meltRate: number;
    };
  };
  dom: {
    detection: 'auto' | 'explicit';
    respectLayers: boolean;
    observeMutations: boolean;
    include: string[];
    exclude: string[];
    maxSurfaces: number;
    removedSurface: 'shed' | 'dispose';
  };
  interactions: {
    brush: { enabled: boolean; radius: number; strength: number; activation: 'hover' | 'press' };
    snowballs: {
      enabled: boolean;
      activation: 'press-and-drag' | 'hover-circle';
      minRadius: number;
      maxRadius: number;
      maxCount: number;
    };
    snowman: { enabled: boolean; requiredBalls: number };
    pointerVortex: { enabled: boolean };
  };
  performance: {
    adaptive: boolean;
    maxFPS: number;
    preferredQuality: 'auto' | 'low' | 'medium' | 'high';
    maxDPR: number;
  };
  accessibility: { reducedMotion: 'respect' | 'reduce' | 'ignore'; controls: boolean };
  debug: boolean;
}
export type WeatherOptions = DeepPartial<WeatherConfig>;
export interface SurfaceOptions {
  priority?: number | undefined;
  accumulation?: boolean | undefined;
  material?: Material | undefined;
  edge?: 'top' | 'bottom' | undefined;
  layer?: Layer | undefined;
  clip?: boolean | undefined;
  maxSnowDepth?: number | undefined;
}
export interface ClipRect {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
}
export interface Surface {
  id: string;
  element: Element;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  normal: Vec2;
  velocity: Vec2;
  previousVelocity?: Vec2;
  acceleration: Vec2;
  profile: Float32Array;
  packing?: Float32Array;
  binSize: number;
  layer: Layer;
  paintOrder: number;
  clipRegions: ClipRect[];
  radius: number;
  material: Material;
  maxDepth: number;
  accumulation: boolean;
  visible: boolean;
  opaque?: boolean;
  exposed?: Uint8Array;
  occluded?: boolean;
  confidence: 'high' | 'medium' | 'low';
  options: SurfaceOptions;
}
export interface Particle {
  x: number;
  y: number;
  previousX: number;
  previousY: number;
  vx: number;
  vy: number;
  radius: number;
  mass: number;
  opacity: number;
  phase: number;
  depth: number;
  kind: 'flake' | 'clump' | 'sparkle';
  age: number;
  layer: Layer;
}
export type WeatherState = 'idle' | 'running' | 'paused' | 'stopped' | 'destroyed';
export interface WeatherMetrics {
  textureStatus: 'idle' | 'loading' | 'ready' | 'error' | 'destroyed';
  state: WeatherState;
  fps: number;
  frameTime: number;
  simTime: number;
  renderTime: number;
  geometryScanTime: number;
  particleCount: number;
  particleBudget: number;
  surfaceCount: number;
  collisionChecks: number;
  droppedFrames: number;
  quality: number;
  snowMass: number;
  snowballCount: number;
  snowmanCount: number;
  approximateMemory: number;
}
export type WeatherEventName =
  | 'ready'
  | 'start'
  | 'pause'
  | 'resume'
  | 'stop'
  | 'destroy'
  | 'error'
  | 'surface:added'
  | 'surface:removed'
  | 'surface:updated'
  | 'snow:deposit'
  | 'snow:slide'
  | 'snow:brush'
  | 'snow:transfer'
  | 'snowball:created'
  | 'snowball:thrown'
  | 'snowball:stacked'
  | 'snowman:created'
  | 'snowman:removed'
  | 'plough:start'
  | 'plough:complete'
  | 'quality:changed';
export type TriggerType = 'plough' | 'gust' | 'snowburst' | 'sparkle' | 'snowman' | 'snowball';
export interface TriggerOptions {
  selector?: string;
  surface?: Element;
  direction?: 'left' | 'right';
  x?: number;
  y?: number;
  radius?: number;
  speed?: number;
  style?: 'classic' | 'minimal' | 'festive';
}
export interface PluginContext {
  trigger?(type: TriggerType, options?: TriggerOptions): void;
  getConfig(): WeatherConfig;
  getSurfaces(): readonly Surface[];
  emit(event: WeatherEventName, data?: unknown): void;
  spawnClump(x: number, y: number, mass: number, vx: number, vy: number): void;
}
export interface WeatherPlugin {
  name: string;
  setup?(context: PluginContext): void | (() => void);
  update?(dt: number, time: number): void;
  render?(ctx: CanvasRenderingContext2D, time: number): void;
  trigger?(type: TriggerType, options: TriggerOptions): void;
  destroy?(): void;
}
export interface WeatherController {
  start(): void;
  pause(): void;
  resume(): void;
  stop(): void;
  destroy(): void;
  updateConfig(patch: WeatherOptions): void;
  getConfig(): WeatherConfig;
  setPreset(name: PresetName, overrides?: WeatherOptions): void;
  setIntensity(amount: number): void;
  clearAccumulation(selector?: string): void;
  addSnow(amount: number, selector?: string): void;
  registerSurface(element: Element, options?: SurfaceOptions): () => void;
  unregisterSurface(element: Element): void;
  trigger(type: TriggerType, options?: TriggerOptions): void;
  getMetrics(): WeatherMetrics;
  on(event: WeatherEventName, callback: (data: unknown) => void): () => void;
  use(plugin: WeatherPlugin): () => void;
}
