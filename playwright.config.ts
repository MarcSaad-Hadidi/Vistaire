import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const shouldStartWebServer = process.env.PLAYWRIGHT_SKIP_WEB_SERVER !== "1";
const startCommand = "node ./node_modules/next/dist/bin/next start";
const reuseExistingServer = process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER === "1";
const browserChannel = process.env.PLAYWRIGHT_BROWSER_CHANNEL;
const ownerE2eToken =
  process.env.VISTAIRE_OWNER_E2E_AUTH_BYPASS_TOKEN ??
  "vistaire-owner-e2e-local-token";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL,
    locale: "fr-CA",
    timezoneId: "America/Toronto",
    screenshot: "only-on-failure",
    trace: "on-first-retry",
    video: "off"
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(browserChannel ? { channel: browserChannel } : {})
      }
    }
  ],
  ...(shouldStartWebServer
    ? {
        webServer: {
          command: startCommand,
          env: {
            ...process.env,
            VISTAIRE_OWNER_E2E_AUTH_BYPASS: "1",
            VISTAIRE_OWNER_E2E_AUTH_BYPASS_TOKEN: ownerE2eToken,
            VISTAIRE_OWNER_E2E_EMAIL: "owner-e2e@localhost",
            VISTAIRE_OWNER_3D_JOBS_FALLBACK: "1",
            VISTAIRE_OWNER_3D_RESTAURANT_SLUGS: "*"
          },
          url: baseURL,
          reuseExistingServer,
          gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
          timeout: 120_000
        }
      }
    : {})
});
