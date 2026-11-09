import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const destination = await mkdtemp(join(tmpdir(), 'fluri-consumer-'));
const archives = join(destination, 'archives');
await mkdir(archives);
const packedArchives = [];
for (const name of ['core', 'react']) {
  const manifest = JSON.parse(await readFile(join(root, 'packages', name, 'package.json'), 'utf8'));
  packedArchives.push(
    join(archives, `${manifest.name.replace('@', '').replace('/', '-')}-${manifest.version}.tgz`),
  );
  execFileSync('pnpm', ['pack', '--pack-destination', archives], {
    cwd: join(root, 'packages', name),
    stdio: 'pipe',
  });
}
await writeFile(
  join(destination, 'package.json'),
  JSON.stringify({ name: 'fluri-consumer-verification', private: true, type: 'module' }),
);
execFileSync(
  'npm',
  [
    'install',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    ...packedArchives,
    'react@19.3.1',
    'react-dom@19.3.1',
    '@types/react@19.3.0',
    'typescript@6.0.3',
  ],
  { cwd: destination, stdio: 'pipe' },
);
await writeFile(
  join(destination, 'verify.mjs'),
  `import assert from 'node:assert/strict';
import {createWeather} from '@fluritheme/fluri';
import {christmasPack} from '@fluritheme/fluri/christmas';
import {Fluri} from '@fluritheme/fluri-react';
import {createElement} from 'react';
import {renderToString} from 'react-dom/server';
const weather=createWeather({preset:'winter-magic'});
weather.use(christmasPack({lights:true}));
assert.equal(weather.getMetrics().state,'idle');
assert.equal(renderToString(createElement(Fluri,{options:{preset:'minimal'}})),'');
weather.destroy();
assert.equal(weather.getMetrics().state,'destroyed');
console.log('Installed tarballs: core, Christmas export, React SSR, and teardown passed.');
`,
);
await writeFile(
  join(destination, 'consumer.mts'),
  `import {createWeather,type WeatherController,type WeatherOptions} from '@fluritheme/fluri';
import {christmasPack} from '@fluritheme/fluri/christmas';
import {useFluri,Fluri} from '@fluritheme/fluri-react';
const options:WeatherOptions={snow:{intensity:0.4},dom:{detection:'explicit'},interactions:{yeti:{enabled:true}}};
const weather:WeatherController=createWeather(options);
weather.use(christmasPack({lights:{warmth:0.8}}));
weather.updateConfig({snow:{texture:null}});
weather.trigger('yeti');
const phase = weather.getMetrics().yetiPhase;
void phase;
weather.destroy();
export {useFluri,Fluri};
`,
);
execFileSync(
  process.execPath,
  [
    join(destination, 'node_modules/typescript/bin/tsc'),
    'consumer.mts',
    '--noEmit',
    '--module',
    'NodeNext',
    '--moduleResolution',
    'NodeNext',
    '--target',
    'ES2022',
    '--strict',
    '--skipLibCheck',
    '--ignoreConfig',
  ],
  { cwd: destination, stdio: 'pipe' },
);
console.log(
  execFileSync(process.execPath, ['verify.mjs'], { cwd: destination, encoding: 'utf8' }).trim(),
);
console.log('Clean consumer TypeScript export resolution passed.');
