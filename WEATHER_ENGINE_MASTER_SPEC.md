# Interactive Winter & Christmas Weather Engine for Websites

> **MASTER PRODUCT REQUIREMENTS DOCUMENT + SOFTWARE ARCHITECTURE + AI IMPLEMENTATION BRIEF**  
> Version: 1.0 — 2026-11-05  
> Status: **Design specification, not an assertion that the software is already implemented**  
> Working product name: **WinterKit** (PLACEHOLDER ONLY). No final brand, Instagram handle, npm name, or domain has been selected or verified.  
> Audience: engineers, designers, testers, AI coding agents, maintainers and marketers.

---

## 0. Instructions for a coding AI (read first)

You are building a **production-ready, framework-agnostic TypeScript npm library** that adds realistic, beautiful, interactive winter weather and Christmas-themed effects to **arbitrary websites**. The distinguishing feature is a **DOM-aware surface and layer engine**: snow gathers on top of actual visible UI surfaces (navigation bars, cards, buttons, modal panels, images and similar elements), moves when they move, falls or slides from one surface onto another, and responds to user interactions.

This document is the complete project brief; **do not assume access to the previous conversation**. Implement the project incrementally, with automated tests and a runnable playground at every milestone. Never substitute a nonfunctional animation or a one-off marketing mockup for the actual npm library.

**Operating principles:**
1. Ship **an excellent snow foundation** first, then optional Christmas modules and advanced interactions; do not try to ship all features in one untested commit.
2. Preserve website layout and functionality. All overlays must be `pointer-events: none` by default, or use non-blocking document-level event observation without stealing input. Never rewrite host DOM unnecessarily.
3. Offer **zero-config defaults** plus granular config, runtime control, per-element attributes, presets and plugin hooks.
4. Physics, browser geometry, renderers, assets, interactions and seasonal features must be modular, not one huge class.
5. Performance and accessibility are essential: efficient cached geometry, adaptive quality, reduced-motion handling, pause on hidden tab, explicit disable/cleanup.
6. Be precise about browser constraints. A web package **cannot perfectly reconstruct the browser compositor** or inspect closed shadow roots/cross-origin iframe internals; implement well-documented best-effort fallbacks and per-element overrides.
7. Do not claim numerical performance, bundle size, browser coverage, or features until measurement/tests prove them.
8. Build with semantic versioning, strong typing, stable APIs, tests, examples, docs and reproducible builds.
9. Original designs and assets only. Reference inspiration is a Mac snow-on-windows effect, but this must not copy its branding, artwork, animations or code.
10. Use a placeholder package name (`@winterkit/core`) throughout until real npm and trademark availability are confirmed. Do not publish under that name without approval.

### Definition of success

On a realistic production-like demo, snowflakes fall **in front of and behind appropriate elements**, settle on edges of visible UI, respond to scroll and moving DOM nodes, can be brushed away, roll into physically meaningful snowballs, transfer between surfaces when displaced, and can form a playful snowman. Optional plough and Christmas effects integrate with the same scene. Developers enable it in minutes and retain control over performance and behavior.

---

## 1. Vision and product positioning

**Product category:** browser-side interactive environmental effects engine distributed via npm.  
**Core tagline option:** “Let your website snow.”  
**Alternate:** “Weather that understands your website.”  
**Brand experience:** high-quality, clean, modern, memorable, cinematic, magical but not childish. Dark premium developer landing page, icy white/blue highlights, subtle purple accents, warm amber Christmas lighting, tidy typography, visually delightful physical interactions.  
**Primary audience:** web developers, design agencies, SaaS sites, holiday campaigns, ecommerce stores, personal websites, event microsites and creative coding communities.  
**Secondary audience:** creators who make shareable short-form social media demos.

### Non-negotiable product differentiators

- DOM-aware snow accumulation instead of a generic full-screen snowfall overlay.
- Geometry and visual-layer awareness, including nested components and dynamically changing layouts.
- Snow responds to window/card/button movement and can slide, drop, bounce, pile and land elsewhere.
- Cursor interactions: brushing snow off, building snowballs by circling/dragging, throwing and stacking snowballs into a snowman.
- Cute but optional autonomous animated props, including a tiny snowplough that can clear a UI shelf/toolbar.
- Rich winter + Christmas presets: snow, frost, icicles, garlands, lights, ornaments, gifts, etc.
- Runtime settings and per-element control so developers can match any site's style.
- A developer-first, framework-neutral engine; not tied to a particular site template.

### Product boundaries

**In scope:** Effects rendered in and reacting to a webpage viewport and supported DOM surfaces.  
**Out of scope for initial releases:** controlling actual macOS windows or Dock, true native desktop effects, changing OS wallpaper, arbitrarily reading cross-origin iframe internals, physically accurate 3D simulation, reading private user data, automatic weather API calls without consent/key, invasive audio autoplay or disruptive UI modification.

---

## 2. Feature catalog and priorities

Priority legend: **P0 = first practical MVP**, **P1 = launch-quality**, **P2 = advanced holiday launch**, **P3 = future / experimental**. Feature toggles must allow each optional capability to be disabled.

### 2.1 Snowfall and atmospheric weather

| Feature | Priority | Detailed behavior |
|---|---|---|
| Ambient falling snow | P0 | Variable flake sizes, shapes, depth, velocity, opacity, drift and fade-in/out. |
| Wind & gusts | P0 | Constant wind + smooth gust variation; per-particle effects based on mass. |
| Depth/parallax | P1 | Background/midground/foreground populations with different blur/scale/speed. |
| Flake types | P1 | Dots, softly glowing flakes, geometric crystals, stylized fluffy flakes; custom sprite textures. |
| Dynamic intensity | P0 | `0..1` intensity at runtime; ramp/transition rather than abrupt changes. |
| Natural accumulation | P0 | Build snow profiles across detected horizontal-ish DOM surfaces. |
| Edge overhangs | P1 | Snow bulges and soft overhang along surfaces, with configurable cap and shedding. |
| Sliding/falling deposits | P1 | When a surface accelerates, tilts or is brushed, snow detaches into particles/clumps. |
| Storm/blizzard | P2 | High density, gusts, lateral streaks, occasional screen haze; adaptive to performance. |
| Frost bloom | P2 | Optional frost/crystals around selected edges and panel corners. |
| Icicles | P2 | Grow from selected edges; optionally detach and melt. |
| Cold breath/fog | P3 | Tiny localized fog puffs, no blocking or obscuring vital UI. |
| Rain/other seasons | P3 | Architecture should support effects later; winter/Christmas prioritized now. |
| Real weather mode | P3 | Explicit opt-in location/provider adapter; never silently geolocate or call APIs. |

### 2.2 DOM / layout-aware behaviors

| Feature | Priority | Detailed behavior |
|---|---|---|
| Auto surface discovery | P0 | Inspect visible eligible UI elements and derive physical support surfaces. |
| Layer ordering | P1 | Approximate effective painting order with stacking-context and hit-test guidance. |
| Occlusion | P1 | Particles/snow do not incorrectly appear through opaque foreground overlays when feasible. |
| Clipping | P1 | Obey clipping regions, rounded rectangles, overflow/scroll containers and viewport. |
| Sticky/fixed elements | P0 | Track screen-space geometry, update after scroll/resize and layout movement. |
| Responsive layouts | P0 | Correct on viewport changes, orientation, zoom and DPR changes. |
| Transform tracking | P1 | Detect movement/rotation/scale; expose approximation limits for transforms. |
| Cross-surface transfer | P1 | Falling snow clumps can land on a lower button/card/toolbar. |
| Layout animation support | P1 | Follow moving surfaces using measured transforms/animation frames without rescanning all DOM. |
| Shadow DOM | P2 | Traverse open shadow roots when permitted; closed roots require explicit registration. |
| Iframes | P2 | Treat iframe as an opaque surface; cross-origin internals unsupported. |
| SVG | P2 | Approximate outer bounds; optionally custom explicit surfaces for complex paths. |
| Layer debug inspector | P1 | Show surface IDs, geometry, collision normals, z/occlusion estimates, clip bounds and FPS. |

### 2.3 Mouse / pointer interactions

| Feature | Priority | Detailed behavior |
|---|---|---|
| Brush snow away | P1 | Rapid cursor motion displaces nearby deposits as clumps and small flakes. |
| Snow push | P1 | Drag/sweep accumulated snow across a surface, including toward an edge. |
| Roll a snowball | P2 | Circling over snow / dragging across a deposit gathers mass into a growing ball. |
| Resize a snowball | P2 | Growth proportional to gathered snow mass; shrink by fragmentation, melting or break-apart action. |
| Throw/flick snowball | P2 | Release with pointer velocity, gravity, bounce, friction and surface collisions. |
| Stack snowballs | P2 | Place three compatible snowballs atop one another to build a snowman. |
| Snowman transformation | P2 | Once assembled, optional eyes, carrot nose, scarf and arms appear; gentle blink/wave animation. |
| Snowman interaction | P3 | Cursor proximity reactions, wave, turn, wobble or dissolve. |
| Snowball collision | P2 | Balls collide with other balls, snow piles and eligible surfaces. |
| Mouse whirl | P2 | Circular gestures create localized vortex and move flakes in a swirl. |
| Touch / pen | P2 | Support safe pointer events and gestures while preserving page scroll/click behavior. |
| Keyboard-triggered effects | P2 | Accessible manual snow-clear/pause actions in an optional control panel. |

**Important:** “Fast moving the mouse in circles changes snowball size” is a design request, not an invitation for arbitrary cursor movement to always grab control. Implement intentional, configurable detection (e.g. cursor circling near a snowball while a modifier/button is held, or explicit interactive mode). Avoid accidental snowball creation while people use the site.

### 2.4 Autonomous objects / playful events

| Feature | Priority | Detailed behavior |
|---|---|---|
| Mini snowplough | P2 | Small stylized truck traverses selected accumulated horizontal surfaces and pushes snow ahead of its blade. |
| Plough clearing path | P2 | Removed mass gets pushed to an edge/pile or becomes clumps; do not simply vanish unless stylized mode enabled. |
| Plough route planner | P2 | Select sensible accessible tracks (nav bar, page-width shelf, explicit dock-style demo bar), do not roam across interactive text. |
| Plough cadence | P2 | Interval, trigger conditions, speed, easing, route, max simultaneous vehicles and manual trigger. |
| Snow shovel icon | P3 | Alternative to truck, simple small worker/tool animation. |
| Falling snow chunks | P1 | Clumps detach from shelves when they move and fall onto lower UI. |
| Snow avalanche | P2 | At a threshold, an overhanging pile slides off as several linked clumps. |
| Footprints/tracks | P3 | Stylized temporary tracks in deep snow on decorative areas. |
| Sled / reindeer flyby | P3 | Rare holiday background/foreground event, disabled by default. |
| Sleigh delivery | P3 | Optional decorative present drop onto explicit safe decorative zones. |

### 2.5 Christmas theme catalog

| Feature | Priority | Behavior / customization |
|---|---|---|
| Christmas lights | P2 | Drape along explicitly selected edges; warm/cool/RGB themes, bulb count, flicker/twinkle, spacing. |
| Garland | P2 | Pine garlands around selected nav/header edges, with realistic sag. |
| Ornaments | P2 | Hang from supported edges; gentle spring sway, selectable palette/shape. |
| Candy canes | P2 | Occasional decorative props or special snow particle skin. |
| Gift boxes | P2 | Tiny presents on deliberate safe surfaces; optionally bounce when touched. |
| Christmas wreath | P2 | Optional overlay anchored to chosen element, never automatic over content. |
| Snowy corners | P1 | Accumulation and frost on designated card corners. |
| Star/sparkle particles | P2 | Subtle warm-white particles; configurable density and motion. |
| Holiday countdown | P3 | Explicit opt-in compact widget; localization and timezone aware. |
| Winter day/night | P2 | Temperature/color grading presets on **effects**, not globally editing host website colors. |
| Cozy glow | P2 | Optional glow around snow and ornaments, without large blur/perf cost. |
| Gingerbread / festive sprites | P3 | Asset-pack-only decorative props, explicit placement. |
| Seasonal sound | P3 | Optional, user-initiated only; muted by default and respect browser autoplay rules. |
| Christmas easter eggs | P3 | Rare snowman wave, shooting star, reindeer silhouette, clicking a gift reveals small visual burst. |

### 2.6 Theme presets

Provide composable data presets, **never hardcode physics into preset names**:
- `gentle-snow`: calm, sparse flakes, modest accumulation.
- `winter-magic`: cinematic flurries, soft glow, medium accumulation.
- `snowstorm`: strong wind, dense particles, faster surface build-up.
- `frosted-glass`: minimal falling particles, frost and snow-edge focus.
- `christmas-classic`: warm lights, garlands, moderate snow, occasional sparkle.
- `christmas-night`: cool night snow, warm lights, ornaments, delicate glow.
- `north-pole`: heavier snow, icicles, festive lights and snowman interaction.
- `minimal`: low particle budget, white/neutral palette, no auto props.
- `playful`: snowballs, snowman, plough and gesture helpers enabled on explicit demo surfaces.
- `cinematic`: depth layers + expressive snow, but performance adaptive.

Presets must support partial overrides. Allow custom JSON configuration files, save/load configuration in playground, and generate copy-paste TypeScript config snippets.

---

## 3. Detailed physics and geometry model

### 3.1 Coordinate spaces

Clearly distinguish:
- **Viewport coordinates** for particles drawn in fixed overlays.
- **Document coordinates** for optional long-lived world objects.
- **Element local coordinates** for accumulated snow and attached props.
- **Canvas device pixels** for rendering and DPR scaling.
- **Visual viewport** vs layout viewport on mobile; test pinch zoom and scroll offsets.

Use typed vector and transform helpers. Store deposited snow in **surface-local space** so it follows surfaces when they move. Convert to viewport space during collision and rendering.

### 3.2 DOM surface representation

```ts
interface Surface {
  id: string;
  element: Element;
  rect: DOMRectReadOnly;                 // cached viewport bounds
  polygon?: readonly Vec2[];             // transformed boundary approximation
  topEdge: readonly Vec2[];              // potential snow support edge
  normal: Vec2;                          // upward-facing support direction
  clipRegions: readonly ClipRegion[];
  paintGroup: number;                    // approximate ordering key
  occlusionConfidence: 'high' | 'medium' | 'low';
  material: 'flat' | 'slippery' | 'sticky' | 'no-accumulation';
  eligible: boolean;
  localSnowProfile: Float32Array;        // bins with depth/mass
  velocity: Vec2;                        // measured change between updates
  acceleration: Vec2;
  lastUpdatedAt: number;
}
```

Surface discovery heuristic: favor visible horizontal-ish top boundaries of cards, headers, sections, popovers, dialogs, buttons, floating panels, images and explicit `[data-weather-surface]` nodes; filter out tiny hidden/invisible elements, zero-area nodes, full-screen wrapper layers that cause false collisions, SVG internals without usable boundaries and overly dense overlapping child fragments. Track the minimum useful edge length; avoid placing snow over text baselines, inputs or tiny icon glyphs by default.

**Explicit override wins** over heuristics. A developer may declare `include`, `exclude`, `priority`, `accumulation`, `material`, `edge`, `layer`, `clip`, and `maxSnowDepth` on a node or via registered surfaces.

### 3.3 Layer / occlusion model

Browser CSS paint order is complex: stacking contexts from position/z-index, opacity, transforms, isolation, filters, flex/grid items, `contain`, and top-layer dialogs/popovers. `z-index` alone does not determine global layer order. `elementFromPoint()` / `elementsFromPoint()` can help sample local occlusion but are expensive and not a perfect compositor API.

**Recommended strategy:**
1. Walk the candidate DOM subtree and collect computed style, ancestors, clipping and relevant stacking-context boundaries.
2. Build an **approximate scene graph** of visual groups with cached transforms/clips.
3. Sample overlapping candidates selectively using `elementsFromPoint`, never per particle per frame.
4. Assign particles to configurable visual groups (`background`, `content`, `foreground`) and render in separate non-interactive overlay canvases when viable.
5. Clip/draw exclusion masks for simple occluders; for arbitrary complex occlusion expose `data-weather-layer` override and graceful approximation.
6. Treat native `<dialog>` top layer, browser extensions and cross-origin frames as special/opaque cases.
7. Provide debug mode showing the approximate result and any uncertain ordering.

**Do not promise** perfect interaction with all possible CSS compositing effects; document supported cases and provide custom layer hooks.

### 3.4 Particle motion

Each snow particle has position, velocity, radius, mass, drag, turbulence seed, opacity, lifetime, render group and current contact state. Use an appropriate stable simulation time step (e.g. fixed 1/60 s with accumulator and bounded catch-up steps) and interpolate at render time. Cap elapsed-time spikes after tab suspension. Basic forces: `F = gravity + wind + turbulence - drag`. Larger clumps/snowballs carry more mass and fall faster (through tuned stylized parameters, not naive real-world SI assumptions).

Use broad-phase spatial bins or an interval index to quickly find nearby surface edges. Narrow-phase collision uses swept movement/segment tests so fast particles do not tunnel through narrow shelves. Collision response depends on entity type:
- Light flake: adhere, bounce lightly or blow off, based on probability/material/speed.
- Clump: bounce/slide, fragment or attach depending on mass and impact.
- Snowball: solve bounce/friction/rolling and energy loss; remain interactive.
- Snow on moving element: inherit surface motion and release with impulse when acceleration/tilt exceeds threshold.

### 3.5 Accumulation model

Represent snow as per-edge **height/mass bins**, e.g. `Float32Array`, with stable surface-local coordinates. For each new deposit: locate bin, add mass, apply local Gaussian-like smoothing, settle under gravity, clamp `maxDepth`, and optionally flow surplus toward neighboring bins and edge. Separate internal mass from visual profile. When brushed/ploughed/tilted, subtract mass from bins and spawn corresponding particles/clumps. **Mass accounting** should be approximately conserved unless a configured evaporation/removal mode explicitly discards snow.

Surface movement: compare transformed edge geometry between frames; update attached piles with the element; when acceleration/angle exceeds a threshold, create falling clumps with inherited surface velocity. Those clumps must collide with other discovered surfaces below. Handle removed/hidden elements by either shedding their snow or disposing cleanly, configurable.

Visual snow edges: soft organic silhouette with subtle highlights/shadows, minimal blur. Potential render variants: procedural Canvas paths, mesh/triangle strip, lightweight pre-generated textures, pixel art style. Do not use a flat uniform white stripe.

### 3.6 Snowball creation and snowman mechanics

**Snowball state machine:** `idle -> gathering -> rolling -> airborne -> resting -> stacked -> broken/melted`.

Gesture mode A (preferred): user presses/holds near a pile then drags or circles; tangential movement gathers deposited snow. Gesture mode B: explicit `interactive: 'hover-circle'` detects repeated tight loops near existing balls; disabled by default to avoid accidental triggers. Estimate circularity by angular sweep around centroid and consistent radius, with time/distance thresholds. Track actual gathered mass, cap ball size, and allow shrinking by break-up, melt gesture or reverse mode. Do **not** claim that arbitrary clockwise vs anticlockwise motion universally maps to growth/shrink without clear UI discoverability; make that configurable.

Snowballs have radius derived from mass (2D visual approximation), attach to surfaces at rest, and support a physically plausible release velocity. Three compatible resting balls can stack vertically using overlap/contact tolerances; combine into a snowman prefab without changing actual DOM content. Animation includes subtle blink, scarf sway, carrot nose, optional smile/wave. Keep snowman aligned with its host surface and allow it to fall if support moves. Limit object count.

### 3.7 Snowplough

Plough is a decorative entity with a defined support route (e.g. selected toolbar/navigation edge). It spawns on a chosen side, follows an edge at configurable speed, pushes accumulated snow ahead of its blade by removing mass bins, and converts removed mass to a rolling mound that ultimately falls off an edge or gets deposited at a designated location. Use collision with temporary snow piles and avoid clipping through interactive UI.

Provide `snowplough.trigger({surface, direction})`, routes, auto triggers, probability, idle delay, one-time demo mode and cancellation. Tiny vehicle asset should be original and customizable (cartoon yellow tractor, minimalist plough, festive truck). Disable automatic plough motion with `prefers-reduced-motion` or allow a static alternative.

---

## 4. Repository architecture / folder tree

Use **pnpm workspaces** with TypeScript and project references where appropriate. Prefer a library package that builds to ESM and typings, is side-effect-free until initialized, and supports tree shaking. Start with one core package plus optional extras; split further only when justified by real use.

```text
winterkit/                           # working repo name, rename later
├── apps/
│   ├── website/                     # public marketing site, docs navigation, examples
│   │   ├── app/ or src/             # choose Next.js app router or similar
│   │   ├── components/
│   │   ├── public/
│   │   └── package.json
│   ├── playground/                  # interactive QA lab & preset editor (Vite)
│   │   ├── src/
│   │   │   ├── scenes/
│   │   │   │   ├── BasicLandingScene.tsx
│   │   │   │   ├── LayerStressScene.tsx
│   │   │   │   ├── MovingCardsScene.tsx
│   │   │   │   ├── StickyScrollScene.tsx
│   │   │   │   ├── ChristmasScene.tsx
│   │   │   │   └── MobileScene.tsx
│   │   │   ├── panels/
│   │   │   ├── debug/
│   │   │   └── main.tsx
│   │   └── package.json
│   └── promo/                        # optional capture/recording storyboard tool
├── packages/
│   ├── core/                         # installable framework-independent engine
│   │   ├── src/
│   │   │   ├── index.ts              # public exports only
│   │   │   ├── engine/
│   │   │   │   ├── WeatherEngine.ts
│   │   │   │   ├── EngineLifecycle.ts
│   │   │   │   ├── Clock.ts
│   │   │   │   ├── Scheduler.ts
│   │   │   │   └── PerformanceManager.ts
│   │   │   ├── scene/
│   │   │   │   ├── SceneGraph.ts
│   │   │   │   ├── Surface.ts
│   │   │   │   ├── SpatialIndex.ts
│   │   │   │   ├── CoordinateSpaces.ts
│   │   │   │   └── LayerManager.ts
│   │   │   ├── dom/
│   │   │   │   ├── DOMScanner.ts
│   │   │   │   ├── SurfaceDetector.ts
│   │   │   │   ├── GeometryCache.ts
│   │   │   │   ├── StyleInspector.ts
│   │   │   │   ├── ClipResolver.ts
│   │   │   │   ├── LayerResolver.ts
│   │   │   │   ├── VisibilityFilter.ts
│   │   │   │   └── DOMObserver.ts
│   │   │   ├── physics/
│   │   │   │   ├── ParticleSystem.ts
│   │   │   │   ├── Integrator.ts
│   │   │   │   ├── CollisionEngine.ts
│   │   │   │   ├── ContactSolver.ts
│   │   │   │   ├── AccumulationSystem.ts
│   │   │   │   ├── SnowTransfer.ts
│   │   │   │   ├── WindField.ts
│   │   │   │   └── GesturePhysics.ts
│   │   │   ├── effects/
│   │   │   │   ├── Effect.ts
│   │   │   │   ├── snow/
│   │   │   │   │   ├── SnowEffect.ts
│   │   │   │   │   ├── SnowEmitter.ts
│   │   │   │   │   ├── SnowAccumulation.ts
│   │   │   │   │   ├── SnowClump.ts
│   │   │   │   │   └── FrostEffect.ts
│   │   │   │   └── atmosphere/
│   │   │   │       └── WindEffect.ts
│   │   │   ├── interactions/
│   │   │   │   ├── PointerTracker.ts
│   │   │   │   ├── GestureRecognizer.ts
│   │   │   │   ├── SnowBrush.ts
│   │   │   │   ├── SnowballController.ts
│   │   │   │   └── SnowmanController.ts
│   │   │   ├── actors/
│   │   │   │   ├── Actor.ts
│   │   │   │   └── SnowploughActor.ts
│   │   │   ├── rendering/
│   │   │   │   ├── Renderer.ts
│   │   │   │   ├── CanvasRenderer.ts
│   │   │   │   ├── ParticleRenderer.ts
│   │   │   │   ├── AccumulationRenderer.ts
│   │   │   │   ├── SpriteRenderer.ts
│   │   │   │   ├── LayerCompositor.ts
│   │   │   │   └── OverlayManager.ts
│   │   │   ├── performance/
│   │   │   │   ├── QualityController.ts
│   │   │   │   └── Metrics.ts
│   │   │   ├── config/
│   │   │   │   ├── defaults.ts
│   │   │   │   ├── schema.ts
│   │   │   │   ├── validation.ts
│   │   │   │   └── presets.ts
│   │   │   ├── accessibility/
│   │   │   ├── types/
│   │   │   └── utils/
│   │   ├── tests/
│   │   │   ├── unit/
│   │   │   ├── integration/
│   │   │   ├── performance/
│   │   │   └── fixtures/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── README.md
│   ├── christmas/                    # optional separately tree-shakeable festive pack
│   │   ├── src/
│   │   │   ├── lights/
│   │   │   ├── garlands/
│   │   │   ├── ornaments/
│   │   │   ├── gifts/
│   │   │   ├── icicles/
│   │   │   ├── actors/
│   │   │   ├── presets/
│   │   │   └── index.ts
│   │   └── package.json
│   ├── react/                        # optional hooks/component wrapper
│   ├── vue/                          # future adapter
│   └── svelte/                       # future adapter
├── examples/
│   ├── vanilla-ts/
│   ├── react/
│   ├── nextjs/
│   ├── vue/
│   └── static-html/
├── docs/
│   ├── getting-started.md
│   ├── api-reference.md
│   ├── physics-and-layers.md
│   ├── customization.md
│   ├── accessibility.md
│   ├── performance.md
│   ├── browser-support.md
│   ├── troubleshooting.md
│   └── limitations.md
├── assets/
│   ├── brand/                        # original identity drafts
│   ├── sprites/                      # original snowplough, snowman, etc.
│   └── promo/                        # source assets and approved promo media
├── scripts/
│   ├── measure-bundle.mjs
│   ├── generate-api-docs.mjs
│   └── release-check.mjs
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── release.yml
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.base.json
├── vitest.workspace.ts
├── playwright.config.ts
├── eslint.config.js
├── prettier.config.js
├── README.md
├── CONTRIBUTING.md
├── CHANGELOG.md
├── SECURITY.md
└── LICENSE
```

**Do not create hundreds of placeholder files immediately.** Create modules as features are implemented and exercised. The proposed layout is a destination map; evolve it pragmatically. Avoid duplicated abstractions in `scene/`, `dom/` and `physics/`.

---

## 5. Public API design (proposed contract)

Focus on no-config use, typed options, chainable life-cycle methods where convenient, safe SSR imports and predictable cleanup.

### 5.1 Basic usage

```bash
pnpm add @winterkit/core
```

```ts
import { createWeather } from '@winterkit/core';

const weather = createWeather({
  preset: 'winter-magic',
  snow: { enabled: true, intensity: 0.7, accumulation: true },
  dom: { detection: 'auto', respectLayers: true },
});

weather.start();
```

**Note:** The package name is illustrative and not availability-checked. Before production publication, replace the placeholder consistently.

### 5.2 Full example with holiday pack

```ts
import { createWeather } from '@winterkit/core';
import { christmasPack } from '@winterkit/christmas';

const weather = createWeather({
  preset: 'christmas-night',
  container: document.body,
  autoStart: false,
  snow: {
    enabled: true,
    intensity: 0.75,
    flakeStyle: 'soft',
    wind: { base: 0.12, gusts: true, variability: 0.3 },
    accumulation: {
      enabled: true,
      maxDepth: 24,
      growthRate: 0.8,
      softness: 0.6,
      sliding: true,
      transferToLowerSurfaces: true,
    },
  },
  dom: {
    detection: 'auto',
    respectLayers: true,
    observeMutations: true,
    include: ['[data-weather-surface]'],
    exclude: ['input', 'textarea', '[data-weather-ignore]'],
  },
  interactions: {
    brush: { enabled: true, radius: 28, strength: 0.8 },
    snowballs: { enabled: true, activation: 'press-and-drag' },
    snowman: { enabled: true, requiredBalls: 3 },
    pointerVortex: { enabled: false },
  },
  performance: {
    adaptive: true,
    maxFPS: 60,
    preferredQuality: 'auto',
  },
  accessibility: { reducedMotion: 'respect', controls: true },
  debug: false,
});

weather.use(christmasPack({
  lights: { enabled: true, selector: '[data-holiday-lights]', warmth: 0.85 },
  garlands: { enabled: true, selector: '[data-holiday-garland]' },
  ornaments: { enabled: true, maxCount: 12 },
  plough: { enabled: true, automatic: false },
}));

weather.start();
weather.setIntensity(0.9);
weather.trigger('plough', { selector: '[data-plough-route]' });
```

### 5.3 Runtime API

```ts
interface WeatherController {
  start(): void;
  pause(): void;
  resume(): void;
  stop(): void;                   // stops effects, retains instance/config
  destroy(): void;                // disconnect everything and release all resources
  updateConfig(patch: DeepPartial<WeatherConfig>): void;
  setPreset(name: string, overrides?: DeepPartial<WeatherConfig>): void;
  setIntensity(amount: number): void;
  clearAccumulation(selector?: string): void;
  addSnow(amount: number, selector?: string): void;
  registerSurface(element: Element, options?: SurfaceOptions): () => void;
  unregisterSurface(element: Element): void;
  trigger(type: 'plough' | 'gust' | 'snowburst' | 'sparkle' | 'snowman', options?: unknown): void;
  getMetrics(): WeatherMetrics;
  on(event: WeatherEventName, callback: (data: unknown) => void): () => void;
}
```

Never make `createWeather()` automatically mutate the DOM during SSR/module import. Either defer all DOM operations until `start()` or accept explicit `autoStart` only in a browser context. Prefer clear async behavior for optional sprite/font loading; provide loading/ready state if relevant.

### 5.4 Declarative element control

```html
<nav data-weather-surface data-weather-snow-depth="20" data-holiday-lights>
  ...
</nav>

<button data-weather-surface data-weather-material="slippery">Get started</button>

<section data-weather-ignore>Content that must remain visually untouched</section>

<div data-weather-layer="foreground" data-weather-surface>
  A draggable modal panel
</div>

<div data-plough-route data-weather-surface>
  A demo toolbar that the mini plough can traverse
</div>
```

Attribute parsing should be typed, validated and documented; unknown attributes should not crash. Explicit `SurfaceOptions` registered through JS overrides attributes, and config defines global defaults. Define final precedence clearly: `defaults < preset < global config < attributes < registerSurface override`.

### 5.5 Hooks and events

Recommended events:
- `ready`, `start`, `pause`, `resume`, `stop`, `destroy`, `error`
- `surface:added`, `surface:removed`, `surface:updated`
- `snow:deposit`, `snow:slide`, `snow:brush`, `snow:transfer`
- `snowball:created`, `snowball:thrown`, `snowball:stacked`
- `snowman:created`, `snowman:removed`
- `plough:start`, `plough:complete`
- `quality:changed`

Throttle high-frequency events and never leak raw DOM details unless needed by the integrator. Let integrators register custom actors, emitters, materials, textures, preset objects, and effects via an extension API.

---

## 6. Rendering plan

### MVP renderer: Canvas 2D

Use a fixed, pointer-transparent overlay canvas (or a small number of layer-specific canvases) with correct DPR scaling. Render particles, snow surfaces, clumps and actors in deterministic order. Keep any DOM control panel in a separate opt-in root.

**Key constraints:**
- Do not take focus, capture pointer interactions or introduce layout shifts.
- Surface snow drawing must account for rounded corners and clipping.
- Restrict redraw and object counts, maintain typed arrays/object pools for particles where practical.
- Avoid high-cost `getComputedStyle`/layout reads in the inner particle loop.
- Default asset rendering must be original, lightweight and crisp at small screen sizes.
- Offer a low-fi look as a valid product choice (minimal flat white snow) and premium realistic look (soft 3D-like edge).

### Future renderer: WebGL/WebGPU

Introduce behind a `Renderer` interface **only after actual profiling**. Keep collision, scene and snow mass independent of graphics backend. A GPU renderer should be optional with a Canvas fallback; WebGPU is not a baseline requirement. Do not write separate physics engines per renderer.

---

## 7. Performance, accessibility, privacy and safety

### 7.1 Performance budgets (targets, not promises)

- Aim for 60 FPS on capable desktop devices during typical scenes, adapt to 30 FPS or reduced particle load under pressure.
- Define measurable particle/object/surface counts and memory budgets after profiling; initial candidates might be hundreds of light flakes and dozens of surface profiles, not unlimited particles.
- Cap work per frame, cache styles/geometry, refresh only dirty surfaces and visible viewport regions.
- Use `ResizeObserver`, `MutationObserver`, scroll listeners, visibility tracking and RAF-based coalesced updates; avoid self-induced observation loops.
- Use scene/spatial bins for broad-phase collision and sampled hit-test for scene setup/changes only.
- Stop animation when tab hidden, pause off-screen optional scenes, throttle under low power and respect data/device constraints.
- Track `frameTime`, `simTime`, `renderTime`, `geometryScanTime`, `particleCount`, `surfaceCount`, `collisionChecks`, dropped frames and approximate memory.
- Test on low-power mobile devices and content-heavy websites, not only a powerful laptop.

### 7.2 Accessibility and user experience

- Respect `prefers-reduced-motion`: auto-disable or dramatically simplify moving effects and require opt-in for intense animations.
- Allow site integrators and visitors to pause/disable via an optional accessible toggle.
- Never obscure essential text/calls-to-action beyond conservative low accumulation defaults.
- Use pointer-transparent presentation overlays; no keyboard traps, no surprise audio, no automatic focus.
- Honor pointer and touch interaction patterns; don't prevent native scrolling and button clicks.
- Support dark/light visual environments and adapt contrast of snow assets.
- Make festive props opt-in for commercial/accessibility-sensitive sites.

### 7.3 Privacy & security

- Entire basic engine runs locally in browser, with **no external analytics, tracking, geolocation, cookies or network calls** by default.
- Weather-provider integration, external textures and telemetry are optional and explicitly configured.
- Avoid dynamic HTML injection, `eval`, inline executable strings and unsafe CSS selectors derived from untrusted input.
- Publish dependency inventory, licenses, vulnerability response policy and security tests.
- Do not collect cursor motion or website content externally. Pointer history stays in short-lived local memory.

---

## 8. Test and quality plan

### Unit tests (Vitest)

- Vector math, coordinate transforms, time-step updates, particles, gravity/wind and seeded deterministic simulation.
- Collision with horizontal, tilted and moving edges; fast particles cannot tunnel through thin edges.
- Snow mass added/removed/transferred correctly (within float tolerance).
- Gesture detection thresholds, circle detection, snowball mass/radius and release impulses.
- Snowman assembly state machine and plough mass transfer.
- Preset merge precedence, option validation, event emitter unsubscribe and lifecycle cleanup.

### Browser integration tests (Playwright)

- Vanilla HTML; React re-render; Next.js hydration; Vue; Svelte adapter later.
- Nested divs, transformed elements, sticky navbar, fixed modal, `overflow:hidden`, border radius, dynamic lists, portals, open shadow roots, iframes treated opaque.
- Scroll and resize; CSS transitions; draggable panels; removed surfaces.
- Buttons remain clickable and links navigable; focus remains accessible.
- Start/pause/stop/destroy do not leak overlay nodes, observers or listeners.
- Reduced-motion, mobile viewport/DPR, touch and high contrast.

### Visual regression tests

Use deterministic PRNG seeds and frozen clock for stable screenshots. Capture:
1. First flakes vs 10s accumulation on a navbar.
2. Card sliding out and snow shedding.
3. Falling clump landing on a lower button.
4. Cursor brushing off surface snow.
5. Snowball creation and snowman assembly.
6. Tiny plough clearing a demo toolbar.
7. Christmas lights and garlands without text occlusion.
8. Debug layer and clipping/occlusion stress scene.

### Performance tests

Benchmarks at representative DOM complexity (e.g. 100/500/2000 elements) and 0/50/200 discovered candidate surfaces. Record FPS percentiles and JS main-thread time. Establish regression thresholds only after baseline measurements. Test desktop Chromium/Firefox/WebKit and representative mobile devices. Monitor bundle weight and tree shaking.

---

## 9. Implementation milestones and exit criteria

### Milestone 0 — Foundation

- pnpm workspace, TypeScript strict mode, lint/format/test, basic CI, build outputs and typed public exports.
- Playground shell with controls, realistic responsive demo landing page and layered-card test scene.
- **Exit:** `pnpm install`, `pnpm build`, `pnpm test`, `pnpm dev` work; no browser effect yet necessary.

### Milestone 1 — Snowfall engine (P0)

- Canvas renderer, deterministic particle simulation, wind, intensity, pause/resume/destroy, maxFPS, quality manager.
- **Exit:** smooth visible snowfall over static sample site; no memory leaks or clicks blocked.

### Milestone 2 — DOM geometry & accumulation (P0)

- Surface discovery, caching, top-edge extraction, deposits, snow silhouette, scroll/resize/mutation response.
- **Exit:** flakes settle on nav/cards/buttons; snow follows moved element and survives responsive changes; stable tests.

### Milestone 3 — Layers & transfer (P1)

- Scene graph, approximate occlusion, clipping, fixed/sticky/transform behavior, collision broad-phase, clump shedding and transfer.
- **Exit:** demo shows a card dragged over another; its snow sheds and falls onto lower surfaces, with reasonable stacking visuals.

### Milestone 4 — Cursor physics (P1/P2)

- Brush, push, fling, snowballs, circle gesture, growing/shrinking mechanics and snowman stacking.
- **Exit:** three snowballs form a snowman; ordinary page controls still work; mobile/reduced-motion behavior safe.

### Milestone 5 — Mini plough + Christmas pack (P2)

- Plough actor with routes and collision, garlands, lights, ornaments, icicles, sparkle and festive presets.
- **Exit:** mini plough physically clears a demo shelf; Christmas decorations respect designated surfaces and can be toggled live.

### Milestone 6 — npm-ready release

- Docs, API review, ESM/type exports, license, integration examples, polished website, browser tests, performance data, security review and release workflow.
- **Exit:** a new developer can install, enable and customize snowfall without reading internal source code.

### Milestone 7 — Launch marketing

- Short social demos, playful feature clips, benchmark disclosure, sample templates, documentation and community feedback loop.
- **Exit:** one coherent brand, working demos with reproducible effects, clear license and public install instructions.

**Stop conditions:** If a milestone fails acceptance tests, fix it before piling on additional effects. A believable physical snow transfer is more important than adding dozens of low-quality decorative toggles.

---

## 10. Playground / configuration UI

The playground is both a QA tool and a conversion driver. Design a polished dark UI with configurable snow, DOM detection, graphics, interactions and Christmas assets; live preview and exportable code.

Required panels:
- **Weather:** intensity, snow shape/size, density, wind, gusts, gravity, turbulence, parallax, glow, colors.
- **Accumulation:** enable, growth speed, max pile depth, smoothing, stickiness, shedding, transfer and melt timer.
- **Layers:** show detected surfaces, include/exclude selectors, outline surfaces, clipping, inferred layer, explicit override.
- **Interactions:** brush radius/strength, click vs hover activation, snowball gesture mode, size limits, snowman construction.
- **Actors:** snowplough select route, speed, spawn interval, manual spawn, style; snowman animations.
- **Christmas:** lights, garlands, ornaments, presents, icicles, sparkle, palette, attachment selectors.
- **Performance:** quality, max FPS, particle budget, metrics graph, benchmark scene.
- **Accessibility:** reduced-motion policy, auto-pause, pause button, low-visibility mode.
- **Presets:** save, load, compare, reset and export config as TS/JSON.

Add buttons to spawn a snowball, release snow from a card, clear all piles, trigger plough, create a holiday storm, enter debug layer and record a short demo scene (recording may be phase 2; avoid coupling capture code with core runtime).

---

## 11. Demo scenes and visually impressive interactions

1. **Premium landing page:** dark navy hero with aurora subtle haze; snow collects on navigation, buttons, card headers and pill badges. The most important first impression.
2. **Window drag:** a draggable card with snow perched on the top. A quick lateral fling causes a soft avalanche; snowlands on a second card below.
3. **Cursor brush:** cursor sweeps the snow off a card edge, leaving an irregular clean path and scattered falling clumps.
4. **Snowball workshop:** user holds and circles over an accumulation to roll a ball; faster circles collect more snow, with capped realistic growth. Reverse/shrink action is discoverable.
5. **Snowman creation:** stack three snowballs on a special demo surface; small eyes/scarf/nose appear, snowman waves and snow drifts around it.
6. **Mini plough:** yellow stylized truck drives across an optional dock-like bottom toolbar, pushing a mound of snow off the end and revealing icons.
7. **Christmas mode:** switch from neutral winter to Christmas-night: warm string lights twinkle over navbar, tiny ornaments hang from header, snow glows subtly.
8. **Layer challenge:** modal overlays a card, snow in front/behind behaves correctly for supported cases; show debug labels and mask areas.
9. **Mobile scene:** responsive snowy cards, low particle budget, safe touch interactions; no obstruction of navigation.
10. **Stress test:** dynamic 1000-element list and moving widgets with adaptive FPS and metrics display.

### Interaction animation timings (starting hypotheses)

- Snowflake fall speed/size varied continuously rather than in lockstep.
- Brush response should appear immediate within the frame budget.
- Snow accumulation should be visible over several seconds in demo mode and adjustable slower for real sites.
- Snowman assembly transformation around 300–700 ms of polished easing; allow reduced motion.
- Plough traverse ~2–5 seconds over a demo-width bar, configurable with surface size.
- Garlands/light twinkle subtle, non-seizure-inducing, asynchronous low-frequency timing.

These are tuning defaults, not requirements for physically accurate real-world timing.

---

## 12. Marketing, branding, Instagram and launch plan

### Brand constraints

The user wants a short, easy-to-remember name, preferably 4–7 letters, suitable for Instagram and npm; **no finalized identity exists**. Previously brainstormed names included **Fluri, Flova, Nivo, Flurivo, Flurrivo, SnowLayer, DriftUI and FrostFlow**. These are brainstorms only, **not confirmed available**; names like DriftUI may be used elsewhere. Do not assume rights to any name.

Current proposed Instagram positioning:
- Display line: **“Let Your Website Snow ❄️”**
- Bio concept: `❄️ Let your website snow.\n☃️ Realistic snowfall that interacts with your website.\n✨ Watch the magic happen.\n🚀 Coming soon.`
- Profile picture concept: clean centered luminous ice-blue snowflake in a dark circular mark with soft snow drift, no tiny text; must read clearly at 40px.

### Visual design system (proposed, adjust after name selection)

| Token | Suggested value | Usage |
|---|---|---|
| `night` | `#0B0F1E` | Page background |
| `surface` | `#1A2342` | Cards/dialogs |
| `frost` | `#5B7CFF` | Primary accent |
| `snow` | `#F3F7FF` | Foreground snow/text |
| `ice` | `#B8D6FF` | Ice highlights |
| `aurora` | `#B388FF` | Secondary accent |
| `warm` | `#FFB984` | Cozy Christmas lighting |

Typography: clean geometric or humanist sans (e.g. Inter/Sora or freely licensed equivalents), large bold headings, concise code examples, highly legible mobile text. Landing page should contrast **functional UI** with expressive snowy edges, not drown the entire interface in decorations. Brand logo should be abstract and ownable rather than a generic unaltered Unicode snowflake alone.

### Viral promo video storyboard (15–30 seconds, vertical 9:16)

**Hook (0–3s):** “Your website can do THIS ❄️” on a clean realistic website. Flakes start falling.

**Magic (3–7s):** close-up of snow piling naturally on navigation and feature cards; layer debug briefly reveals intelligence.

**Physics (7–11s):** drag a snowy card; its snow slides off and lands on the button below.

**Interaction (11–15s):** brush snow away with cursor; roll a growing snowball through a pile.

**Surprise (15–19s):** stack three snowballs; snowman comes to life with a quick wave.

**Delight (19–23s):** tiny snowplough drives along a demo toolbar and clears snow.

**Seasonal payoff (23–26s):** toggle Christmas mode; lights, garland, warm glow and sparkles appear.

**CTA (26–30s):** “One npm package. Entire winter.” Show real command and logo after name finalized.

Use actual screen recordings of the working engine for key interactions, not only AI-generated mockups; clearly label conceptual previews before release. Original audio/assets or properly licensed music. Alternate short-form clips can each focus on one feature: “snow falls between buttons,” “cursor makes snowballs,” “snowplough cleans your navbar,” “build a snowman on your website.”

### Product website sections

Hero with real interactive effect, single-command installation, side-by-side layer-aware demo, feature gallery, full-screen Christmas preview, API snippet, configurable playground, integration examples, performance metrics (measured), FAQ, limitations and GitHub/npm calls to action. Optional `Try snow on this page` toggle for visitors.

### Launch sequence

1. Publish development clips and ask creators which effect they'd want on their website.
2. Open waitlist/Instagram handle only once branding verified.
3. Release open playground and working core demo, gather bug reports.
4. Release npm alpha/beta with docs and migration notes.
5. Release stable after browser/compatibility testing.
6. Publish a flagship Christmas promo Reel and short TikTok/YouTube variants, link to playground and GitHub.

Avoid claims like “6 KB” or “perfect 60 FPS” until measured. Keep promotional claims honest about browser limitations.

---

## 13. Design decisions and unresolved questions (use safe defaults)

| Question | Default approach |
|---|---|
| Final brand/npm name? | Placeholder `WinterKit`; choose only after availability and trademark checks. |
| License? | Prefer MIT or Apache-2.0 for core, subject to owner decision; verify third-party assets. |
| Include React in core? | No, core DOM/browser-only with optional wrappers. |
| Bundle renderer? | Canvas 2D in MVP; optional GPU later. |
| Multiplayer/shared website state? | No; each browser has local simulation. |
| Auto-create snowman on all sites? | No; enable via preset or explicit config. |
| Auto-spawn plough everywhere? | No; demo/explicit surfaces only. |
| Effects on inputs and text? | Conservative default excludes them. |
| Is real weather location required? | No; optional later with consent and provider. |
| Can the browser fully understand every CSS layer? | No; approximate with scene graph and overrides. |
| What if the page uses closed shadow DOM? | Treat host as opaque, require explicit integration. |
| What if an element disappears? | Shed/dispose attached snow based on config, then free resources. |
| How to avoid accidental interaction? | Activation gesture with threshold or explicit interactive mode. |
| Can snowfall run inside a component instead of whole page? | Yes, support `container` option and scoped detection. |
| Should background audio autoplay? | Never. |
| How to version public config? | SemVer; support migration/deprecation notes and schema validation. |

---

## 14. AI coding agent implementation contract

### Mandatory development workflow

1. Inspect the repository and existing tools; don't overwrite completed modules without need.
2. Implement only the next milestone, with working demos and tests, before proceeding.
3. Keep changes small enough to review; use strict TypeScript without broad `any` casts.
4. Provide meaningful comments explaining geometry assumptions, browser limitations and numerical stability.
5. Write tests concurrently, especially for physics and gesture state machines.
6. Keep demo effects visually polished, but prioritize correct geometry and deterministic reproducibility.
7. Do not create fake integrations, mock npm publishing, phantom benchmarks, invented citations or pretend-completed features.
8. At the end of each milestone, report files changed, tests run, known limitations and next steps.
9. Maintain `CHANGELOG.md`, `docs/limitations.md` and `docs/api-reference.md` as capabilities evolve.
10. Never copy code, designs, logos or trademarked content from Koi/other example products without permission; build original implementations.

### First coding task to execute

Implement **Milestone 0 and a minimal vertical slice of Milestone 1**:
- Set up pnpm monorepo with `packages/core`, `apps/playground` and `apps/website` shell (website may be minimal).
- Implement typed `createWeather`, `WeatherController`, Canvas overlay management, deterministic basic snowfall, start/pause/resume/destroy, DPR/resize updates, background-tab pause and reduced-motion respect.
- Build a beautiful but functional playground with nav, cards, buttons and a few controls for snowfall intensity/wind/particle count; ensure buttons remain clickable under the canvas.
- Add Vitest unit tests for simulation and lifecycle, Playwright smoke test for overlay/pointer behavior, README with installation/running instructions.
- Ensure `pnpm install && pnpm build && pnpm test` succeeds locally and provide exact commands.
- Then propose the next milestone for DOM accumulation with design tradeoffs and specific test cases.

### Acceptance demonstration required from the coding AI

A reviewer should be able to run `pnpm dev`, see falling snow on the demo, adjust parameters live, click underlying UI, pause/resume, resize without broken rendering, and destroy the instance without leftover canvas/listeners. This is the minimal credible start toward the complete concept.

---

## 15. Future opportunities (do not block initial delivery)

- Rain, fog, pollen, autumn leaves, cherry blossoms and sand particles using the same scene/physics system.
- Heat/melting and seasonal progression (snow slowly melts; icicles drip).
- GPU-based large particle crowds where benchmarks justify it.
- Visual preset marketplace and community-contributed themes, vetted for safe assets.
- Embedded site inspector browser extension for developers (separate repo/product).
- Per-element custom collision geometry plugins and advanced shape masks.
- Physics-based wind interaction from scroll velocity or pointer swirls.
- Weather timeline sequencer: calm snowfall -> blizzard -> settle -> sunshine -> melting.
- Holiday story mode: presents arrive, snowman waves, plough visits, lights switch on.
- A/B performance and engagement tests that remain opt-in/privacy-preserving.
- Optional integration with weather APIs, explicit consent, cache and server proxy for keys.
- Tutorial generators, starter templates and hosted interactive configurator.

---

## 16. Final product requirement in one paragraph

Build a **professional, original, extensible, lightweight-as-practical npm library** that lets developers add **beautiful interactive winter and Christmas weather to existing websites** with minimal code. It must intelligently detect supported DOM surfaces and visual layers, accumulate snow along real UI edges, simulate gravity/wind/collisions/transfer across moving and nested elements, respond to cursor brushing and circling to create and manipulate snowballs, allow three snowballs to become a playful animated snowman, optionally animate a tiny snowplough clearing snow from selected UI surfaces, and offer rich customizable holiday lighting, garlands, ornaments, icicles, gifts and themed presets. Deliver a real TypeScript engine, tests, framework integrations, playground, documentation, clean branding and a marketing-ready demo — in phases, with strong performance/accessibility, honest constraints and zero accidental interference with host websites.

**End of master specification.**
