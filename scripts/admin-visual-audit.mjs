import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const [referenceDir, actualDir, outputDir, ceilingRaw = "0.01", mode = "enforce"] = process.argv.slice(2);
if (!referenceDir || !actualDir || !outputDir) {
  throw new Error("usage: node scripts/admin-visual-audit.mjs <reference-dir> <actual-dir> <output-dir> [ceiling] [enforce|report]");
}

const ceiling = Number(ceilingRaw);
const threshold = 20;
const screens = [
  { id: "overview-desktop", reference: "01-overview-desktop.png", actual: "overview-desktop.png", width: 1672, height: 941 },
  { id: "availability-desktop", reference: "02-availability-desktop.png", actual: "availability-desktop.png", width: 1672, height: 941 },
  { id: "insights-desktop", reference: "04-insights-desktop.png", actual: "insights-desktop.png", width: 1672, height: 941 },
  { id: "overview-mobile", reference: "03-overview-mobile.png", actual: "overview-mobile-reference.png", width: 390, height: 903, crop: { left: 139, top: 69, width: 663, height: 1535 }, radius: 24 },
];

await fs.mkdir(outputDir, { recursive: true });

async function pixels(file, screen, isReference) {
  let pipeline = sharp(file);
  if (isReference && screen.crop) pipeline = pipeline.extract(screen.crop);
  pipeline = pipeline.resize(screen.width, screen.height, { fit: "fill" }).ensureAlpha();
  if (screen.radius) {
    const mask = Buffer.from(`<svg width="${screen.width}" height="${screen.height}"><rect width="${screen.width}" height="${screen.height}" rx="${screen.radius}" fill="white"/></svg>`);
    pipeline = pipeline.composite([{ input: mask, blend: "dest-in" }]);
  }
  return pipeline.raw().toBuffer();
}

const results = [];
for (const screen of screens) {
  const reference = await pixels(path.join(referenceDir, screen.reference), screen, true);
  const actual = await pixels(path.join(actualDir, screen.actual), screen, false);
  const diff = Buffer.alloc(reference.length);
  let changed = 0;
  let eligible = 0;
  for (let index = 0; index < reference.length; index += 4) {
    if (reference[index + 3] === 0) continue;
    eligible += 1;
    let maximum = 0;
    for (let channel = 0; channel < 3; channel += 1) {
      const delta = Math.abs(reference[index + channel] - actual[index + channel]);
      diff[index + channel] = delta;
      maximum = Math.max(maximum, delta);
    }
    diff[index + 3] = 255;
    if (maximum > threshold) changed += 1;
  }
  const changedRatio = changed / Math.max(1, eligible);
  await sharp(diff, { raw: { width: screen.width, height: screen.height, channels: 4 } }).png().toFile(path.join(outputDir, `${screen.id}-diff.png`));
  await sharp({ create: { width: screen.width, height: screen.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([
      { input: reference, raw: { width: screen.width, height: screen.height, channels: 4 }, opacity: 0.5 },
      { input: actual, raw: { width: screen.width, height: screen.height, channels: 4 }, opacity: 0.5 },
    ])
    .png()
    .toFile(path.join(outputDir, `${screen.id}-overlay.png`));
  results.push({ id: screen.id, changedRatio, ceiling, threshold, ...(screen.crop ? { crop: screen.crop, radius: screen.radius } : {}) });
}

console.log(JSON.stringify({ results }, null, 2));
if (mode !== "report" && results.some((result) => result.changedRatio > ceiling)) process.exitCode = 1;
