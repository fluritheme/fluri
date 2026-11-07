export type TextureStatus = 'idle' | 'loading' | 'ready' | 'error' | 'destroyed';
const maxSourceLength = 4 * 1024 * 1024;

/** Raster-only data URLs avoid SVG script/external-resource behavior. Remote images require HTTPS. */
export function isSafeTextureSource(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > maxSourceLength ||
    value !== value.trim()
  )
    return false;
  if (/^data:image\/(?:png|jpeg|webp);base64,[a-z\d+/]+={0,2}$/i.test(value)) return true;
  try {
    const url = new URL(value);
    if (url.username || url.password) return false;
    if (url.protocol === 'https:') return true;
    if (url.protocol === 'blob:') {
      if (/^blob:null\/[a-z\d-]+$/i.test(value)) return true;
      const origin = new URL(value.slice(5));
      return (
        !origin.username &&
        !origin.password &&
        (origin.protocol === 'https:' || origin.protocol === 'http:')
      );
    }
  } catch {
    return false;
  }
  return false;
}

/** Owns exactly one asynchronous load. Stale callbacks cannot resurrect a disposed texture. */
export class SnowTexture {
  private requested: string | undefined;
  private pending: HTMLImageElement | undefined;
  private drawable: HTMLImageElement | undefined;
  private generation = 0;
  private currentStatus: TextureStatus = 'idle';
  constructor(
    private readonly doc: Document,
    private readonly onError: (error: Error) => void = () => {},
  ) {}
  get status(): TextureStatus {
    return this.currentStatus;
  }
  get image(): HTMLImageElement | undefined {
    return this.drawable;
  }

  setSource(source?: string): void {
    if (this.currentStatus === 'destroyed' || this.requested === source) return;
    this.clearImage();
    this.requested = source;
    if (source === undefined) {
      this.currentStatus = 'idle';
      return;
    }
    if (!isSafeTextureSource(source)) {
      this.fail(new TypeError('Snow texture must be a safe HTTPS, blob, or raster data URL'));
      return;
    }
    const image = this.doc.createElement('img');
    const generation = this.generation;
    this.pending = image;
    this.currentStatus = 'loading';
    image.decoding = 'async';
    image.referrerPolicy = 'no-referrer';
    if (new URL(source).protocol === 'https:') image.crossOrigin = 'anonymous';
    image.onload = () => {
      if (generation !== this.generation || this.currentStatus === 'destroyed') return;
      if (
        image.naturalWidth <= 0 ||
        image.naturalHeight <= 0 ||
        image.naturalWidth > 2048 ||
        image.naturalHeight > 2048
      ) {
        this.fail(new RangeError('Snow texture dimensions must be between 1 and 2048 pixels'));
        return;
      }
      image.onload = null;
      image.onerror = null;
      this.drawable = image;
      this.pending = undefined;
      this.currentStatus = 'ready';
    };
    image.onerror = () => {
      if (generation !== this.generation || this.currentStatus === 'destroyed') return;
      this.fail(
        new Error(
          'Snow texture failed to load or was blocked by CORS or the site content security policy',
        ),
      );
    };
    image.src = source;
  }
  private fail(error: Error): void {
    this.clearImage();
    this.currentStatus = 'error';
    this.onError(error);
  }
  private clearImage(): void {
    this.generation++;
    for (const image of [this.pending, this.drawable])
      if (image) {
        image.onload = null;
        image.onerror = null;
        image.removeAttribute('src');
      }
    this.pending = undefined;
    this.drawable = undefined;
  }
  destroy(): void {
    if (this.currentStatus === 'destroyed') return;
    this.clearImage();
    this.requested = undefined;
    this.currentStatus = 'destroyed';
  }
}
