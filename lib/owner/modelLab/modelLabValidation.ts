import { MODEL_LAB_PRESETS, type ModelLabPresetId } from "@/lib/owner/modelLab/modelLabPresets";

const GLB_JSON_CHUNK_TYPE = 0x4e4f534a;
const GLB_BIN_CHUNK_TYPE = 0x004e4942;
const ALLOWED_GLB_MIME_TYPES = new Set([
  "",
  "application/octet-stream",
  "model/gltf-binary"
]);

export type GlbChunkInfo = {
  type: "JSON" | "BIN" | `0x${string}`;
  byteOffset: number;
  byteLength: number;
};

export type ParsedGlbContainer = {
  json: Record<string, unknown>;
  jsonText: string;
  binChunk: Buffer;
  chunks: GlbChunkInfo[];
  declaredLength: number;
  version: 2;
};

export function normalizeModelLabBytes(bytes: ArrayBuffer | ArrayBufferView): Buffer {
  if (bytes instanceof ArrayBuffer) return Buffer.from(bytes);
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

export function sanitizeModelLabOriginalName(value: string): string {
  const basename = value.split(/[\\/]+/).filter(Boolean).pop() ?? "model.glb";
  const cleaned = basename
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[^a-zA-Z0-9._ -]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);

  return cleaned || "model.glb";
}

function chunkTypeLabel(type: number): GlbChunkInfo["type"] {
  if (type === GLB_JSON_CHUNK_TYPE) return "JSON";
  if (type === GLB_BIN_CHUNK_TYPE) return "BIN";
  return `0x${type.toString(16).padStart(8, "0")}`;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function parseGlbContainer(bytes: Buffer): ParsedGlbContainer {
  if (bytes.byteLength < 20) {
    throw new Error("GLB header is incomplete.");
  }
  if (bytes.subarray(0, 4).toString("ascii") !== "glTF") {
    throw new Error("GLB magic header must be glTF.");
  }

  const version = bytes.readUInt32LE(4);
  if (version !== 2) {
    throw new Error("Only GLB version 2 is accepted.");
  }

  const declaredLength = bytes.readUInt32LE(8);
  if (declaredLength !== bytes.byteLength) {
    throw new Error("GLB declared length does not match the uploaded bytes.");
  }

  let offset = 12;
  let chunkIndex = 0;
  let jsonText = "";
  let json: Record<string, unknown> | null = null;
  let binChunk = Buffer.alloc(0);
  const chunks: GlbChunkInfo[] = [];

  while (offset < bytes.byteLength) {
    if (offset + 8 > bytes.byteLength) {
      throw new Error("GLB chunk header is truncated.");
    }

    const byteLength = bytes.readUInt32LE(offset);
    const rawType = bytes.readUInt32LE(offset + 4);
    offset += 8;

    if (byteLength <= 0 || byteLength % 4 !== 0) {
      throw new Error("GLB chunk length is invalid.");
    }
    if (offset + byteLength > bytes.byteLength) {
      throw new Error("GLB chunk exceeds uploaded byte length.");
    }
    if (chunkIndex === 0 && rawType !== GLB_JSON_CHUNK_TYPE) {
      throw new Error("GLB JSON chunk must be first.");
    }

    chunks.push({
      type: chunkTypeLabel(rawType),
      byteOffset: offset,
      byteLength
    });

    if (rawType === GLB_JSON_CHUNK_TYPE) {
      if (json) throw new Error("GLB must contain exactly one JSON chunk.");
      jsonText = bytes
        .subarray(offset, offset + byteLength)
        .toString("utf8")
        .replace(/[\u0000\u0020]+$/g, "");
      const parsed = JSON.parse(jsonText) as unknown;
      if (!isPlainRecord(parsed) || !isPlainRecord(parsed.asset)) {
        throw new Error("GLB JSON asset metadata is missing.");
      }
      json = parsed;
    } else if (rawType === GLB_BIN_CHUNK_TYPE) {
      if (binChunk.byteLength > 0) throw new Error("GLB must contain at most one BIN chunk.");
      binChunk = Buffer.from(bytes.subarray(offset, offset + byteLength));
    }

    offset += byteLength;
    chunkIndex += 1;
  }

  if (!json || chunkIndex === 0 || offset !== bytes.byteLength) {
    throw new Error("GLB chunk layout is invalid.");
  }

  return { json, jsonText, binChunk, chunks, declaredLength, version: 2 };
}

export function validateModelLabGlbFile(
  file: {
    name: string;
    type: string;
    size: number;
    bytes: ArrayBuffer | ArrayBufferView;
  },
  maxBytes: number
):
  | { ok: true; originalName: string; mimeType: "model/gltf-binary"; bytes: Buffer }
  | { ok: false; error: string; status: 400 | 413 } {
  const originalName = sanitizeModelLabOriginalName(file.name);
  const lowerName = originalName.toLowerCase();

  if (/[\\/]/.test(file.name) || file.name.includes("..")) {
    return { ok: false, error: "Filename must not contain paths.", status: 400 };
  }
  if (!lowerName.endsWith(".glb")) {
    return { ok: false, error: "Only .glb files are accepted.", status: 400 };
  }

  const declaredSize = Number(file.size);
  if (!Number.isFinite(declaredSize) || declaredSize <= 0) {
    return { ok: false, error: "GLB file is empty.", status: 400 };
  }
  if (declaredSize > maxBytes) {
    return { ok: false, error: "GLB is larger than the configured Model Lab cap.", status: 413 };
  }

  const bytes = normalizeModelLabBytes(file.bytes);
  if (bytes.byteLength !== declaredSize || bytes.byteLength > maxBytes) {
    return { ok: false, error: "GLB file size does not match the upload body.", status: 400 };
  }

  const mimeType = (file.type || "").split(";")[0].trim().toLowerCase();
  if (!ALLOWED_GLB_MIME_TYPES.has(mimeType)) {
    return { ok: false, error: "GLB MIME type is not accepted.", status: 400 };
  }

  try {
    parseGlbContainer(bytes);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "GLB container is invalid.",
      status: 400
    };
  }

  return { ok: true, originalName, mimeType: "model/gltf-binary", bytes };
}

export function parseModelLabMode(value: FormDataEntryValue | null):
  | { ok: true; mode: ModelLabPresetId }
  | { ok: false; error: string } {
  if (typeof value !== "string") {
    return { ok: false, error: "Mode is required." };
  }

  const mode = value.trim();
  if (!MODEL_LAB_PRESETS.some((preset) => preset.id === mode)) {
    return { ok: false, error: "Mode is not supported by Vistaire Model Lab." };
  }

  return { ok: true, mode: mode as ModelLabPresetId };
}
