import { readdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const testsDirectory = fileURLToPath(new URL("../tests/", import.meta.url));
const testFiles = (await readdir(testsDirectory))
  .filter((name) => /^(?:admin-|owner-qr-).*\.test\.mjs$/.test(name))
  .sort()
  .map((name) => `tests/${name}`);

if (testFiles.length === 0) {
  throw new Error("No admin or owner QR tests were found.");
}

const child = spawn(process.execPath, ["--test", ...testFiles], {
  stdio: "inherit",
  shell: false
});

child.once("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exitCode = code ?? 1;
});
