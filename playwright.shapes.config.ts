import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  testMatch: [
    'text-shapes.spec.ts',
    'fast-scroll.spec.ts',
    'layer-geometry.spec.ts',
    'native-scroll.spec.ts',
  ],
  workers: 2,
  retries: 0,
  timeout: 30000,
  use: { baseURL: 'http://127.0.0.1:5191', trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command:
      'node --input-type=module -e \'import { createServer } from "vite";const server=await createServer({configFile:false,cacheDir:".vite-shapes",server:{host:"127.0.0.1",port:5191,strictPort:true,hmr:false}});await server.listen();\'',
    url: 'http://127.0.0.1:5191/tests/fixtures/index.html',
    reuseExistingServer: true,
  },
});
