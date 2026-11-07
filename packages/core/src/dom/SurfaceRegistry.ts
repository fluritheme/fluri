import { createPackingProfile } from '../physics/packing.js';
import type {
  ClipRect,
  Layer,
  Material,
  Surface,
  SurfaceOptions,
  WeatherConfig,
  WeatherEventName,
} from '../types.js';
interface Quad {
  p1: { x: number; y: number };
  p2: { x: number; y: number };
  p3: { x: number; y: number };
  p4: { x: number; y: number };
}
type QuadElement = Element & { getBoxQuads?: () => Quad[] };
const eligibleTags = new Set([
  'NAV',
  'HEADER',
  'BUTTON',
  'ARTICLE',
  'ASIDE',
  'FIGURE',
  'IMG',
  'DIALOG',
  'SECTION',
]);
export class SurfaceRegistry {
  readonly surfaces: Surface[] = [];
  private registered = new Map<Element, SurfaceOptions>();
  private excluded = new WeakSet<Element>();
  private dirty = true;
  private observer: MutationObserver | undefined;
  private resizeObserver: ResizeObserver | undefined;
  private nextId = 0;
  private transforms = new WeakMap<Element, string>();
  private scrollOffsets = new WeakMap<Element, { x: number; y: number }>();
  private positionModes = new WeakMap<Element, string>();
  private scrollChains = new WeakMap<Element, { parents: Element[]; window: boolean }>();
  private lastTime = 0;
  private lastSurfaceEvents = new WeakMap<Element, number>();
  private lastScan = -Infinity;
  private occlusionCursor = 0;
  private lastOcclusion = -Infinity;
  private clipsDirty = true;
  geometryScanTime = 0;
  constructor(
    private root: HTMLElement,
    private config: () => WeatherConfig,
    private emit: (name: WeatherEventName, data: unknown) => void,
    private shed: (surface: Surface, reason?: 'removed' | 'resize') => void,
    private onInvalidate?: () => void,
  ) {}
  start(): void {
    const win = this.root.ownerDocument.defaultView;
    if (!win) return;
    this.resizeObserver = new win.ResizeObserver(() => {
      this.clipsDirty = true;
      this.dirty = true;
    });
    this.resizeObserver.observe(this.root);
    this.refreshObservers();
    this.scan();
  }
  refreshObservers(): void {
    this.observer?.disconnect();
    this.observer = undefined;
    const win = this.root.ownerDocument.defaultView;
    if (!win) return;
    if (this.config().dom.observeMutations) {
      this.observer = new win.MutationObserver((records) => {
        if (
          records.some(
            (r) => !(r.target instanceof win.Element && r.target.closest('[data-fluri-root]')),
          )
        )
          this.invalidate();
      });
      this.observer.observe(this.root, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: [
          'style',
          'class',
          'hidden',
          'open',
          'data-weather-surface',
          'data-weather-ignore',
          'data-weather-layer',
          'data-weather-material',
          'data-weather-snow-depth',
          'data-weather-accumulation',
          'data-weather-priority',
          'data-weather-edge',
          'data-weather-clip',
        ],
      });
    }
  }
  invalidate(): void {
    this.dirty = true;
    this.clipsDirty = true;
    this.onInvalidate?.();
  }
  invalidateGeometry(): void {
    this.clipsDirty = true;
    this.onInvalidate?.();
  }
  register(element: Element, options: SurfaceOptions = {}): () => void {
    this.registered.set(element, { ...options });
    this.excluded.delete(element);
    this.invalidate();
    return () => this.unregister(element);
  }
  unregister(element: Element): void {
    this.registered.delete(element);
    this.excluded.add(element);
    this.invalidate();
  }
  update(time: number, physicalMotion = true): void {
    const begin = performance.now();
    if (this.dirty && time - this.lastScan > 0.1) {
      this.scan();
      this.lastScan = time;
    }
    const dt = this.lastTime ? Math.max(1 / 240, Math.min(0.1, time - this.lastTime)) : 1 / 60;
    for (const surface of this.surfaces) {
      const oldX = surface.x,
        oldY = surface.y,
        oldWidth = surface.width,
        oldVx = surface.velocity.x,
        oldVy = surface.velocity.y;
      const scroll = this.scrollPosition(surface.element),
        previousScroll = this.scrollOffsets.get(surface.element) ?? scroll;
      this.measure(surface, this.clipsDirty);
      const mode = this.positionModes.get(surface.element);
      let dx = surface.x - oldX,
        dy = surface.y - oldY;
      if (mode !== 'fixed') {
        const sx = scroll.x - previousScroll.x,
          sy = scroll.y - previousScroll.y;
        // Sticky elements can consume only part of a scroll while transitioning to their constraint.
        const compensate = (delta: number, scrollDelta: number) =>
          delta * scrollDelta < 0
            ? delta + Math.sign(scrollDelta) * Math.min(Math.abs(delta), Math.abs(scrollDelta))
            : delta;
        dx = mode === 'sticky' ? compensate(dx, sx) : dx + sx;
        dy = mode === 'sticky' ? compensate(dy, sy) : dy + sy;
      }
      this.scrollOffsets.set(surface.element, scroll);
      surface.previousVelocity = { x: oldVx, y: oldVy };
      surface.velocity = { x: dx / dt, y: dy / dt };
      surface.acceleration = {
        x: (surface.velocity.x - oldVx) / dt,
        y: (surface.velocity.y - oldVy) / dt,
      };
      if (!physicalMotion) {
        surface.previousVelocity = { x: 0, y: 0 };
        surface.velocity = { x: 0, y: 0 };
        surface.acceleration = { x: 0, y: 0 };
      }
      if (Math.abs(oldWidth - surface.width) > 1) this.resizeProfile(surface, oldWidth);
      if (
        Math.abs(oldX - surface.x) + Math.abs(oldY - surface.y) > 2 &&
        time - (this.lastSurfaceEvents.get(surface.element) ?? -Infinity) > 0.1
      ) {
        this.lastSurfaceEvents.set(surface.element, time);
        this.emit('surface:updated', { id: surface.id });
      }
    }
    if (this.config().dom.respectLayers && (this.clipsDirty || time - this.lastOcclusion > 0.12)) {
      this.updateOcclusion();
      this.lastOcclusion = time;
    } else if (!this.config().dom.respectLayers) {
      for (const s of this.surfaces) {
        delete s.exposed;
        s.occluded = false;
      }
    }
    this.lastTime = time;
    this.clipsDirty = false;
    this.geometryScanTime = performance.now() - begin;
  }
  private resizeProfile(s: Surface, oldWidth: number): void {
    const count = Math.max(2, Math.ceil(s.width / 6)),
      bins = new Float32Array(count);
    const oldBin = oldWidth / s.profile.length,
      newBin = s.width / count;
    let detached = 0;
    // Snow occupies physical local coordinates; a new extension starts bare, unsupported snow falls.
    for (let i = 0; i < s.profile.length; i++) {
      const mass = s.profile[i] ?? 0,
        start = i * oldBin,
        end = (i + 1) * oldBin;
      const retained = Math.max(0, Math.min(end, s.width) - start);
      detached += mass * (1 - retained / oldBin);
      for (
        let j = Math.max(0, Math.floor(start / newBin));
        j < Math.min(count, Math.ceil(end / newBin));
        j++
      ) {
        const overlap = Math.max(
          0,
          Math.min(end, (j + 1) * newBin, s.width) - Math.max(start, j * newBin),
        );
        bins[j] = (bins[j] ?? 0) + (mass * overlap) / oldBin;
      }
    }
    s.profile = bins;
    s.binSize = newBin;
    s.packing = this.packing(s);
    delete s.exposed;
    if (detached > 0.01) {
      const extension = Math.max(1, oldWidth - s.width);
      const fragment: Surface = {
        ...s,
        x: s.x + Math.cos(s.angle) * s.width,
        y: s.y + Math.sin(s.angle) * s.width,
        width: extension,
        profile: new Float32Array([detached]),
        binSize: extension,
      };
      this.shed(fragment, 'resize');
    }
  }
  private scan(): void {
    const config = this.config();
    const doc = this.root.ownerDocument;
    const win = doc.defaultView;
    if (!win) return;
    // Selector errors are surfaced before mutating the active registry.
    for (const sel of [...config.dom.include, ...config.dom.exclude]) doc.querySelector(sel);
    const candidates = new Set<Element>(this.registered.keys());
    const walk = (root: Element | ShadowRoot): void => {
      const walker = doc.createTreeWalker(root, 1);
      let count = 0;
      let node = walker.nextNode();
      while (node && count++ < 12000) {
        const element = node as Element;
        if (element.closest('[data-fluri-root]')) {
          node = walker.nextNode();
          continue;
        }
        const explicit =
          element.hasAttribute('data-weather-surface') ||
          config.dom.include.some((sel) => element.matches(sel));
        if (
          explicit ||
          (config.dom.detection === 'auto' &&
            (eligibleTags.has(element.tagName) ||
              element.classList.contains('card') ||
              element.getAttribute('role') === 'dialog'))
        )
          candidates.add(element);
        if (element.shadowRoot) walk(element.shadowRoot);
        node = walker.nextNode();
      }
    };
    walk(this.root);
    if (this.root.hasAttribute('data-weather-surface')) candidates.add(this.root);
    const old = new Map(this.surfaces.map((s) => [s.element, s]));
    const next: Surface[] = [];
    const sorted = [...candidates].sort(
      (a, b) =>
        (this.registered.get(b)?.priority ??
          (Number(b.getAttribute('data-weather-priority')) || 0)) -
        (this.registered.get(a)?.priority ??
          (Number(a.getAttribute('data-weather-priority')) || 0)),
    );
    for (const element of sorted) {
      if (next.length >= config.dom.maxSurfaces) break;
      if (
        !element.isConnected ||
        this.excluded.has(element) ||
        element.closest('[data-weather-ignore]') ||
        config.dom.exclude.some((sel) => element.closest(sel))
      )
        continue;
      const style = win.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      if (
        style.display === 'none' ||
        style.visibility !== 'visible' ||
        Number(style.opacity) === 0 ||
        rect.width < 24 ||
        rect.height < 8
      )
        continue;
      const explicit = this.registered.has(element) || element.hasAttribute('data-weather-surface');
      if (!explicit && rect.height > win.innerHeight * 0.9 && rect.width > win.innerWidth * 0.9)
        continue;
      const options = this.readOptions(element, this.registered.get(element));
      const existing = old.get(element);
      const s: Surface = existing ?? {
        id: `fluri-${++this.nextId}`,
        element,
        x: 0,
        y: 0,
        width: rect.width,
        height: rect.height,
        angle: 0,
        normal: { x: 0, y: -1 },
        velocity: { x: 0, y: 0 },
        acceleration: { x: 0, y: 0 },
        profile: new Float32Array(Math.max(2, Math.ceil(rect.width / 6))),
        binSize: 6,
        layer: 'content',
        paintOrder: 0,
        clipRegions: [],
        radius: 0,
        material: 'flat',
        maxDepth: config.snow.accumulation.maxDepth,
        accumulation: true,
        visible: true,
        confidence: 'medium',
        options,
      };
      s.options = options;
      s.material = options.material ?? 'flat';
      s.accumulation = options.accumulation ?? true;
      s.maxDepth =
        options.maxSnowDepth ??
        Math.min(
          config.snow.accumulation.maxDepth,
          Math.max(2, rect.height * 0.4),
          rect.width * 0.18,
        );
      s.layer = options.layer ?? 'content';
      s.opaque =
        style.backgroundColor !== 'rgba(0, 0, 0, 0)' ||
        style.backgroundImage !== 'none' ||
        ['IMG', 'DIALOG', 'IFRAME'].includes(element.tagName);
      this.transforms.set(element, style.transform);
      this.positionModes.set(element, style.position);
      this.cacheScrollChain(element);
      s.paintOrder = this.paintOrder(element);
      s.radius = Math.min(
        rect.width / 2,
        rect.height / 2,
        Math.max(0, parseFloat(style.borderTopLeftRadius) || 0),
      );
      if (!existing) {
        this.measure(s, true);
        s.packing = this.packing(s);
        this.scrollOffsets.set(element, this.scrollPosition(element));
      }
      next.push(s);
      old.delete(element);
      if (!existing) {
        this.resizeObserver?.observe(element);
        this.emit('surface:added', { id: s.id });
      }
    }
    for (const s of old.values()) {
      this.resizeObserver?.unobserve(s.element);
      if (config.dom.removedSurface === 'shed') this.shed(s);
      this.emit('surface:removed', { id: s.id });
    }
    this.surfaces.splice(0, this.surfaces.length, ...next);
    this.dirty = false;
  }
  private updateOcclusion(): void {
    const doc = this.root.ownerDocument,
      win = doc.defaultView;
    if (!win || !doc.elementsFromPoint || !this.surfaces.length) return;
    let budget = 72,
      visited = 0;
    const opaque = new WeakMap<Element, boolean>();
    while (budget > 0 && visited < this.surfaces.length) {
      const surface = this.surfaces[this.occlusionCursor++ % this.surfaces.length];
      visited++;
      if (!surface?.visible) continue;
      const samples = Math.min(budget, 12, Math.max(3, Math.ceil(surface.width / 32)));
      const exposed = new Uint8Array(surface.profile.length);
      const hits: boolean[] = [];
      for (let index = 0; index < samples; index++) {
        const localX = ((index + 0.5) * surface.width) / samples;
        const x = surface.x + Math.cos(surface.angle) * localX - Math.sin(surface.angle) * 2;
        const y = surface.y + Math.sin(surface.angle) * localX + Math.cos(surface.angle) * 2;
        let clear = true;
        if (x < 0 || x >= win.innerWidth || y < 0 || y >= win.innerHeight) clear = false;
        else
          for (const element of doc.elementsFromPoint(x, y)) {
            if (element.closest('[data-fluri-root]')) continue;
            if (element === surface.element || surface.element.contains(element)) break;
            if (element.contains(surface.element)) continue;
            let blocks = opaque.get(element);
            if (blocks === undefined) {
              const style = win.getComputedStyle(element);
              const alpha = style.backgroundColor.match(/rgba?\([^)]*[,/]\s*([\d.]+)\s*\)$/)?.[1];
              const painted =
                style.backgroundImage !== 'none' ||
                ['IMG', 'IFRAME', 'CANVAS', 'VIDEO'].includes(element.tagName) ||
                (style.backgroundColor !== 'rgba(0, 0, 0, 0)' &&
                  (alpha === undefined || Number(alpha) >= 0.95));
              blocks = style.visibility === 'visible' && Number(style.opacity) >= 0.95 && painted;
              opaque.set(element, blocks);
            }
            if (blocks) {
              clear = false;
              break;
            }
          }
        hits.push(clear);
        budget--;
      }
      for (let bin = 0; bin < exposed.length; bin++)
        exposed[bin] = hits[
          Math.min(samples - 1, Math.floor(((bin + 0.5) / exposed.length) * samples))
        ]
          ? 1
          : 0;
      surface.exposed = exposed;
      surface.occluded = !hits.some(Boolean);
    }
  }
  private packing(surface: Surface): Float32Array {
    let seed = this.config().seed;
    for (const code of surface.id) seed = Math.imul(seed ^ code.charCodeAt(0), 16777619);
    return createPackingProfile(surface.profile.length, surface.binSize, seed >>> 0);
  }
  private cacheScrollChain(element: Element): void {
    const doc = element.ownerDocument,
      win = doc.defaultView;
    const parents: Element[] = [];
    let includeWindow = true,
      parent = element.parentElement;
    while (parent && parent !== doc.body && parent !== doc.documentElement) {
      parents.push(parent);
      if (win?.getComputedStyle(parent).position === 'fixed') {
        includeWindow = false;
        break;
      }
      parent = parent.parentElement;
    }
    this.scrollChains.set(element, { parents, window: includeWindow });
  }
  private scrollPosition(element: Element): { x: number; y: number } {
    const win = element.ownerDocument.defaultView,
      chain = this.scrollChains.get(element);
    let x = chain?.window ? (win?.scrollX ?? 0) : 0,
      y = chain?.window ? (win?.scrollY ?? 0) : 0;
    for (const parent of chain?.parents ?? []) {
      x += parent.scrollLeft;
      y += parent.scrollTop;
    }
    return { x, y };
  }
  private readOptions(el: Element, override: SurfaceOptions = {}): SurfaceOptions {
    const result: SurfaceOptions = {};
    const material = el.getAttribute('data-weather-material');
    if (material && ['flat', 'slippery', 'sticky', 'no-accumulation'].includes(material))
      result.material = material as Material;
    const layer = el.getAttribute('data-weather-layer');
    if (layer && ['background', 'content', 'foreground'].includes(layer))
      result.layer = layer as Layer;
    const depth = el.getAttribute('data-weather-snow-depth');
    if (depth !== null && Number.isFinite(Number(depth)))
      result.maxSnowDepth = Math.max(0, Math.min(80, Number(depth)));
    const priority = el.getAttribute('data-weather-priority');
    if (priority !== null && Number.isFinite(Number(priority))) result.priority = Number(priority);
    if (el.hasAttribute('data-weather-accumulation'))
      result.accumulation = el.getAttribute('data-weather-accumulation') !== 'false';
    if (el.hasAttribute('data-weather-clip'))
      result.clip = el.getAttribute('data-weather-clip') !== 'false';
    if (el.getAttribute('data-weather-edge') === 'bottom') result.edge = 'bottom';
    return { ...result, ...override };
  }
  private measure(s: Surface, clips: boolean): void {
    const rect = s.element.getBoundingClientRect();
    const win = s.element.ownerDocument.defaultView;
    s.x = rect.left;
    s.y = s.options.edge === 'bottom' ? rect.bottom : rect.top;
    s.width = rect.width;
    s.height = rect.height;
    s.angle = 0;
    const quad = (s.element as QuadElement).getBoxQuads?.()[0];
    if (quad) {
      const a = s.options.edge === 'bottom' ? quad.p4 : quad.p1;
      const b = s.options.edge === 'bottom' ? quad.p3 : quad.p2;
      s.x = a.x;
      s.y = a.y;
      s.width = Math.hypot(b.x - a.x, b.y - a.y);
      s.angle = Math.atan2(b.y - a.y, b.x - a.x);
      s.confidence = 'high';
    } else if (win) {
      if (clips || s.element.getAnimations().some((a) => a.playState === 'running'))
        this.transforms.set(s.element, win.getComputedStyle(s.element).transform);
      const transform = this.transforms.get(s.element) ?? 'none';
      if (transform !== 'none') {
        const matrix = new win.DOMMatrixReadOnly(transform);
        const angle = Math.atan2(matrix.b, matrix.a);
        // Rect + affine local transform recovers common rotate/scale cards; skew/3D stays approximate.
        if (
          Math.abs(angle) > 1e-7 &&
          Math.abs(angle) < 1.2 &&
          Math.abs(matrix.c + matrix.b) < 0.05 &&
          matrix.is2D
        ) {
          const el = s.element as HTMLElement;
          const width = (el.offsetWidth || rect.width) * Math.hypot(matrix.a, matrix.b);
          const height = (el.offsetHeight || rect.height) * Math.hypot(matrix.c, matrix.d);
          const cy = rect.top + rect.height / 2,
            cx = rect.left + rect.width / 2;
          const sign = s.options.edge === 'bottom' ? 1 : -1;
          s.angle = angle;
          s.width = width;
          s.x = cx - (Math.cos(angle) * width) / 2 - (sign * Math.sin(angle) * height) / 2;
          s.y = cy - (Math.sin(angle) * width) / 2 + (sign * Math.cos(angle) * height) / 2;
          s.confidence = 'low';
        }
      }
    }
    s.normal = { x: Math.sin(s.angle), y: -Math.cos(s.angle) };
    s.binSize = s.width / s.profile.length;
    s.visible =
      s.element.isConnected &&
      rect.bottom >= 0 &&
      rect.top <= (win?.innerHeight ?? 0) &&
      rect.right >= 0 &&
      rect.left <= (win?.innerWidth ?? 0) &&
      rect.width > 0;
    if (clips) s.clipRegions = this.clips(s.element);
  }
  private clips(el: Element): ClipRect[] {
    const regions: ClipRect[] = [];
    const win = el.ownerDocument.defaultView;
    if (!win) return regions;
    let parent = el.parentElement;
    while (parent && parent !== el.ownerDocument.documentElement) {
      const style = win.getComputedStyle(parent);
      if (/hidden|clip|scroll|auto/.test(`${style.overflowX} ${style.overflowY}`)) {
        const r = parent.getBoundingClientRect();
        regions.push({
          x: r.left,
          y: r.top,
          width: r.width,
          height: r.height,
          radius: parseFloat(style.borderRadius) || 0,
        });
      }
      parent = parent.parentElement;
    }
    return regions;
  }
  private paintOrder(el: Element): number {
    const win = el.ownerDocument.defaultView;
    if (!win) return 0;
    let order = 0,
      weight = 1,
      parent: Element | null = el;
    while (parent) {
      const st = win.getComputedStyle(parent);
      const z = Number(st.zIndex);
      if (Number.isFinite(z)) order += Math.max(-1000, Math.min(1000, z)) * weight;
      weight *= 2;
      parent = parent.parentElement;
    }
    return order;
  }
  destroy(): void {
    this.observer?.disconnect();
    this.resizeObserver?.disconnect();
    this.surfaces.length = 0;
    this.registered.clear();
  }
}
