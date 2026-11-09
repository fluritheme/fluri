# Winter for Framer preview

The public demonstration lives at https://winter.fluri.xyz/framer/. It is prepared for a paid Framer integration around the existing free MIT engine. Sales remain marked **Coming soon** until native Framer and checkout validation are complete.

The original product workspace is maintained separately from this public engine repository. The `apps/website/public/framer/` directory contains its generated demonstration, screenshots, guide and pinned engine only. It contains no customer-delivery ZIP or payment credentials. Folder-specific notices identify the new presentation materials; the engine and third-party MIT/OFL licenses remain intact.

## Runtime

- Engine: `@fluritheme/fluri@0.2.0`, bundled with its dependencies.
- URL: `https://winter.fluri.xyz/framer/runtime/winter-0.2.0.mjs`
- SHA-256: `86dce6c56a5e469feae104f3261e59d2b6680f6f87d6d9e5c9385c0ebdab7c96`
- Engine and bundled Zod notices: `/framer/runtime/THIRD-PARTY.txt`.
- CORS is enabled only for the public runtime path so a Framer page can import the pinned module.
- Runtime and content-hashed demonstration assets use immutable caching. Publish a new runtime filename when changing that runtime; do not replace it in place.

The adapter loads this runtime on the client only. Its static editor/export mode does not fetch or start the simulation. The public demonstration uses a local Framer API boundary in React 18, so it does not certify the native Framer editor.

## Verification

The separate product checks cover server rendering without DOM globals, static rendering, React Strict Mode, duplicate ownership, hidden breakpoint handoff, enable/disable and unmount cleanup, color controls, independent section scopes, reduced motion, runtime loading failure, demo controls, restart, and widths down to 320px. Chromium and WebKit are exercised. The original 0.1.1 adapter was verified in native Framer and published at https://safe-apricot-404658.framer.app/. The 0.2.0 adapter update adds a Little yeti property control; its updated native validation and checkout are pending.

Previews are captured from the actual runnable React demonstration, not a fabricated Framer editor. The hero title is deliberately excluded from accumulation; settling is demonstrated on the objects below.

## Publishing state

The existing native component is https://framer.com/m/Winter-jGyBaJ.js@lWsgV8LILmxFtzuwuMYx. The 0.2.0 update has no live checkout yet. Do not mark this edition available, add a purchase link, or claim native editor verification until those steps have actually completed. The underlying engine and React adapter remain free under MIT. The new public demo includes Yeti vs snowman and a Little yeti switch.
