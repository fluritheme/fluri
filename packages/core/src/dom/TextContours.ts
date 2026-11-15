import { worldToLocal } from '../physics/math.js';
import type { Surface, Vec2 } from '../types.js';
export interface TextLine {
  key: string;
  range: Range;
  offsets: Float32Array;
  step: number;
  width: number;
  height: number;
}
interface Glyph {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}
function localSize(rect: DOMRect, angle: number, fallbackHeight: number): Vec2 {
  const c = Math.abs(Math.cos(angle)),
    s = Math.abs(Math.sin(angle)),
    d = c * c - s * s;
  if (Math.abs(d) > 0.03)
    return {
      x: Math.max(0, (rect.width * c - rect.height * s) / d),
      y: Math.max(0, (rect.height * c - rect.width * s) / d),
    };
  return {
    x: Math.max(0, (rect.width - s * fallbackHeight) / Math.max(0.01, c)),
    y: fallbackHeight,
  };
}
export function measureTextLine(
  line: TextLine,
  angle: number,
): { x: number; y: number; width: number; height: number } {
  const rect = line.range.getBoundingClientRect();
  const size = localSize(rect, angle, line.height);
  const width = size.x || line.width,
    height = size.y || line.height;
  return {
    x: rect.x + rect.width / 2 - (Math.cos(angle) * width) / 2 + (Math.sin(angle) * height) / 2,
    y: rect.y + rect.height / 2 - (Math.sin(angle) * width) / 2 - (Math.cos(angle) * height) / 2,
    width,
    height,
  };
}
/** Rasterise actual local glyph tops, retaining whitespace holes instead of a text bounding-box shelf. */
export function textContours(
  element: Element,
  basis: Surface,
  keyFor: (node: Text) => string,
): TextLine[] {
  const doc = element.ownerDocument,
    win = doc.defaultView;
  if (!win || !element.textContent?.trim()) return [];
  const walker = doc.createTreeWalker(element, NodeFilter.SHOW_TEXT),
    result: TextLine[] = [];
  const canvas = doc.createElement('canvas'),
    ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];
  let node: Node | null,
    remaining = 1600;
  while ((node = walker.nextNode()) && remaining > 0 && result.length < 40) {
    const text = node as Text,
      parent = text.parentElement;
    if (!parent || !text.data.trim() || parent.closest('script,style,svg,[data-weather-ignore]'))
      continue;
    const style = win.getComputedStyle(parent);
    if (style.visibility !== 'visible' || style.display === 'none' || Number(style.opacity) === 0)
      continue;
    const fontSize = parseFloat(style.fontSize) || 16;
    const sx = basis.width / ((element as HTMLElement).offsetWidth || basis.width),
      sy = basis.height / ((element as HTMLElement).offsetHeight || basis.height);
    const groups: { start: number; end: number; cy: number; glyphs: Glyph[] }[] = [];
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    for (const segment of segmenter.segment(text.data)) {
      if (remaining-- <= 0) break;
      if (!segment.segment.trim()) continue;
      const range = doc.createRange();
      range.setStart(text, segment.index);
      range.setEnd(text, segment.index + segment.segment.length);
      const rect = range.getBoundingClientRect();
      if (rect.width < 0.01 || rect.height < 0.01) continue;
      const center = worldToLocal(basis, {
        x: rect.x + rect.width / 2,
        y: rect.y + rect.height / 2,
      });
      const size = localSize(rect, basis.angle, fontSize * sy * 1.2);
      let group = groups.find((g) => Math.abs(g.cy - center.y) < fontSize * sy * 0.3);
      if (!group) {
        group = {
          start: segment.index,
          end: segment.index + segment.segment.length,
          cy: center.y,
          glyphs: [],
        };
        groups.push(group);
      }
      group.end = segment.index + segment.segment.length;
      const content =
        style.textTransform === 'uppercase'
          ? segment.segment.toUpperCase()
          : style.textTransform === 'lowercase'
            ? segment.segment.toLowerCase()
            : segment.segment;
      group.glyphs.push({
        text: content,
        x: center.x - size.x / 2,
        y: center.y - size.y / 2,
        width: size.x,
        height: size.y,
      });
    }
    for (const group of groups) {
      const range = doc.createRange();
      range.setStart(text, group.start);
      range.setEnd(text, group.end);
      const rect = range.getBoundingClientRect(),
        size = localSize(rect, basis.angle, fontSize * sy * 1.2);
      const center = worldToLocal(basis, {
        x: rect.x + rect.width / 2,
        y: rect.y + rect.height / 2,
      });
      const left = center.x - size.x / 2,
        top = center.y - size.y / 2;
      const width = Math.max(1, size.x),
        height = Math.max(1, size.y);
      const density = Math.min(1, 4096 / width, 512 / height);
      canvas.width = Math.ceil(width * density) + 2;
      canvas.height = Math.ceil(height * density) + 2;
      ctx.setTransform(density * sx, 0, 0, density * sy, 0, 0);
      ctx.font =
        style.font ||
        `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#000';
      ctx.direction = style.direction === 'rtl' ? 'rtl' : 'ltr';
      ctx.textAlign = 'left';
      for (const glyph of group.glyphs) {
        const metrics = ctx.measureText(glyph.text);
        const ascent = metrics.fontBoundingBoxAscent || fontSize * 0.82,
          descent = metrics.fontBoundingBoxDescent || fontSize * 0.22;
        const leading = Math.max(0, glyph.height / sy - ascent - descent) / 2;
        ctx.fillText(glyph.text, (glyph.x - left) / sx, (glyph.y - top) / sy + leading + ascent);
      }
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const offsets = new Float32Array(canvas.width);
      offsets.fill(Infinity);
      for (let x = 0; x < canvas.width; x++)
        for (let y = 0; y < canvas.height; y++)
          if ((pixels[(y * canvas.width + x) * 4 + 3] ?? 0) > 48) {
            offsets[x] = y / density;
            break;
          }
      if (!offsets.some(Number.isFinite)) continue;
      result.push({
        key: `${keyFor(text)}:${group.start}`,
        range,
        offsets,
        step: 1 / density,
        width,
        height,
      });
    }
  }
  return result;
}
export function cssCornerRadii(
  style: CSSStyleDeclaration,
  width: number,
  height: number,
  scaleX: number,
  scaleY: number,
): readonly [Vec2, Vec2, Vec2, Vec2] {
  const parse = (value: string): Vec2 => {
    const [x = '0', y = x] = value.split(/\s+/);
    return {
      x: Math.max(0, parseFloat(x) || 0) * (x.includes('%') ? width / 100 : scaleX),
      y: Math.max(0, parseFloat(y) || 0) * (y.includes('%') ? height / 100 : scaleY),
    };
  };
  const radii: [Vec2, Vec2, Vec2, Vec2] = [
    style.borderTopLeftRadius,
    style.borderTopRightRadius,
    style.borderBottomRightRadius,
    style.borderBottomLeftRadius,
  ].map(parse) as [Vec2, Vec2, Vec2, Vec2];
  const [tl, tr, br, bl] = radii;
  const factor = Math.min(
    1,
    width / Math.max(1, tl.x + tr.x),
    width / Math.max(1, bl.x + br.x),
    height / Math.max(1, tl.y + bl.y),
    height / Math.max(1, tr.y + br.y),
  );
  return radii.map((r) => ({ x: r.x * factor, y: r.y * factor })) as [Vec2, Vec2, Vec2, Vec2];
}
