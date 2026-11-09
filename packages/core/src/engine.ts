import { FrameBudget, particleBudget } from './performance/Budget.js';
import { seedDeposits } from './seedDeposits.js';
import { Actors } from './actors/Actors.js';
import { cloneConfig, patchConfig, resolveConfig, surfaceOptionsSchema } from './config.js';
import { SurfaceRegistry } from './dom/SurfaceRegistry.js';
import { ParticleSystem, depthAt, seededRandom, localToWorld, totalMass } from './physics/index.js';
import { CanvasRenderer } from './rendering/CanvasRenderer.js';
import type {
  PluginContext,
  PresetName,
  Surface,
  SurfaceOptions,
  TriggerOptions,
  TriggerType,
  WeatherConfig,
  WeatherController,
  WeatherEventName,
  WeatherMetrics,
  WeatherOptions,
  WeatherPlugin,
  WeatherState,
} from './types.js';

export function createWeather(options: WeatherOptions = {}): WeatherController {
  return new WeatherEngine(options);
}
function freezeConfig<T>(value: T): T {
  if (value && typeof value === 'object' && !('nodeType' in value)) {
    for (const child of Object.values(value)) freezeConfig(child);
    Object.freeze(value);
  }
  return value;
}
class WeatherEngine implements WeatherController {
  private config: WeatherConfig;
  private pluginConfig: WeatherConfig;
  private state: WeatherState = 'idle';
  private renderer: CanvasRenderer | undefined;
  private registry: SurfaceRegistry | undefined;
  private particles: ParticleSystem;
  private actors: Actors | undefined;
  private root: HTMLElement | undefined;
  private listeners = new Map<WeatherEventName, Set<(data: unknown) => void>>();
  private plugins = new Map<WeatherPlugin, (() => void) | undefined>();
  private registrations = new Map<Element, SurfaceOptions>();
  private cleanups: (() => void)[] = [];
  private raf = 0;
  private geometryRAF = 0;
  private geometryDirty = false;
  private lastFrame = 0;
  private time = 0;
  private accumulator = 0;
  private quality = 1;
  private frameBudget = new FrameBudget();
  private coarse = false;
  private effectiveBudget = 0;
  private media: MediaQueryList | undefined;
  private toggle: HTMLButtonElement | undefined;
  private pointer: { x: number; y: number; time: number } | undefined;
  private gatheringPointer: number | undefined;
  private lastBrush = 0;
  private depositSeed = 0;
  private eventClock = 0;
  private pendingSnow = { deposits: 0, transfers: 0, slides: 0, slideMass: 0 };
  private metrics: WeatherMetrics = {
    state: 'idle',
    fps: 0,
    frameTime: 0,
    simTime: 0,
    renderTime: 0,
    geometryScanTime: 0,
    particleCount: 0,
    surfaceCount: 0,
    collisionChecks: 0,
    droppedFrames: 0,
    quality: 1,
    snowMass: 0,
    snowballCount: 0,
    snowmanCount: 0,
    yetiPhase: 'hidden',
    approximateMemory: 0,
    particleBudget: 0,
    textureStatus: 'idle',
  };
  constructor(options: WeatherOptions) {
    this.config = resolveConfig(options);
    this.pluginConfig = freezeConfig(cloneConfig(this.config));
    this.particles = new ParticleSystem(this.config.seed);
    this.quality =
      this.config.performance.preferredQuality === 'low'
        ? 0.35
        : this.config.performance.preferredQuality === 'medium'
          ? 0.65
          : 1;
    if (this.config.autoStart && typeof document !== 'undefined') this.start();
  }
  private assertAlive(): void {
    if (this.state === 'destroyed') throw new Error('This Fluri instance has been destroyed');
  }
  private context(): PluginContext {
    return {
      trigger: (type, options) => this.trigger(type, options),
      getConfig: () => this.pluginConfig,
      getSurfaces: () => this.registry?.surfaces ?? [],
      emit: (e, d) => this.emit(e, d),
      spawnClump: (...args) => this.particles.spawnClump(...args),
    };
  }
  private emit(event: WeatherEventName, data?: unknown): void {
    for (const callback of this.listeners.get(event) ?? []) {
      try {
        callback(data);
      } catch (error) {
        if (event !== 'error') this.emit('error', { source: 'event', event, error });
      }
    }
  }
  on(event: WeatherEventName, callback: (data: unknown) => void): () => void {
    this.assertAlive();
    if (typeof callback !== 'function') throw new TypeError('Event callback must be a function');
    const set = this.listeners.get(event) ?? new Set();
    set.add(callback);
    this.listeners.set(event, set);
    return () => set.delete(callback);
  }
  start(): void {
    this.assertAlive();
    if (this.state === 'running') return;
    if (!this.renderer) this.initialize();
    this.state = 'running';
    this.lastFrame = 0;
    this.accumulator = 0;
    this.syncControls();
    this.emit('start');
    this.schedule();
  }
  private initialize(): void {
    if (typeof document === 'undefined')
      throw new Error('Call Fluri.start() in a browser after the document is ready');
    const doc = this.config.container?.ownerDocument ?? document;
    const win = doc.defaultView;
    if (!win || !doc.body) throw new Error('Fluri needs an attached browser document with a body');
    const root = this.config.container ?? doc.body;
    if (!root.isConnected) throw new Error('Fluri container must be connected');
    this.root = root;
    this.renderer = new CanvasRenderer(
      doc,
      (error) => this.emit('error', { source: 'texture', error }),
      () => this.refreshStaticGeometry(),
      root,
    );
    this.renderer.resize(this.config.performance.maxDPR);
    this.registry = new SurfaceRegistry(
      root,
      () => this.config,
      (event, data) => this.emit(event, data),
      (surface, reason) => this.shed(surface, reason),
      () => this.refreshStaticGeometry(),
    );
    for (const [element, options] of this.registrations) this.registry.register(element, options);
    try {
      this.registry.start();
    } catch (error) {
      this.renderer.destroy();
      this.renderer = undefined;
      this.registry.destroy();
      this.registry = undefined;
      throw error;
    }
    this.actors = new Actors(this.context());
    this.media = win.matchMedia('(prefers-reduced-motion: reduce)');
    this.coarse = win.matchMedia('(pointer: coarse)').matches;
    const visibility = () => {
      this.gatheringPointer = undefined;
      this.pointer = undefined;
      this.actors?.pointer({
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        pressed: false,
        shiftKey: false,
        kind: 'cancel',
        time: this.time,
      });
      this.cancel();
      this.lastFrame = 0;
      this.accumulator = 0;
      if (!this.suspended()) this.schedule();
      this.syncControls();
    };
    this.listen(doc, 'visibilitychange', visibility);
    this.media.addEventListener('change', visibility);
    this.cleanups.push(() => this.media?.removeEventListener('change', visibility));
    this.listen(win, 'resize', () => {
      this.renderer?.resize(
        this.config.performance.adaptive && this.quality < 0.65
          ? Math.min(1.25, this.config.performance.maxDPR)
          : this.config.performance.maxDPR,
      );
      this.registry?.invalidate();
      this.refreshStaticGeometry();
    });
    this.listen(doc, 'scroll', () => this.registry?.invalidateGeometry(), {
      capture: true,
      passive: true,
    });
    if (win.visualViewport) {
      this.listen(win.visualViewport, 'resize', () => {
        this.renderer?.resize(
          this.config.performance.adaptive && this.quality < 0.65
            ? Math.min(1.25, this.config.performance.maxDPR)
            : this.config.performance.maxDPR,
        );
        this.registry?.invalidate();
      });
      this.listen(win.visualViewport, 'scroll', () => this.registry?.invalidate(), {
        passive: true,
      });
    }
    const handle = (event: Event) => {
      if (event instanceof win.PointerEvent) this.handlePointer(event);
    };
    for (const name of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'])
      this.listen(doc, name, handle, { passive: false });
    const preventGatherSelection = (event: Event) => {
      if (this.gatheringPointer !== undefined && this.actors?.gathering) event.preventDefault();
    };
    this.listen(doc, 'selectstart', preventGatherSelection, { capture: true });
    this.listen(doc, 'dragstart', preventGatherSelection, { capture: true });
    this.listen(win, 'blur', () => this.cancelGathering());
    this.listen(doc, 'keyup', (event) => {
      if (event instanceof win.KeyboardEvent && event.key === 'Shift') this.cancelGathering();
    });
    for (const plugin of this.plugins.keys()) this.setupPlugin(plugin);
    this.syncControls();
    this.emit('ready');
  }
  private listen(
    target: EventTarget,
    name: string,
    callback: EventListener,
    options?: AddEventListenerOptions,
  ): void {
    target.addEventListener(name, callback, options);
    this.cleanups.push(() => target.removeEventListener(name, callback, options));
  }
  private refreshStaticGeometry(): void {
    this.geometryDirty = true;
    const win = this.root?.ownerDocument.defaultView;
    if (
      !win ||
      this.geometryRAF ||
      !(this.state === 'paused' || (this.state === 'running' && this.suspended()))
    )
      return;
    this.geometryRAF = win.requestAnimationFrame(() => {
      this.geometryRAF = 0;
      if (this.state === 'paused' || (this.state === 'running' && this.suspended())) {
        this.registry?.update(win.performance.now() / 1000, false);
        this.render();
        this.geometryDirty = false;
      }
    });
  }
  private suspended(): boolean {
    return (
      this.root?.ownerDocument.hidden === true ||
      (this.media?.matches === true && this.config.accessibility.reducedMotion === 'respect')
    );
  }
  private schedule(): void {
    if (this.state !== 'running' || this.raf || this.suspended()) return;
    const win = this.root?.ownerDocument.defaultView;
    if (win) this.raf = win.requestAnimationFrame((timestamp) => this.frame(timestamp));
  }
  private cancel(): void {
    const win = this.root?.ownerDocument.defaultView;
    if (this.raf) win?.cancelAnimationFrame(this.raf);
    this.raf = 0;
  }
  private frame(timestamp: number): void {
    this.raf = 0;
    if (this.state !== 'running' || this.suspended()) return;
    const interval = 1000 / this.config.performance.maxFPS;
    const elapsed = this.lastFrame ? timestamp - this.lastFrame : interval;
    if (elapsed < interval - 0.8) {
      // A simulation FPS cap must not leave deposits behind a scrolling or moving interface.
      // Geometry is cheap and invalidated independently; physics still keeps its configured rate.
      if (this.geometryDirty) {
        this.registry?.update(timestamp / 1000);
        this.render();
        this.geometryDirty = false;
      }
      this.schedule();
      return;
    }
    this.lastFrame = timestamp;
    const begin = performance.now();
    const dt = Math.min(0.1, elapsed / 1000);
    this.accumulator += dt;
    this.renderer?.resize(
      this.config.performance.adaptive && this.quality < 0.65
        ? Math.min(1.25, this.config.performance.maxDPR)
        : this.config.performance.maxDPR,
    );
    this.registry?.update(timestamp / 1000);
    this.geometryDirty = false;
    const surfaces = this.registry?.surfaces ?? [];
    const reduced = this.media?.matches && this.config.accessibility.reducedMotion === 'reduce';
    let quality = reduced ? Math.min(0.15, this.quality) : this.quality;
    const doc = this.root?.ownerDocument,
      container = this.config.container;
    const rootRect =
      container && container !== doc?.body && container !== doc?.documentElement
        ? container.getBoundingClientRect()
        : undefined;
    const left = Math.max(0, rootRect?.left ?? 0),
      top = Math.max(0, rootRect?.top ?? 0);
    const emission = rootRect
      ? {
          x: left,
          y: top,
          width: Math.max(0, Math.min(this.renderer?.width ?? 0, rootRect.right) - left),
          height: Math.max(0, Math.min(this.renderer?.height ?? 0, rootRect.bottom) - top),
        }
      : undefined;
    this.effectiveBudget = particleBudget(
      this.config.snow.particleCount,
      (emission?.width ?? this.renderer?.width ?? 0) *
        (emission?.height ?? this.renderer?.height ?? 0),
      this.coarse,
      this.config.performance.adaptive,
    );
    quality *= this.effectiveBudget / Math.max(1, this.config.snow.particleCount);
    const simBegin = performance.now();
    let collisionChecks = 0,
      deposits = 0,
      transfers = 0,
      slides = 0,
      slideMass = 0,
      steps = 0;
    while (this.accumulator >= 1 / 60 && steps < 5) {
      const m = this.particles.step(
        1 / 60,
        this.time,
        this.renderer?.width ?? 1,
        this.renderer?.height ?? 1,
        this.config,
        surfaces,
        quality,
        emission,
      );
      collisionChecks += m.collisionChecks;
      deposits += m.deposits;
      transfers += m.transfers;
      slides += m.slides;
      slideMass += m.slideMass;
      this.actors?.update(1 / 60, this.time);
      for (const plugin of this.plugins.keys()) {
        try {
          plugin.update?.(1 / 60, this.time);
        } catch (error) {
          this.failPlugin(plugin, error);
        }
      }
      this.time += 1 / 60;
      this.accumulator -= 1 / 60;
      steps++;
    }
    if (this.accumulator >= 1 / 60) {
      this.metrics.droppedFrames++;
      this.accumulator = 0;
    }
    this.metrics.simTime = performance.now() - simBegin;
    this.pendingSnow.deposits += deposits;
    this.pendingSnow.transfers += transfers;
    this.pendingSnow.slides += slides;
    this.pendingSnow.slideMass += slideMass;
    this.eventClock += dt;
    if (this.eventClock >= 0.1) {
      this.eventClock %= 0.1;
      if (this.pendingSnow.deposits)
        this.emit('snow:deposit', { count: this.pendingSnow.deposits });
      if (this.pendingSnow.transfers)
        this.emit('snow:transfer', { count: this.pendingSnow.transfers });
      if (this.pendingSnow.slides)
        this.emit('snow:slide', {
          count: this.pendingSnow.slides,
          mass: this.pendingSnow.slideMass,
          reason: 'motion',
        });
      this.pendingSnow = { deposits: 0, transfers: 0, slides: 0, slideMass: 0 };
    }
    this.render();
    const work = performance.now() - begin;
    if (this.config.performance.adaptive) {
      const previous = this.quality;
      const cap =
        this.config.performance.preferredQuality === 'low'
          ? 0.35
          : this.config.performance.preferredQuality === 'medium'
            ? 0.65
            : 1;
      this.quality = Math.min(cap, this.frameBudget.observe(work, elapsed, interval, this.quality));
      if (previous !== this.quality)
        this.emit('quality:changed', {
          quality: this.quality,
          particleBudget: this.effectiveBudget,
        });
    }
    this.metrics.fps = this.metrics.fps
      ? this.metrics.fps * 0.9 + (1000 / Math.max(1, elapsed)) * 0.1
      : 1000 / elapsed;
    this.metrics.frameTime = elapsed;
    this.metrics.geometryScanTime = this.registry?.geometryScanTime ?? 0;
    this.metrics.collisionChecks = collisionChecks;
    this.schedule();
  }
  private render(): void {
    if (!this.renderer) return;
    if (this.state === 'stopped') {
      this.renderer.clear();
      return;
    }
    const begin = performance.now();
    this.renderer.render(
      this.particles.particles,
      this.registry?.surfaces ?? [],
      this.config,
      this.time,
      [...this.plugins.keys()].map((plugin) => ({
        name: plugin.name,
        render: (ctx: CanvasRenderingContext2D, time: number) => {
          try {
            plugin.render?.(ctx, time);
          } catch (error) {
            this.failPlugin(plugin, error);
          }
        },
      })),
      (ctx, time) => this.actors?.render(ctx, time),
    );
    this.metrics.renderTime = performance.now() - begin;
  }
  pause(): void {
    this.assertAlive();
    if (this.state !== 'running') return;
    this.state = 'paused';
    this.cancel();
    this.gatheringPointer = undefined;
    this.pointer = undefined;
    this.actors?.pointer({
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      pressed: false,
      shiftKey: false,
      kind: 'cancel',
      time: this.time,
    });
    this.syncControls();
    this.emit('pause');
  }
  resume(): void {
    this.assertAlive();
    if (this.state === 'running') return;
    if (!this.renderer) {
      this.start();
      return;
    }
    this.state = 'running';
    this.lastFrame = 0;
    this.accumulator = 0;
    this.syncControls();
    this.emit('resume');
    this.schedule();
  }
  stop(): void {
    this.assertAlive();
    this.state = 'stopped';
    this.cancel();
    this.gatheringPointer = undefined;
    this.particles.clear();
    this.actors?.clear();
    for (const surface of this.registry?.surfaces ?? []) surface.profile.fill(0);
    this.renderer?.clear();
    this.syncControls();
    this.emit('stop');
  }
  destroy(): void {
    if (this.state === 'destroyed') return;
    this.cancel();
    this.gatheringPointer = undefined;
    if (this.geometryRAF)
      this.root?.ownerDocument.defaultView?.cancelAnimationFrame(this.geometryRAF);
    this.geometryRAF = 0;
    for (const cleanup of this.cleanups.splice(0)) cleanup();
    for (const [plugin, cleanup] of this.plugins) {
      this.safeCleanup(cleanup, plugin.name);
      this.safeCleanup(() => plugin.destroy?.(), plugin.name);
    }
    this.plugins.clear();
    this.registry?.destroy();
    this.renderer?.destroy();
    this.actors?.destroy();
    this.particles.clear();
    this.toggle?.remove();
    this.registrations.clear();
    this.state = 'destroyed';
    this.emit('destroy');
    this.listeners.clear();
    this.root = undefined;
    this.renderer = undefined;
    this.registry = undefined;
    this.actors = undefined;
    this.media = undefined;
  }
  updateConfig(patch: WeatherOptions): void {
    this.assertAlive();
    const next = patchConfig(this.config, patch);
    if (this.renderer && next.container !== this.config.container)
      throw new Error('Create a new Fluri instance to change its container');
    const doc = this.root?.ownerDocument;
    if (doc)
      for (const selector of [...next.dom.include, ...next.dom.exclude])
        doc.querySelector(selector);
    const needsObserver = next.dom.observeMutations !== this.config.dom.observeMutations;
    const seedChanged = next.seed !== this.config.seed;
    this.config = next;
    if (!next.interactions.snowballs.enabled) this.cancelGathering();
    this.pluginConfig = freezeConfig(cloneConfig(next));
    if (!next.interactions.yeti.enabled) this.actors?.yeti.clear(true);
    if (seedChanged) {
      this.particles = new ParticleSystem(next.seed);
    }
    this.particles.setIntensity(next.snow.intensity);
    const preferred = next.performance.preferredQuality;
    this.quality = preferred === 'low' ? 0.35 : preferred === 'medium' ? 0.65 : 1;
    this.registry?.invalidate();
    if (needsObserver) this.registry?.refreshObservers();
    this.renderer?.resize(next.performance.maxDPR);
    this.syncControls();
    this.cancel();
    this.lastFrame = 0;
    this.render();
    this.schedule();
  }
  getConfig(): WeatherConfig {
    return cloneConfig(this.config);
  }
  setPreset(name: PresetName, overrides: WeatherOptions = {}): void {
    const container = this.config.container;
    const next = resolveConfig({ ...overrides, preset: name, ...(container ? { container } : {}) });
    this.updateConfig(next);
  }
  setIntensity(amount: number): void {
    this.updateConfig({ snow: { intensity: amount } });
  }
  private selected(selector?: string): Surface[] {
    if (selector !== undefined && this.root) this.root.ownerDocument.querySelector(selector);
    return (this.registry?.surfaces ?? []).filter((s) => !selector || s.element.matches(selector));
  }
  clearAccumulation(selector?: string): void {
    this.assertAlive();
    for (const s of this.selected(selector)) s.profile.fill(0);
    this.render();
  }
  addSnow(amount: number, selector?: string): void {
    this.assertAlive();
    if (!Number.isFinite(amount) || amount < 0 || amount > 80)
      throw new RangeError('addSnow depth must be between 0 and 80 CSS pixels');
    for (const s of this.selected(selector)) {
      if (!s.accumulation || s.material === 'no-accumulation') continue;
      seedDeposits(
        s,
        amount,
        Math.min(s.maxDepth, this.config.snow.accumulation.maxDepth),
        (this.config.seed + Math.imul(++this.depositSeed, 0x9e3779b9)) >>> 0,
      );
    }
    this.render();
  }
  registerSurface(element: Element, options: SurfaceOptions = {}): () => void {
    this.assertAlive();
    if (
      !element ||
      element.nodeType !== 1 ||
      typeof element.getBoundingClientRect !== 'function' ||
      !element.ownerDocument
    )
      throw new TypeError('registerSurface expects an Element');
    const doc = this.root?.ownerDocument ?? this.config.container?.ownerDocument;
    if (doc && element.ownerDocument !== doc)
      throw new TypeError('A surface must belong to the Fluri instance document');
    options = surfaceOptionsSchema.parse(options);
    this.registrations.set(element, { ...options });
    this.registry?.register(element, options);
    return () => this.unregisterSurface(element);
  }
  unregisterSurface(element: Element): void {
    this.assertAlive();
    this.registrations.delete(element);
    this.registry?.unregister(element);
  }
  trigger(type: TriggerType, options: TriggerOptions = {}): void {
    this.assertAlive();
    if (!['plough', 'gust', 'snowburst', 'sparkle', 'snowman', 'snowball', 'yeti'].includes(type))
      throw new TypeError('Unknown Fluri trigger');
    if (!options || typeof options !== 'object')
      throw new TypeError('Trigger options must be an object');
    for (const key of Object.keys(options))
      if (!['selector', 'surface', 'direction', 'x', 'y', 'radius', 'speed', 'style'].includes(key))
        throw new TypeError(`Unknown trigger option: ${key}`);
    if (options.style !== undefined && !['classic', 'minimal', 'festive'].includes(options.style))
      throw new TypeError('Unknown plough style');
    if (options.direction !== undefined && !['left', 'right'].includes(options.direction))
      throw new TypeError('Unknown trigger direction');
    if (
      options.speed !== undefined &&
      (!Number.isFinite(options.speed) || options.speed < 10 || options.speed > 600)
    )
      throw new RangeError('Plough speed must be between 10 and 600');
    if (options.radius !== undefined && (options.radius < 1 || options.radius > 100))
      throw new RangeError('Snowball radius must be between 1 and 100');
    if (options.surface !== undefined && options.surface.nodeType !== 1)
      throw new TypeError('Trigger surface must be an Element');
    if (options.selector) {
      if (typeof options.selector !== 'string' || options.selector.length > 512)
        throw new TypeError('Invalid trigger selector');
      this.root?.ownerDocument.querySelector(options.selector);
    }
    for (const value of [options.x, options.y, options.radius])
      if (value !== undefined && !Number.isFinite(value))
        throw new TypeError('Trigger coordinates must be finite');
    const x = options.x ?? (this.renderer?.width ?? 0) / 2,
      y = options.y ?? (this.renderer?.height ?? 0) / 3;
    if (type === 'gust') this.particles.gust();
    else if (type === 'snowburst' || type === 'sparkle')
      this.particles.burst(x, y, 70, type === 'sparkle' ? 'sparkle' : 'flake');
    else this.actors?.trigger(type, options);
    if (type === 'snowburst') this.actors?.trigger(type, options);
    for (const plugin of this.plugins.keys()) {
      try {
        plugin.trigger?.(type, options);
      } catch (error) {
        this.failPlugin(plugin, error);
      }
    }
    this.render();
  }
  getMetrics(): WeatherMetrics {
    const surfaces = this.registry?.surfaces ?? [];
    return {
      ...this.metrics,
      particleBudget: Math.floor(this.effectiveBudget * this.quality),
      textureStatus:
        this.renderer?.textureStatus ?? (this.state === 'destroyed' ? 'destroyed' : 'idle'),
      state: this.state === 'running' && this.suspended() ? 'paused' : this.state,
      particleCount: this.particles.particles.length,
      surfaceCount: surfaces.length,
      quality: this.quality,
      snowMass: surfaces.reduce((sum, s) => sum + totalMass(s.profile), 0),
      snowballCount: this.actors?.counts.snowballs ?? 0,
      snowmanCount: this.actors?.counts.snowmen ?? 0,
      yetiPhase: this.actors?.yeti.phase ?? 'hidden',
      approximateMemory:
        this.particles.particles.length * 128 +
        surfaces.reduce((n, s) => n + s.profile.byteLength + 256, 0),
    };
  }
  use(plugin: WeatherPlugin): () => void {
    this.assertAlive();
    if (!plugin || typeof plugin.name !== 'string' || !plugin.name)
      throw new TypeError('A plugin needs a name');
    if ([...this.plugins.keys()].some((p) => p.name === plugin.name))
      throw new Error(`Plugin already registered: ${plugin.name}`);
    this.plugins.set(plugin, undefined);
    if (this.renderer) this.setupPlugin(plugin);
    return () => {
      if (this.plugins.has(plugin)) {
        const cleanup = this.plugins.get(plugin);
        this.plugins.delete(plugin);
        this.safeCleanup(cleanup, plugin.name);
        this.safeCleanup(() => plugin.destroy?.(), plugin.name);
        this.render();
      }
    };
  }
  private setupPlugin(plugin: WeatherPlugin): void {
    try {
      this.plugins.set(plugin, plugin.setup?.(this.context()) ?? undefined);
    } catch (error) {
      this.failPlugin(plugin, error);
    }
  }
  private safeCleanup(cleanup: (() => void) | undefined, name: string): void {
    try {
      cleanup?.();
    } catch (error) {
      this.emit('error', { source: 'cleanup', name, error });
    }
  }
  private failPlugin(plugin: WeatherPlugin, error: unknown): void {
    const cleanup = this.plugins.get(plugin);
    this.plugins.delete(plugin);
    this.safeCleanup(cleanup, plugin.name);
    this.safeCleanup(() => plugin.destroy?.(), plugin.name);
    this.emit('error', { source: 'plugin', name: plugin.name, error });
  }
  private shed(surface: Surface, reason: 'removed' | 'resize' = 'removed'): void {
    const mass = totalMass(surface.profile);
    if (mass > 0) this.emit('snow:slide', { surfaceId: surface.id, mass, reason });
    for (let i = 0; i < surface.profile.length; i += 4) {
      let mass = 0;
      for (let j = i; j < Math.min(i + 4, surface.profile.length); j++) {
        mass += surface.profile[j] ?? 0;
        surface.profile[j] = 0;
      }
      if (mass > 0) {
        const pos = localToWorld(
          surface,
          (i + Math.min(4, surface.profile.length - i) / 2) * surface.binSize,
          -3,
        );
        this.particles.spawnClump(pos.x, pos.y, mass, surface.velocity.x, surface.velocity.y + 12);
      }
    }
  }
  private handlePointer(event: PointerEvent): void {
    if (this.state !== 'running' || this.suspended() || !this.root) return;
    if (this.gatheringPointer !== undefined && event.pointerId !== this.gatheringPointer) return;
    if (event.type === 'pointerdown' && event.button !== 0) return;
    if (event.type === 'pointerup' || event.type === 'pointercancel') {
      const previous = this.pointer;
      const dt = Math.max(
        1 / 240,
        Math.min(0.1, event.timeStamp / 1000 - (previous?.time ?? event.timeStamp / 1000)),
      );
      this.actors?.pointer({
        x: event.clientX,
        y: event.clientY,
        vx: previous ? (event.clientX - previous.x) / dt : 0,
        vy: previous ? (event.clientY - previous.y) / dt : 0,
        pressed: false,
        shiftKey: event.shiftKey,
        kind: event.type === 'pointerup' ? 'up' : 'cancel',
        time: this.time,
      });
      this.pointer = undefined;
      this.gatheringPointer = undefined;
      return;
    }
    const rect = this.root.getBoundingClientRect();
    const scoped = this.root !== this.root.ownerDocument.body;
    if (
      scoped &&
      (event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom)
    ) {
      this.cancelGathering();
      return;
    }
    if (
      event.target instanceof Element &&
      event.target.closest(
        '[data-fluri-root], [data-weather-ignore], input, textarea, select, button, a[href], [contenteditable]:not([contenteditable="false"]), [role="button"], [role="link"]',
      )
    ) {
      this.cancelGathering();
      return;
    }
    const now = event.timeStamp / 1000;
    const previous = this.pointer;
    const dt = Math.max(1 / 240, Math.min(0.1, now - (previous?.time ?? now - 1 / 60)));
    const vx = previous ? (event.clientX - previous.x) / dt : 0,
      vy = previous ? (event.clientY - previous.y) / dt : 0;
    const kind =
      event.type === 'pointerdown'
        ? 'down'
        : event.type === 'pointerup'
          ? 'up'
          : event.type === 'pointercancel'
            ? 'cancel'
            : 'move';
    this.actors?.pointer({
      x: event.clientX,
      y: event.clientY,
      vx,
      vy,
      pressed: event.buttons !== 0,
      shiftKey: event.shiftKey,
      kind,
      time: this.time,
    });
    if (this.actors?.gathering && event.shiftKey && event.buttons === 1) {
      this.gatheringPointer = event.pointerId;
      // Only an accepted snow gesture owns selection; ordinary page input remains native.
      if (event.cancelable) event.preventDefault();
    } else this.gatheringPointer = undefined;
    if (kind === 'cancel' || kind === 'up') {
      this.pointer = undefined;
      return;
    }
    const brush = this.config.interactions.brush;
    const intentional =
      event.pointerType === 'mouse'
        ? brush.activation === 'hover' || event.buttons === 1
        : event.buttons === 1 &&
          event.target instanceof Element &&
          !!event.target.closest('[data-weather-interactive="brush"]');
    if (
      kind === 'move' &&
      brush.enabled &&
      intentional &&
      !event.shiftKey &&
      Math.hypot(vx, vy) > 20
    ) {
      let brushed = 0;
      const start = { x: previous?.x ?? event.clientX, y: previous?.y ?? event.clientY };
      const end = { x: event.clientX, y: event.clientY };
      const dx = end.x - start.x,
        dy = end.y - start.y,
        lengthSquared = dx * dx + dy * dy;
      const nearest = (point: { x: number; y: number }) => {
        const t =
          lengthSquared > 0
            ? Math.max(
                0,
                Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared),
              )
            : 1;
        return { x: start.x + t * dx, y: start.y + t * dy };
      };
      // Cursor airflow affects nearby falling flakes without capturing a click or storing history.
      for (const flake of this.particles.particles) {
        if (flake.kind !== 'flake') continue;
        const point = nearest(flake),
          fx = flake.x - point.x,
          fy = flake.y - point.y,
          distance = Math.hypot(fx, fy);
        const radius = brush.radius * 1.5;
        if (distance > 1 && distance < radius) {
          const impulse =
            (1 - distance / radius) * Math.min(100, Math.sqrt(lengthSquared) * 3) * brush.strength;
          flake.vx = Math.max(
            -500,
            Math.min(500, flake.vx + (fx / distance) * impulse + vx * 0.025),
          );
          flake.vy = Math.max(
            -200,
            Math.min(400, flake.vy + (fy / distance) * impulse + vy * 0.012),
          );
        }
      }
      const random = seededRandom((Math.floor(now * 1000000) ^ this.config.seed) >>> 0);
      for (const s of this.registry?.surfaces ?? []) {
        if (!s.visible || s.occluded) continue;
        for (let bin = 0; bin < s.profile.length; bin++) {
          const before = s.profile[bin] ?? 0;
          if (before <= 0.01 || s.exposed?.[bin] === 0) continue;
          const x = (bin + 0.5) * s.binSize,
            depth = depthAt(s, x);
          const center = localToWorld(s, x, -depth * 0.5),
            point = nearest(center);
          const distance = Math.hypot(center.x - point.x, center.y - point.y);
          if (distance >= brush.radius) continue;
          const strength =
            distance < brush.radius * 0.6
              ? Math.min(1, brush.strength * 1.5)
              : Math.min(1, (1 - distance / brush.radius) * brush.strength * 2);
          s.profile[bin] = before * (1 - strength);
          const mass = before - (s.profile[bin] ?? 0);
          if (mass <= 0) continue;
          brushed += mass;
          const count = Math.min(12, Math.max(1, Math.ceil(mass / 10)));
          for (let i = 0; i < count; i++) {
            const pos = localToWorld(s, x + (random() - 0.5) * s.binSize, -depth * 0.5);
            this.particles.spawnClump(
              pos.x,
              pos.y,
              mass / count,
              Math.max(-450, Math.min(450, vx * 0.3)) + (random() - 0.5) * 65,
              Math.max(35, depth / 0.32, vy * 0.25 + 25) + random() * 30,
              s,
            );
          }
        }
      }
      if (brushed && now - this.lastBrush > 0.08) {
        this.emit('snow:brush', { mass: brushed });
        this.lastBrush = now;
      }
    }
    if (this.config.interactions.pointerVortex.enabled && event.shiftKey)
      for (const p of this.particles.particles) {
        const dx = p.x - event.clientX,
          dy = p.y - event.clientY,
          d = Math.hypot(dx, dy);
        if (d > 4 && d < 120) {
          p.vx += (-dy / d) * Math.min(10, Math.hypot(vx, vy) * 0.01);
          p.vy += (dx / d) * Math.min(10, Math.hypot(vx, vy) * 0.01);
        }
      }
    this.pointer = { x: event.clientX, y: event.clientY, time: now };
  }
  private cancelGathering(): void {
    this.actors?.pointer({
      x: this.pointer?.x ?? 0,
      y: this.pointer?.y ?? 0,
      vx: 0,
      vy: 0,
      pressed: false,
      shiftKey: false,
      kind: 'cancel',
      time: this.time,
    });
    this.pointer = undefined;
    this.gatheringPointer = undefined;
  }
  private syncControls(): void {
    const doc = this.root?.ownerDocument;
    if (!this.config.accessibility.controls || !doc) {
      this.toggle?.remove();
      this.toggle = undefined;
      return;
    }
    if (!this.toggle) {
      const button = doc.createElement('button');
      button.type = 'button';
      button.dataset.fluriRoot = 'control';
      Object.assign(button.style, {
        position: 'fixed',
        right: '16px',
        bottom: '16px',
        zIndex: '2147483001',
        border: '1px solid #758396',
        borderRadius: '999px',
        padding: '10px 16px',
        background: '#111b2d',
        color: '#f3f7ff',
        font: '500 14px system-ui',
        cursor: 'pointer',
      });
      button.addEventListener('click', () => {
        if (this.state === 'running') this.pause();
        else this.resume();
      });
      doc.body.append(button);
      this.toggle = button;
    }
    this.toggle.textContent = this.state === 'running' ? 'Pause snow' : 'Resume snow';
    this.toggle.setAttribute('aria-pressed', String(this.state === 'running'));
  }
}
