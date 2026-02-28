const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './',
  testMatch: '**/e2e.test.js',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 1,
  reporter: 'html',
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:8080',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'node server.js',
    url: 'http://localhost:8080',
    // Reuse an already-running server when BASE_URL is explicitly set (e.g. Docker mode)
    reuseExistingServer: !!process.env.BASE_URL || !process.env.CI,
    timeout: 120 * 1000,
    env: {
      // Short timeouts so E2E host-takeover tests don't wait a full minute
      RECONNECT_GRACE_PERIOD_MS: '100',
      HOST_TAKEOVER_TIMEOUT_MS: '500',
    },
  },
});
