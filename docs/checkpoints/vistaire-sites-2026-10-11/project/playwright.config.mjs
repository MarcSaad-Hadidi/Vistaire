import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  workers: 1,
  retries: 0,
  expect: { timeout: 45000 },
  timeout: 360000,
  reporter: [
    ["list"],
    ["json", { outputFile: "artifacts/browser-results.json" }],
  ],
  use: {
    actionTimeout: 15000,
    baseURL: "http://127.0.0.1:5176",
    screenshot: "only-on-failure",
    launchOptions: process.env.VISTAIRE_QA_CHROMIUM
      ? {
          executablePath: process.env.VISTAIRE_QA_CHROMIUM,
          ignoreDefaultArgs: [
            "--enable-unsafe-swiftshader",
            "--unsafely-disable-devtools-self-xss-warnings",
          ],
        }
      : {},
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 5176 --strictPort",
    url: "http://127.0.0.1:5176",
    reuseExistingServer: false,
  },
  projects: [
    {
      name: "scroll-layout",
      testMatch: "**/viewport-scroll.spec.mjs",
      use: {
        viewport: { width: 390, height: 820 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "recovery",
      testMatch: "**/recovery.spec.mjs",
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        reducedMotion: "reduce",
      },
    },
    {
      name: "desktop",
      testMatch: "**/experience.spec.mjs",
      use: { viewport: { width: 1440, height: 900 } },
    },
    {
      name: "mobile",
      testMatch: "**/experience.spec.mjs",
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "mobile430",
      testMatch: "**/experience.spec.mjs",
      use: {
        viewport: { width: 430, height: 900 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "retina",
      testMatch: "**/quality.spec.mjs",
      use: {
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        reducedMotion: "reduce",
      },
    },
  ],
});
