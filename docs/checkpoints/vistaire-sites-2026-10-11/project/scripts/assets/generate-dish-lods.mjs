import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { NodeIO } from "@gltf-transform/core";
import {
  ALL_EXTENSIONS,
  EXTMeshoptCompression,
} from "@gltf-transform/extensions";
import {
  compactPrimitive,
  getBounds,
  reorder,
  weld,
} from "@gltf-transform/functions";
import draco from "draco3dgltf";
import validator from "gltf-validator";
import {
  MeshoptDecoder,
  MeshoptEncoder,
  MeshoptSimplifier,
} from "meshoptimizer";

// No texture transform, material edit, vertex update, lossy welding, or new
// quantization is applied. Only triangles are collapsed onto existing vertices.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const outputDir = resolve(root, "public/assets/dishes/lod");
const expected = {
  huitres: "5169fc3b87f36927a770fce880de6cc2a7f9acc4ddfd037974b82dbc319069d7",
  sushi: "9b94523eaf54c6789d66c02d1bcb5fafd8d910dab5237e55b0c8016323056e88",
  "chocolat-fume":
    "81cc641cf08f34d1ef0854f55c0dfe1a101f0f1814de8fbefc6fda7d36ecee73",
  poutine: "66d25e9532f04591c8f3cbd818d80dc797b1611a8fa75041beb89d52eb1d6f2d",
  burger: "0452856149f975b5a8867e4d2e40f71dc69c7bc3a26942cd14a71bcdc23660ae",
};
const targetTriangles = 120_000;
const maximumCombinedError = 0.002;
const normalWeight = 0.2;
const uvWeight = 4;
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const arrayHash = (array) =>
  sha256(new Uint8Array(array.buffer, array.byteOffset, array.byteLength));

await Promise.all([
  MeshoptDecoder.ready,
  MeshoptEncoder.ready,
  MeshoptSimplifier.ready,
]);
assert.ok(
  MeshoptSimplifier.supported,
  "Meshopt WASM simplification unavailable",
);
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    "meshopt.decoder": MeshoptDecoder,
    "meshopt.encoder": MeshoptEncoder,
    "draco3d.decoder": await draco.createDecoderModule(),
  });

function geometryStats(document) {
  let triangles = 0;
  let vertices = 0;
  let decodedAttributeBytes = 0;
  let decodedIndexBytes = 0;
  for (const mesh of document.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      assert.equal(primitive.getMode(), 4, "Only triangle lists are supported");
      assert.equal(
        primitive.listTargets().length,
        0,
        "Morph targets unsupported",
      );
      triangles += primitive.getIndices().getCount() / 3;
      vertices += primitive.getAttribute("POSITION").getCount();
      decodedIndexBytes += primitive.getIndices().getArray().byteLength;
      for (const accessor of primitive.listAttributes()) {
        decodedAttributeBytes += accessor.getArray().byteLength;
      }
    }
  }
  return {
    triangles,
    vertices,
    decodedAttributeBytes,
    decodedIndexBytes,
    decodedGeometryBytes: decodedAttributeBytes + decodedIndexBytes,
    bounds: getBounds(document.getRoot().listScenes()[0]),
  };
}

function textureHashes(document) {
  return document
    .getRoot()
    .listTextures()
    .map((texture) => ({
      name: texture.getName(),
      mimeType: texture.getMimeType(),
      bytes: texture.getImage().byteLength,
      sha256: sha256(texture.getImage()),
    }));
}

function attributeSnapshot(document) {
  return document
    .getRoot()
    .listMeshes()
    .flatMap((mesh) =>
      mesh.listPrimitives().map((primitive) =>
        Object.fromEntries(
          primitive.listSemantics().map((semantic) => {
            const accessor = primitive.getAttribute(semantic);
            return [
              semantic,
              {
                count: accessor.getCount(),
                componentType: accessor.getComponentType(),
                normalized: accessor.getNormalized(),
                sha256: arrayHash(accessor.getArray()),
              },
            ];
          }),
        ),
      ),
    );
}

async function appearanceSnapshot(document) {
  const { json } = await io.writeJSON(document);
  return {
    materials: json.materials,
    textures: json.textures,
    samplers: json.samplers,
    nodes: json.nodes,
    copyright: json.asset.copyright ?? null,
  };
}

function floatValues(accessor) {
  const array = accessor.getArray();
  if (array instanceof Float32Array && !accessor.getNormalized()) return array;
  const values = new Float32Array(
    accessor.getCount() * accessor.getElementSize(),
  );
  const element = [];
  for (let index = 0; index < accessor.getCount(); index++) {
    accessor.getElement(index, element);
    values.set(element, index * accessor.getElementSize());
  }
  return values;
}

function simplifyPrimitive(primitive) {
  const documentVertexCount = primitive.getAttribute("POSITION").getCount();
  const positions = floatValues(primitive.getAttribute("POSITION"));
  const normals = floatValues(primitive.getAttribute("NORMAL"));
  const uv = floatValues(primitive.getAttribute("TEXCOORD_0"));
  const attributes = new Float32Array(documentVertexCount * 5);
  for (let index = 0; index < documentVertexCount; index++) {
    attributes.set(normals.subarray(index * 3, index * 3 + 3), index * 5);
    attributes.set(uv.subarray(index * 2, index * 2 + 2), index * 5 + 3);
  }
  const originalIndices = new Uint32Array(primitive.getIndices().getArray());
  const [indices, estimatedError] = MeshoptSimplifier.simplifyWithAttributes(
    originalIndices,
    positions,
    3,
    attributes,
    5,
    [normalWeight, normalWeight, normalWeight, uvWeight, uvWeight],
    null,
    targetTriangles * 3,
    maximumCombinedError,
    [],
  );
  assert.ok(
    indices.length / 3 >= 80_000 && indices.length / 3 <= 150_000,
    `Quality-constrained result ${indices.length / 3} triangles is outside mobile budget`,
  );
  assert.ok(estimatedError <= maximumCombinedError);
  primitive.getIndices().setArray(indices);

  // Retain the exact values of each surviving vertex, including UVs/normals.
  const remap = new Uint32Array(documentVertexCount).fill(0xffffffff);
  let compactCount = 0;
  for (const index of indices) {
    if (remap[index] === 0xffffffff) remap[index] = compactCount++;
  }
  const sources = Object.fromEntries(
    primitive.listSemantics().map((semantic) => [
      semantic,
      {
        array: primitive.getAttribute(semantic).getArray(),
        size: primitive.getAttribute(semantic).getElementSize(),
      },
    ]),
  );
  compactPrimitive(primitive, remap, compactCount);
  for (const [semantic, { array, size }] of Object.entries(sources)) {
    const compacted = primitive.getAttribute(semantic).getArray();
    for (let oldIndex = 0; oldIndex < remap.length; oldIndex++) {
      if (remap[oldIndex] === 0xffffffff) continue;
      for (let component = 0; component < size; component++) {
        assert.equal(
          compacted[remap[oldIndex] * size + component],
          array[oldIndex * size + component],
          `${semantic} changed during compaction`,
        );
      }
    }
  }
  return {
    targetTriangles,
    maximumCombinedError,
    estimatedCombinedError: estimatedError,
    normalWeight,
    uvWeight,
    preservedVertexAttributeValues: true,
    note: "Combined position/attribute error is Meshopt's estimate, not a Hausdorff or pixel-error bound.",
  };
}

async function validate(bytes, uri) {
  const result = await validator.validateBytes(new Uint8Array(bytes), {
    uri,
    maxIssues: 100,
  });
  return {
    numErrors: result.issues.numErrors,
    numWarnings: result.issues.numWarnings,
    numInfos: result.issues.numInfos,
    numHints: result.issues.numHints,
    truncated: result.issues.truncated,
    messages: result.issues.messages,
  };
}

await mkdir(outputDir, { recursive: true });
const dishes = [];
for (const [id, expectedHash] of Object.entries(expected)) {
  const originalPath = resolve(root, `public/assets/dishes/${id}.glb`);
  const outputPath = resolve(outputDir, `${id}-mobile.glb`);
  const originalBytes = await readFile(originalPath);
  assert.equal(
    sha256(originalBytes),
    expectedHash,
    `${id} original differs from supplied asset`,
  );
  const document = await io.read(originalPath);
  const original = geometryStats(document);
  const originalTextures = textureHashes(document);
  document.disposeExtension("KHR_draco_mesh_compression");
  document.disposeExtension("EXT_meshopt_compression");
  const originalAppearance = await appearanceSnapshot(document);
  const originalDecodedValidation = await validate(
    await io.writeBinary(document),
    `${id}-original-decoded.glb`,
  );
  await document.transform(weld());
  const simplification = document
    .getRoot()
    .listMeshes()
    .flatMap((mesh) => mesh.listPrimitives().map(simplifyPrimitive));
  await document.transform(
    reorder({ encoder: MeshoptEncoder, target: "performance", cleanup: false }),
  );
  // reorder(cleanup:false) deliberately leaves old accessors in the graph.
  // Remove only accessors without consumers; do not prune images/materials/nodes.
  for (const accessor of document.getRoot().listAccessors()) {
    if (
      accessor.listParents().every((parent) => parent === document.getRoot())
    ) {
      accessor.dispose();
    }
  }
  assert.deepEqual(
    textureHashes(document),
    originalTextures,
    "Source image bytes changed",
  );
  assert.deepEqual(
    await appearanceSnapshot(document),
    originalAppearance,
    "Materials, samplers, nodes or copyright changed",
  );

  document.getRoot().getAsset().generator +=
    "; Vistaire mobile LOD (Meshopt attribute-aware simplification)";
  document.getRoot().setExtras({
    ...document.getRoot().getExtras(),
    vistaireLod: {
      originalSha256: expectedHash,
      targetTriangles,
      maximumCombinedError,
    },
  });
  document
    .createExtension(EXTMeshoptCompression)
    .setRequired(true)
    // This mode encodes existing arrays losslessly. No quantize() transform is used.
    .setEncoderOptions({
      method: EXTMeshoptCompression.EncoderMethod.QUANTIZE,
    });
  const expectedAttributes = attributeSnapshot(document);
  const outputBytes = await io.writeBinary(document);
  const decoded = await io.readBinary(outputBytes);
  assert.deepEqual(
    attributeSnapshot(decoded),
    expectedAttributes,
    "Meshopt roundtrip changed vertex attributes",
  );
  assert.deepEqual(
    textureHashes(decoded),
    originalTextures,
    "Encoded output changed source images",
  );
  assert.deepEqual(
    await appearanceSnapshot(decoded),
    originalAppearance,
    "Encoded output changed appearance properties",
  );
  const mobile = geometryStats(decoded);
  for (const mesh of decoded.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      const count = primitive.getAttribute("POSITION").getCount();
      for (const index of primitive.getIndices().getArray())
        assert.ok(index < count);
      for (const accessor of primitive.listAttributes()) {
        assert.equal(accessor.getCount(), count);
        for (const value of accessor.getArray())
          assert.ok(Number.isFinite(value));
      }
    }
  }
  const encodedValidation = await validate(outputBytes, `${id}-mobile.glb`);
  decoded.disposeExtension("EXT_meshopt_compression");
  const decodedValidation = await validate(
    await io.writeBinary(decoded),
    `${id}-mobile-decoded.glb`,
  );
  assert.equal(
    decodedValidation.numErrors,
    0,
    `${id} decoded LOD has glTF validation errors`,
  );
  assert.equal(
    encodedValidation.numErrors,
    0,
    `${id} encoded LOD has glTF validation errors`,
  );
  assert.equal(
    sha256(await readFile(originalPath)),
    expectedHash,
    "Original changed during generation",
  );
  await writeFile(outputPath, outputBytes);
  const maximumBoundsDelta = Math.max(
    ...["min", "max"].flatMap((key) =>
      original.bounds[key].map((value, axis) =>
        Math.abs(value - mobile.bounds[key][axis]),
      ),
    ),
  );
  dishes.push({
    id,
    original: {
      path: relative(root, originalPath),
      bytes: originalBytes.length,
      sha256: expectedHash,
      ...original,
    },
    mobile: {
      path: relative(root, outputPath),
      href: `/assets/dishes/lod/${id}-mobile.glb`,
      bytes: outputBytes.length,
      sha256: sha256(outputBytes),
      ...mobile,
    },
    triangleReductionPercent: (1 - mobile.triangles / original.triangles) * 100,
    maximumWorldBoundsDelta: maximumBoundsDelta,
    imagesRetainedExactly: originalTextures,
    materialsSamplersTransformsRetained: true,
    originalFileRetainedUnchanged: true,
    simplification,
    validation: {
      originalDecoded: originalDecodedValidation,
      encoded: encodedValidation,
      decoded: decodedValidation,
    },
    rights:
      "Derived from the user's supplied Vistaire model under their explicit authorization. No broader model licence inferred. Embedded metadata and copyright retained.",
  });
  console.log(
    `${id}: ${original.triangles.toLocaleString()} -> ${mobile.triangles.toLocaleString()} triangles; ${outputBytes.length} bytes; error=${simplification[0].estimatedCombinedError}; bounds delta=${maximumBoundsDelta}`,
  );
}
await writeFile(
  resolve(root, "docs/lod-inventory.json"),
  JSON.stringify(
    {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      scope:
        "Five derived mobile GLBs. Source GLBs and textures unchanged. No Scene/App/RestaurantWorld modification.",
      tools: [
        {
          name: "glTF Transform",
          version: "4.5.1",
          licence: "MIT",
          author: "Don McCurdy",
          source: "https://github.com/donmccurdy/glTF-Transform",
          registry: "https://registry.npmjs.org",
        },
        {
          name: "meshoptimizer",
          version: "1.1.1",
          licence: "MIT",
          author: "Arseny Kapoulkine",
          source: "https://github.com/zeux/meshoptimizer",
        },
        {
          name: "draco3dgltf",
          version: "1.5.7",
          licence: "Apache-2.0",
          author: "Google LLC",
          source: "https://github.com/google/draco",
        },
        {
          name: "glTF Validator",
          version: "2.0.0-dev.3.10",
          licence: "Apache-2.0",
          author: "The Khronos Group Inc.",
          source: "https://github.com/KhronosGroup/glTF-Validator",
        },
      ],
      method:
        "Exact weld, Meshopt simplifyWithAttributes (existing vertices only, no permissive/sloppy/prune flags), compact all surviving attributes, reorder for GPU locality, lossless Meshopt encoding of existing component arrays. No new quantization or texture conversion.",
      memoryEstimateNote:
        "DecodedGeometryBytes sums tightly packed decoded attribute/index arrays. It excludes stride padding, extra allocations, textures/mipmaps, render targets and GPU-driver overhead; it is not measured GPU memory.",
      validated: [
        "Original SHA-256 unchanged",
        "Embedded image bytes identical",
        "Materials, samplers, transforms and copyright unchanged",
        "Surviving vertex attributes identical",
        "Serialized Meshopt attribute roundtrip exact",
        "Finite attributes and in-range indices",
        "Khronos raw and fully decoded glTF validation",
      ],
      notVerified: [
        "Side-by-side rendered visual parity",
        "Physical mobile FPS and thermal behaviour",
        "AR placement quality",
        "Hausdorff/pixel-error bounds; Meshopt combined error is only an estimate",
      ],
      dishes,
    },
    null,
    2,
  ) + "\n",
);
