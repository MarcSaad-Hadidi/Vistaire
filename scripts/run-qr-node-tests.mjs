import { readdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const testsDirectory = fileURLToPath(new URL("../tests/", import.meta.url));
const qrTestName = /^(?:admin-qr-|owner-qr-|qr-).*\.test\.mjs$/;
const testFiles = (await readdir(testsDirectory))
  .filter((name) => qrTestName.test(name) || name === "menu-qr-code.test.mjs")
  .sort()
  .map((name) => `tests/${name}`);

if (testFiles.length === 0) {
  throw new Error("No QR Node.js tests were found.");
}

const child = spawn(process.execPath, ["--test", ...testFiles], {
  stdio: "inherit",
  shell: false,
  windowsHide: true
});

child.once("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exitCode = code ?? 1;
});
