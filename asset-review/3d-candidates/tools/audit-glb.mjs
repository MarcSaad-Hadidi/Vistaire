import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { basename, relative, resolve } from "node:path";
import { NodeIO, getBounds, ImageUtils } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";

const ROOT = resolve(process.cwd());
const DEFAULT_ASSETS = [
  "public/models/demo/ravioles-chevre-miel.glb",
  "public/models/demo/homard-bisque.glb",
  "public/models/demo/souffle-chocolat.glb",
  "public/models/demo/maison-elyse-n1.glb",
];

const usageByFile = new Map([
  ["ravioles-chevre-miel.glb", { dish: "ravioles-romarin", url: "/models/demo/ravioles-chevre-miel.glb", role: "Web 3D / Android Scene Viewer source" }],
  ["homard-bisque.glb", { dish: "homard-bisque", url: "/models/demo/homard-bisque.glb", role: "Web 3D / Android Scene Viewer source" }],
  ["souffle-chocolat.glb", { dish: "souffle-chocolat", url: "/models/demo/souffle-chocolat.glb", role: "Web 3D / Android Scene Viewer source" }],
  ["maison-elyse-n1.glb", { dish: "cocktail-maison-elyse", url: "/models/demo/maison-elyse-n1.glb", role: "Web 3D / Android Scene Viewer source; audit only" }],
]);

const round = (value) => Number(value.toFixed(6));
const roundList = (values) => values.map(round);
const mib = (bytes) => Number((bytes / 1024 / 1024).toFixed(4));
const rel = (path) => relative(ROOT, path).replaceAll("\\", "/");

function accessorBytes(accessor) {
  return accessor ? accessor.getByteLength() : 0;
}

function textureBytes(texture) {
  const image = texture.getImage();
  return image ? image.byteLength : 0;
}

function boundsFor(property) {
  try {
    const bounds = getBounds(property);
    return { min: roundList(bounds.min), max: roundList(bounds.max), size: roundList(bounds.max.map((max, index) => max - bounds.min[index])) };
  } catch (error) {
    return { error: error.message };
  }
}

function textureSummary(texture) {
  const image = texture.getImage();
  const mimeType = texture.getMimeType();
  let size = texture.getSize();
  if (!size && image && mimeType) {
    size = ImageUtils.getSize(image, mimeType);
  }
  return {
    name: texture.getName() || null,
    uri: texture.getURI() || null,
    mimeType: mimeType || (image ? ImageUtils.getMimeType(image) : null),
    dimensions: size ? [size[0], size[1]] : null,
    encodedBytes: textureBytes(texture),
  };
}

function materialSummary(material) {
  const slots = {
    baseColor: material.getBaseColorTexture()?.getName() || material.getBaseColorTexture()?.getURI() || null,
    metallicRoughness: material.getMetallicRoughnessTexture()?.getName() || material.getMetallicRoughnessTexture()?.getURI() || null,
    normal: material.getNormalTexture()?.getName() || material.getNormalTexture()?.getURI() || null,
    occlusion: material.getOcclusionTexture()?.getName() || material.getOcclusionTexture()?.getURI() || null,
    emissive: material.getEmissiveTexture()?.getName() || material.getEmissiveTexture()?.getURI() || null,
  };
  return {
    name: material.getName() || null,
    alphaMode: material.getAlphaMode(),
    doubleSided: material.getDoubleSided(),
    baseColorFactor: roundList(material.getBaseColorFactor()),
    metallicFactor: round(material.getMetallicFactor()),
    roughnessFactor: round(material.getRoughnessFactor()),
    textureSlots: slots,
  };
}

function primitiveSummary(meshName, primitive, index) {
  const position = primitive.getAttribute("POSITION");
  const normal = primitive.getAttribute("NORMAL");
  const texcoord0 = primitive.getAttribute("TEXCOORD_0");
  const indices = primitive.getIndices();
  const semantics = primitive.listSemantics();
  const vertexCount = position?.getCount() ?? 0;
  const indexCount = indices?.getCount() ?? 0;
  const faceCount = primitive.getMode() === 4 ? (indexCount || vertexCount) / 3 : null;
  const attributeBytes = primitive.listAttributes().reduce((sum, accessor) => sum + accessorBytes(accessor), 0);
  return {
    meshName,
    primitiveIndex: index,
    mode: primitive.getMode(),
    material: primitive.getMaterial()?.getName() || null,
    semantics,
    vertexCount,
    indexCount,
    faceCount: faceCount === null ? null : Math.floor(faceCount),
    positionAccessorBytes: accessorBytes(position),
    normalAccessorBytes: accessorBytes(normal),
    texcoordAccessorBytes: accessorBytes(texcoord0),
    indexAccessorBytes: accessorBytes(indices),
    attributeBytes,
    totalPrimitiveBytes: attributeBytes + accessorBytes(indices),
  };
}

async function inspectGlb(input) {
  const absolute = resolve(ROOT, input);
  const bytes = await readFile(absolute);
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    "meshopt.decoder": MeshoptDecoder,
  });
  const doc = await io.readBinary(bytes);
  const root = doc.getRoot();
  const scenes = root.listScenes();
  const defaultScene = root.getDefaultScene() || scenes[0] || null;
  const textures = root.listTextures().map(textureSummary);
  const materials = root.listMaterials().map(materialSummary);
  const meshes = root.listMeshes().map((mesh) => {
    const primitives = mesh.listPrimitives().map((primitive, index) => primitiveSummary(mesh.getName() || null, primitive, index));
    return {
      name: mesh.getName() || null,
      primitiveCount: primitives.length,
      vertexCount: primitives.reduce((sum, primitive) => sum + primitive.vertexCount, 0),
      indexCount: primitives.reduce((sum, primitive) => sum + primitive.indexCount, 0),
      faceCount: primitives.reduce((sum, primitive) => sum + (primitive.faceCount || 0), 0),
      accessorBytes: primitives.reduce((sum, primitive) => sum + primitive.totalPrimitiveBytes, 0),
      primitives,
    };
  });
  const nodes = root.listNodes();
  const rootNodes = defaultScene ? defaultScene.listChildren() : nodes.filter((node) => !node.getParent());
  const meshNodeSummaries = nodes
    .filter((node) => node.getMesh())
    .map((node) => ({
      name: node.getName() || null,
      mesh: node.getMesh()?.getName() || null,
      translation: roundList(node.getTranslation()),
      rotation: roundList(node.getRotation()),
      scale: roundList(node.getScale()),
      worldMatrix: roundList(Array.from(node.getWorldMatrix())),
      bounds: boundsFor(node),
    }));
  return {
    file: rel(absolute),
    usage: usageByFile.get(basename(input)) || null,
    bytes: bytes.byteLength,
    mib: mib(bytes.byteLength),
    sha256: createHash("sha256").update(bytes).digest("hex"),
    extensionsUsed: root.listExtensionsUsed().map((extension) => extension.extensionName),
    extensionsRequired: root.listExtensionsRequired().map((extension) => extension.extensionName),
    sceneCount: scenes.length,
    defaultScene: defaultScene?.getName() || null,
    sceneBounds: defaultScene ? boundsFor(defaultScene) : null,
    nodeCount: nodes.length,
    meshNodeCount: meshNodeSummaries.length,
    rootTransforms: rootNodes.map((node) => ({
      name: node.getName() || null,
      translation: roundList(node.getTranslation()),
      rotation: roundList(node.getRotation()),
      scale: roundList(node.getScale()),
      matrix: roundList(Array.from(node.getMatrix())),
    })),
    meshCount: meshes.length,
    primitiveCount: meshes.reduce((sum, mesh) => sum + mesh.primitiveCount, 0),
    vertexCount: meshes.reduce((sum, mesh) => sum + mesh.vertexCount, 0),
    faceCount: meshes.reduce((sum, mesh) => sum + mesh.faceCount, 0),
    accessorCount: root.listAccessors().length,
    accessorBytes: root.listAccessors().reduce((sum, accessor) => sum + accessorBytes(accessor), 0),
    materialCount: materials.length,
    textureCount: textures.length,
    textureEncodedBytes: textures.reduce((sum, texture) => sum + texture.encodedBytes, 0),
    textures,
    materials,
    meshes: meshes.sort((a, b) => b.accessorBytes - a.accessorBytes),
    meshNodes: meshNodeSummaries,
  };
}

let output = "asset-review/3d-candidates/baseline/glb-baseline.json";
let assets = DEFAULT_ASSETS;
const args = process.argv.slice(2);
if (args[0] === "--output") {
  output = args[1];
  assets = args.slice(2);
} else if (args.length) {
  output = args[0];
  assets = args.slice(1);
}
if (!assets.length) assets = DEFAULT_ASSETS;

const reports = [];
for (const asset of assets) {
  reports.push(await inspectGlb(asset));
}

await writeFile(resolve(ROOT, output), `${JSON.stringify({ generatedAt: new Date().toISOString(), reports }, null, 2)}\n`);
console.log(`Wrote ${output}`);
