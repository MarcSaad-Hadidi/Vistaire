import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const RUNNER_ARGUMENT_PREFIX = "--runner=";
const runnerArgument = process.argv
  .slice(2)
  .find((argument) => argument.startsWith(RUNNER_ARGUMENT_PREFIX));
const playwrightRunner = runnerArgument?.slice(RUNNER_ARGUMENT_PREFIX.length).trim();

if (!playwrightRunner) {
  throw new Error("WebKit critical runner requires --runner=<path>.");
}

const MAISON_PUBLIC_SPECS = [
  "e2e/maison-elyse-public-menu.spec.ts"
];

const SHARED_WEBKIT_SPECS = [
  "e2e/sauge-noire-3d-state-reset.spec.ts",
  "e2e/sauge-noire-contents-single-flip.spec.ts",
  "e2e/sauge-noire-static-page-handoff.spec.ts",
  "e2e/demo-restaurant-experiences.spec.ts",
  "e2e/seo-interactive-showcases.spec.ts",
  "e2e/restaurateur-preview.spec.ts"
];

const COMMON_ARGS = [
  "--project=webkit",
  "--workers=1",
  "--retries=0",
  "--forbid-only",
  "--reporter=list,./e2e/support/forbid-skipped-tests-reporter.ts"
];

function runNode(args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      env,
      stdio: "inherit",
      windowsHide: true
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      resolve(code ?? (signal ? 1 : 0));
    });
  });
}

async function runGroup(specs, reportPath) {
  return runNode(
    [playwrightRunner, ...specs, ...COMMON_ARGS],
    {
      ...process.env,
      CI_TEST_REPORT_PATH: reportPath
    }
  );
}

const reportDirectory = await mkdtemp(join(tmpdir(), "vistaire-webkit-critical-"));
const maisonReport = join(reportDirectory, "maison-public.json");
const sharedReport = join(reportDirectory, "shared-webkit.json");
const outputReport = process.env.CI_TEST_REPORT_PATH?.trim() || null;

let exitCode = 0;
try {
  const maisonExitCode = await runGroup(MAISON_PUBLIC_SPECS, maisonReport);
  const sharedExitCode = await runGroup(SHARED_WEBKIT_SPECS, sharedReport);

  if (outputReport) {
    const aggregateExitCode = await runNode(
      ["scripts/ci/aggregate-test-reports.mjs"],
      {
        ...process.env,
        CI_TEST_REPORT_PATH: outputReport,
        CI_TEST_REPORT_PATHS: `${maisonReport},${sharedReport}`
      }
    );
    if (aggregateExitCode !== 0) exitCode = 1;
  }

  if (maisonExitCode !== 0 || sharedExitCode !== 0) exitCode = 1;
} finally {
  await rm(reportDirectory, { recursive: true, force: true });
}

process.exitCode = exitCode;
