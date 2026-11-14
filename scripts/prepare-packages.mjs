import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const core = new URL('packages/core/', root);
await mkdir(new URL('docs/', core), { recursive: true });
await cp(new URL('docs/', root), new URL('docs/', core), { recursive: true });
await cp(new URL('assets/', root), new URL('assets/', core), { recursive: true });
for (const file of [
  'LICENSE',
  'LICENSE-MIT-LEGACY',
  'LICENSING.md',
  'licensing.json',
  'CHANGELOG.md',
  'CONTRIBUTING.md',
  'SECURITY.md',
])
  await cp(new URL(file, root), new URL(file, core));
for (const f of ['LICENSE', 'LICENSE-MIT-LEGACY', 'LICENSING.md', 'licensing.json'])
  await cp(new URL(f, root), new URL('packages/react/' + f, root));
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
let readme = await readFile(new URL('README.md', root), 'utf8');
// GitHub resolves repository-relative assets; npm needs public absolute image and document URLs.
readme = readme.replace(/src="assets\/readme\//g, `src="${origin}/readme/`);
readme = readme.replace(/!\[([^\]]*)\]\(assets\/readme\/([^)]+)\)/g, `![$1](${origin}/readme/$2)`);
readme = readme.replace(/href="LICENSE"/g, `href="https://fluri.xyz/license/"`);
readme = readme.replace(
  /\[([^\]]+)\]\((docs\/[^)]+|LICENSE|CONTRIBUTING\.md|CHANGELOG\.md|SECURITY\.md)\)/g,
  (_match, label, path) =>
    `[${label}](${path === 'LICENSE' ? `https://fluri.xyz/license/` : `${origin}/reference/${path.replace(/^docs\//, '')}`})`,
);
readme +=
  '\nFull Markdown reference files and artwork are also included in the installed package.\n';
await writeFile(new URL('README.md', core), readme);
