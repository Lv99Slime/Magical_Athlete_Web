import { defineConfig, devices } from "@playwright/test";
if (
  !process.env.VITE_SUPABASE_URL ||
  !process.env.VITE_SUPABASE_PUBLISHABLE_KEY
) {
  throw new Error(
    "Online browser tests require VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY; refusing to skip.",
  );
}
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "online.spec.ts",
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: 120000,
  expect: { timeout: 20000 },
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:5174",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "online-chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "npm run dev -- --port 5174 --strictPort",
    url: "http://127.0.0.1:5174",
    reuseExistingServer: false,
    timeout: 60000,
  },
});
