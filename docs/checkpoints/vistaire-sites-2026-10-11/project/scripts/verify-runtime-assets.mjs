import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(
  await fs.readFile(path.join(root, "runtime-assets.json"), "utf8"),
);

// Validate the actual deployment output, not just the source media directory.
// A missing initial dish makes the entire scene fall back to the cinematic film.
for (const asset of manifest) {
  const target = path.join(root, "dist/client/media", asset.name);
  let bytes;
  try {
    bytes = await fs.readFile(target);
  } catch (error) {
    throw new Error(`Missing published runtime asset: ${asset.name}`, {
      cause: error,
    });
  }
  if (
    bytes.length !== asset.bytes ||
    crypto.createHash("sha256").update(bytes).digest("hex") !== asset.sha256
  ) {
    throw new Error(`Published runtime asset checksum mismatch: ${asset.name}`);
  }
}

console.log(
  `Verified ${manifest.length} exact runtime assets in the Sites build.`,
);
