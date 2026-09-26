import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/production",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report/production", open: "never" }],
  ],
  outputDir: "test-results/production",
  timeout: 45000,
  expect: { timeout: 10000 },
  use: {
    baseURL: "http://127.0.0.1:4178/magical-athlete/",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "production-desktop",
      use: {
        ...devices["Desktop Chrome"],
        ...(process.env.PLAYWRIGHT_CHANNEL
          ? { channel: process.env.PLAYWRIGHT_CHANNEL }
          : {}),
      },
    },
    {
      name: "production-mobile",
      use: {
        ...devices["iPhone 13"],
        browserName: "chromium",
        ...(process.env.PLAYWRIGHT_CHANNEL
          ? { channel: process.env.PLAYWRIGHT_CHANNEL }
          : {}),
      },
    },
  ],
  webServer: {
    command: "node scripts/serve-production.mjs",
    url: "http://127.0.0.1:4178/magical-athlete/",
    reuseExistingServer: false,
    timeout: 15000,
  },
});
