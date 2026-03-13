import { defineConfig, devices } from "@playwright/test";

/** @type {import('@playwright/test').PlaywrightTestConfig} */
export default defineConfig({
  testDir: "tests/e2e",
  outputDir: "playwright-test-results",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["list"], ["html"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry"
  },
  projects: [{ name: "chrome", use: { ...devices["Desktop Chrome"], channel: "chrome" } }],
  webServer: {
    command: "npm run server",
    url: "http://localhost:3000",
    reuseExistingServer: true
  }
});
