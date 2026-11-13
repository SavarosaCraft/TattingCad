import { defineConfig } from '@playwright/test';

// App tests: the real app in a real browser (Chromium), served by Vite,
// with a fake Tauri layer and an in-memory file system (test/app/harness).
// Run: npm run test:app      One file: npx playwright test test/app/save
//
// The Vite server is started by test/app/global-setup.ts inside this
// process, on a port the system picks — never a fixed port, never a left-
// over server from an earlier run (session 63's lesson).
export default defineConfig({
  testDir: './test/app',
  testMatch: '**/*.spec.ts',
  globalSetup: './test/app/global-setup.ts',
  timeout: 90_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,          // tests in one file run in order
  workers: process.env.CI ? 2 : undefined,
  retries: 0,                    // a test that only passes on a second try is a bug to look at
  forbidOnly: !!process.env.CI,
  reporter: [['list']],
  outputDir: './test/app/.results',
  use: {
    viewport: { width: 1400, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
