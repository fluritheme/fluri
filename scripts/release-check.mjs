import { readFile, access } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
for (const name of ['core', 'react']) {
  const cwd = new URL(`../packages/${name}/`, import.meta.url);
  const manifest = JSON.parse(await readFile(new URL('package.json', cwd), 'utf8'));
  assert.equal(manifest.license, 'MIT');
  assert.equal(manifest.sideEffects, false);
  assert.equal(manifest.publishConfig.access, 'public');
  assert.ok(manifest.keywords.length >= 8);
  assert.equal(new Set(manifest.keywords).size, manifest.keywords.length);
  assert.ok(
    manifest.keywords.every((keyword) => typeof keyword === 'string' && keyword.length <= 32),
  );
  assert.equal(new URL(manifest.homepage).protocol, 'https:');
  const readme = await readFile(new URL('README.md', cwd), 'utf8');
  assert.match(readme, /https:\/\/[^\s"]+\/readme\/banner\.png/);
  assert.match(readme, /https:\/\/[^\s"]+\/readme\/features\.png/);
  assert.doesNotMatch(readme, /(?:src|href)="(?:assets\/|docs\/)/);
  assert.doesNotMatch(readme, /\]\((?:assets\/|docs\/|LICENSE\))/);
  for (const file of ['dist/index.js', 'dist/index.d.ts', 'README.md', 'LICENSE'])
    await access(new URL(file, cwd));
  const packed = JSON.parse(
    execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }),
  )[0];
  assert.ok(packed.files.some((file) => file.path === 'dist/index.js'));
  if (name === 'core') {
    assert.ok(packed.files.some((file) => file.path === 'assets/readme/banner.png'));
    assert.ok(packed.files.some((file) => file.path === 'assets/readme/features.png'));
  }
  assert.ok(
    packed.files.every(
      (file) => !file.path.includes('node_modules') && !file.path.endsWith('.env'),
    ),
  );
  console.log(
    `${manifest.name}@${manifest.version}: ${packed.entryCount} files, ${packed.size} archive bytes; package inspection passed.`,
  );
}
const { createWeather } = await import('../packages/core/dist/index.js');
const weather = createWeather();
assert.equal(weather.getMetrics().state, 'idle');
weather.destroy();
console.log('SSR-safe package import and lifecycle passed. Nothing published.');
