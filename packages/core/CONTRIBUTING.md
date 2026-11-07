# Contributing to Fluri

Use Node 22.12+ and pnpm 10.33.2. Install with `pnpm install --frozen-lockfile`; start the playground using `pnpm dev`.

Keep rendering, physics, DOM geometry, configuration, and interactions modular. Preserve SSR-safe imports, native pointer behavior outside accepted intentional gestures, deterministic seeds, bounded work, and complete cleanup. Validate all public inputs. Original assets only; include licenses for any added dependency or artwork.

Before proposing changes run `pnpm check`, `pnpm test:browser`, `pnpm format:check`, `pnpm audit --audit-level high`, and `pnpm release:check`. Add meaningful tests for physics/geometry/lifecycle behavior, not assertions that simply mirror an implementation. Freeze seeds/time for visual comparisons. Document geometry approximations and intentional mass sources/sinks.

Maintain CHANGELOG.md, docs/api-reference.md, docs/limitations.md, and the package README when public behavior changes. Keep API changes compatible within the declared SemVer contract. Avoid unsupported performance, browser, or accessibility claims.
