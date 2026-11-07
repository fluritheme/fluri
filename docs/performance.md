# Performance and measurement

There is no universal FPS claim. Runtime cost depends on device, browser, scene size, styles, pointer activity, and effects.

## Work model

- Fixed 1/60-second physics steps, bounded catch-up, elapsed-time clamping after suspension.
- Deterministic PRNG and bounded flake/transient budgets.
- Spatial broad-phase collision lookup and swept narrow-phase tests.
- Cached discovery/styles, coalesced mutation/resize/scroll invalidation, per-surface geometry refresh.
- Surface-local typed-array snow profiles and mass-preserving responsive remapping.
- Three pointer-transparent Canvas 2D passes with capped DPR.
- Hidden-tab suspension, reduced-motion policy, configurable FPS, and adaptive particle quality.

`getMetrics()` returns smoothed observed FPS, frame interval, simulation/render/geometry milliseconds, particles, surfaces, collision checks, dropped catch-up frames, quality, surface mass, actor counts, and an approximate object/profile memory estimate. Memory excludes browser/canvas/GPU allocation and is not a heap measurement. Metrics remain last-observed values while paused.

`performance.preferredQuality` supports `low`, `medium`, `high`, and `auto`. With adaptive performance enabled, quality responds to measured work and late frames within the selected quality ceiling. Lower DPR, maxFPS, particleCount, and maxSurfaces for content-heavy/mobile pages. Avoid enabling all decorations on every element.

## Reproduce measurements

```sh
pnpm measure
pnpm benchmark
```

The bundle command writes `docs/bundle-report.json` with tool/method information and minified/gzip/Brotli bytes for independently bundled core and Christmas entry points. Compression values are transfer estimates, not installed package size.

The benchmark command launches local Chromium against real DOM configurations, samples frame metrics, and writes `docs/performance-report.json`. Its DOM/surface-count matrix and environment are recorded in the report. Run on representative low-power and real mobile devices before setting your own integration budget. CI browser emulation does not replace physical-device measurement.

Regression budgets should be selected from stable baselines on your own infrastructure. Neither a headless run nor a local development result certifies a public performance guarantee.

## Dense snow safeguards

With adaptive performance enabled (the default), the requested particle count is bounded by the visible scene area and by a desktop/coarse-pointer ceiling. `getMetrics().particleBudget` reports the resulting ambient budget before intensity; `particleCount` includes ambient flakes, overflow parcels, and sparkles actually alive. A request for 4,000 flakes therefore does not force 4,000 expensive particles into a small preview.

Quality now responds to late browser frames as well as measured JavaScript work. Sustained late frames reduce quality within a few frames; recovery takes sustained spare capacity. When quality falls, canvas DPR is also capped to reduce pixel/compositing cost. Per-flake canvas shadow blur is omitted in dense scenes, while contact shadows are omitted across large surface populations. Full-snow overflow parcels are bounded and coalesced with mass/momentum conservation.

Collision tests sample only the crossed portion of a support curve. Deposits reuse scratch buffers, and the renderer reuses unchanged contours. These changes avoid traversing an entire shelf and allocating fresh profile/contour work for every flake.

`performance.adaptive: false` deliberately bypasses the ambient density governor for profiling or explicit integrator control. Very large manual workloads can still be expensive. Physical-device testing is necessary before making frame-rate guarantees; headless browser timing is recorded only as a local observation.
