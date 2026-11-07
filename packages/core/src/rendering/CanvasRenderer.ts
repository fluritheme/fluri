import { SnowTexture } from './Texture.js';
import { buildSnowContours } from './SnowContour.js';
import { SnowContrast } from './Contrast.js';
import type { Layer, Particle, Surface, WeatherConfig, WeatherPlugin } from '../types.js';
const layers: Layer[] = ['background', 'content', 'foreground'];
export class CanvasRenderer {
  private host: HTMLDivElement;
  private canvases = new Map<Layer, HTMLCanvasElement>();
  private contexts = new Map<Layer, CanvasRenderingContext2D>();
  width = 0;
  height = 0;
  private dpr = 1;
  private bitmapWidth = 0;
  private bitmapHeight = 0;
  private mountedScope: HTMLElement | undefined;
  private mountDirty = true;
  private scopeEligible = false;
  private maxDPR = 1;
  private ignored: Element[] = [];
  private lastIgnoreRefresh = -Infinity;
  private texture: SnowTexture;
  private allowGlow = true;
  private contactShadows = true;
  private contrast: SnowContrast;
  private paleSnow = true;
  private contourCache = new WeakMap<
    Surface,
    {
      profile: Float32Array;
      signature: number;
      width: number;
      radius: number;
      contours: ReturnType<typeof buildSnowContours>;
    }
  >();
  constructor(
    private doc: Document,
    onTextureError?: (error: Error) => void,
    onAppearanceChange: () => void = () => {},
    private scope?: HTMLElement,
  ) {
    this.texture = new SnowTexture(doc, onTextureError);
    this.contrast = new SnowContrast(doc, () => {
      this.mountDirty = true;
      onAppearanceChange();
    });
    this.host = doc.createElement('div');
    this.host.dataset.fluriRoot = 'effects';
    this.host.dataset.fluriMount = 'viewport';
    this.host.setAttribute('aria-hidden', 'true');
    this.host.inert = true;
    Object.assign(this.host.style, {
      position: 'fixed',
      inset: '0',
      pointerEvents: 'none',
      zIndex: '2147483000',
      overflow: 'hidden',
      contain: 'strict',
    });
    for (const layer of layers) {
      const canvas = doc.createElement('canvas');
      canvas.dataset.fluriLayer = layer;
      canvas.setAttribute('aria-hidden', 'true');
      Object.assign(canvas.style, {
        position: 'absolute',
        inset: '0',
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      });
      const context = canvas.getContext('2d', { alpha: true });
      if (!context) throw new Error('Fluri needs Canvas 2D support');
      this.host.append(canvas);
      this.canvases.set(layer, canvas);
      this.contexts.set(layer, context);
    }
    doc.body.append(this.host);
  }
  get textureStatus() {
    return this.texture.status;
  }
  resize(maxDPR: number): void {
    this.maxDPR = maxDPR;
    const win = this.doc.defaultView;
    if (!win) return;
    const width = win.innerWidth,
      height = win.innerHeight,
      dpr = Math.min(win.devicePixelRatio || 1, maxDPR);
    const scope = this.scope;
    if (this.mountDirty && scope) {
      this.scopeEligible =
        scope !== this.doc.body && scope !== this.doc.documentElement && scope.isConnected;
      let ancestor: HTMLElement | null = scope;
      while (this.scopeEligible && ancestor) {
        const style = win.getComputedStyle(ancestor);
        if (
          (ancestor === scope &&
            (style.position === 'static' ||
              style.display === 'contents' ||
              style.display === 'inline')) ||
          style.transform !== 'none' ||
          style.perspective !== 'none' ||
          (style.getPropertyValue('zoom') &&
            !['1', 'normal'].includes(style.getPropertyValue('zoom')))
        )
          this.scopeEligible = false;
        ancestor = ancestor.parentElement;
      }
      this.mountDirty = false;
    }
    const scopeRect = this.scopeEligible ? scope?.getBoundingClientRect() : undefined;
    const nativeScope =
      this.scopeEligible &&
      scope &&
      scopeRect &&
      scopeRect.width > 0 &&
      scopeRect.height > 0 &&
      scopeRect.width <= width * 1.5 &&
      scopeRect.height <= height * 1.5 &&
      scope.scrollHeight <= scope.clientHeight + 1 &&
      scope.scrollWidth <= scope.clientWidth + 1
        ? scope
        : undefined;
    if (nativeScope !== this.mountedScope) {
      this.mountedScope = nativeScope;
      this.host.style.position = nativeScope ? 'absolute' : 'fixed';
      this.host.dataset.fluriMount = nativeScope ? 'scope' : 'viewport';
      (nativeScope ?? this.doc.body).append(this.host);
    }
    const bounds = nativeScope ? this.host.getBoundingClientRect() : undefined;
    const bitmapWidth = bounds?.width ?? width;
    const bitmapHeight = bounds?.height ?? height;
    if (
      width === this.width &&
      height === this.height &&
      dpr === this.dpr &&
      bitmapWidth === this.bitmapWidth &&
      bitmapHeight === this.bitmapHeight
    )
      return;
    this.width = width;
    this.height = height;
    this.bitmapWidth = bitmapWidth;
    this.bitmapHeight = bitmapHeight;
    this.dpr = dpr;
    for (const [layer, canvas] of this.canvases) {
      canvas.width = Math.round(bitmapWidth * dpr);
      canvas.height = Math.round(bitmapHeight * dpr);
      this.contexts.get(layer)?.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }
  clear(): void {
    for (const ctx of this.contexts.values())
      ctx.clearRect(0, 0, this.bitmapWidth, this.bitmapHeight);
  }
  render(
    particles: readonly Particle[],
    surfaces: readonly Surface[],
    config: WeatherConfig,
    time: number,
    plugins: readonly WeatherPlugin[],
    actorDraw: (ctx: CanvasRenderingContext2D, time: number) => void,
  ): void {
    // Paused previews still receive layout/theme invalidations and must keep their backing store sized.
    this.resize(this.maxDPR);
    this.clear();
    this.contrast.refresh(surfaces, this.width, this.height);
    this.paleSnow = this.contrast.isPale(config.snow.color);
    this.allowGlow = particles.length < 240;
    this.contactShadows = surfaces.length < 40;
    this.texture.setSource(config.snow.texture ?? undefined);
    if (time - this.lastIgnoreRefresh > 0.2 || this.lastIgnoreRefresh === -Infinity) {
      this.ignored = [
        ...this.doc.querySelectorAll(['[data-weather-ignore]', ...config.dom.exclude].join(',')),
      ].slice(0, 512);
      this.lastIgnoreRefresh = time;
    }
    const ignoredRects = this.ignored
      .filter((el) => el.isConnected)
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.height > 0);
    const sorted = surfaces
      .filter((s) => s.visible && !s.occluded)
      .sort((a, b) => a.paintOrder - b.paintOrder);
    const origin = this.mountedScope ? this.host.getBoundingClientRect() : undefined;
    for (const layer of layers) {
      const ctx = this.contexts.get(layer);
      if (!ctx) continue;
      ctx.save();
      if (origin) ctx.translate(-origin.left, -origin.top);
      if (
        config.container &&
        config.container !== this.doc.body &&
        config.container !== this.doc.documentElement
      ) {
        const r = config.container.getBoundingClientRect();
        ctx.beginPath();
        ctx.rect(r.left, r.top, r.width, r.height);
        ctx.clip();
      }
      for (const p of particles) if (p.layer === layer) this.particle(ctx, p, config);
      if (layer === 'content') {
        // Mask flakes before attached deposits so their lower edge can meet the actual rounded shoulder.
        if (config.dom.respectLayers) this.maskBodies(ctx, sorted);
        for (const s of sorted) if (s.layer === 'content') this.snow(ctx, s, config);
        if (config.dom.respectLayers) this.maskBodies(ctx, sorted, true);
        actorDraw(ctx, time);
        for (const plugin of plugins) {
          ctx.save();
          plugin.render?.(ctx, time);
          ctx.restore();
        }
      } else {
        for (const s of sorted) if (s.layer === layer) this.snow(ctx, s, config);
        if (layer === 'background' && config.dom.respectLayers) this.maskBodies(ctx, sorted);
      }
      if (config.debug && layer === 'foreground') this.debug(ctx, sorted);
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = '#000';
      for (const r of ignoredRects) ctx.fillRect(r.left, r.top, r.width, r.height);
      ctx.restore();
      ctx.restore();
    }
  }
  private particle(ctx: CanvasRenderingContext2D, p: Particle, config: WeatherConfig): void {
    const contrast = this.paleSnow && p.kind !== 'sparkle' ? this.contrast.at(p.x, p.y) : 0;
    ctx.globalAlpha = Math.min(1, Math.max(0, p.opacity));
    ctx.fillStyle = p.kind === 'sparkle' ? '#ffd7a1' : config.snow.color;
    if (this.allowGlow && config.snow.glow && p.radius > 1.8) {
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = Math.min(7, p.radius * 2);
    }
    if (this.texture.image && p.kind === 'flake') {
      ctx.drawImage(this.texture.image, p.x - p.radius, p.y - p.radius, p.radius * 2, p.radius * 2);
    } else if (config.snow.flakeStyle === 'crystal' && p.kind === 'flake') {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.phase + p.age * 0.2);
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI) / 3;
        ctx.moveTo(-Math.cos(a) * p.radius * 1.5, -Math.sin(a) * p.radius * 1.5);
        ctx.lineTo(Math.cos(a) * p.radius * 1.5, Math.sin(a) * p.radius * 1.5);
      }
      if (contrast > 0.05) {
        ctx.strokeStyle = `rgba(89,120,143,${0.72 * contrast})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.strokeStyle = config.snow.color;
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.restore();
    } else if (p.kind === 'clump' && p.radius > 1.4) {
      ctx.beginPath();
      for (let index = 0; index < 12; index++) {
        const a = (index / 12) * Math.PI * 2;
        const r =
          p.radius *
          (0.77 +
            0.11 * Math.sin(p.phase + index * 2.37) +
            0.08 * Math.cos(index * 1.13 + p.phase));
        const x = p.x + Math.cos(a) * r,
          y = p.y + Math.sin(a) * r * 0.72;
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      if (contrast > 0.05) {
        ctx.strokeStyle = `rgba(89,120,143,${0.8 * contrast})`;
        ctx.lineWidth = 0.85;
        ctx.stroke();
      }
    } else {
      ctx.beginPath();
      ctx.ellipse(
        p.x,
        p.y,
        p.radius,
        p.kind === 'clump' ? p.radius * 0.8 : p.radius,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      if (contrast > 0.05) {
        ctx.strokeStyle = `rgba(89,120,143,${0.8 * contrast})`;
        ctx.lineWidth = 0.85;
        ctx.stroke();
      }
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }
  private snow(ctx: CanvasRenderingContext2D, s: Surface, config: WeatherConfig): void {
    if (!config.snow.accumulation.enabled || !s.accumulation) return;
    let signature = s.occluded ? 1 : 0;
    for (let i = 0; i < s.profile.length; i++)
      signature = Math.imul(
        signature ^ Math.round((s.profile[i] ?? 0) * 128) ^ (s.exposed?.[i] ?? 1),
        16777619,
      );
    let cached = this.contourCache.get(s);
    if (
      !cached ||
      cached.profile !== s.profile ||
      cached.signature !== signature ||
      cached.width !== s.width ||
      cached.radius !== s.radius
    ) {
      cached = {
        profile: s.profile,
        signature,
        width: s.width,
        radius: s.radius,
        contours: buildSnowContours(s),
      };
      this.contourCache.set(s, cached);
    }
    const contours = cached.contours;
    if (!contours.length) return;
    ctx.save();
    if (s.options.clip !== false)
      for (const c of s.clipRegions) {
        ctx.beginPath();
        ctx.roundRect(c.x, c.y, c.width, c.height, c.radius);
        ctx.clip();
      }
    ctx.translate(s.x, s.y);
    ctx.rotate(s.angle);
    const contrast = this.paleSnow ? this.contrast.forSurface(s) : 0;
    for (const contour of contours) {
      const first = contour.points[0],
        last = contour.points.at(-1);
      if (!first || !last) continue;
      // The contour comes from stored mass, while a small contact shadow gives the deposit volume.
      const gradient = ctx.createLinearGradient(0, -contour.peak, 0, 0.5);
      gradient.addColorStop(0, this.paleSnow ? '#ffffff' : config.snow.color);
      gradient.addColorStop(0.45, config.snow.color);
      gradient.addColorStop(
        1,
        this.paleSnow ? (contrast > 0.05 ? '#b0c4d4' : '#d1deea') : config.snow.color,
      );
      ctx.fillStyle = gradient;
      ctx.shadowColor = 'rgba(5,16,32,.2)';
      ctx.shadowBlur = this.contactShadows ? 1 : 0;
      ctx.shadowOffsetY = 1;
      ctx.beginPath();
      ctx.moveTo(first.x, first.base + 0.35);
      for (const point of contour.points) ctx.lineTo(point.x, point.base - point.depth);
      for (let index = contour.points.length - 1; index >= 0; index--) {
        const point = contour.points[index];
        if (point) ctx.lineTo(point.x, point.base + 0.35);
      }
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      // Restrained rim light follows the same physical edge, rather than a scalloped white stripe.
      if (contour.peak > 1.5) {
        ctx.strokeStyle =
          contrast > 0.05 ? `rgba(89,120,143,${0.72 * contrast})` : 'rgba(255,255,255,.35)';
        ctx.lineWidth = contrast > 0.05 ? 0.95 : 0.5;
        ctx.beginPath();
        contour.points.forEach((point, index) => {
          if (index === 0) ctx.moveTo(point.x, point.base - point.depth + 0.25);
          else ctx.lineTo(point.x, point.base - point.depth + 0.25);
        });
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  private maskBodies(ctx: CanvasRenderingContext2D, surfaces: Surface[], deposits = false): void {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000';
    for (const s of surfaces) {
      if (s.opaque === false) continue;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.angle);
      ctx.beginPath();
      const top = deposits ? Math.min(6, Math.max(1.25, s.radius * 0.35)) : 1;
      ctx.roundRect(0, top, s.width, Math.max(0, s.height - top), s.radius);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }
  private debug(ctx: CanvasRenderingContext2D, surfaces: Surface[]): void {
    ctx.font = '10px ui-monospace,monospace';
    ctx.lineWidth = 1;
    for (const s of surfaces) {
      ctx.save();
      ctx.strokeStyle = '#b49df5';
      ctx.setLineDash([3, 4]);
      for (const clip of s.clipRegions) {
        ctx.beginPath();
        ctx.roundRect(clip.x, clip.y, clip.width, clip.height, clip.radius);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.translate(s.x, s.y);
      ctx.rotate(s.angle);
      ctx.strokeStyle = s.confidence === 'low' ? '#ffbe86' : '#68f1dc';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(s.width, 0);
      const middle = s.width / 2;
      ctx.moveTo(middle, 0);
      ctx.lineTo(middle, -18);
      ctx.moveTo(middle - 3, -13);
      ctx.lineTo(middle, -18);
      ctx.lineTo(middle + 3, -13);
      ctx.stroke();
      ctx.fillStyle = '#68f1dc';
      ctx.fillText(
        `${s.id} · ${s.layer} · paint ${s.paintOrder} · ${s.confidence}`,
        4,
        -s.maxDepth - 7,
      );
      ctx.restore();
    }
  }
  destroy(): void {
    this.contrast.destroy();
    this.texture.destroy();
    this.host.remove();
    this.canvases.clear();
    this.contexts.clear();
  }
}
