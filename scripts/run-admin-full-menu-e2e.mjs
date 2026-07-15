import { spawnSync } from "node:child_process";

const result = spawnSync(process.execPath, [
  "node_modules/@playwright/test/cli.js", "test", "e2e/admin-chart-interactions.spec.ts",
  "--project=chromium", "--grep", "full-menu admin parity",
], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    VISTAIRE_ADMIN_VISUAL_FIXTURE: "1",
    VISTAIRE_ADMIN_FIXTURE_SCENARIO: "full-menu",
    VISTAIRE_ADMIN_VISUAL_FIXTURE_PORT: process.env.VISTAIRE_ADMIN_VISUAL_FIXTURE_PORT ?? "3191",
    PLAYWRIGHT_BASE_URL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3192",
  },
  stdio: "inherit",
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
