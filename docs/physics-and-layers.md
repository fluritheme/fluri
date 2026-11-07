# Physics, geometry, and visual layers

Fluri combines a deterministic particle simulation with measured browser surfaces and original Canvas drawings. Geometry is an approximation of the visible DOM. It is not a second browser compositor, and it does not create physically accurate three-dimensional snow.

## Coordinate spaces

Particles and pointer positions use **viewport CSS pixels**. Surface `x`/`y` is the start of a measured support edge; `width` is its edge length and `angle` is in radians. Attached snow is stored in **surface-local bins**, so translation or rotation moves its support rather than detaching all existing snow by default.

For edge-local coordinates `(u, v)`, viewport coordinates are:

```text
x = surface.x + u × cos(angle) - v × sin(angle)
y = surface.y + u × sin(angle) + v × cos(angle)
```

The outward/upward support normal is `(sin(angle), -cos(angle))`. Canvas drawing uses CSS pixels; the renderer separately sizes its backing stores using device pixel ratio, capped by `performance.maxDPR`. A scoped container limits discovery and clips the result, while the canvases remain viewport overlays.

## Discovery and measurement

The registry discovers explicit registrations, marked surfaces, configured include selectors, and conservative eligible UI candidates in automatic mode. It avoids excluded subtrees, invisible/tiny elements, internal Fluri nodes, and certain full-screen wrappers. The configured surface cap bounds the selected candidate set. Open shadow roots are traversed; a closed root can only be represented by an explicit external integration/host support. Iframes are opaque outer elements, not traversable documents.

`ResizeObserver` and a filtered `MutationObserver` invalidate discovery and clips. Document scroll/viewport changes also invalidate geometry. Rescans are coalesced, while the existing supports are measured as the active scene runs so moving cards, fixed elements, and sticky elements can follow their current viewport position. Geometry work is separate from the inner particle loop.

Invalidated geometry and attached snow redraw on browser animation frames even between frames skipped by `performance.maxFPS`. Lowering the physics/render cap therefore does not intentionally leave deposits behind a scrolling support. As with any main-thread canvas overlay, a blocked main thread or asynchronous compositor scroll can still cause a temporary visual mismatch.

When available, `getBoxQuads()` supplies edge endpoints. Otherwise `getBoundingClientRect()` gives an axis-aligned fallback; common affine rotate/scale cases are approximated from the transform matrix and box dimensions. Nested transforms, skew, perspective, arbitrary transform origins, complex SVG paths, and complex CSS clipping remain limited. Surface confidence labels distinguish exact available box-quad geometry from less certain fallbacks.

Resize preserves the physical local footprint of existing snow. Newly extended edges start bare. When an edge shrinks, the portion that loses support becomes falling clumps; the remaining deposit plus emitted mass conserves the original budget within floating-point tolerance. Scroll offsets are compensated separately from actual surface movement, including fixed/sticky ancestors.

## Stable simulation

The engine advances at a fixed `1/60` second step with bounded catch-up. Browser frame gaps are capped; hidden documents do not accumulate an unlimited backlog. A seeded PRNG drives particle variation, enabling reproducible numerical tests for the same seed, geometry, configuration, input, and step history. A seed alone does not freeze browser layout or user timing.

Ambient flakes vary in size, depth, opacity, velocity, and phase. Gravity, signed wind, smooth gusts, turbulence, and velocity relaxation produce stylized motion. Clumps carry independent mass and inherited support/pointer velocity. Density approaches its target gradually rather than resetting all particles when an intensity control moves.

The broad phase indexes support bounds in a grid. Narrow-phase particle collision sweeps the prior-to-current motion against profile segments, preventing fast flakes/clumps from tunneling through thin supported shelves. Clipped-away intersection points are rejected. Collision selects the earliest hit, using approximate surface paint order for near ties. Full shelves redirect excess as moving clumps rather than silently deleting overflow mass.

## Mass profiles

Each `Float32Array` profile entry stores **mass**, not depth. Bin depth is `mass / binSize`. A shared monotone cubic profile, including rounded-edge taper, drives both rendering and collision. The renderer samples this profile into separate nonzero contours; a cleared interval remains open. No sine-wave ridges or decorative silhouette noise are added. The collision solver adaptively samples the same curve.

Deposits distribute their mass through a localized bell kernel. A granular height-field solver relaxes slopes above the material’s repose threshold, transports snow downhill, and retains support-relative tangential inertia. Bulk flow leaving a support becomes coherent edge parcels. Full-shelf clumps slide along the contact surface until they find capacity or fall off an edge. Brushing, gathering, vehicle clearing, and actor breakup preserve stored mass within floating-point tolerance. A vehicle holds pushed mass until it reaches an edge, then spills clumps. Under extreme transient particle pressure, clumps can coalesce while preserving combined mass and momentum.

The following are deliberate sources or sinks, so a whole-scene mass total is not constant:

- Ambient emitters, `addSnow()`, manual bursts, and explicit actor spawning introduce snow.
- `clearAccumulation()`, stop/destruction, configured disposal, and melting remove it.
- Particles and airborne actors leaving the viewport are retired.
- Manual actor spawning consumes nearby deposits first and supplies any shortfall as an explicit source.

`getMetrics().snowMass` measures deposited profiles only. Use direct simulation tests to audit transfer; adding profile mass to particle/actor mass is necessary for a broader accounting check.

## Moving surfaces and transfer

The registry derives velocity and acceleration from measured edge movement. Attached profiles follow the support. When motion or slope makes snow unstable, the simulation removes mass from profile bins and emits clumps with inherited velocity. Lower discovered supports can accept those clumps when transfer is enabled.

`sliding` and `transferToLowerSurfaces` control this behavior. `material: 'slippery'` lowers repose and friction thresholds; `no-accumulation` prevents deposition. Removing a surface either sheds its profile or disposes it according to `dom.removedSurface`. These parameters are tuned for readable interactions, not real-world friction/temperature measurements.

## Snowballs and snowmen

A snowball's mass maps to its visual radius as `radius = sqrt(mass / π)`. Shift plus press/drag deliberately gathers mass from nearby profile bins. Pointer velocity is bounded before release. Airborne balls use gravity, damped lateral motion, support collision response, and pairwise collision impulses. A resting ball stores its support and local horizontal position. When support movement becomes unstable, it releases with inherited motion.

Three resting balls with decreasing sizes, vertical contact, and compatible horizontal alignment assemble into a snowman. The resulting actor keeps the three masses, draws a face/scarf/arms, and stays anchored to its base support. Losing support disassembles it back into airborne balls. Breakup converts its masses into clumps. Configured melting shrinks balls; lowering the maximum radius sheds excess mass as clumps.

Actor simulation is deliberately bounded: the configured ball budget includes three per snowman, the snowman budget is four, and at most two ploughs can run with one per explicit route. Rendering uses original procedural shapes, not downloaded character images. Pointer handlers never capture input and preserve native behavior outside an accepted intentional gathering gesture.

## Layers and occlusion

Fluri uses three pointer-transparent canvases for background, content, and foreground effect groups. For eligible bounded, already-positioned containers, the inert overlay is mounted inside the scene. Its backing store scrolls natively with the scene and its supports, preventing attached deposits from drifting between JavaScript redraws. Viewport-space simulation coordinates are translated by the canvas host’s actual origin when drawing. No styles are added to the container itself.

Full-document, static, transformed, oversized, and internally scrolling scopes keep the fixed viewport overlay. Their attachments refresh on invalidated browser frames, including frames between simulation FPS caps. A blocked main thread or asynchronous compositor scroll can still temporarily mismatch this fallback. The effect groups are not independently inserted browser compositing planes between every host element.

The scene assigns approximate paint-order weights from ancestor z-index values. Simple opaque discovered UI bodies are masked out of background/content effects; foreground flakes intentionally stay in front. Surface-attached drawings can use ancestor overflow/rounded-rectangle clip regions. This supports common cards, toolbars, scrolling containers, and fixed headers without expensive per-particle DOM hit testing.

The current approximation does **not** reconstruct the complete CSS stacking-context tree or perform compositor-equivalent local hit testing. Undiscovered opaque nodes cannot automatically become masks. Opacity, filters, blending, masks, `clip-path`, top-layer dialogs/popovers, nested stacking contexts, and portal arrangements may need explicit integration and can still differ from native paint order. Attached actors/plugin drawings render after the content masks; their overlap can therefore differ from the underlying DOM scene. Native top-layer elements may cover the entire Fluri overlay.

Use `data-weather-layer`, registered surface options, explicit detection, and exclusions to constrain a scene. Do not represent the visual group setting as a guarantee that snow will appear between every arbitrary pair of DOM elements. The debug mode shows detected support edges, normals, clip rectangles, IDs, assigned groups, paint-order estimates, and confidence so integration errors can be reproduced.

## Christmas composition

The optional Christmas pack shares the discovered support scene. Each ornament, light string, garland, striped candy cane, gift, wreath, crystal edge, frost accent, and localized sparkle requires an explicit matching attachment selector. The pack does not edit host text or global CSS colors. Automatic vehicles delegate to the same actor system through `PluginContext.trigger` and run on simulation time; a paused scene does not queue missed visits.

The decorations use procedural Canvas geometry. Icicle growth, twinkle, ornament sway, and snowman gestures are stylized animation. Gifts and wreaths are decorative; they are not independent rigid-body simulation objects. For supported settings, see the [API reference](./api-reference.md).

## Verification and integration limits

Unit tests exercise transforms, swept collisions, deterministic particle stepping, profile conservation, gestures, snowman assembly, actor disposal, plough clearing, and runtime option validation. Browser tests verify representative page behavior and cleanup. Neither numerical unit tests nor a single desktop screenshot certify every host site or mobile device.

Validate your actual integration under scroll, resize, DPR changes, responsive reflow, active CSS transitions, reduced-motion preferences, keyboard navigation, and open dialogs. Profile a representative page before making FPS, memory, browser-coverage, or bundle claims. See [limitations](./limitations.md) for the release's explicit boundaries.

## Cursor and scoped simulation

The brush sweeps the actual pointer segment across deposited bins, removing measured mass and emitting small parcels with cursor impulse and gravity. Freshly brushed snow temporarily excludes its source support to keep a wipe from immediately refilling itself. Nearby falling flakes receive bounded local cursor airflow. Pointer handlers preserve native input by default. Once an intentional Shift-drag actually gathers snow, selection and native dragging are suppressed only for that gesture. Shift release, pointer release/cancel, loss of focus, pause, and teardown release ownership. An integrator may explicitly mark a touch brush zone with `data-weather-interactive="brush"`; native page scrolling remains available elsewhere.

A scoped engine emits within its container’s viewport rectangle, rather than producing a whole-page population and clipping most of it away. All collision/render coordinates remain viewport coordinates. Off-container/out-of-view work is bounded by the configured budgets.

Visibility uses a bounded cache of DOM hit samples, plus explicit layer overrides. Covered support bins reject deposition. This is a practical approximation; pointer-transparent occluders and complex CSS compositing can still require explicit integration.

## Rounded shoulders and saturated snow

The visible cap rests on the actual rounded shoulder of its support, rather than joining a flat baseline across an empty corner. Its upper curve and collision curve use the same shoulder geometry. Rounded cap ends avoid the long pointed wedges produced by a simple height taper.

Detected surfaces receive a deterministic local packing profile. Capacity varies across broad drifts and smaller crests, so saturation does not force every bin to one identical height. Deposits and settling use that same capacity field; this is stored snow geometry, not noise painted over a flat physics profile. The global `maxDepth` remains an upper bound. Conservative default depth caps also account for small surface dimensions; explicit per-element depth options can override that local heuristic.
