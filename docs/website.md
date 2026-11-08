# Fluri promotional website

The production website is deployed with Cloudflare Workers Static Assets. It includes Home, Features, an interactive Showcase, Documentation, About, Changelog, Privacy, Terms, Cookies & Storage, the MIT License, a custom 404 page, and the existing playground.

Public website: [winter.fluri.xyz](https://winter.fluri.xyz/).

## Local development

```sh
pnpm build
pnpm preview
```

Open `http://127.0.0.1:4173/` for the complete production layout, including package downloads and the playground. For website live reload, use `pnpm dev:website`; run `pnpm dev` alongside it for the playground. Development playground links redirect to port 5173.

## Content and design

- `apps/website/src/pages.ts` contains the page content, shared navigation/footer, integration examples, and static page renderer.
- `apps/website/src/legal.ts` contains the operator details, legal notices, and complete MIT text. The confirmed public operator is Frantisek Gejdos, with contact address fluritheme@gmail.com.
- `apps/website/src/style.css` defines the color, typography, spacing, responsive layouts, and accessible interaction styles. Start with the custom properties in `:root` to change the palette.
- `apps/shared/brand.css` holds the palette, body font, and display font shared by the website and playground. Change these tokens to customize both together.
- `apps/website/src/main.ts` connects navigation, keyboard tabs, clipboard actions, preset filtering, motion preferences, and real snow previews.
- `apps/website/public/art/` contains original self-contained SVG illustrations and a 1200×630 social card PNG. No external fonts, stock imagery, or image-service requests are needed at runtime.

`scripts/prepare-website.mjs` renders the HTML entry points before Vite runs. Edit the content source rather than the generated HTML. Every route has its own complete, readable HTML, title, description, canonical URL, and social metadata. Content and legal notices work without JavaScript. The core snow library loads only when a live preview needs it.

The showcase uses the actual presets and scoped engine. A preview outside the visible region pauses. The default reduced-motion policy is respected. An explicit on/off choice is stored as `fluri:motion:v1`; the site runs if storage is unavailable. The core simulation does not report visitor interactions. Optional owner registration and server-to-server aggregate reporting are separate features; see [the participation guide](participation.md).

The marketing previews and playground mount eligible canvases inside their positioned scene. The browser scrolls the snow and its card supports in the same subtree, including between JavaScript paints. The renderer uses smaller scene-sized backing stores while keeping simulation coordinates in viewport space.

The homepage hero also has an occasional automatic snowplough. Its first pass starts after 12 seconds of running preview time; later passes wait 24 seconds after completion and alternate direction. It waits for real shelf deposits, and its cadence does not advance when the preview is paused, offscreen, or suspended for reduced motion. Showcase and feature previews do not run this schedule.

## Package downloads

The build packs the compiled core and React adapter into versioned archives under `public/downloads/`. Visitors can install these archives before npm publication. The site clearly distinguishes this from registry availability. Package version changes flow from the core package manifest. The generated archives and copied reference files are ignored by Git.

## Cloudflare Workers

The checked-in `wrangler.jsonc` points to the combined root `dist/`, uses folder-index routes with trailing slashes, and returns the custom 404 page for missing paths. This is Workers Static Assets, not a Pages project. Public previews are static assets. The optional participation API uses the EU-jurisdiction D1 database and private Worker secrets described in [deployment](deployment.md). No visitor analytics script is added.

```sh
pnpm deploy:check
pnpm preview:worker
pnpm deploy
```

`pnpm deploy` builds before running the pinned Wrangler CLI. It requires an authenticated Cloudflare account with Worker deployment permissions. The configuration names the Worker `fluri`; the authenticated account supplies deployment access. Set up a separate database and secrets when moving the project to another account. Credentials are managed by Wrangler, never committed to the project.

The default production origin is `https://winter.fluri.xyz`. Configure the `winter.fluri.xyz` custom domain for the Worker in Cloudflare before directing public traffic there. To build for another HTTPS origin, set `FLURI_SITE_ORIGIN` before rebuilding. The generator validates the origin and updates canonical/social URLs, `sitemap.xml`, and `robots.txt`. It accepts an origin without a path, query, or credentials.

Security headers are declared in `apps/website/public/_headers`, including CSP, content-type protection, framing restrictions, and disabled camera/microphone/geolocation permissions. Hashed assets receive immutable caching. Downloads receive attachment headers. The application does not enable Worker invocation logs; Cloudflare may independently process security and operational request data as described in the privacy notice.

## Verification

```sh
pnpm check
pnpm exec playwright test tests/website.spec.ts --workers=2 --trace=off
```

The website checks cover real snow controls, presets, keyboard navigation and code tabs, persisted pause choices, reduced motion, page metadata, no-JavaScript content, responsive overflow, exact license text, and genuine package downloads. Cloudflare route status and security headers should also be checked after deployment, because Vite preview is not the Cloudflare asset router.

## Participation and discovery

`/participate/` provides registration, DNS verification, sharing choices, one-time keys, reporting, export, and deletion. `/community/` loads only verified, owner-permitted, operator-approved name/domain listings. `/dashboard/` requires a separate operator session; private data is loaded after authentication and never built into HTML. The dashboard is excluded from the sitemap and marked noindex. Empty states show real lack of data rather than invented installations.

Unique page descriptions, canonical URLs, Open Graph and Twitter metadata, and JSON-LD are generated from the page content. `src/seo.ts` describes the source project, license, operator, and page relationships without ratings or inflated usage claims. `/llms.txt` indexes public documentation and limitations for text-based readers. These help machines understand the product; rankings and AI recommendations remain outside the project's control. Public metadata uses `winter.fluri.xyz` exclusively.

## GitHub social preview

Upload `assets/brand/github-social-preview.png` in the repository's **Settings → General → Social preview**. The original artwork is 1280 × 640 pixels and matches the website and README. Its editable SVG is next to the PNG. Regenerate both from the README artwork with `node scripts/render-social-preview.mjs` after installing the workspace and Playwright Chromium. This is a repository preview image; it does not replace the website's separate 1200 × 630 Open Graph card.
