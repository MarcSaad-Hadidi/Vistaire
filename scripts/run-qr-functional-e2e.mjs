import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";

const generatedOutput = ["test-results", "playwright-report"];

async function cleanGeneratedOutput() {
  await Promise.all(
    generatedOutput.map((path) => rm(path, { force: true, recursive: true }))
  );
}

await cleanGeneratedOutput();

const child = spawn(
  process.execPath,
  ["./node_modules/@playwright/test/cli.js", "test", "e2e/qr-functional.spec.ts"],
  {
    stdio: "inherit",
    windowsHide: true,
    env: {
      ...process.env,
      PLAYWRIGHT_SKIP_WEB_SERVER: "1",
      VISTAIRE_QR_E2E_SENSITIVE: "1",
      VISTAIRE_QR_FUNCTIONAL: "1"
    }
  }
);

child.once("exit", async (code, signal) => {
  await cleanGeneratedOutput();
  if (signal) process.kill(process.pid, signal);
  process.exitCode = code ?? 1;
});
