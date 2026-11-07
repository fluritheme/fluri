# Customizing Fluri

Start with a preset, tune its snowfall, then opt specific surfaces into richer interactions. The core is independent of React and does not require modifying a page's layout.

Pale snow automatically receives a subtle cool outline on light solid-color backgrounds, and accumulated piles gain a cooler contour. This preserves white snow while keeping it visible on white pages. Background sampling is cached rather than performed for each flake; transparent backgrounds resolve through their ancestors. Custom snow colors remain the selected color. Image and video luminance are not analyzed.

## Tune a restrained site effect

```ts
import { createWeather } from '@fluritheme/fluri';

const weather = createWeather({
  preset: 'minimal',
  snow: {
    intensity: 0.3,
    color: '#e9f3ff',
    particleCount: 180,
    wind: { base: 0.05, gusts: true, variability: 0.15 },
    accumulation: { maxDepth: 9, growthRate: 0.35 },
  },
  accessibility: { controls: true, reducedMotion: 'respect' },
});
weather.start();
```

Intensity scales the target number of flakes. Particle count is the upper ambient budget before intensity and adaptive quality. `growthRate` changes the mass of newly created flakes rather than instantly replacing existing deposits. `maxDepth` bounds deposit capacity. Use `meltRate` for intentional gradual removal, or `clearAccumulation()` for an immediate reset.

Color values use hexadecimal notation. `dot` draws circular flakes, `soft` supports subtle glow when `glow: true`, and `crystal` draws geometric arms. Parallax varies flake depth, size, speed, opacity, and visual group. These are stylized physical controls, not calibrated measurements of real weather.

## Supply an original bitmap flake

The `snow.texture` option draws a configured image for ambient flakes while retaining physical accumulation and clumps. This example creates a real original PNG sprite locally:

```ts
const sprite = document.createElement('canvas');
sprite.width = 48;
sprite.height = 48;
const ink = sprite.getContext('2d');
if (ink) {
  ink.translate(24, 24);
  ink.strokeStyle = '#ecf8ff';
  ink.lineWidth = 2;
  ink.lineCap = 'round';
  for (let arm = 0; arm < 6; arm++) {
    ink.save();
    ink.rotate((arm * Math.PI) / 3);
    ink.beginPath();
    ink.moveTo(0, 0);
    ink.lineTo(0, -20);
    ink.moveTo(0, -12);
    ink.lineTo(-5, -16);
    ink.moveTo(0, -12);
    ink.lineTo(5, -16);
    ink.stroke();
    ink.restore();
  }
  weather.updateConfig({ snow: { texture: sprite.toDataURL('image/png') } });
}
```

Set `snow.texture: null` to restore procedural flakes. You may also use an explicit HTTPS image URL with CORS support, a blob URL, or a PNG/JPEG/WebP base64 data URI. There is no default image download. During loading or an image error, snowfall continues using its procedural shape. Listen for the `error` event to report failed sources. Keep sprites small: decoded textures above 2048 × 2048 and source strings above 4 MiB characters are rejected. A site's content security policy must permit its selected image source.

## Select exact surfaces

```html
<nav data-weather-surface data-weather-snow-depth="12" data-holiday-lights>
  <a href="/">Home</a>
</nav>
<article id="feature-card" data-weather-surface data-weather-material="sticky">
  <h2>A snowy feature</h2>
</article>
<form data-weather-ignore>
  <label>Email <input type="email" autocomplete="email" /></label>
</form>
```

For a tightly controlled integration, set `dom.detection: 'explicit'`. Add `[data-weather-surface]` only to intended supports, or call `registerSurface()`. For more automatic coverage, keep `auto` and use `dom.include`/`exclude` selectors. Exclusions apply to matching ancestors as well as the node itself, so an ignored form protects all its contents.

```ts
const card = document.querySelector<HTMLElement>('#feature-card');
if (card) {
  weather.registerSurface(card, {
    layer: 'content',
    priority: 20,
    maxSnowDepth: 16,
    material: 'sticky',
  });
}
```

Registered options take precedence over attributes. `priority` chooses which candidates fit the surface budget; it is not a CSS z-index. `layer` selects an effect group; it cannot reproduce arbitrary browser stacking contexts. Prefer explicit integration over increasing the surface budget until every DOM fragment receives snow.

## Scope an effect

```ts
const container = document.querySelector<HTMLElement>('#seasonal-preview');
if (container) {
  const preview = createWeather({ container, preset: 'winter-magic' });
  preview.start();
}
```

The container scopes discovery and clips the output to its bounds. The renderer still uses viewport overlay coordinates. Create a new instance to change the container after initialization. Use one engine for the full page where possible; multiple independent overlays increase rendering work.

## Runtime controls and saved settings

```ts
weather.setIntensity(0.8);
weather.updateConfig({ snow: { wind: { base: -0.4 } } });
weather.setPreset('christmas-night', { snow: { particleCount: 240 } });
```

A config patch merges with current values. `setPreset()` resets previous custom settings except the container, then applies its overrides. Arrays are replaced, so specify the complete desired selector list when updating `dom.include` or `exclude`.

The playground can export TypeScript or JSON settings and save configurations locally. A live `HTMLElement` is not portable JSON; preserve a scoped container through code. Configuration validation remains active after import, so malformed external settings cannot silently set infinite budgets or invalid physics values.

## Snowball workshop

```html
<section id="workshop" data-weather-surface>
  <h2>Snow workshop</h2>
  <p>Hold Shift and drag through snow. Release to throw.</p>
</section>
```

```ts
weather.updateConfig({
  interactions: {
    snowballs: { enabled: true, activation: 'press-and-drag', maxCount: 9 },
    snowman: { enabled: true },
  },
});
weather.addSnow(18, '#workshop');
```

Shift plus press gives the action a deliberate activation gesture. Existing snow is consumed as the pointer rolls a ball. Ball size follows gathered mass; it does not grow from arbitrary cursor speed alone. Compatible resting balls with decreasing radii and vertical contact form a snowman. The automatic `hover-circle` mode is available for deliberately interactive demos, but remains opt-in.

For explicit demo controls, call `trigger('snowball', { selector: '#workshop' })` or `trigger('snowman', { selector: '#workshop' })`. These manual spawns can introduce snow mass intentionally. `trigger('snowburst', { selector: '#workshop' })` breaks matching actors back into falling clumps. `clearAccumulation()` clears deposits without breaking actors.

## Christmas attachments

```html
<header data-weather-surface data-holiday-lights data-holiday-garland>
  <h1>Winter collection</h1>
</header>
<aside data-weather-surface data-holiday-ornaments data-holiday-icicles>
  <h2>Seasonal details</h2>
</aside>
<div
  id="decorative-shelf"
  data-weather-surface
  data-plough-route
  data-holiday-gifts
  data-holiday-candy-canes
>
  <span>Winter workshop</span>
</div>
```

```ts
import { christmasPack } from '@fluritheme/fluri/christmas';

const removeDecorations = weather.use(
  christmasPack({
    lights: { warmth: 0.9, color: '#ffd99d', spacing: 36, twinkle: true },
    garlands: { color: '#375d4c' },
    ornaments: { maxCount: 6, palette: ['#efa9b7', '#c3dfd4'] },
    gifts: true,
    candyCanes: true,
    icicles: true,
    frost: true,
    sparkle: false,
    wreath: false,
    plough: {
      enabled: true,
      automatic: true,
      selector: '#decorative-shelf',
      interval: 35,
      style: 'festive',
    },
  }),
);
```

An attachment attribute alone does not guarantee the element is a support: register it or add `data-weather-surface` if it is not automatically discovered. Place wreaths/gifts on decorative areas with room for them. The plugin never edits a host website's theme colors. Its palette changes effect drawings only.

To reconfigure the pack, call its disposer and register a new `christmasPack()` instance. Reusing the same name without disposal throws, which prevents duplicated plugin updates. A manual vehicle uses `trigger('plough', { selector: '#decorative-shelf', speed: 80 })`; it still requires `data-plough-route`. Choose `style: 'classic'`, `'minimal'`, or `'festive'` for the vehicle drawing. Candy canes are explicit decorative attachments rather than simulated snow particles; set `candyCanes: false` to remove them.

## Add an original plugin

This extension draws a small lantern above deliberately marked surfaces. It owns no network, input listeners, or DOM nodes.

```ts
import type { PluginContext, WeatherPlugin } from '@fluritheme/fluri';

function lanterns(): WeatherPlugin {
  let context: PluginContext | undefined;
  return {
    name: 'surface-lanterns',
    setup(next) {
      context = next;
      return () => {
        context = undefined;
      };
    },
    render(ctx) {
      for (const surface of context?.getSurfaces() ?? []) {
        if (!surface.visible || !surface.element.hasAttribute('data-lantern')) continue;
        ctx.save();
        ctx.translate(surface.x, surface.y);
        ctx.rotate(surface.angle);
        ctx.fillStyle = '#ffd699';
        ctx.fillRect(10, -13, 7, 11);
        ctx.strokeStyle = '#40546b';
        ctx.strokeRect(9, -14, 9, 13);
        ctx.restore();
      }
    },
    destroy() {
      context = undefined;
    },
  };
}

const removeLanterns = weather.use(lanterns());
```

Custom plugin coordinates use viewport CSS pixels. Read the API contract before changing surface profiles or creating clumps. Keep work bounded, respect clipping/motion preferences, and return a cleanup function for resources you create.

## Ship conservatively

Keep controls and forms unobstructed. Offer visitor pause controls, respect reduced motion, and keep festive actors on designated shelves. Test the actual host page at mobile widths, with a sticky header, while scrolling, and with dialogs open. `debug: true` helps inspect detected supports and confidence. Detailed renderer and geometry boundaries are documented in [physics and layers](./physics-and-layers.md) and [limitations](./limitations.md).
