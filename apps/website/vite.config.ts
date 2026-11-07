import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  base: '/',
  plugins: [
    {
      name: 'playground-development-link',
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          if (request.url === '/playground/' || request.url === '/playground') {
            response.writeHead(302, { Location: 'http://127.0.0.1:5173/' });
            response.end();
          } else next();
        });
      },
    },
  ],
  resolve: {
    alias: [
      {
        find: '@fluritheme/fluri/christmas',
        replacement: fileURLToPath(
          new URL('../../packages/core/src/christmas.ts', import.meta.url),
        ),
      },
      {
        find: '@fluritheme/fluri',
        replacement: fileURLToPath(new URL('../../packages/core/src/index.ts', import.meta.url)),
      },
    ],
  },
  server: { host: '127.0.0.1', port: 5174 },
  build: {
    target: 'es2022',
    rollupOptions: {
      input: Object.fromEntries(
        [
          'index.html',
          'christmas/index.html',
          'participate/index.html',
          'dashboard/index.html',
          'community/index.html',
          'features/index.html',
          'showcase/index.html',
          'docs/index.html',
          'about/index.html',
          'changelog/index.html',
          'privacy/index.html',
          'terms/index.html',
          'cookies/index.html',
          'license/index.html',
          '404.html',
        ].map((path) => [path.replaceAll('/', '-'), fileURLToPath(new URL(path, import.meta.url))]),
      ),
    },
  },
});
