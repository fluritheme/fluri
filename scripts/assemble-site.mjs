import { cp, mkdir, rm } from 'node:fs/promises';
const out = new URL('../dist/', import.meta.url);
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await cp(new URL('../apps/website/dist/', import.meta.url), out, { recursive: true });
await cp(new URL('../apps/playground/dist/', import.meta.url), new URL('playground/', out), {
  recursive: true,
});
await cp(new URL('../docs/', import.meta.url), new URL('docs/', out), { recursive: true });
console.log('Static website and playground assembled in dist/.');
