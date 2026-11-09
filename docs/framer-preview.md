# Winter for Framer preview

The public demonstration lives at https://winter.fluri.xyz/framer/. It is prepared for a paid Framer integration around the existing free MIT engine. Sales remain marked **Coming soon** until native Framer and checkout validation are complete.

The original product workspace is maintained separately from this public engine repository. The `apps/website/public/framer/` directory contains its generated demonstration, screenshots, guide and pinned engine only. It contains no customer-delivery ZIP or payment credentials. Folder-specific notices identify the new presentation materials; the engine and third-party MIT/OFL licenses remain intact.

## Runtime

- Engine: `@fluritheme/fluri@0.1.1`, bundled with its dependencies.
- URL: `https://winter.fluri.xyz/framer/runtime/winter-0.1.1.mjs`
- SHA-256: `1e64052dc723eabadf7d9e3dfbd6cbc4104c8d3339f2c6fbff2cf9dede29b355`
- Engine and bundled Zod notices: `/framer/runtime/THIRD-PARTY.txt`.
- CORS is enabled only for the public runtime path so a Framer page can import the pinned module.
- Runtime and content-hashed demonstration assets use immutable caching. Publish a new runtime filename when changing that runtime; do not replace it in place.

The adapter loads this runtime on the client only. Its static editor/export mode does not fetch or start the simulation. The public demonstration uses a local Framer API boundary in React 18, so it does not certify the native Framer editor.

## Verification

The separate product checks cover server rendering without DOM globals, static rendering, React Strict Mode, duplicate ownership, hidden breakpoint handoff, enable/disable and unmount cleanup, color controls, independent section scopes, reduced motion, runtime loading failure, demo controls, restart, and widths down to 320px. Chromium and WebKit are exercised. Native Framer and checkout validation are still pending account/browser access.

Previews are captured from the actual runnable React demonstration, not a fabricated Framer editor. The hero title is deliberately excluded from accumulation; settling is demonstrated on the objects below.

## Publishing state

There is no marketplace component URL or live checkout yet. Do not mark this edition available, add a purchase link, or claim native editor verification until those steps have actually completed. The underlying npm and JSR packages remain unchanged and free under MIT.
