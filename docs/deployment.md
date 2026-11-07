# Deployment and publication

## Static website

Run `pnpm build`. The root `dist/` contains the multi-page promotional website, package downloads, documentation, legal notices, and `playground/`. Serve this artifact at the root of an HTTPS origin. `pnpm preview` serves the assembled layout at port 4173. The public previews require no database, server-side secrets, external fonts, service accounts, or visitor analytics. The separately enabled participation service described below uses D1 and private server credentials. Static `_headers` files include CSP, nosniff, referrer, and HSTS configuration for hosts that support that convention. Configure equivalent headers on other hosts.

Build output for the individual apps also remains under each app's `dist/`. The website expects the playground at `/playground/` in production; use the combined root artifact for that layout. The development servers link to one another at ports 5173/5174.

The Cloudflare Workers deployment is configured in `wrangler.jsonc`. Use `pnpm deploy:check` for a dry run and `pnpm deploy` to build and deploy with the authenticated Cloudflare account. Set `FLURI_SITE_ORIGIN` before building when changing the public origin. See [Website development and deployment](website.md) for page structure, customization, package downloads, routing, and security headers.

The README download badges at `/readme/npm-downloads.svg` and `/readme/npm-downloads-react.svg` are served by `workers/site.ts`. They use npm's [official download API](https://github.com/npm/registry/blob/main/docs/download-counts.md) for the last 30 available days and cache successful counts for one hour. npm updates the underlying data daily; GitHub and npm image proxies may add caching. Counts represent package downloads, including automated installations, rather than unique people or websites. Unpublished packages display “not published”; missing statistics and service failures have separate status labels. The badges need no credentials or database and do not add reporting to the Fluri library. A static-only host must keep these image URLs pointed at the deployed Worker, or provide an equivalent endpoint.

## npm release

Publishing is owner-operated and has not been performed by the development workflow. You need write access to the npm `@themes` scope. Verify package availability and ownership before publication; local package naming does not reserve it.

1. Review the version, changelog, license, published file list, and npm account/scope permissions.
2. Verify the package homepage `https://fluri.xyz/`, source repository [fluritheme/fluri](https://github.com/fluritheme/fluri), and [issue tracker](https://github.com/fluritheme/fluri/issues). Both package manifests identify their directory within the shared repository.
3. Run `pnpm check`, `pnpm test:browser`, `pnpm format:check`, `pnpm audit --audit-level high`, `pnpm measure`, and `pnpm release:check`.
4. Use `pnpm --filter @themes/fluri pack` to create the core archive, inspect it, and install that archive into a clean consumer project.
5. Publish core publicly, then the optional React adapter. `pnpm publish` resolves its workspace development linkage to the versioned peer contract.

Public scoped packages need `access: public`, which is already configured. All public exports point to built ESM and declaration files; `sideEffects: false` allows bundler tree shaking. The Christmas entry is separate from the main export. The only core runtime dependency is Zod for configuration validation.

The manual release workflow performs checks by default and publishes only when the `publish` input is selected. Configure the GitHub `npm` environment and npm trusted publishing for `fluritheme/fluri` and its release workflow before using OIDC/provenance. No npm token is stored in this project. Do not run a publish workflow until scope access and trusted publishing are configured.

MIT licensing is confirmed by the project owner. The selected Fluri product/package name is user-supplied; it does not constitute trademark clearance.

## Participation service and private dashboard

`workers/participation.ts` provides optional owner registration, DNS verification, aggregate reporting, and private administration. The core package is independent of this service. Read [the participation guide](participation.md) for permissions, measurement definitions, endpoints, and retention.

Cloudflare D1 stores participation data. The production database was created with EU jurisdiction; this is a database creation property rather than a Worker binding option. For a separate deployment, create a separate D1 database, update `PARTICIPATION_DB` in `wrangler.jsonc`, and apply migrations before deploying:

```sh
pnpm exec wrangler d1 migrations apply fluri-participation --remote
```

The Worker config binds `API_LIMIT` and `LOGIN_LIMIT` to Cloudflare's Rate Limiting API. Limits are per network location, not globally exact. Missing bindings fail closed. The daily GitHub Actions retention workflow calls the narrowly scoped maintenance endpoint to remove expired reports, unverified registrations, and sessions. Its separate high-entropy key is kept in the repository secret `FLURI_MAINTENANCE_KEY`; only its SHA-256 digest is kept in the Worker secret `MAINTENANCE_KEY_HASH`. The endpoint cannot export data or execute supplied queries. Monitor workflow failures, including paused schedules or inactive repositories, and database usage. The domain must resolve before this scheduled job can run. GitHub can delay scheduled jobs; cleanup runs when the job executes. This avoids consuming a Cloudflare cron trigger on the current free account. Database backups remain subject to Cloudflare's Time Travel retention. Before restoring into service, reapply deletion and permission-withdrawal requests made after the restoration point; never silently republish revoked listings.

The dashboard uses a high-entropy operator access key, not a low-entropy human password. Generate at least 32 random bytes and put only its SHA-256 hex digest into the `DASHBOARD_PASSWORD_HASH` Worker secret. Keep the original key in a password manager. For local development, put the digest in a gitignored `.dev.vars` file. Do not place either value in source, HTML, URLs, build variables consumed by Vite, or commits. Rotating the digest changes future login access; delete `admin_sessions` using an authenticated operator database session to revoke existing sessions immediately. The database stores only random session-token hashes and expiry times; sessions expire after eight hours.

No visitor analytics module is shipped. The registration form's contact data, aggregate reporting, and separate public listing permission have corresponding privacy/terms documentation. Owners must review the lawfulness of their own source analytics. Legal notices name the owner in Slovakia with the supplied contact email; check whether your business status requires additional statutory contact or commercial disclosures before operating commercially.

## Canonical domain and discovery

All public metadata uses `https://fluri.xyz`. The custom-domain Worker route is configured explicitly and the default platform subdomain is disabled. Activate the domain's assigned Cloudflare nameservers and wait for DNS and certificate issuance before relying on public links. The public sitemap excludes the private dashboard; robots rules disallow the dashboard and API. Canonical URLs, unique descriptions, Open Graph/Twitter previews, and JSON-LD describe the actual product and source repository. `/llms.txt` provides a concise reference index; it is an informational convention, not a guarantee of AI indexing or recommendations. Do not add fake ratings, installation totals, or keyword stuffing.

## Repository safety

The repository omits `.env*`, `.dev.vars*`, private keys, local databases, dependency trees, archives, Cloudflare state, and browser test output. No deployed credentials belong in GitHub Actions artifacts. npm publication remains a separate owner-operated step; pushing to GitHub does not publish packages. Configure protected branches and the `npm` environment's required reviewers before enabling package publication. The release workflow defaults to checks only.
