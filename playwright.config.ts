import { randomBytes } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";
import { privacyRejectedStorageState } from "./e2e/support/privacy-consent";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const configuredSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const allowProductionSupabaseE2e =
  process.env.VISTAIRE_ALLOW_PRODUCTION_SUPABASE_E2E === "1" &&
  process.env.VISTAIRE_E2E_PRODUCTION_SMOKE === "1";
let externalSupabaseUrl = false;
if (configuredSupabaseUrl) {
  try {
    const parsed = new URL(configuredSupabaseUrl);
    const loopback =
      parsed.hostname === "localhost" ||
      parsed.hostname.endsWith(".localhost") ||
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "[::1]" ||
      parsed.hostname === "::1";
    externalSupabaseUrl = !loopback;
  } catch {
    externalSupabaseUrl = true;
  }
}
if (externalSupabaseUrl && !allowProductionSupabaseE2e) {
  throw new Error(
    "Playwright refuse toute URL Supabase externe; configurez un fixture local ou l'opt-in explicite du smoke contrôlé."
  );
}
const shouldStartWebServer = process.env.PLAYWRIGHT_SKIP_WEB_SERVER !== "1";
const startCommand = "node ./node_modules/next/dist/bin/next start --hostname 127.0.0.1";
const reuseExistingServer = process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER === "1";
const browserChannel = process.env.PLAYWRIGHT_BROWSER_CHANNEL;
const cliRequestsWebkit = process.argv.some((argument) => argument === "--project=webkit");
if (cliRequestsWebkit) process.env.PLAYWRIGHT_INCLUDE_WEBKIT = "1";
const includeWebkit = process.env.PLAYWRIGHT_INCLUDE_WEBKIT === "1";
const adminE2eSensitive = process.env.VISTAIRE_ADMIN_E2E_SENSITIVE === "1";
const sensitiveQrE2E = process.env.VISTAIRE_QR_E2E_SENSITIVE === "1";
const sensitiveE2E = adminE2eSensitive || sensitiveQrE2E;
const adminVisualFixture = process.env.VISTAIRE_ADMIN_VISUAL_FIXTURE === "1";
const qrFixture = process.env.VISTAIRE_QR_FIXTURE === "1";
const qrFunctionalFixture = process.env.VISTAIRE_QR_FUNCTIONAL === "1";
const cliIncludesSaugeNoireBrowserFlow = process.argv
  .slice(2)
  .some((argument) => {
    const normalized = argument.replaceAll("\\", "/");
    return (
      /(?:^|\/)sauge-noire-[^/]+\.spec\.ts$/.test(normalized) ||
      /(?:^|\/)ar-renderer-handoff\.spec\.ts$/.test(normalized) ||
      /(?:^|\/)demo-restaurant-experiences\.spec\.ts$/.test(normalized) ||
      /(?:^|\/)landing-(?:redesign|production-photo)\.spec\.ts$/.test(normalized)
    );
  });
const cliIncludesLandingProductionPhoto = process.argv
  .slice(2)
  .some((argument) =>
    /(?:^|\/)landing-production-photo\.spec\.ts$/.test(
      argument.replaceAll("\\", "/")
    )
  );
if (cliIncludesSaugeNoireBrowserFlow) process.env.VISTAIRE_SAUGE_NOIRE_FIXTURE = "1";
const saugeNoireFixture = process.env.VISTAIRE_SAUGE_NOIRE_FIXTURE === "1";
const saugeNoireFixtureOrigin = "http://127.0.0.1:55434";
const adminVisualFixturePort = process.env.VISTAIRE_ADMIN_VISUAL_FIXTURE_PORT ?? "3110";
const adminVisualFixtureOrigin = `http://127.0.0.1:${adminVisualFixturePort}`;
const qrFixtureOrigin = "http://127.0.0.1:55432";
const fixtureStartCommand = `node ./node_modules/next/dist/bin/next dev --webpack --hostname 127.0.0.1 --port ${new URL(baseURL).port || "3000"}`;
const fixtureAppStartCommand = cliIncludesLandingProductionPhoto
  ? startCommand
  : fixtureStartCommand;
const ownerE2eToken = shouldStartWebServer
  ? randomBytes(32).toString("base64url")
  : process.env.VISTAIRE_OWNER_E2E_AUTH_BYPASS_TOKEN ??
    randomBytes(32).toString("base64url");
process.env.VISTAIRE_OWNER_E2E_AUTH_BYPASS_TOKEN = ownerE2eToken;
const fixtureOnlyTestIgnore = [
  ...(adminVisualFixture ? [] : [
      "**/admin-chart-interactions.spec.ts",
      "**/admin-insights-fidelity.spec.ts",
      "**/admin-visual.spec.ts",
      ...(process.env.VISTAIRE_ADMIN_PERFORMANCE_SESSION_SECRET
        ? []
        : ["**/admin-performance.spec.ts"])
    ]),
  ...(qrFixture ? [] : ["**/admin-qr-resolution.spec.ts"]),
  ...(qrFunctionalFixture ? [] : ["**/qr-functional.spec.ts"])
];

export default defineConfig({
  testDir: "./e2e",
  testIgnore: fixtureOnlyTestIgnore,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: sensitiveE2E ? 0 : process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
  preserveOutput: sensitiveE2E ? "never" : "always",
  use: {
    baseURL,
    storageState: privacyRejectedStorageState(baseURL),
    locale: "fr-CA",
    timezoneId: "America/Toronto",
    screenshot: sensitiveE2E ? "off" : "only-on-failure",
    trace: sensitiveE2E ? "off" : "on-first-retry",
    video: "off"
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(browserChannel ? { channel: browserChannel } : {})
      }
    },
    ...(includeWebkit
      ? [{
          name: "webkit",
          use: {
            ...devices["iPhone 13"]
          }
        }]
      : [])
  ],
  ...(shouldStartWebServer
    ? {
        webServer: saugeNoireFixture ? [{
          command: "node e2e/support/sauge-noire-fixture-server.mjs",
          url: `${saugeNoireFixtureOrigin}/fixture/health`,
          reuseExistingServer,
          gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
          timeout: 30_000
        }, {
          command: fixtureAppStartCommand,
          env: {
            ...process.env,
            NEXT_PUBLIC_SUPABASE_URL: saugeNoireFixtureOrigin,
            SUPABASE_SERVICE_ROLE_KEY: "sauge-noire-fixture-service-role-key",
            VISTAIRE_EXPECTED_SUPABASE_PROJECT_REF: "",
            VISTAIRE_EXCHANGE_RATES_FIXTURE_JSON:
              '{"CAD":1,"USD":0.72,"EUR":0.6225}'
          },
          url: baseURL,
          reuseExistingServer,
          gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
          timeout: 120_000
        }] : adminVisualFixture ? [{
          command: "node e2e/support/admin-visual-fixture-server.mjs",
          url: `${adminVisualFixtureOrigin}/rest/v1/restaurants`,
          reuseExistingServer,
          timeout: 30_000
        }, {
          command: fixtureStartCommand,
          env: {
            ...process.env,
            NEXT_PUBLIC_SUPABASE_URL: adminVisualFixtureOrigin,
            SUPABASE_SERVICE_ROLE_KEY: "visual-fixture-service-role-key",
            NEXT_PUBLIC_DEMO_RESTAURANT_ID: "11111111-1111-1111-1111-111111111111",
            VISTAIRE_ADMIN_VISUAL_NOW: "2026-07-10T12:00:00.000Z",
            VISTAIRE_LOCAL_PREVIEW_SECRET: "admin-visual-fixture-preview-secret-2026",
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
        }] : qrFixture ? [{
          command: "node e2e/support/qr-supabase-fixture-server.mjs",
          url: `${qrFixtureOrigin}/fixture/state`,
          reuseExistingServer,
          timeout: 30_000
        }, {
          command: startCommand,
          env: {
            ...process.env,
            NEXT_PUBLIC_SUPABASE_URL: qrFixtureOrigin,
            SUPABASE_SERVICE_ROLE_KEY: "qr-fixture-service-role-key",
            VISTAIRE_ADMIN_SESSION_SECRET:
              "qr-fixture-admin-session-secret-at-least-32-bytes",
            VISTAIRE_EXPECTED_SUPABASE_PROJECT_REF: "",
            VISTAIRE_QR_DIAGNOSTICS: "1"
          },
          url: baseURL,
          reuseExistingServer,
          gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
          timeout: 120_000
        }] : {
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
