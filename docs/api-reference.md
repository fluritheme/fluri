# Fluri API reference

Fluri is a browser effects engine distributed as ESM with TypeScript declarations. The core entry point is `@themes/fluri`; the optional decoration factory is `@themes/fluri/christmas`. Importing either entry point is safe during server rendering. Call `start()` only after a browser document has a connected body.

## Creating an instance

```ts
import { createWeather } from '@themes/fluri';

const weather = createWeather({
  preset: 'winter-magic',
  snow: { intensity: 0.65 },
  accessibility: { controls: true },
});
weather.start();
```

`createWeather(options?: WeatherOptions): WeatherController` validates configuration synchronously. `WeatherOptions` is a deep partial of `WeatherConfig`. Unknown configuration fields, invalid enum values, non-finite numbers, out-of-range numbers, and incompatible size bounds throw. Configuration objects cannot contain `__proto__`, `constructor`, or `prototype` merge keys.

The engine starts only when `start()` is called, unless `autoStart: true` is supplied in a browser. No network requests, geolocation, analytics, cookies, or audio are part of core initialization.

## Controller

| Method                                           | Behavior                                                                                                                                                                |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `start(): void`                                  | Initializes the renderer, observers, input observation, and registered plugins, then starts the simulation. Repeated calls while running do nothing.                    |
| `pause(): void`                                  | Freezes the current scene and releases an active snowball gesture.                                                                                                      |
| `resume(): void`                                 | Resumes a paused or stopped instance; initializes it if necessary.                                                                                                      |
| `stop(): void`                                   | Clears core particles, deposits, and actors; keeps the configuration and instance available for restart.                                                                |
| `destroy(): void`                                | Disconnects observers/listeners, disposes plugins, removes canvases and visitor controls, and releases state. Safe to repeat. Create a new instance afterward.          |
| `updateConfig(patch): void`                      | Validates and deeply merges a patch into the current configuration. Arrays replace earlier arrays. Changing the container after initialization requires a new instance. |
| `getConfig(): WeatherConfig`                     | Returns a configuration copy. Mutating it does not configure the engine.                                                                                                |
| `setPreset(name, overrides?): void`              | Resolves defaults plus the selected preset plus overrides; preserves the current container. Other prior customizations are reset.                                       |
| `setIntensity(amount): void`                     | Validates intensity in `0..1`; particle density approaches the requested value smoothly.                                                                                |
| `clearAccumulation(selector?): void`             | Explicitly removes deposited snow on matching discovered surfaces. Does not remove snowballs.                                                                           |
| `addSnow(amount, selector?): void`               | Adds an organic deposit of up to `amount` CSS pixels, bounded by surface/global depth limits. Amount is `0..80`.                                                        |
| `registerSurface(element, options?): () => void` | Explicitly includes an eligible element and returns its unregister callback. May be called before `start()`.                                                            |
| `unregisterSurface(element): void`               | Removes registration and excludes the element from subsequent automatic discovery for this instance.                                                                    |
| `trigger(type, options?): void`                  | Runs a manual weather or actor action; see below.                                                                                                                       |
| `getMetrics(): WeatherMetrics`                   | Returns a metrics snapshot.                                                                                                                                             |
| `on(event, callback): () => void`                | Subscribes to an event and returns an unsubscribe function. Callback payloads are `unknown`; narrow them before use.                                                    |
| `use(plugin): () => void`                        | Registers a uniquely named plugin and returns its disposer. Before startup, setup is deferred until initialization.                                                     |

Methods other than idempotent destruction and read-only snapshots generally require a live, undestroyed instance. Invalid CSS selectors throw when validated in the browser. Runtime patches do not mutate a host page's layout or copy configuration into its markup.

## Configuration schema

The defaults below are the effective result of `resolveConfig()`, which applies the default `gentle-snow` preset. `defaults` is the underlying base object; `resolveConfig(options)` is the authoritative way to inspect resolved settings.

### General and snowfall

| Path                       | Effective default | Accepted values                                                                             |
| -------------------------- | ----------------- | ------------------------------------------------------------------------------------------- |
| `preset`                   | `'gentle-snow'`   | A preset listed below                                                                       |
| `autoStart`                | `false`           | Boolean                                                                                     |
| `seed`                     | `20261105`        | Integer `0..4294967295`                                                                     |
| `container`                | Document body     | Connected `HTMLElement` when supplied                                                       |
| `snow.enabled`             | `true`            | Boolean                                                                                     |
| `snow.intensity`           | `0.4`             | `0..1`                                                                                      |
| `snow.particleCount`       | `360`             | Integer `0..4000`; density budget before intensity/quality scaling                          |
| `snow.flakeStyle`          | `'soft'`          | `'soft'`, `'dot'`, `'crystal'`                                                              |
| `snow.color`               | `'#f3f7ff'`       | Hex color                                                                                   |
| `snow.texture`             | Unset             | Explicit HTTPS/blob URL or PNG/JPEG/WebP base64 data URI; `null` restores procedural flakes |
| `snow.minSize` / `maxSize` | `0.8` / `3.2`     | Minimum `0.2..20`, maximum `0.2..30`; minimum must not exceed maximum                       |
| `snow.gravity`             | `85`              | `0..1500`, stylized acceleration                                                            |
| `snow.turbulence`          | `0.55`            | `0..5`                                                                                      |
| `snow.glow`                | `false`           | Boolean                                                                                     |
| `snow.parallax`            | `true`            | Boolean; varies particle depth and visual groups                                            |
| `snow.wind.base`           | `0.08`            | `-5..5`; signed lateral wind control                                                        |
| `snow.wind.gusts`          | `true`            | Boolean                                                                                     |
| `snow.wind.variability`    | `0.3`             | `0..5`                                                                                      |

A custom texture is loaded only when explicitly configured. Remote HTTPS images use anonymous CORS and a no-referrer policy; their server must allow cross-origin image use. The engine uses procedural flakes until decoding succeeds and after load failure. Failures emit `error` with source `texture` while snowfall continues. Repeated frames do not retry a failed source; replace or disable it before retrying. Source strings are capped at 4 MiB characters, decoded dimensions at 2048 × 2048. Data URLs accept raster formats only; SVG data and arbitrary URL schemes are rejected. Destroying/replacing the texture removes pending callbacks and image sources. Image loading still obeys the host site's CSP.

### Accumulation

| Path under `snow.accumulation` | Default | Accepted values                                         |
| ------------------------------ | ------- | ------------------------------------------------------- |
| `enabled`                      | `true`  | Boolean                                                 |
| `maxDepth`                     | `14`    | `0..80` CSS pixels                                      |
| `growthRate`                   | `0.8`   | `0..10`; affects mass of newly emitted flakes           |
| `softness`                     | `0.6`   | `0..1`; conservative mass smoothing                     |
| `sliding`                      | `true`  | Boolean                                                 |
| `transferToLowerSurfaces`      | `true`  | Boolean; clumps may collide with lower supports         |
| `meltRate`                     | `0`     | `0..10` CSS pixels per second; intentional mass removal |

### DOM discovery

| Path under `dom`   | Default                                                                     | Accepted values                                                      |
| ------------------ | --------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `detection`        | `'auto'`                                                                    | `'auto'` or `'explicit'`                                             |
| `respectLayers`    | `true`                                                                      | Boolean; enables approximate body masks and collision grouping       |
| `observeMutations` | `true`                                                                      | Boolean                                                              |
| `include`          | `['[data-weather-surface]']`                                                | Up to 32 CSS selectors, each 1–512 characters                        |
| `exclude`          | `['input','textarea','select','[contenteditable]','[data-weather-ignore]']` | Same selector limits; also excludes descendants matching `closest()` |
| `maxSurfaces`      | `160`                                                                       | Integer `0..500`                                                     |
| `removedSurface`   | `'shed'`                                                                    | `'shed'` or `'dispose'`                                              |

Automatic candidates include navigation, headers, buttons, articles, asides, figures, images, dialogs, sections, `.card`, and `[role="dialog"]`. Invisible, tiny, excluded, and certain full-screen wrapper candidates are filtered. Open shadow roots are traversed. Closed shadow roots and iframe internals are not inspected.

### Interactions

| Path under `interactions`           | Default            | Accepted values                                                    |
| ----------------------------------- | ------------------ | ------------------------------------------------------------------ |
| `brush.enabled`                     | `true`             | Boolean                                                            |
| `brush.radius`                      | `28`               | `1..200` CSS pixels                                                |
| `brush.strength`                    | `0.8`              | `0..5`                                                             |
| `brush.activation`                  | `'hover'`          | `'hover'` or `'press'`                                             |
| `snowballs.enabled`                 | `false`            | Boolean                                                            |
| `snowballs.activation`              | `'press-and-drag'` | `'press-and-drag'` or explicit opt-in `'hover-circle'`             |
| `snowballs.minRadius` / `maxRadius` | `6` / `36`         | Minimum `2..50`, maximum `4..100`; minimum must not exceed maximum |
| `snowballs.maxCount`                | `12`               | Integer `0..32`; snowmen count as three balls                      |
| `snowman.enabled`                   | `false`            | Boolean                                                            |
| `snowman.requiredBalls`             | `3`                | Exactly `3`                                                        |
| `pointerVortex.enabled`             | `false`            | Boolean                                                            |

Hold **Shift**, press near a pile or existing ball, and drag to gather snow or carry the ball. Releasing throws it with bounded pointer velocity. A near-circular gesture only activates automatically in the explicitly selected `hover-circle` mode. Gathering consumes deposited mass. Compatible resting balls can form a three-part snowman; `snowburst` breaks actors into conserved falling clumps. Melting also shrinks actors when configured. Accepted Shift gathering suppresses text selection and native dragging only for the active gesture. Ordinary scrolling, selection, and native controls remain available; releasing Shift, cancelling the pointer, or losing focus releases the gesture.

### Performance and accessibility

| Path                           | Default     | Accepted values                                                                                  |
| ------------------------------ | ----------- | ------------------------------------------------------------------------------------------------ |
| `performance.adaptive`         | `true`      | Boolean                                                                                          |
| `performance.maxFPS`           | `60`        | Integer `10..120`; upper scheduling target                                                       |
| `performance.preferredQuality` | `'auto'`    | `'auto'`, `'low'`, `'medium'`, `'high'`                                                          |
| `performance.maxDPR`           | `2`         | `1..3`                                                                                           |
| `accessibility.reducedMotion`  | `'respect'` | `'respect'` suspends animation, `'reduce'` lowers particle quality, `'ignore'` opts out          |
| `accessibility.controls`       | `false`     | Boolean; adds an accessible visitor pause button                                                 |
| `debug`                        | `false`     | Boolean; outlines supports with IDs, normals, clip bounds, paint-order estimates, and confidence |

Hidden documents suspend animation automatically. Reduced particle quality does not guarantee every custom plugin motion is reduced; custom plugins must read the configuration and honor the visitor's motion preference.

## Presets and merge precedence

Preset names are `gentle-snow`, `winter-magic`, `snowstorm`, `frosted-glass`, `christmas-classic`, `christmas-night`, `north-pole`, `minimal`, `playful`, and `cinematic`. Presets are composable data, not separate physics engines. Christmas-named presets configure core snowfall; install the Christmas plugin for decorations.

Configuration precedence is **base defaults → preset → instance options → element attributes → registered surface options**. Global accumulation disable and global depth capacity still apply to every surface. `updateConfig()` patches the current resolved configuration; use `setPreset()` when a reset is intended.

Public helper exports include `presets`, `presetNames`, `defaults`, `resolveConfig(options)`, and `validateConfig(fullConfig)`. Validation expects a complete config; resolution accepts partial options.

## Per-surface controls

| `SurfaceOptions` | Markup attribute                    | Meaning                                                        |
| ---------------- | ----------------------------------- | -------------------------------------------------------------- |
| `priority`       | `data-weather-priority`             | Candidate selection priority                                   |
| `accumulation`   | `data-weather-accumulation="false"` | Enable/disable deposits                                        |
| `material`       | `data-weather-material`             | `'flat'`, `'slippery'`, `'sticky'`, `'no-accumulation'`        |
| `edge`           | `data-weather-edge="bottom"`        | Support top or bottom edge                                     |
| `layer`          | `data-weather-layer`                | `'background'`, `'content'`, `'foreground'` visual group       |
| `clip`           | `data-weather-clip="false"`         | Disable attached snow/actor ancestor clipping when intentional |
| `maxSnowDepth`   | `data-weather-snow-depth`           | Surface depth cap `0..80`                                      |

`data-weather-surface` explicitly includes a candidate. `data-weather-ignore` excludes an entire subtree by default. `data-plough-route` marks a deliberately selected vehicle route and must also belong to a discovered surface. Invalid/unknown markup values are ignored or bounded; registered options are validated.

```ts
const shelf = document.querySelector<HTMLElement>('#snow-shelf');
if (shelf) {
  const unregister = weather.registerSurface(shelf, {
    priority: 10,
    material: 'slippery',
    maxSnowDepth: 24,
  });
  // Call unregister() when this integration no longer owns the shelf.
}
```

## Manual triggers

`TriggerOptions` supports `selector`, `surface`, `direction: 'left' | 'right'`, viewport `x`/`y`, `radius`, plough `speed`, and `style: 'classic' | 'minimal' | 'festive'`. A supplied element takes precedence over a selector. Coordinates must be finite. Selectors choose already discovered/registered supports; they do not scan arbitrary nodes on demand.

| Trigger       | Result                                                                                                                      |
| ------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `'gust'`      | Temporary wind impulse                                                                                                      |
| `'snowburst'` | Radial flakes and breakup of matching snowballs/snowmen into clumps                                                         |
| `'sparkle'`   | Short-lived decorative particles; also notifies plugins                                                                     |
| `'snowball'`  | Spawns one enabled snowball, optionally attached to a selected support                                                      |
| `'snowman'`   | Creates three compatible enabled balls on a selected support and assembles them                                             |
| `'plough'`    | Traverses a visible explicit `data-plough-route`; direction defaults right; speed is bounded to `10..600` CSS pixels/second |

Manual ball/man spawning is an **explicit mass source**, like `addSnow()`: it reuses deposits first and supplies any shortfall. Interactive gathering, plough clearing, actor breakup, and surface transfer move existing mass. A plough cannot automatically roam unrelated controls; at most two vehicles and one per route can be active. Vehicle styles are `'classic'` (yellow utility truck), `'minimal'` (neutral gray without a beacon), and `'festive'` (cranberry body, pine roof, and warm decorative lights). Style changes rendering without altering clearing physics.

```ts
weather.trigger('snowball', { selector: '#workshop', radius: 16 });
weather.trigger('plough', { selector: '#toolbar', direction: 'left', speed: 90 });
weather.trigger('snowburst', { selector: '#workshop' });
```

## Metrics

`getMetrics()` returns `state`, `fps`, `frameTime`, `simTime`, `renderTime`, `geometryScanTime`, `particleCount`, `surfaceCount`, `collisionChecks`, `droppedFrames`, `quality`, `snowMass`, `snowballCount`, `snowmanCount`, and `approximateMemory`.

Timing fields use milliseconds; FPS is a smoothed observation. `snowMass` counts **surface profiles only**; it excludes particles and actors. `approximateMemory` is a calculated estimate of selected engine structures, not a browser heap measurement. Quality is a scaling factor. Dropped frames count simulation catch-up overruns, not every missed browser refresh. These observations do not establish a universal device performance guarantee.

## Events

| Events                                                 | Typical payload                                                           |
| ------------------------------------------------------ | ------------------------------------------------------------------------- |
| `ready`, `start`, `pause`, `resume`, `stop`, `destroy` | Lifecycle notification                                                    |
| `error`                                                | Source/error details; inspect defensively                                 |
| `surface:added`, `surface:removed`, `surface:updated`  | `{ id }`                                                                  |
| `snow:deposit`, `snow:transfer`                        | Aggregated `{ count }`                                                    |
| `snow:brush`                                           | Throttled `{ mass }`                                                      |
| `snow:slide`                                           | Surface shedding notification when reported by the engine or an extension |
| `snowball:created`                                     | `{ id, mass }`                                                            |
| `snowball:thrown`                                      | `{ id, vx, vy }`                                                          |
| `snowball:stacked`                                     | `{ id }`                                                                  |
| `snowman:created`                                      | `{ surfaceId, mass }`                                                     |
| `snowman:removed`                                      | `{ surfaceId, reason? }`                                                  |
| `plough:start`                                         | `{ surfaceId, direction }`                                                |
| `plough:complete`                                      | `{ surfaceId, mass }`                                                     |
| `quality:changed`                                      | `{ quality }`                                                             |

Payloads intentionally remain extensible. Do not depend on every individual flake producing an event. Surface updates and debug identities reflect a live approximation, not stable DOM identifiers across instances.

## Optional Christmas pack

```ts
import { christmasPack } from '@themes/fluri/christmas';

const disposeChristmas = weather.use(
  christmasPack({
    lights: { enabled: true, selector: '[data-holiday-lights]', warmth: 0.85 },
    garlands: true,
    ornaments: { maxCount: 8, palette: ['#ef9fae', '#b6dfd0'] },
    gifts: false,
    plough: { enabled: true, automatic: true, selector: '#toolbar', interval: 30, speed: 80 },
  }),
);
```

Every decoration requires a matching **discovered surface**. Decorative options default to enabled with explicit attachment attributes; set a feature to `false` to disable it. The automatic plough defaults to disabled.

| Option       | Default selector             | Additional settings                                                                                                                                   |
| ------------ | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lights`     | `[data-holiday-lights]`      | `warmth: 0..1`, `spacing: 16..100`, hex `color`, `twinkle`                                                                                            |
| `garlands`   | `[data-holiday-garland]`     | Hex `color`                                                                                                                                           |
| `ornaments`  | `[data-holiday-ornaments]`   | `maxCount: 0..64`, nonempty hex `palette`                                                                                                             |
| `candyCanes` | `[data-holiday-candy-canes]` | Attachment settings                                                                                                                                   |
| `gifts`      | `[data-holiday-gifts]`       | Attachment settings                                                                                                                                   |
| `wreath`     | `[data-holiday-wreath]`      | Attachment settings                                                                                                                                   |
| `icicles`    | `[data-holiday-icicles]`     | Attachment settings                                                                                                                                   |
| `frost`      | `[data-holiday-frost]`       | Attachment settings                                                                                                                                   |
| `sparkle`    | `[data-holiday-sparkle]`     | Attachment settings                                                                                                                                   |
| `plough`     | `[data-plough-route]`        | `automatic`, `interval: 5..3600`, `idleDelay: 0..3600`, `speed: 10..600`, `direction`, `style` (`classic`, `minimal`, `festive`), `probability: 0..1` |

Each feature accepts a boolean or an object with `enabled` and `selector`; extra settings apply as listed. Shared `palette` accepts 1–16 hex colors. Unknown settings and malformed colors/numbers throw before animation starts. Selectors are syntax-checked during browser setup. Plough timing uses seconds of simulated active time, so paused/hidden time does not queue vehicles. Lights, pine foliage, baubles, striped candy canes, presents, wreaths, crystals, and the vehicle are original procedural Canvas drawings. No external image/audio fetch is required.

## Extension API

```ts
interface WeatherPlugin {
  name: string;
  setup?(context: PluginContext): void | (() => void);
  update?(dt: number, time: number): void;
  render?(ctx: CanvasRenderingContext2D, time: number): void;
  trigger?(type: TriggerType, options: TriggerOptions): void;
  destroy?(): void;
}
```

`dt` and `time` use seconds. Render coordinates are viewport CSS pixels; Fluri applies DPR scaling. A plugin can obtain current config/surfaces, emit a defined event, spawn a clump, and, on an engine-provided context, call `context.trigger?.(type, options)`. `getSurfaces()` exposes live engine objects: inspect them carefully; mutating profiles makes the plugin responsible for mass accounting and bounds. Do not store raw user pointer history or page content externally.

Setup may return cleanup, and `destroy()` can release additional state. Plugin names must be unique within an instance. Dispose before replacing a plugin with the same name. Keep canvas `save()`/`restore()` balanced and avoid host-DOM mutation, blocking input, per-particle layout reads, or network behavior unless explicitly configured by the site integrator.

## React

`@themes/fluri-react` exports `useFluri(options?, onReady?)` and `<Fluri options={...} onReady={...} />`. Both own an instance for the mounted lifetime and destroy it on unmount, including React Strict Mode replay. Render them from a client component. The hook returns a ref-like `{ current: WeatherController | null }`; the controller becomes available after mounting. Keep options stable when practical; changed options are applied through `updateConfig()`.

`getMetrics().textureStatus` reports `idle`, `loading`, `ready`, `error`, or `destroyed` for the optional snow texture. Loading is asynchronous; procedural flakes render until decoding succeeds.

### Updated snow behavior

`addSnow(depth, selector?)` is a manual source whose intended mass is mean depth × support width, limited by physical capacity. A deterministic per-invocation seed produces different broad drifts across supports. `snow:slide` reports actual detached mass; resize events include `reason: 'resize'` and motion events use `reason: 'motion'`. Shrinking supports shed the unsupported portion, while growing edges start bare. Desktop brush activation follows pointer movement or a held pointer according to configuration. Non-mouse brushing additionally requires an explicit `data-weather-interactive="brush"` interaction zone; overlays remain passive.

`getMetrics().particleBudget` is the effective ambient particle budget before snowfall intensity. With adaptive performance enabled it can be lower than the requested `snow.particleCount`, based on scene area, pointer/device class, and measured frame pressure. Saturated surface capacities vary through a deterministic packing profile while remaining below the configured maximum.
