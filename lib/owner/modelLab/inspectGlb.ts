import { createHash } from "node:crypto";
import { parseGlbContainer } from "@/lib/owner/modelLab/modelLabValidation";

type GltfAccessor = {
  count?: number;
  min?: number[];
  max?: number[];
};

type GltfBufferView = {
  buffer?: number;
  byteOffset?: number;
  byteLength?: number;
};

type GltfPrimitive = {
  mode?: number;
  indices?: number;
  attributes?: Record<string, number>;
};

type GltfMesh = {
  primitives?: GltfPrimitive[];
};

type GltfBuffer = {
  uri?: string;
};

type GltfImage = {
  uri?: string;
  mimeType?: string;
  bufferView?: number;
};

type GltfJson = Record<string, unknown> & {
  asset?: { version?: string; generator?: string };
  meshes?: GltfMesh[];
  bufferViews?: GltfBufferView[];
  accessors?: GltfAccessor[];
  buffers?: GltfBuffer[];
  images?: GltfImage[];
  textures?: unknown[];
  materials?: unknown[];
  animations?: Array<{
    channels?: unknown[];
    samplers?: unknown[];
  }>;
  extensionsUsed?: string[];
  extensionsRequired?: string[];
};

export type ModelLabBounds = {
  min: [number, number, number];
  max: [number, number, number];
  size: [number, number, number];
  center: [number, number, number];
};

export type ModelLabInspectionReport = {
  ok: true;
  fileName: string;
  bytes: number;
  sha256: string;
  glbVersion: 2;
  declaredLength: number;
  assetVersion: string;
  generator: string;
  meshCount: number;
  primitives: number;
  triangles: number;
  vertices: number;
  accessors: number;
  accessorElements: number;
  materials: number;
  textures: number;
  images: number;
  animations: number;
  animationChannels: number;
  animationSamplers: number;
  maxTextureSize: number | null;
  maxTexturePixels: number | null;
  totalTexturePixels: number;
  extensionsUsed: string[];
  extensionsRequired: string[];
  externalUris: string[];
  bounds: ModelLabBounds | null;
  warnings: string[];
};

function asGltfJson(value: Record<string, unknown>): GltfJson {
  return value as GltfJson;
}

function accessorCount(accessors: GltfAccessor[] | undefined, index: number | undefined): number {
  if (typeof index !== "number" || !Number.isInteger(index) || !accessors?.[index]) {
    return 0;
  }
  const count = Number(accessors[index]?.count ?? 0);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

function triangleCountForPrimitive(
  primitive: GltfPrimitive,
  accessors: GltfAccessor[] | undefined
): number {
  const mode = primitive.mode ?? 4;
  const indexedCount = accessorCount(accessors, primitive.indices);
  const positionCount = accessorCount(accessors, primitive.attributes?.POSITION);
  const drawCount = indexedCount || positionCount;

  if (mode === 4) return Math.floor(drawCount / 3);
  if (mode === 5 || mode === 6) return Math.max(0, drawCount - 2);
  return 0;
}

function collectExternalUris(gltf: GltfJson): string[] {
  const uris = [
    ...(gltf.buffers ?? []).map((buffer) => buffer.uri),
    ...(gltf.images ?? []).map((image) => image.uri)
  ].filter((uri): uri is string => {
    return typeof uri === "string" && uri.length > 0 && !uri.startsWith("data:");
  });

  return [...new Set(uris)];
}

function readPngSize(bytes: Buffer): { width: number; height: number } | null {
  if (bytes.length < 24) return null;
  if (!bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))) return null;
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function readJpegSize(bytes: Buffer): { width: number; height: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    const segmentLength = bytes.readUInt16BE(offset + 2);
    const isSof =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc;
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

function readWebpSize(bytes: Buffer): { width: number; height: number } | null {
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
    return {
      width: bytes.readUInt16LE(26) & 0x3fff,
      height: bytes.readUInt16LE(28) & 0x3fff
    };
  }
  if (format === "VP8L") {
    const bits = bytes.readUInt32LE(21);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1
    };
  }
  return null;
}

function imageBytes(gltf: GltfJson, binChunk: Buffer, image: GltfImage): Buffer | null {
  if (Number.isInteger(image.bufferView)) {
    const view = gltf.bufferViews?.[image.bufferView as number];
    if (!view || view.buffer !== 0) return null;
    const start = view.byteOffset ?? 0;
    const length = view.byteLength ?? 0;
    if (start < 0 || length <= 0 || start + length > binChunk.byteLength) return null;
    return binChunk.subarray(start, start + length);
  }
  if (typeof image.uri === "string" && image.uri.startsWith("data:")) {
    const base64 = image.uri.split(",", 2)[1];
    return base64 ? Buffer.from(base64, "base64") : null;
  }
  return null;
}

function collectTextureMetrics(
  gltf: GltfJson,
  binChunk: Buffer
): { maxTextureSize: number | null; maxTexturePixels: number | null; totalTexturePixels: number } {
  let maxTextureSize = 0;
  let maxTexturePixels = 0;
  let totalTexturePixels = 0;

  for (const image of gltf.images ?? []) {
    const bytes = imageBytes(gltf, binChunk, image);
    if (!bytes) continue;
    const size = readPngSize(bytes) ?? readJpegSize(bytes) ?? readWebpSize(bytes);
    if (!size) continue;
    const pixels = size.width * size.height;
    maxTextureSize = Math.max(maxTextureSize, size.width, size.height);
    maxTexturePixels = Math.max(maxTexturePixels, pixels);
    totalTexturePixels += pixels;
  }

  return {
    maxTextureSize: maxTextureSize || null,
    maxTexturePixels: maxTexturePixels || null,
    totalTexturePixels
  };
}

function collectBounds(gltf: GltfJson): ModelLabBounds | null {
  const min: [number, number, number] = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
  const max: [number, number, number] = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
  let hasBounds = false;

  for (const mesh of gltf.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      const positionIndex = primitive.attributes?.POSITION;
      if (typeof positionIndex !== "number" || !Number.isInteger(positionIndex)) {
        continue;
      }

      const accessor = gltf.accessors?.[positionIndex];
      if (!accessor?.min || !accessor.max || accessor.min.length < 3 || accessor.max.length < 3) {
        continue;
      }

      for (let axis = 0; axis < 3; axis += 1) {
        const axisMin = Number(accessor.min[axis]);
        const axisMax = Number(accessor.max[axis]);
        if (!Number.isFinite(axisMin) || !Number.isFinite(axisMax)) continue;
        min[axis] = Math.min(min[axis], axisMin);
        max[axis] = Math.max(max[axis], axisMax);
        hasBounds = true;
      }
    }
  }

  if (!hasBounds) return null;

  const size: [number, number, number] = [
    max[0] - min[0],
    max[1] - min[1],
    max[2] - min[2]
  ];
  const center: [number, number, number] = [
    min[0] + size[0] / 2,
    min[1] + size[1] / 2,
    min[2] + size[2] / 2
  ];

  return { min, max, size, center };
}

export function inspectGlbBuffer(args: {
  bytes: Buffer;
  fileName: string;
}): ModelLabInspectionReport {
  const container = parseGlbContainer(args.bytes);
  const gltf = asGltfJson(container.json);
  const warnings: string[] = [];
  const externalUris = collectExternalUris(gltf);
  if (externalUris.length > 0) {
    warnings.push(
      "Ce GLB reference des ressources externes. Model Lab n'en stocke aucune et l'optimisation les refuse pour eviter tout fetch reseau."
    );
  }
  if (gltf.asset?.version !== "2.0") {
    warnings.push("Le JSON glTF ne declare pas asset.version 2.0.");
  }

  let primitives = 0;
  let vertices = 0;
  let triangles = 0;
  let accessorElements = 0;
  let animationChannels = 0;
  let animationSamplers = 0;

  for (const mesh of gltf.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      primitives += 1;
      vertices += accessorCount(gltf.accessors, primitive.attributes?.POSITION);
      triangles += triangleCountForPrimitive(primitive, gltf.accessors);
    }
  }
  for (const accessor of gltf.accessors ?? []) {
    const count = Number(accessor.count ?? 0);
    if (Number.isFinite(count) && count > 0) accessorElements += count;
  }
  for (const animation of gltf.animations ?? []) {
    animationChannels += animation.channels?.length ?? 0;
    animationSamplers += animation.samplers?.length ?? 0;
  }
  const textureMetrics = collectTextureMetrics(gltf, container.binChunk);

  return {
    ok: true,
    fileName: args.fileName,
    bytes: args.bytes.byteLength,
    sha256: createHash("sha256").update(args.bytes).digest("hex"),
    glbVersion: container.version,
    declaredLength: container.declaredLength,
    assetVersion: gltf.asset?.version ?? "",
    generator: gltf.asset?.generator ?? "",
    meshCount: gltf.meshes?.length ?? 0,
    primitives,
    triangles,
    vertices,
    accessors: gltf.accessors?.length ?? 0,
    accessorElements,
    materials: gltf.materials?.length ?? 0,
    textures: gltf.textures?.length ?? 0,
    images: gltf.images?.length ?? 0,
    animations: gltf.animations?.length ?? 0,
    animationChannels,
    animationSamplers,
    maxTextureSize: textureMetrics.maxTextureSize,
    maxTexturePixels: textureMetrics.maxTexturePixels,
    totalTexturePixels: textureMetrics.totalTexturePixels,
    extensionsUsed: gltf.extensionsUsed ?? [],
    extensionsRequired: gltf.extensionsRequired ?? [],
    externalUris,
    bounds: collectBounds(gltf),
    warnings
  };
}
