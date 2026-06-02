// Analyze an uploaded OptimizeGLB candidate GLB buffer.
//
// Pure computation over a Buffer: geometry metrics (triangles/vertices/bounds)
// plus GLB JSON metadata (materials/textures/extensions/external URIs) and a
// best-effort max texture size. No network, no OptimizeGLB API.

import { createHash } from "node:crypto";

import { analyzeGeometryFromGltf, parseGlbBuffer } from "../geometry-metrics.mjs";

function sha256Hex(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function collectExternalUris(gltf) {
  const fromBuffers = (gltf.buffers ?? [])
    .map((buffer) => buffer.uri)
    .filter((uri) => typeof uri === "string" && uri && !uri.startsWith("data:"));
  const fromImages = (gltf.images ?? [])
    .map((image) => image.uri)
    .filter((uri) => typeof uri === "string" && uri && !uri.startsWith("data:"));
  return [...fromBuffers, ...fromImages];
}

function readPngSize(bytes) {
  if (bytes.length < 24) return null;
  if (bytes.readUInt32BE(0) !== 0x89504e47) return null;
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function readJpegSize(bytes) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    const isSof =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc;
    const segmentLength = bytes.readUInt16BE(offset + 2);
    if (isSof) {
      return {
        height: bytes.readUInt16BE(offset + 5),
        width: bytes.readUInt16BE(offset + 7)
      };
    }
    offset += 2 + segmentLength;
  }
  return null;
}

function readWebpSize(bytes) {
  if (bytes.length < 30) return null;
  if (bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WEBP") {
    return null;
  }
  const format = bytes.toString("ascii", 12, 16);
  if (format === "VP8X") {
    const width = 1 + ((bytes[24] | (bytes[25] << 8) | (bytes[26] << 16)) & 0xffffff);
    const height = 1 + ((bytes[27] | (bytes[28] << 8) | (bytes[29] << 16)) & 0xffffff);
    return { width, height };
  }
  if (format === "VP8 ") {
    const width = bytes.readUInt16LE(26) & 0x3fff;
    const height = bytes.readUInt16LE(28) & 0x3fff;
    return { width, height };
  }
  if (format === "VP8L") {
    const bits = bytes.readUInt32LE(21);
    const width = (bits & 0x3fff) + 1;
    const height = ((bits >> 14) & 0x3fff) + 1;
    return { width, height };
  }
  return null;
}

function imageSize(bytes) {
  return readPngSize(bytes) ?? readJpegSize(bytes) ?? readWebpSize(bytes);
}

function maxTextureSize(gltf, binBuffer) {
  let max = 0;
  for (const image of gltf.images ?? []) {
    let bytes = null;
    if (Number.isInteger(image.bufferView)) {
      const view = gltf.bufferViews?.[image.bufferView];
      if (view && view.buffer === 0) {
        const start = view.byteOffset ?? 0;
        bytes = binBuffer.subarray(start, start + (view.byteLength ?? 0));
      }
    } else if (typeof image.uri === "string" && image.uri.startsWith("data:")) {
      const base64 = image.uri.split(",", 2)[1];
      if (base64) bytes = Buffer.from(base64, "base64");
    }
    if (!bytes || bytes.length === 0) continue;
    const size = imageSize(bytes);
    if (size) max = Math.max(max, size.width, size.height);
  }
  return max > 0 ? max : null;
}

/**
 * Analyze candidate GLB bytes for a given variant role.
 * Throws if the buffer is not a valid GLB v2 container.
 */
export function analyzeCandidateGlb({ buffer, variantRole }) {
  const { gltf, binBuffer } = parseGlbBuffer(buffer);
  const geometry = analyzeGeometryFromGltf({ gltf, binBuffer });
  const externalUris = collectExternalUris(gltf);

  return {
    variantRole,
    bytes: buffer.length,
    sha256: sha256Hex(buffer),
    triangleCount: geometry.triangles,
    vertexCount: geometry.vertices,
    materialCount: gltf.materials?.length ?? 0,
    textureCount: gltf.textures?.length ?? 0,
    maxTextureSize: maxTextureSize(gltf, binBuffer),
    extensionsUsed: gltf.extensionsUsed ?? [],
    extensionsRequired: gltf.extensionsRequired ?? [],
    externalUris,
    externalUriCount: externalUris.length,
    groundedY: geometry.bounds.groundedY,
    centeredXZ: geometry.bounds.centeredXZ,
    dimensionsMeters: geometry.bounds.dimensionsMeters,
    primitives: geometry.primitives
  };
}

export { sha256Hex };
