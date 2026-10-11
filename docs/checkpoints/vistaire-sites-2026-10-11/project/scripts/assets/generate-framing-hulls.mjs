import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import draco from "draco3dgltf";
import { MeshoptDecoder } from "meshoptimizer";

// Offline CPU generation only. No GLB, texture, or material is changed.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const variants = [
  ["homard-desktop", "homard", "/media/homard.glb"],
  ["homard-mobile", "homard", "/media/homard-mobile.glb"],
  ["souffle", "souffle", "/media/souffle.glb"],
  ...["huitres", "sushi", "chocolat-fume", "poutine", "burger"].map((id) => [
    id,
    id,
    `/assets/dishes/lod/${id}-mobile.glb`,
  ]),
];
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    "meshopt.decoder": MeshoptDecoder,
    "draco3d.decoder": await draco.createDecoderModule(),
  });
const directory = await mkdtemp(resolve(tmpdir(), "vistaire-framing-hulls-"));
const manifest = [];
const assetProvenance = JSON.parse(
  await readFile(resolve(root, "asset-provenance.json"), "utf8"),
);
const lodInventory = JSON.parse(
  await readFile(resolve(root, "docs/lod-inventory.json"), "utf8"),
);

try {
  for (const [variant, id, url] of variants) {
    const file = resolve(root, `public${url}`);
    const bytes = await readFile(file);
    const jsonLength = bytes.readUInt32LE(12);
    const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
    const sourceHash = createHash("sha256").update(bytes).digest("hex");
    const runtimeOrigin = assetProvenance.find(
      (asset) => asset.sha256 === sourceHash,
    );
    const lodOrigin = lodInventory.dishes.find(
      (dish) => dish.mobile.sha256 === sourceHash,
    );
    const provenance = lodOrigin
      ? {
          kind: "metadata-derived-from-user-authorized-lod",
          original: lodOrigin.original.path,
          originalSha256: lodOrigin.original.sha256,
          inventory: "docs/lod-inventory.json",
          sourceCopyright: json.asset.copyright ?? null,
        }
      : {
          kind: "metadata-derived-from-official-vistaire-runtime",
          repository: "https://github.com/MarcSaad-Hadidi/Vistaire",
          original: runtimeOrigin?.sourcePath ?? null,
          inventory: "asset-provenance.json",
          sourceCopyright: json.asset.copyright ?? null,
        };
    assert.equal(
      (json.skins ?? []).length,
      0,
      "Static, unskinned models required",
    );
    assert.equal((json.animations ?? []).length, 0, "Static models required");
    const document = await io.read(file);
    const meshes = document.getRoot().listMeshes();
    const scene =
      document.getRoot().getDefaultScene() ??
      document.getRoot().listScenes()[0];
    const bounds = new THREE.Box3();
    const meshesToRead = [];
    for (const ancestor of scene.listChildren()) {
      ancestor.traverse((node) => {
        const mesh = node.getMesh();
        if (!mesh) return;
        const meshIndex = meshes.indexOf(mesh);
        const matrix = new THREE.Matrix4().fromArray(node.getWorldMatrix());
        mesh.listPrimitives().forEach((primitive, primitiveIndex) => {
          assert.equal(primitive.getMode(), 4, "Triangle lists required");
          assert.equal(primitive.listTargets().length, 0, "Morphs unsupported");
          const position = primitive.getAttribute("POSITION");
          const definition = json.meshes[meshIndex].primitives[primitiveIndex];
          const accessor = json.accessors[definition.attributes.POSITION];
          assert(
            accessor.min && accessor.max,
            "GLTFLoader accessor bounds required",
          );
          // Mirror GLTFLoader.computeBounds, then Box3.setFromObject (non-precise),
          // exactly as the current Scene.jsx normalization does.
          const box = new THREE.Box3(
            new THREE.Vector3().fromArray(accessor.min),
            new THREE.Vector3().fromArray(accessor.max),
          );
          if (accessor.normalized) {
            const divisor = { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 }[
              accessor.componentType
            ];
            assert(divisor, "Unsupported normalized position component type");
            box.min.multiplyScalar(1 / divisor);
            box.max.multiplyScalar(1 / divisor);
          }
          bounds.union(box.applyMatrix4(matrix));
          meshesToRead.push({
            position,
            indices: primitive.getIndices(),
            matrix,
          });
        });
      });
    }
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const scale = 2.35 / Math.max(size.x, size.z, size.y * 1.3, 0.001);
    const offset = new THREE.Vector3(
      -center.x * scale,
      -bounds.min.y * scale,
      -center.z * scale,
    );
    const points = [];
    let sourceVertices = 0;
    let triangles = 0;
    const element = [],
      point = new THREE.Vector3();
    for (const { position, indices, matrix } of meshesToRead) {
      sourceVertices += position.getCount();
      triangles += (indices?.getCount() ?? position.getCount()) / 3;
      const referenced = indices
        ? new Set(Array.from(indices.getArray()))
        : Array.from({ length: position.getCount() }, (_, index) => index);
      for (const index of referenced) {
        position.getElement(index, element);
        point
          .fromArray(element)
          .applyMatrix4(matrix)
          .multiplyScalar(scale)
          .add(offset);
        points.push(point.x, point.y, point.z);
      }
    }
    const positions = new Float64Array(points);
    const binary = resolve(directory, `${variant}.float64`);
    await writeFile(binary, new Uint8Array(positions.buffer));
    manifest.push({
      variant,
      id,
      url,
      source: {
        bytes: bytes.length,
        sha256: sourceHash,
        vertices: sourceVertices,
        triangles,
      },
      provenance,
      normalization: {
        scale,
        position: offset.toArray(),
        sourceBounds: { min: bounds.min.toArray(), max: bounds.max.toArray() },
        maxDimension: 2.35,
        heightWeight: 1.3,
      },
      binary,
      referencedVertices: points.length / 3,
    });
    console.log(`Decoded ${variant}: ${points.length / 3} referenced vertices`);
  }
  const manifestFile = resolve(directory, "manifest.json");
  await writeFile(manifestFile, JSON.stringify(manifest));
  const output = resolve(root, "public/assets/dishes/framing-hulls.json");
  const python = String.raw`
import json, sys
import numpy as np
import scipy
from scipy.spatial import ConvexHull
with open(sys.argv[1]) as file: manifest = json.load(file)
result = {"schemaVersion":1,"coordinateSpace":"Normalized activeDish coordinates, before dishRoot transform", "method":"Exact unsampled convex hull of all indexed drawable decoded vertices, including all node transforms. No QJ jitter, simplification, or coordinate rounding.","tools":{"scipy":scipy.__version__,"numpy":np.__version__,"qhullOptions":"Qc Tv"},"provenance":{"generator":"scripts/assets/generate-framing-hulls.mjs","sourceInventory":"asset-provenance.json","lodInventory":"docs/lod-inventory.json","rightsScope":"Derived geometric metadata only. Original author, attribution and licence are not changed or expanded. Existing user-authorized Vistaire runtime and supplied model assets; no broader redistribution licence is inferred."},"byUrl":{}}
for entry in manifest:
    points = np.fromfile(entry.pop("binary"),dtype=np.float64).reshape(-1,3)
    unique = np.unique(points,axis=0)
    hull = ConvexHull(unique,qhull_options="Qc Tv")
    # Check every source vertex against every hull plane in bounded chunks.
    maximum = float('-inf')
    for start in range(0,len(unique),2048):
        chunk=unique[start:start+2048]
        for face in range(0,len(hull.equations),256):
            equations=hull.equations[face:face+256]
            maximum=max(maximum,float(np.max(chunk @ equations[:,:3].T + equations[:,3])))
    assert maximum <= 1e-9, (entry['variant'],maximum)
    vertices=unique[hull.vertices]
    entry.update({"vertexCount":len(vertices),"facetCount":len(hull.simplices),"uniqueSourceVertices":len(unique),"vertices":vertices.tolist(),"validation":{"allSourceVerticesContained":True,"maximumOutsideDistance":maximum,"tolerance":1e-9},"bounds":{"min":vertices.min(axis=0).tolist(),"max":vertices.max(axis=0).tolist()},"radiusXZ":float(np.sqrt(unique[:,0]**2+unique[:,2]**2).max())})
    result['byUrl'][entry['url']]=entry
    print(f"Hull {entry['variant']}: {len(vertices)} vertices, {len(hull.simplices)} facets; containment {maximum:.3g}",flush=True)
with open(sys.argv[2],'w') as file: json.dump(result,file,separators=(',',':'),ensure_ascii=False);file.write('\n')
`;
  const run = spawnSync("python", ["-c", python, manifestFile, output], {
    stdio: "inherit",
    env: { ...process.env, OPENBLAS_NUM_THREADS: "2", OMP_NUM_THREADS: "2" },
  });
  assert.equal(
    run.status,
    0,
    "Exact ConvexHull generation/verification failed",
  );
  console.log(`Wrote ${output}`);
} finally {
  await rm(directory, { recursive: true, force: true });
}
