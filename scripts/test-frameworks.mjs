import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const child = spawn(
  process.execPath,
  [
    require.resolve('@playwright/test/cli'),
    'test',
    'tests/frameworks.spec.ts',
    ...process.argv.slice(2),
  ],
  { stdio: 'inherit', env: { ...process.env, FLURI_FRAMEWORK_TESTS: '1' } },
);
child.on('error', (error) => {
  console.error(error);
  process.exitCode = 1;
});
child.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
