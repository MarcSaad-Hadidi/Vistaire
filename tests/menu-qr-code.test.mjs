import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const componentPath = "components/owner/MenuQrCode.tsx";
const rendererPath = "lib/owner/qrRenderer.ts";

test("owner QR component delegates rendering and keeps export actions", async () => {
  const source = await readFile(componentPath, "utf8");
  const renderer = await readFile(rendererPath, "utf8");

  assert.match(source, /"use client"/);
  assert.match(source, /renderOwnerQrSvg/);
  assert.doesNotMatch(source, /import\(\s*"qrcode"\s*\)/);
  assert.match(source, /navigator\.clipboard\.writeText\(menuUrl\)/);
  assert.match(source, /download/);
  assert.match(source, /Menu QR/);
  assert.match(renderer, /export async function renderOwnerQrSvg/);
  assert.match(renderer, /errorCorrectionLevel: style\.errorCorrectionLevel/);
  assert.match(renderer, /data-qr-config-version/);
});
