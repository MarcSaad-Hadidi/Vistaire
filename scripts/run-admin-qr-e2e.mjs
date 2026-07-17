import { spawn } from "node:child_process";

const child = spawn(
  process.execPath,
  ["./node_modules/@playwright/test/cli.js", "test", "e2e/admin-qr-resolution.spec.ts"],
  {
    stdio: "inherit",
    windowsHide: true,
    env: {
      ...process.env,
      VISTAIRE_QR_FIXTURE: "1"
    }
  }
);

child.once("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exitCode = code ?? 1;
});
