import type { VariantRole } from "./presets.mjs";

export type CandidateAnalysis = {
  variantRole: VariantRole;
  bytes: number;
  sha256: string;
  triangleCount: number;
  vertexCount: number;
  materialCount: number;
  textureCount: number;
  maxTextureSize: number | null;
  extensionsUsed: string[];
  extensionsRequired: string[];
  externalUris: string[];
  externalUriCount: number;
  groundedY: boolean;
  centeredXZ: boolean;
  dimensionsMeters: number[];
  primitives: number;
};

export function analyzeCandidateGlb(args: {
  buffer: Buffer;
  variantRole: VariantRole;
}): CandidateAnalysis;

export function sha256Hex(buffer: Buffer): string;
