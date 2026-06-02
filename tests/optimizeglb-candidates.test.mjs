import assert from "node:assert/strict";
import test from "node:test";

import {
  isValidPresetLabel,
  isValidVariantRole,
  recommendedPresetsForRole
} from "../scripts/3d/shared/optimizeglb/presets.mjs";
import {
  candidateStatusFromAnalysis,
  classifyCandidateBudget,
  evaluateCandidateSet,
  isNoOpCandidate,
  recommendCandidatePerRole,
  sortCandidatesForRole
} from "../scripts/3d/shared/optimizeglb/candidate-rules.mjs";
import { analyzeCandidateGlb } from "../scripts/3d/shared/optimizeglb/candidate-analysis.mjs";
import {
  buildCandidateRetryBrief,
  buildSetRetryBrief
} from "../scripts/3d/shared/optimizeglb/retry-brief.mjs";

const MB = 1000 * 1000;
const MiB = 1024 * 1024;

function padJson(value) {
  const raw = Buffer.from(JSON.stringify(value), "utf8");
  return Buffer.concat([raw, Buffer.alloc((4 - (raw.length % 4)) % 4, 0x20)]);
}

function padBin(value) {
  return Buffer.concat([value, Buffer.alloc((4 - (value.length % 4)) % 4)]);
}

function makeGlb(gltf, bin) {
  const json = padJson(gltf);
  const binChunk = padBin(bin);
  const totalLength = 12 + 8 + json.length + 8 + binChunk.length;
  const buffer = Buffer.alloc(totalLength);
  buffer.write("glTF", 0, "ascii");
  buffer.writeUInt32LE(2, 4);
  buffer.writeUInt32LE(totalLength, 8);
  buffer.writeUInt32LE(json.length, 12);
  buffer.writeUInt32LE(0x4e4f534a, 16);
  json.copy(buffer, 20);
  const binOffset = 20 + json.length;
  buffer.writeUInt32LE(binChunk.length, binOffset);
  buffer.writeUInt32LE(0x004e4942, binOffset + 4);
  binChunk.copy(buffer, binOffset + 8);
  return buffer;
}

function fakePng(width, height) {
  const png = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png, 0);
  png.writeUInt32BE(13, 8);
  png.write("IHDR", 12, "ascii");
  png.writeUInt32BE(width, 16);
  png.writeUInt32BE(height, 20);
  return png;
}

function makeTexturedTriangleGlb({ extensionsRequired = [], grounded = true } = {}) {
  const points = [
    [-0.25, grounded ? 0 : -0.3, -0.2],
    [0.25, grounded ? 0 : -0.3, -0.2],
    [0, grounded ? 0.12 : -0.18, 0.2]
  ];
  const positions = Buffer.alloc(points.length * 12);
  points.flat().forEach((value, index) => positions.writeFloatLE(value, index * 4));
  const indices = Buffer.alloc(3 * 2);
  [0, 1, 2].forEach((value, index) => indices.writeUInt16LE(value, index * 2));
  const bin = Buffer.concat([positions, indices]);
  const gltf = {
    asset: { version: "2.0", generator: "vistaire-optimizeglb-test" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    buffers: [{ byteLength: bin.length }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: positions.length },
      { buffer: 0, byteOffset: positions.length, byteLength: indices.length }
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 3, type: "VEC3" },
      { bufferView: 1, componentType: 5123, count: 3, type: "SCALAR" }
    ],
    materials: [{ name: "plat" }],
    textures: [{ source: 0 }],
    images: [{ uri: `data:image/png;base64,${fakePng(1024, 512).toString("base64")}` }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0 }] }]
  };
  if (extensionsRequired.length > 0) gltf.extensionsRequired = extensionsRequired;
  return makeGlb(gltf, bin);
}

test("preset vocabulary validates roles and labels", () => {
  assert.equal(isValidVariantRole("arLite"), true);
  assert.equal(isValidVariantRole("nope"), false);
  assert.equal(isValidPresetLabel("optimizeglb-ios-source"), true);
  assert.equal(isValidPresetLabel("optimizeglb-cloud"), false);
  assert.deepEqual(recommendedPresetsForRole("arLite"), [
    "optimizeglb-ar-lite-aggressive",
    "optimizeglb-ar-lite-emergency"
  ]);
});

test("web candidate over 12MB fails the byte budget", () => {
  const result = classifyCandidateBudget({ variantRole: "web", bytes: 13 * MB });
  assert.equal(result.budgetStatus, "fail");
  assert.equal(result.fails.length >= 1, true);
});

test("mobile candidate within budget passes", () => {
  const result = classifyCandidateBudget({ variantRole: "mobile", bytes: 4 * MB });
  assert.notEqual(result.budgetStatus, "fail");
  assert.equal(result.fails.length, 0);
});

test("arLite over 15 MiB fails", () => {
  const result = classifyCandidateBudget({
    variantRole: "arLite",
    bytes: 16 * MiB,
    triangleCount: 50_000,
    extensionsRequired: [],
    groundedY: true,
    centeredXZ: true
  });
  assert.equal(result.budgetStatus, "fail");
});

test("arLite over 150k triangles fails", () => {
  const result = classifyCandidateBudget({
    variantRole: "arLite",
    bytes: 8 * MiB,
    triangleCount: 220_000,
    groundedY: true,
    centeredXZ: true
  });
  assert.equal(result.budgetStatus, "fail");
  assert.equal(result.fails.some((f) => /triangle/i.test(f)), true);
});

test("arLite with required extensions or external URIs fails", () => {
  const required = classifyCandidateBudget({
    variantRole: "arLite",
    bytes: 8 * MiB,
    triangleCount: 40_000,
    extensionsRequired: ["KHR_draco_mesh_compression"],
    groundedY: true,
    centeredXZ: true
  });
  assert.equal(required.budgetStatus, "fail");

  const external = classifyCandidateBudget({
    variantRole: "web",
    bytes: 4 * MB,
    externalUriCount: 1
  });
  assert.equal(external.budgetStatus, "fail");
});

test("no-op candidate (same SHA as source) is rejected", () => {
  assert.equal(isNoOpCandidate("abc", "abc"), true);
  assert.equal(isNoOpCandidate("abc", "def"), false);
  assert.equal(
    candidateStatusFromAnalysis(
      { variantRole: "web", bytes: 4 * MB, sha256: "abc" },
      "abc"
    ),
    "no_op_rejected"
  );
});

test("recommendation picks the smallest passing candidate and never a failed one", () => {
  const candidates = [
    { variantRole: "web", bytes: 9 * MB, status: "candidate_analyzed", budgetStatus: "advisory" },
    { variantRole: "web", bytes: 5 * MB, status: "candidate_analyzed", budgetStatus: "target" },
    { variantRole: "web", bytes: 1 * MB, status: "candidate_invalid", budgetStatus: "fail" }
  ];
  const recommended = recommendCandidatePerRole(candidates);
  assert.equal(recommended.web.bytes, 5 * MB);
  const sorted = sortCandidatesForRole(candidates);
  assert.equal(sorted[sorted.length - 1].status, "candidate_invalid");
});

test("candidate set is incomplete without web/mobile/arLite", () => {
  const evaluation = evaluateCandidateSet({
    sourceSha256: "s",
    members: {
      web: { variantRole: "web", sourceSha256: "s", bytes: 5 * MB, status: "candidate_visual_passed", budgetStatus: "target", visualStatus: "passed" }
    }
  });
  assert.equal(evaluation.status, "incomplete");
  assert.equal(evaluation.canApprove, false);
  assert.deepEqual(evaluation.missingRoles, ["mobile", "arLite"]);
});

test("candidate set cannot mix different source SHAs", () => {
  const evaluation = evaluateCandidateSet({
    sourceSha256: "s",
    members: {
      web: { variantRole: "web", sourceSha256: "s", bytes: 5 * MB, status: "candidate_visual_passed", budgetStatus: "target", visualStatus: "passed" },
      mobile: { variantRole: "mobile", sourceSha256: "s", bytes: 3 * MB, status: "candidate_visual_passed", budgetStatus: "target", visualStatus: "passed" },
      arLite: { variantRole: "arLite", sourceSha256: "OTHER", bytes: 8 * MiB, status: "candidate_visual_passed", budgetStatus: "target", visualStatus: "passed" }
    }
  });
  assert.equal(evaluation.canApprove, false);
  assert.equal(evaluation.fails.some((f) => /SHA mismatch/i.test(f)), true);
});

test("candidate set needs visual compare before approval, then becomes recommended", () => {
  const base = {
    web: { variantRole: "web", sourceSha256: "s", bytes: 5 * MB, status: "candidate_analyzed", budgetStatus: "target", visualStatus: "pending" },
    mobile: { variantRole: "mobile", sourceSha256: "s", bytes: 3 * MB, status: "candidate_analyzed", budgetStatus: "target", visualStatus: "pending" },
    arLite: { variantRole: "arLite", sourceSha256: "s", bytes: 8 * MiB, status: "candidate_analyzed", budgetStatus: "target", visualStatus: "pending" }
  };
  const pending = evaluateCandidateSet({ sourceSha256: "s", members: base });
  assert.equal(pending.status, "needs_visual_compare");
  assert.equal(pending.canApprove, false);

  const passed = evaluateCandidateSet({
    sourceSha256: "s",
    members: {
      web: { ...base.web, status: "candidate_visual_passed", visualStatus: "passed" },
      mobile: { ...base.mobile, status: "candidate_visual_passed", visualStatus: "passed" },
      arLite: { ...base.arLite, status: "candidate_visual_passed", visualStatus: "passed" }
    }
  });
  assert.equal(passed.status, "recommended");
  assert.equal(passed.canApprove, true);
});

test("candidate analysis reads geometry, materials, textures and max texture size", () => {
  const analysis = analyzeCandidateGlb({ buffer: makeTexturedTriangleGlb(), variantRole: "arLite" });
  assert.equal(analysis.triangleCount, 1);
  assert.equal(analysis.materialCount, 1);
  assert.equal(analysis.textureCount, 1);
  assert.equal(analysis.maxTextureSize, 1024);
  assert.equal(analysis.externalUriCount, 0);
  assert.equal(analysis.groundedY, true);
  assert.equal(typeof analysis.sha256, "string");
  assert.equal(analysis.sha256.length, 64);
});

test("retry brief gives concrete numeric guidance, never vague", () => {
  const brief = buildCandidateRetryBrief({
    variantRole: "arLite",
    budgetStatus: "fail",
    bytes: 22 * MiB,
    triangleCount: 221_000,
    extensionsRequired: ["KHR_draco_mesh_compression"],
    groundedY: false
  });
  assert.equal(brief.items.length >= 3, true);
  assert.equal(brief.items.some((item) => /15 MiB|512/.test(item.fix) || /MiB/.test(item.problem)), true);
  assert.equal(brief.items.some((item) => /50k-100k|triangles/i.test(item.fix)), true);
  assert.equal(brief.items.some((item) => /extension|Draco/i.test(item.problem)), true);

  const usdzBrief = buildCandidateRetryBrief({ variantRole: "iosSource", usdzBytes: 28 * MiB });
  assert.equal(usdzBrief.items.some((item) => /USDZ/i.test(item.problem)), true);

  const sets = buildSetRetryBrief([
    { variantRole: "web", budgetStatus: "target", bytes: 5_000_000 },
    { variantRole: "arLite", budgetStatus: "fail", bytes: 22 * MiB }
  ]);
  assert.equal(sets.length, 1);
  assert.equal(sets[0].role, "arLite");
});

test("candidate analysis surfaces required extensions for AR-lite gating", () => {
  const analysis = analyzeCandidateGlb({
    buffer: makeTexturedTriangleGlb({ extensionsRequired: ["KHR_draco_mesh_compression"], grounded: false }),
    variantRole: "arLite"
  });
  const budget = classifyCandidateBudget(analysis);
  assert.equal(budget.budgetStatus, "fail");
  assert.equal(budget.fails.some((f) => /extension/i.test(f)), true);
  assert.equal(budget.fails.some((f) => /grounded/i.test(f)), true);
});
