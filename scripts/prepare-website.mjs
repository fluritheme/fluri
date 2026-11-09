import { readFile, writeFile, mkdir, cp, readdir, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import { format, resolveConfig } from 'prettier';

const root = new URL('../', import.meta.url);
const website = new URL('apps/website/', root);
async function loadContent(file) {
  const source = await readFile(new URL(file, website), 'utf8');
  const contentSource =
    file === 'src/pages.ts'
      ? source.replace(
          "import { structuredData } from './seo';",
          (await readFile(new URL('src/seo.ts', website), 'utf8')).replace(
            'export function structuredData',
            'function structuredData',
          ),
        )
      : source;
  const javascript = ts.transpileModule(contentSource, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`);
}
const { renderWebsite, escapeHTML } = await loadContent('src/pages.ts');
const { legalPages, mitLicenseText, legalUpdatedAt } = await loadContent('src/legal.ts');
const { version } = JSON.parse(await readFile(new URL('packages/core/package.json', root), 'utf8'));
const originURL = new URL(process.env.FLURI_SITE_ORIGIN ?? 'https://winter.fluri.xyz');
if (
  originURL.protocol !== 'https:' ||
  originURL.pathname !== '/' ||
  originURL.search ||
  originURL.hash ||
  originURL.username ||
  originURL.password
)
  throw new Error('FLURI_SITE_ORIGIN must be an HTTPS origin without a path or credentials.');
const origin = originURL.origin;
const pages = renderWebsite({ origin, version, legalPages, legalUpdatedAt });
const formatOptions = await resolveConfig(fileURLToPath(new URL('prettier.config.js', root)));
for (const page of pages) {
  const destination = new URL(
    page.path.endsWith('.html') ? page.path : `${page.path}index.html`,
    website,
  );
  await mkdir(new URL('./', destination), { recursive: true });
  await writeFile(destination, await format(page.html, { ...formatOptions, parser: 'html' }));
}
await mkdir(new URL('public/reference/', website), { recursive: true });
for (const name of await readdir(new URL('docs/', root))) {
  if (name.endsWith('.md') || name.endsWith('.json'))
    await cp(new URL(`docs/${name}`, root), new URL(`public/reference/${name}`, website));
}
for (const name of ['CONTRIBUTING.md', 'SECURITY.md', 'CHANGELOG.md'])
  await cp(new URL(name, root), new URL(`public/reference/${name}`, website));
await cp(new URL('assets/readme/', root), new URL('public/readme/', website), { recursive: true });
await writeFile(new URL('public/license.txt', website), mitLicenseText);
const urls = [
  ...pages
    .filter((page) => page.path !== '404.html' && page.path !== 'dashboard/')
    .map((page) => page.path),
  'playground/',
];
await writeFile(
  new URL('public/sitemap.xml', website),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((path) => `<url><loc>${escapeHTML(new URL(path, `${origin}/`).href)}</loc></url>`).join('')}</urlset>\n`,
);
await writeFile(
  new URL('public/robots.txt', website),
  `User-agent: *\nAllow: /\nDisallow: /dashboard/\nDisallow: /api/\nSitemap: ${origin}/sitemap.xml\n`,
);
await mkdir(new URL('public/downloads/', website), { recursive: true });
for (const name of await readdir(new URL('public/downloads/', website))) {
  if (name.endsWith('.tgz')) await unlink(new URL(`public/downloads/${name}`, website));
}
for (const name of ['core', 'react'])
  execFileSync(
    'pnpm',
    ['pack', '--pack-destination', fileURLToPath(new URL('public/downloads/', website))],
    { cwd: new URL(`packages/${name}/`, root), stdio: 'pipe' },
  );
console.log(
  `Prepared ${pages.length} static pages, package downloads, and search metadata for ${origin}.`,
);

await writeFile(
  new URL('public/llms.txt', website),
  `# Fluri

> Open-source TypeScript snow animation library for websites. Snow accumulates on supported DOM edges and responds to pointer interactions. MIT licensed.

Fluri is a visual effect, not a weather forecast service. The core works independently of frameworks; a separate React adapter supports React and Next.js. Defaults include no visitor telemetry or network requests. Adaptive quality and reduced-motion controls are available; performance and supported geometry have documented limits.

Winter 0.2.0 includes an opt-in animated yeti: it gathers real deposited snow, packs a snowball, and tries to knock down a snowman on the same surface. Set interactions.yeti.enabled to true; see the API reference for size, cooldown, events and reduced-motion behavior.

Package names: @fluritheme/fluri (core) and @fluritheme/fluri-react (optional React adapter).

Install with npm. Package files are also distributed by jsDelivr and UNPKG; raw ESM files need dependency resolution through a bundler, import map, or ESM transformation service.

## Product and source
- [Overview](${origin}/): Live preview and product capabilities.
- [Documentation](${origin}/docs/): Setup, lifecycle, configuration, and framework examples.
- [Source](https://github.com/fluritheme/fluri): Source code, license, issues, and contribution instructions.
- [Preset previews](${origin}/showcase/): Ten presets rendered by the actual engine.
- [Playground](${origin}/playground/): Interactive configuration; JavaScript required.

## Reference
- [Getting started](${origin}/reference/getting-started.md)
- [API](${origin}/reference/api-reference.md)
- [Customization](${origin}/reference/customization.md)
- [Browser support](${origin}/reference/browser-support.md)
- [Performance](${origin}/reference/performance.md)
- [Known limitations](${origin}/reference/limitations.md)
- [Accessibility](${origin}/reference/accessibility.md)
- [Privacy](${origin}/privacy/)
- [Optional website participation](${origin}/reference/participation.md): Owner-approved registration and server-to-server aggregate reports; not unique people or automatic visitor tracking.

Operator: Frantisek Gejdos, Slovakia. Contact: fluritheme@gmail.com.
`,
);
