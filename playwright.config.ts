import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testIgnore: process.env.FLURI_FRAMEWORK_TESTS === '1' ? [] : ['**/frameworks.spec.ts'],
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 4,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:5190',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    reducedMotion: 'no-preference',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      // Use Vite's real server with fixed fixture entries and HMR disabled. Lazy discovery of
      // React must not reload another browser's active physics scene halfway through a test.
      command: `node --input-type=module -e 'import { createServer } from "vite"; const server = await createServer({ configFile: false, cacheDir: "node_modules/.vite-fluri-browser-tests", server: { host: "127.0.0.1", port: 5190, strictPort: true, hmr: false }, optimizeDeps: { entries: ["tests/fixtures/index.html", "tests/fixtures/react.html"], include: ["react", "react-dom/client", "react/jsx-runtime"] } }); await server.listen();'`,
      url: 'http://127.0.0.1:5190/tests/fixtures/index.html',
      reuseExistingServer: false,
    },
    {
      command: 'pnpm --filter @fluri/playground dev --strictPort',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'pnpm preview --strictPort',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: !process.env.CI,
    },
    ...(process.env.FLURI_FRAMEWORK_TESTS !== '1'
      ? []
      : [
          {
            command: 'pnpm --filter @fluri/example-next dev',
            url: 'http://127.0.0.1:5202',
            timeout: 120_000,
            reuseExistingServer: !process.env.CI,
          },
          {
            command: 'pnpm --filter @fluri/example-vue dev',
            url: 'http://127.0.0.1:5203',
            reuseExistingServer: !process.env.CI,
          },
        ]),
  ],
});
