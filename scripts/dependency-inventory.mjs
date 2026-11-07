import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
const inventory = JSON.parse(
  execFileSync('pnpm', ['licenses', 'list', '--prod', '--json'], { encoding: 'utf8' }),
);
for (const packages of Object.values(inventory)) for (const pkg of packages) delete pkg.paths;
await writeFile(
  'docs/dependencies.json',
  JSON.stringify(
    {
      methodology:
        'pnpm licenses list --prod; filesystem paths omitted; React is an optional adapter peer, Zod is the core runtime dependency.',
      licenses: inventory,
    },
    null,
    2,
  ) + '\n',
);
