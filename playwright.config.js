const { defineConfig } = require('@playwright/test')

module.exports = defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  fullyParallel: false,
  use: { baseURL: 'http://127.0.0.1:3100', trace: 'retain-on-failure' },
  webServer: [
    {
      command: 'node_modules/.bin/hardhat node --port 9545',
      url: 'http://127.0.0.1:9545',
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'node scripts/e2e-web.js',
      url: 'http://127.0.0.1:3100',
      timeout: 180_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
})
