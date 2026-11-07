import type { Surface } from '../types.js';

interface Color {
  r: number;
  g: number;
  b: number;
  a: number;
}
const paper: Color = { r: 255, g: 255, b: 255, a: 1 };

/** Small cached backdrop map. No hit testing or computed-style reads occur in the particle loop. */
export class SnowContrast {
  private columns = 8;
  private rows = 5;
  private cells = new Float32Array(this.columns * this.rows);
  private support = new WeakMap<Surface, number>();
  private colors = new Map<string, Color>();
  private parser: CanvasRenderingContext2D | null;
  private lastRefresh = -Infinity;
  private dirty = true;
  private width = 1;
  private height = 1;
  private observer: MutationObserver | undefined;
  private pending: ReturnType<typeof setTimeout> | undefined;
  constructor(
    private doc: Document,
    invalidate: () => void,
  ) {
    const canvas = doc.createElement('canvas');
    canvas.width = canvas.height = 1;
    this.parser = canvas.getContext('2d', { willReadFrequently: true });
    const win = doc.defaultView;
    if (win) {
      this.observer = new win.MutationObserver((records) => {
        if (
          records.some(
            (record) =>
              !(record.target instanceof win.Element) ||
              !record.target.closest('[data-fluri-root]'),
          )
        ) {
          this.dirty = true;
          if (!this.pending)
            this.pending = setTimeout(
              () => {
                this.pending = undefined;
                invalidate();
              },
              Math.max(0, 185 - (performance.now() - this.lastRefresh)),
            );
        }
      });
      this.observer.observe(doc.documentElement, {
        attributes: true,
        subtree: true,
        attributeFilter: ['style', 'class', 'data-theme', 'data-color-scheme'],
      });
    }
  }
  invalidate(): void {
    this.dirty = true;
  }
  private color(css: string): Color {
    const known = this.colors.get(css);
    if (known) return known;
    const ctx = this.parser;
    if (!ctx) return paper;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = 'transparent';
    ctx.fillStyle = css;
    ctx.fillRect(0, 0, 1, 1);
    const pixel = ctx.getImageData(0, 0, 1, 1).data;
    const value = {
      r: pixel[0] ?? 0,
      g: pixel[1] ?? 0,
      b: pixel[2] ?? 0,
      a: (pixel[3] ?? 0) / 255,
    };
    if (this.colors.size >= 128) this.colors.clear();
    this.colors.set(css, value);
    return value;
  }
  private lightness(color: Color): number {
    const linear = (value: number) =>
      value <= 10.31475 ? value / 3294.6 : ((value / 255 + 0.055) / 1.055) ** 2.4;
    return 0.2126 * linear(color.r) + 0.7152 * linear(color.g) + 0.0722 * linear(color.b);
  }
  private strength(color: Color): number {
    return Math.max(0, Math.min(1, (this.lightness(color) - 0.56) / 0.32));
  }
  isPale(css: string): boolean {
    const color = this.color(css);
    return (
      this.lightness(color) > 0.7 &&
      Math.max(color.r, color.g, color.b) - Math.min(color.r, color.g, color.b) < 65
    );
  }
  refresh(surfaces: readonly Surface[], width: number, height: number): void {
    const now = performance.now();
    const resized = width !== this.width || height !== this.height;
    if (!resized && now - this.lastRefresh < (this.dirty ? 180 : 650)) return;
    this.lastRefresh = now;
    this.dirty = false;
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    const win = this.doc.defaultView;
    if (!win) return;
    const raw = new WeakMap<Element, Color>();
    const composed = new WeakMap<Element, Color>();
    const own = (element: Element): Color => {
      let value = raw.get(element);
      if (!value) {
        value = this.color(win.getComputedStyle(element).backgroundColor);
        raw.set(element, value);
      }
      return value;
    };
    const background = (element: Element | null): Color => {
      if (!element) return paper;
      const cached = composed.get(element);
      if (cached) return cached;
      const foreground = own(element);
      const behind = foreground.a >= 0.999 ? foreground : background(element.parentElement);
      const value =
        foreground.a >= 0.999
          ? foreground
          : {
              r: foreground.r * foreground.a + behind.r * (1 - foreground.a),
              g: foreground.g * foreground.a + behind.g * (1 - foreground.a),
              b: foreground.b * foreground.a + behind.b * (1 - foreground.a),
              a: 1,
            };
      composed.set(element, value);
      return value;
    };
    for (let row = 0; row < this.rows; row++)
      for (let column = 0; column < this.columns; column++) {
        const x = ((column + 0.5) * this.width) / this.columns,
          y = ((row + 0.5) * this.height) / this.rows;
        const elements = this.doc.elementsFromPoint(x, y);
        const underlying = elements.find(
          (element) => !element.closest('[data-fluri-root]') && own(element).a > 0.01,
        );
        this.cells[row * this.columns + column] = this.strength(
          background(underlying ?? this.doc.body),
        );
      }
    this.support = new WeakMap();
    for (const surface of surfaces)
      this.support.set(
        surface,
        Math.max(
          this.strength(background(surface.element)),
          this.strength(background(surface.element.parentElement)),
        ),
      );
  }
  at(x: number, y: number): number {
    const column = Math.max(
      0,
      Math.min(this.columns - 1, Math.floor((x * this.columns) / this.width)),
    );
    const row = Math.max(0, Math.min(this.rows - 1, Math.floor((y * this.rows) / this.height)));
    return this.cells[row * this.columns + column] ?? 0;
  }
  forSurface(surface: Surface): number {
    return this.support.get(surface) ?? this.at(surface.x + surface.width / 2, surface.y - 3);
  }
  destroy(): void {
    clearTimeout(this.pending);
    this.observer?.disconnect();
    this.colors.clear();
    this.parser = null;
  }
}
