import { textContours, measureTextLine, cssCornerRadii, type TextLine } from './TextContours.js';
import { supportYAt } from '../physics/profiles.js';
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
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
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
  private textLines = new WeakMap<Surface, TextLine>();
  private textKeys = new WeakMap<Text, string>();
  private shapeKeys = new WeakMap<Surface, string>();
  private registered = new Map<Element, SurfaceOptions>();
  private excluded = new WeakSet<Element>();
  private dirty = true;
  private observer: MutationObserver | undefined;
  private resizeObserver: ResizeObserver | undefined;
  private nextId = 0;
  private transforms = new WeakMap<Element, DOMMatrixReadOnly>();
  private scrollOffsets = new WeakMap<Surface, { x: number; y: number }>();
  private positionModes = new WeakMap<Element, string>();
  private scrollChains = new WeakMap<Element, { parents: Element[]; window: boolean }>();
  private lastTime = 0;
  private animatedElements: Element[] = [];
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
    // Ancestor CSS/Web Animations can move a shelf without a style mutation.
    // Collect their targets once per frame rather than querying every ancestor per shelf.
    this.animatedElements = this.root
      .getAnimations({ subtree: true })
      .filter((animation) => animation.playState === 'running')
      .map((animation) => (animation.effect as KeyframeEffect | null)?.target)
      .filter((target): target is Element => target instanceof Element);
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
        previousScroll = this.scrollOffsets.get(surface) ?? scroll;
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
      this.scrollOffsets.set(surface, scroll);
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
    const count = Math.max(2, Math.ceil(s.width / (s.shape === 'text' ? 2 : 6))),
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
    const old = new Map(this.surfaces.map((s) => [this.shapeKeys.get(s) ?? s.element, s]));
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
      const explicit =
        this.registered.has(element) ||
        element.hasAttribute('data-weather-surface') ||
        config.dom.include.some((selector) => element.matches(selector));
      // Structural wrappers have no physical edge unless they paint a box. In particular,
      // transparent nav/section wrappers must not create floating shelves above their text.
      if (
        !explicit &&
        !['BUTTON', 'IMG', 'DIALOG', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(
          element.tagName,
        ) &&
        !this.paintedBox(style)
      )
        continue;
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
      s.shape = 'box';
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
      s.opaque = this.opaqueBox(element, style);
      this.positionModes.set(element, style.position);
      this.cacheScrollChain(element);
      s.paintOrder = this.paintOrder(element);
      const measured: Surface = existing ? { ...s } : s;
      this.measure(measured, true);
      const sx = measured.width / ((element as HTMLElement).offsetWidth || measured.width),
        sy = measured.height / ((element as HTMLElement).offsetHeight || measured.height);
      s.cornerRadii = cssCornerRadii(style, measured.width, measured.height, sx, sy);
      s.radius = Math.max(s.cornerRadii[0].y, s.cornerRadii[1].y);
      let ancestor: Element | null = element;
      s.viewportFixed = false;
      while (ancestor) {
        const mode = win.getComputedStyle(ancestor).position;
        if (mode === 'fixed' || mode === 'sticky') {
          s.viewportFixed = true;
          break;
        }
        ancestor = ancestor.parentElement;
      }
      const isText =
        Boolean(element.textContent?.trim()) &&
        !this.paintedBox(style) &&
        !['IMG', 'CANVAS', 'VIDEO', 'IFRAME', 'INPUT', 'TEXTAREA'].includes(element.tagName);
      if (isText) {
        const lines = textContours(element, measured, (node) => {
          let key = this.textKeys.get(node);
          if (!key) {
            key = `text-${++this.nextId}`;
            this.textKeys.set(node, key);
          }
          return key;
        });
        for (const line of lines) {
          if (next.length >= config.dom.maxSurfaces) break;
          const saved = old.get(line.key),
            bins = Math.max(2, Math.ceil(line.width / 2));
          const part: Surface = saved ?? {
            ...s,
            id: `fluri-${++this.nextId}`,
            profile: new Float32Array(bins),
          };
          part.options = options;
          part.shape = 'text';
          part.accumulation = s.accumulation;
          part.material = s.material;
          part.maxDepth = Math.min(s.maxDepth, line.height * 0.12);
          part.opaque = false;
          part.radius = 0;
          delete part.cornerRadii;
          part.layer = s.layer;
          part.paintOrder = s.paintOrder;
          part.viewportFixed = s.viewportFixed;
          part.contour = { offsets: line.offsets, step: line.step };
          this.textLines.set(part, line);
          this.shapeKeys.set(part, line.key);
          this.positionModes.set(part.element, style.position);
          if (!saved) {
            this.measure(part, true);
            this.scrollOffsets.set(part, this.scrollPosition(part.element));
          }
          part.packing = this.packing(part);
          next.push(part);
          old.delete(line.key);
          if (!saved) this.emit('surface:added', { id: part.id });
        }
        this.resizeObserver?.observe(element);
        // Remove a former rectangular support when its box becomes text-only.
        if (existing) {
          old.delete(element);
          if (config.dom.removedSurface === 'shed') this.shed(existing);
        }
        continue;
      }
      delete s.contour;
      this.textLines.delete(s);
      if (!existing) {
        s.packing = this.packing(s);
        this.scrollOffsets.set(s, this.scrollPosition(element));
      }
      next.push(s);
      old.delete(element);
      if (!existing) {
        this.resizeObserver?.observe(element);
        this.emit('surface:added', { id: s.id });
      }
    }
    for (const s of old.values()) {
      if (!next.some((n) => n.element === s.element)) this.resizeObserver?.unobserve(s.element);
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
        const support = supportYAt(surface, localX);
        if (!Number.isFinite(support)) {
          hits.push(false);
          budget--;
          continue;
        }
        const x =
          surface.x + Math.cos(surface.angle) * localX - Math.sin(surface.angle) * (support + 2);
        const y =
          surface.y + Math.sin(surface.angle) * localX + Math.cos(surface.angle) * (support + 2);
        let clear = true;
        if (x < 0 || x >= win.innerWidth || y < 0 || y >= win.innerHeight) clear = true;
        else
          for (const element of doc.elementsFromPoint(x, y)) {
            if (element.closest('[data-fluri-root]')) continue;
            if (element === surface.element || surface.element.contains(element)) break;
            if (element.contains(surface.element)) continue;
            let blocks = opaque.get(element);
            if (blocks === undefined) {
              const style = win.getComputedStyle(element);
              blocks = style.visibility === 'visible' && this.opaqueBox(element, style);
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
  private colorAlpha(color: string): number {
    // Computed rgb(r, g, b) has no alpha: the final blue channel is not opacity.
    const values = color.slice(color.indexOf('(') + 1, color.lastIndexOf(')'));
    const alpha = values.includes('/') ? values.split('/')[1] : values.split(',')[3];
    if (alpha === undefined) return color === 'transparent' ? 0 : 1;
    const parsed = parseFloat(alpha);
    return Number.isFinite(parsed) ? parsed / (alpha.includes('%') ? 100 : 1) : 1;
  }
  private paintedBox(style: CSSStyleDeclaration): boolean {
    return (
      this.colorAlpha(style.backgroundColor) > 0 ||
      style.backgroundImage !== 'none' ||
      ['Top', 'Right', 'Bottom', 'Left'].some(
        (side) =>
          parseFloat(style.getPropertyValue(`border-${side.toLowerCase()}-width`)) > 0 &&
          this.colorAlpha(style.getPropertyValue(`border-${side.toLowerCase()}-color`)) > 0,
      )
    );
  }
  private opaqueBox(element: Element, style: CSSStyleDeclaration): boolean {
    return (
      Number(style.opacity) >= 0.95 &&
      (this.colorAlpha(style.backgroundColor) >= 0.95 ||
        style.backgroundImage !== 'none' ||
        ['IMG', 'IFRAME', 'CANVAS', 'VIDEO'].includes(element.tagName))
    );
  }
  private packing(surface: Surface): Float32Array {
    let seed = this.config().seed;
    for (const code of surface.id) seed = Math.imul(seed ^ code.charCodeAt(0), 16777619);
    const packing = createPackingProfile(surface.profile.length, surface.binSize, seed >>> 0);
    if (surface.contour)
      for (let i = 0; i < packing.length; i++)
        if (!Number.isFinite(supportYAt(surface, (i + 0.5) * surface.binSize))) packing[i] = 0;
    return packing;
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
      s.height = Math.hypot(quad.p4.x - quad.p1.x, quad.p4.y - quad.p1.y);
      s.angle = Math.atan2(b.y - a.y, b.x - a.x);
      s.confidence = 'high';
    } else if (win) {
      // getBoundingClientRect() is an axis-aligned envelope. Recover the real edge from
      // the complete ancestor transform, not only the card's own transform (Chromium
      // does not expose getBoxQuads). Rect center already includes transform origins.
      let matrix = this.transforms.get(s.element);
      if (
        clips ||
        !matrix ||
        this.animatedElements.some(
          (element) => element === s.element || element.contains(s.element),
        )
      ) {
        matrix = new win.DOMMatrixReadOnly();
        let ancestor: Element | null = s.element;
        while (ancestor) {
          const style = win.getComputedStyle(ancestor);
          let local = new win.DOMMatrixReadOnly();
          const rotation = style.getPropertyValue('rotate');
          if (rotation && rotation !== 'none' && !/^[xy]\s/.test(rotation)) {
            const angle = rotation.trim().split(/\s+/).pop() ?? '0';
            const degrees =
              parseFloat(angle) *
              (angle.endsWith('rad') && !angle.endsWith('grad')
                ? 180 / Math.PI
                : angle.endsWith('turn')
                  ? 360
                  : angle.endsWith('grad')
                    ? 0.9
                    : 1);
            if (Number.isFinite(degrees)) local = local.rotate(degrees);
          }
          const scale = style.getPropertyValue('scale');
          if (scale && scale !== 'none') {
            const values = scale.trim().split(/\s+/).map(Number);
            local = local.scale(values[0] || 1, values[1] ?? values[0] ?? 1);
          }
          if (style.transform !== 'none')
            local = local.multiply(new win.DOMMatrixReadOnly(style.transform));
          const zoom = style.getPropertyValue('zoom');
          if (zoom && zoom !== 'normal') {
            const factor = parseFloat(zoom) / (zoom.includes('%') ? 100 : 1);
            if (factor > 0) local = local.scale(factor);
          }
          matrix = local.multiply(matrix);
          ancestor = ancestor.parentElement;
        }
        this.transforms.set(s.element, matrix);
      }
      const angle = Math.atan2(matrix.b, matrix.a);
      const scaleX = Math.hypot(matrix.a, matrix.b);
      const scaleY = Math.hypot(matrix.c, matrix.d);
      const orthogonality = Math.abs(matrix.a * matrix.c + matrix.b * matrix.d);
      // A Surface describes an orthogonal shelf, so leave skew/perspective approximate.
      if (
        matrix.is2D &&
        Math.abs(angle) < 1.2 &&
        scaleX > 0 &&
        scaleY > 0 &&
        orthogonality < scaleX * scaleY * 0.001 &&
        matrix.a * matrix.d - matrix.b * matrix.c > 0
      ) {
        const el = s.element as HTMLElement;
        const localWidth = el.offsetWidth || rect.width / scaleX;
        const localHeight = el.offsetHeight || rect.height / scaleY;
        const sign = s.options.edge === 'bottom' ? 1 : -1;
        s.angle = angle;
        s.width = localWidth * scaleX;
        s.height = localHeight * scaleY;
        s.x =
          rect.left +
          rect.width / 2 -
          (matrix.a * localWidth) / 2 +
          (sign * matrix.c * localHeight) / 2;
        s.y =
          rect.top +
          rect.height / 2 -
          (matrix.b * localWidth) / 2 +
          (sign * matrix.d * localHeight) / 2;
        s.confidence = 'high';
      }
    }
    const textLine = this.textLines.get(s);
    if (textLine) Object.assign(s, measureTextLine(textLine, s.angle));
    s.normal = { x: Math.sin(s.angle), y: -Math.cos(s.angle) };
    s.binSize = s.width / s.profile.length;
    s.visible =
      s.element.isConnected &&
      rect.bottom >= -(this.root === this.root.ownerDocument.body ? (win?.innerHeight ?? 0) : 0) &&
      rect.top <= (win?.innerHeight ?? 0) * (this.root === this.root.ownerDocument.body ? 2 : 1) &&
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
