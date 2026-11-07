import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  base: './',
  resolve: {
    alias: [
      {
        find: '@themes/fluri/christmas',
        replacement: fileURLToPath(
          new URL('../../packages/core/src/christmas.ts', import.meta.url),
        ),
      },
      {
        find: '@themes/fluri',
        replacement: fileURLToPath(new URL('../../packages/core/src/index.ts', import.meta.url)),
      },
    ],
  },
  server: { host: '127.0.0.1', port: 5173 },
  build: { target: 'es2022' },
});
