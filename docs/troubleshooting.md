# Troubleshooting

**No snowfall:** call `start()` in the browser after the body exists. Check the reduced-motion preference, document visibility, `snow.enabled`, intensity, particle budget, and controller metrics. Respect mode intentionally schedules no animation for reduced-motion visitors.

**No accumulation:** use explicit `data-weather-surface` targets or `registerSurface()`, check accumulation settings/material, and enable debug mode. Surface discovery excludes inputs, ignored subtrees, tiny/hidden nodes, and full-screen automatic wrappers. Increase snowfall or use `addSnow(8)` to inspect geometry immediately.

**Snow is behind/over a modal:** native top-layer dialogs paint above document overlays. This is a browser boundary, not a global z-index competition. Ordinary DOM layer ordering is approximate; see limitations and explicit layer controls.

**Snow follows an unexpected edge:** inspect transformed geometry in debug mode, simplify nested/skew/perspective transforms, or register a supported explicit surface. Surface snow is stored in local bins.

**Config import fails:** imports are validated atomically, including unknown keys, ranges, cross-field limits, selectors when a browser document exists, and prototype-pollution keys. Export a current config and edit supported fields. `container` is a DOM reference and should not be included in JSON.

**Snowballs do not appear:** enable snowballs, add deposits, then hold Shift and press-drag near a pile. Gestures deliberately avoid ordinary site use. Use explicit spawn controls on touch devices; maxCount bounds all active snowballs/snowmen.

**Plough does nothing:** route surfaces need `data-plough-route`, active accumulation, a supported near-horizontal edge, and actual stored snow to clear. Only a bounded number run simultaneously. Auto-plough is opt-in through the Christmas plugin.

**CPU is high:** reduce particleCount/maxSurfaces/maxDPR/maxFPS, keep adaptive quality enabled, disable costly decorations, and inspect live geometry/render times. Moving DOM nodes still need geometry reads; complicated host styles can dominate cost.

**Changing a container fails:** this is intentional. Destroy and recreate with the new container rather than moving a live engine between coordinate spaces.

**Destroyed instance cannot restart:** `destroy()` is final and idempotent. Create a new controller; use `stop()` when you want to retain the instance.

**Local website links:** run `pnpm dev` and `pnpm dev:website` for both development servers. Use `pnpm build && pnpm preview` for the combined production layout.
