import { describe, expect, it } from 'vitest';
import { isSafeTextureSource, SnowTexture } from '../src/rendering/Texture.js';

function fixture() {
  const images: HTMLImageElement[] = [];
  const removals: string[] = [];
  const doc = {
    createElement: () => {
      const image = {
        onload: null,
        onerror: null,
        naturalWidth: 64,
        naturalHeight: 64,
        removeAttribute: (name: string) => {
          removals.push(name);
        },
      } as unknown as HTMLImageElement;
      images.push(image);
      return image;
    },
  } as unknown as Document;
  const errors: Error[] = [];
  const texture = new SnowTexture(doc, (error) => {
    errors.push(error);
  });
  return { images, removals, errors, texture };
}
const png = 'data:image/png;base64,AAAA';

describe('custom snow textures', () => {
  it.each([
    'https://example.com/snow.png',
    'blob:https://example.com/snow',
    'blob:http://localhost/snow',
    'blob:null/123-abc',
    png,
    'data:image/webp;base64,AAAA',
    'data:image/jpeg;base64,AAAA',
  ])('accepts an explicit safe source %s', (value) => {
    expect(isSafeTextureSource(value)).toBe(true);
  });
  it.each([
    'http://example.com/snow.png',
    '/snow.png',
    'javascript:alert(1)',
    'data:image/svg+xml;base64,PHN2Zz4=',
    'data:text/html;base64,AAAA',
    'https://user:password@example.com/a.png',
    ' https://example.com/a.png',
    'data:image/png;base64,',
    'file:///tmp/a.png',
  ])('rejects unsafe sources %s', (value) => {
    expect(isSafeTextureSource(value)).toBe(false);
  });
  it('does no work until configured, applies remote CORS policy, and becomes ready only after loading', () => {
    const { texture, images } = fixture();
    expect(texture.status).toBe('idle');
    texture.setSource();
    expect(images).toHaveLength(0);
    texture.setSource('HTTPS://example.com/snow.png');
    const image = images[0];
    expect(texture.status).toBe('loading');
    expect(texture.image).toBeUndefined();
    expect(image?.crossOrigin).toBe('anonymous');
    expect(image?.referrerPolicy).toBe('no-referrer');
    image?.onload?.call(image, new Event('load'));
    expect(texture.status).toBe('ready');
    expect(texture.image).toBe(image);
    texture.setSource('HTTPS://example.com/snow.png');
    expect(images).toHaveLength(1);
  });
  it('ignores stale callbacks and releases resources when replaced, disabled, and destroyed', () => {
    const { texture, images, removals } = fixture();
    texture.setSource(png);
    const old = images[0];
    const stale = old?.onload;
    texture.setSource('data:image/webp;base64,AAAA');
    const current = images[1];
    stale?.call(old as HTMLImageElement, new Event('load'));
    expect(texture.status).toBe('loading');
    expect(texture.image).toBeUndefined();
    current?.onload?.call(current, new Event('load'));
    expect(texture.image).toBe(current);
    texture.setSource();
    expect(texture.status).toBe('idle');
    expect(texture.image).toBeUndefined();
    texture.destroy();
    texture.destroy();
    texture.setSource(png);
    expect(texture.status).toBe('destroyed');
    expect(images).toHaveLength(2);
    expect(removals.length).toBeGreaterThanOrEqual(2);
  });
  it('reports load failures once and retains procedural fallback without retrying every frame', () => {
    const { texture, images, errors } = fixture();
    texture.setSource(png);
    const image = images[0];
    image?.onerror?.call(image, new Event('error'));
    expect(texture.status).toBe('error');
    expect(texture.image).toBeUndefined();
    expect(errors).toHaveLength(1);
    texture.setSource(png);
    expect(images).toHaveLength(1);
    expect(errors).toHaveLength(1);
  });
  it('rejects oversize decoded dimensions and oversize/invalid source strings', () => {
    const { texture, images, errors } = fixture();
    texture.setSource(png);
    const image = images[0];
    if (image) Object.defineProperty(image, 'naturalWidth', { value: 4096 });
    image?.onload?.call(image, new Event('load'));
    expect(texture.status).toBe('error');
    expect(errors).toHaveLength(1);
    expect(isSafeTextureSource('data:image/png;base64,' + 'A'.repeat(4 * 1024 * 1024))).toBe(false);
    texture.setSource('javascript:alert(1)');
    expect(errors).toHaveLength(2);
    expect(images).toHaveLength(1);
  });
});
