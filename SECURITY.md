# Security policy

Fluri runs locally in the browser by default. It performs no analytics, cookies, geolocation, weather-provider calls, or cursor/content uploads. It does not evaluate executable strings or insert user-supplied HTML. Core configuration is runtime-validated with unknown-key rejection and prototype-pollution protection.

Treat custom plugins as trusted code: they execute inside your page. Do not register plugins from untrusted sources. Keep local configuration files free of credentials; the engine has no need for secrets.

If you find a vulnerability, email **fluritheme@gmail.com** privately with a minimal reproduction and affected version. If the owning repository offers a private security-advisory channel, you can use it instead. Avoid posting sensitive details or credentials in public issues.

Maintainers should reproduce reports with a minimal test, assess exploitability, patch the root cause, add a regression test, and release a versioned advisory. CI checks dependencies; unreviewed high/critical audit findings block release. Browser input, selectors, JSON imports, cleanup, and package contents are covered by automated verification. Dependency inventory is reproducible from pnpm-lock.yaml and package manifests.

## Reviewed tooling advisory — 18 November 2026

CVE-2026-112366 / [GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) affects picomatch through 4.0.7. Upstream currently lists no patched release. It requires attacker-controlled repeated extglob patterns. This project uses repository-owned build/test patterns and localhost development servers; it does not accept glob expressions from visitors. Picomatch is absent from the browser theme runtime and deployed Worker entrypoints.

CI scans both development and production dependencies, with a specific exception for this CVE. Every other high/critical advisory still fails CI. This exception is a reviewed exposure assessment, not a fix or a claim that the full dependency tree is vulnerability-free. Check for an upstream patch on each release and remove the exception as soon as one is available. Do not expose development servers or accept untrusted build globs.
