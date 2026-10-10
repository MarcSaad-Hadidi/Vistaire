import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const entries = JSON.parse(await fs.readFile(path.join(root, "docs/immersive-asset-exceptions.json"), "utf8"));
const source = entries.find(entry => entry.path === "assets/immersive-runtime/burger.usdz.gz");
const target = entries.find(entry => entry.path === "public/immersive-assets/ar/burger.usdz");
if (!source || !target) throw new Error("Missing reviewed immersive USDZ metadata.");
const valid = (bytes, entry) => bytes.length === entry.maxBytes && createHash("sha256").update(bytes).digest("hex") === entry.sha256[0];
const targetPath = path.join(root, target.path);
let existing;
try { existing = await fs.readFile(targetPath); } catch {}
if (!existing || !valid(existing, target)) {
  const compressed = await fs.readFile(path.join(root, source.path));
  if (!valid(compressed, source)) throw new Error("Immersive USDZ source checksum mismatch.");
  const original = gunzipSync(compressed, { maxOutputLength: target.maxBytes });
  if (!valid(original, target)) throw new Error("Immersive USDZ output checksum mismatch.");
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath + ".prepared", original);
  await fs.rename(targetPath + ".prepared", targetPath);
}
console.log("Verified exact original immersive USDZ runtime asset.");
