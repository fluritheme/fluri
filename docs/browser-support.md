# Browser support

The runtime requires modern ESM, Canvas 2D (`roundRect`), requestAnimationFrame, typed arrays, ResizeObserver, MutationObserver, Pointer Events, DOMMatrixReadOnly, matchMedia, and standard DOM geometry. Older browsers without these APIs are not supported.

Automated integration tests target the bundled Playwright Chromium, Firefox, and WebKit engines plus a Chromium mobile viewport/DPR profile. Exact execution results and versions belong in verification reports. A passing WebKit run is not a claim that every Safari/macOS/iOS release is covered. Physical iOS/Android and assistive-technology verification remain separate integration checks.

Core imports do not access the DOM. `createWeather()` can construct an idle SSR controller; `start()` requires an attached browser document. The React adapter starts inside effects and cleans up through unmount/Strict Mode replay.

Canvas sizing follows viewport changes and caps device-pixel ratio. Visual viewport resize/scroll events invalidate geometry. Affine transform/paint ordering fallbacks have browser-specific confidence; use debug mode and explicit overrides for complex layouts. See [limitations](limitations.md).
