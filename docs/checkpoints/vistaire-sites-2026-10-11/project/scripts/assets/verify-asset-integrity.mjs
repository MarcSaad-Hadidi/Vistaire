import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Independent raw GLB-byte verification: no glTF Transform or decoder used.
// Optional --record writes verification evidence only, never a model or image.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
async function readGLB(path) {
  const bytes = await readFile(resolve(root, path));
  assert.equal(bytes.readUInt32LE(0), 0x46546c67, "GLB magic");
  assert.equal(bytes.readUInt32LE(4), 2, "GLB version");
  assert.equal(bytes.readUInt32LE(8), bytes.length, "GLB total byte length");
  let json, binary;
  for (let offset = 12; offset < bytes.length;) {
    const length = bytes.readUInt32LE(offset),
      type = bytes.readUInt32LE(offset + 4);
    const chunk = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === 0x4e4f534a) json = JSON.parse(chunk.toString());
    else if (type === 0x004e4942) binary = chunk;
    offset += length + 8;
  }
  assert(json && binary, "Embedded JSON and binary chunks required");
  const images = (json.images ?? []).map((image, index) => {
    assert.equal(typeof image.bufferView, "number", "Embedded image required");
    const view = json.bufferViews[image.bufferView];
    assert.equal(view.buffer ?? 0, 0, "Single embedded GLB buffer required");
    const imageBytes = binary.subarray(
      view.byteOffset ?? 0,
      (view.byteOffset ?? 0) + view.byteLength,
    );
    return {
      index,
      mimeType: image.mimeType,
      bytes: imageBytes.length,
      sha256: sha256(imageBytes),
    };
  });
  return {
    bytes: bytes.length,
    sha256: sha256(bytes),
    images,
    copyright: json.asset.copyright ?? null,
  };
}
const inventoryPath = resolve(root, "docs/lod-inventory.json");
const inventory = JSON.parse(await readFile(inventoryPath, "utf8"));
const verification = {
  checkedAt: new Date().toISOString(),
  method:
    "Independent GLB chunk parsing, image bufferView byte extraction and SHA-256 comparison; no generation/decode library or image resampling.",
  script: "scripts/assets/verify-asset-integrity.mjs",
  dishes: [],
};
for (const dish of inventory.dishes) {
  const original = await readGLB(dish.original.path),
    mobile = await readGLB(dish.mobile.path);
  assert.equal(
    original.sha256,
    dish.original.sha256,
    `${dish.id} original hash`,
  );
  assert.equal(mobile.sha256, dish.mobile.sha256, `${dish.id} LOD hash`);
  assert.deepEqual(
    mobile.images,
    original.images,
    `${dish.id} exact texture bytes/MIME/order`,
  );
  assert.equal(mobile.copyright, original.copyright, `${dish.id} attribution`);
  const evidence = {
    id: dish.id,
    originalSha256: original.sha256,
    mobileSha256: mobile.sha256,
    originalUnchanged: true,
    imageCount: original.images.length,
    embeddedImageBytes: original.images.reduce(
      (total, image) => total + image.bytes,
      0,
    ),
    imageBytesMimeAndOrderIdentical: true,
    copyrightUnchanged: true,
    images: original.images,
  };
  verification.dishes.push(evidence);
  console.log(
    `${dish.id}: hashes match; ${evidence.imageCount} images / ${evidence.embeddedImageBytes} bytes identical`,
  );
}
const table = JSON.parse(
  await readFile(resolve(root, "docs/restaurant-table-inventory.json"), "utf8"),
);
const restaurant = await readGLB(table.asset.path);
assert.equal(restaurant.sha256, table.asset.sha256, "Restaurant source hash");
verification.restaurant = {
  sha256: restaurant.sha256,
  unchanged: true,
  imageCount: restaurant.images.length,
};
const hulls = JSON.parse(
  await readFile(
    resolve(root, "public/assets/dishes/framing-hulls.json"),
    "utf8",
  ),
);
verification.hulls = [];
for (const hull of Object.values(hulls.byUrl)) {
  const actual = sha256(await readFile(resolve(root, `public${hull.url}`)));
  assert.equal(actual, hull.source.sha256, `${hull.variant} hull source hash`);
  verification.hulls.push({
    variant: hull.variant,
    sourceSha256: actual,
    unchanged: true,
  });
}
if (process.argv.includes("--record")) {
  inventory.independentByteVerification = verification;
  await writeFile(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`);
}
console.log(
  JSON.stringify({
    pass: true,
    lods: verification.dishes.length,
    hullSources: verification.hulls.length,
    restaurantUnchanged: true,
  }),
);
