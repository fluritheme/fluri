import { build } from 'vite';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import { writeFile } from 'node:fs/promises';
const entries = { core: 'packages/core/src/index.ts', christmas: 'packages/core/src/christmas.ts' };
const report = {
  measuredAt: new Date().toISOString(),
  node: process.version,
  methodology:
    'Vite production library build, single minified ESM entry, dependencies bundled; compression defaults. Entries measured independently.',
  bundles: {},
};
for (const [name, entry] of Object.entries(entries)) {
  const result = await build({
    configFile: false,
    logLevel: 'error',
    build: {
      write: false,
      minify: true,
      lib: { entry, formats: ['es'], fileName: name },
      sourcemap: false,
    },
  });
  const outputs = (Array.isArray(result) ? result : [result]).flatMap((item) =>
    'output' in item ? item.output : [],
  );
  const code = outputs
    .filter((item) => item.type === 'chunk')
    .map((item) => item.code)
    .join('\n');
  report.bundles[name] = {
    minifiedBytes: Buffer.byteLength(code),
    gzipBytes: gzipSync(code).length,
    brotliBytes: brotliCompressSync(code).length,
  };
}
await writeFile('docs/bundle-report.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
