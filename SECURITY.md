# Security policy

Fluri runs locally in the browser by default. It performs no analytics, cookies, geolocation, weather-provider calls, or cursor/content uploads. It does not evaluate executable strings or insert user-supplied HTML. Core configuration is runtime-validated with unknown-key rejection and prototype-pollution protection.

Treat custom plugins as trusted code: they execute inside your page. Do not register plugins from untrusted sources. Keep local configuration files free of credentials; the engine has no need for secrets.

If you find a vulnerability, email **fluritheme@gmail.com** privately with a minimal reproduction and affected version. If the owning repository offers a private security-advisory channel, you can use it instead. Avoid posting sensitive details or credentials in public issues.

Maintainers should reproduce reports with a minimal test, assess exploitability, patch the root cause, add a regression test, and release a versioned advisory. CI checks dependencies; high/critical audit findings block release. Browser input, selectors, JSON imports, cleanup, and package contents are covered by automated verification. Dependency inventory is reproducible from pnpm-lock.yaml and package manifests.
