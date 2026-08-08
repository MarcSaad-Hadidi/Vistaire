import { spawnSync } from "node:child_process";

const requestedProject = process.env.VISTAIRE_ADMIN_FULL_MENU_PROJECT;
const projects = requestedProject
  ? [requestedProject]
  : ["chromium", "webkit"];

for (const project of projects) {
  if (!new Set(["chromium", "webkit"]).has(project)) {
    throw new Error(`Unsupported admin full-menu Playwright project: ${project}`);
  }
}

const result = spawnSync(process.execPath, [
  "scripts/run-playwright-e2e.mjs", "e2e/admin-chart-interactions.spec.ts",
  ...projects.map((project) => `--project=${project}`),
  "--grep", "full-menu admin (?:parity|thumbnails)",
  "--workers=1", "--retries=0", "--forbid-only",
  "--reporter=list,./e2e/support/forbid-skipped-tests-reporter.ts",
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
