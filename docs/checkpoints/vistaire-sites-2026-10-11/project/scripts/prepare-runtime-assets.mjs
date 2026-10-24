import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const commit = "cd91ec7556c9d6dcafe6d2d44b27f571abd1e0be";
const manifest = JSON.parse(
  await fs.readFile(path.join(root, "runtime-assets.json"), "utf8"),
);
await fs.mkdir(path.join(root, "public/media"), { recursive: true });
for (const asset of manifest) {
  const target = path.join(root, "public/media", asset.name);
  const original = path.resolve(root, "../..", asset.sourcePath);
  let bytes;
  try {
    bytes = await fs.readFile(target);
  } catch {}
  if (
    bytes &&
    crypto.createHash("sha256").update(bytes).digest("hex") === asset.sha256
  )
    continue;
  try {
    bytes = await fs.readFile(path.join(root, asset.sourcePath));
  } catch {}
  if (asset.localOnly && (!bytes || crypto.createHash("sha256").update(bytes).digest("hex") !== asset.sha256))
    throw new Error("Missing exact local runtime source: " + asset.name);
  try {
    if (!bytes || crypto.createHash("sha256").update(bytes).digest("hex") !== asset.sha256)
      bytes = await fs.readFile(original);
  } catch {}
  if (
    !bytes ||
    crypto.createHash("sha256").update(bytes).digest("hex") !== asset.sha256
  ) {
    const tmp = target + ".download";
    const url =
      "https://raw.githubusercontent.com/MarcSaad-Hadidi/Vistaire/" +
      commit +
      "/" +
      asset.sourcePath.split("/").map(encodeURIComponent).join("/");
    execFileSync("curl", [
      "--fail",
      "--location",
      "--retry",
      "2",
      "--silent",
      "--show-error",
      url,
      "--output",
      tmp,
    ]);
    bytes = await fs.readFile(tmp);
    await fs.unlink(tmp);
  }
  if (crypto.createHash("sha256").update(bytes).digest("hex") !== asset.sha256)
    throw new Error("Checksum mismatch: " + asset.name);
  await fs.writeFile(target, bytes);
  console.log("Prepared", asset.name);
}
console.log("Vistaire runtime assets verified.");
