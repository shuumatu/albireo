import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/browser',
  globalSetup: './tests/browser/setup.ts',
  timeout: 30000,
  expect: { timeout: 8000 },
  fullyParallel: true,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5181',
    // Default to Playwright's matching browser; allow an explicitly selected channel.
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    {
      name: 'reduced-motion',
      use: { viewport: { width: 1280, height: 850 }, reducedMotion: 'reduce' }
    }
  ]
})
