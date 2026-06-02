import { readFileSync } from "node:fs";

const GLB_JSON = 0x4e4f534a;
const GLB_BIN = 0x004e4942;

function componentSize(componentType) {
  return ({ 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }[componentType] ?? 0);
}

function typeCount(type) {
  return ({ SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 }[type] ?? 1);
}

function identityMatrix() {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

function multiplyMatrix(a, b) {
  const out = new Array(16).fill(0);
  for (let row = 0; row < 4; row += 1) {
    for (let column = 0; column < 4; column += 1) {
      for (let index = 0; index < 4; index += 1) {
        out[column * 4 + row] += a[index * 4 + row] * b[column * 4 + index];
      }
    }
  }
  return out;
}

function translationMatrix(value = [0, 0, 0]) {
  const out = identityMatrix();
  out[12] = Number(value[0] ?? 0);
  out[13] = Number(value[1] ?? 0);
  out[14] = Number(value[2] ?? 0);
  return out;
}

function scaleMatrix(value = [1, 1, 1]) {
  const out = identityMatrix();
  out[0] = Number(value[0] ?? 1);
  out[5] = Number(value[1] ?? 1);
  out[10] = Number(value[2] ?? 1);
  return out;
}

function rotationMatrix(q = [0, 0, 0, 1]) {
  const x = Number(q[0] ?? 0);
  const y = Number(q[1] ?? 0);
  const z = Number(q[2] ?? 0);
  const w = Number(q[3] ?? 1);
  const x2 = x + x;
  const y2 = y + y;
  const z2 = z + z;
  const xx = x * x2;
  const xy = x * y2;
  const xz = x * z2;
  const yy = y * y2;
  const yz = y * z2;
  const zz = z * z2;
  const wx = w * x2;
  const wy = w * y2;
  const wz = w * z2;
  return [
    1 - yy - zz,
    xy + wz,
    xz - wy,
    0,
    xy - wz,
    1 - xx - zz,
    yz + wx,
    0,
    xz + wy,
    yz - wx,
    1 - xx - yy,
    0,
    0,
    0,
    0,
    1
  ];
}

function nodeMatrix(node = {}) {
  if (Array.isArray(node.matrix) && node.matrix.length === 16) {
    return node.matrix.map((value) => Number(value));
  }
  return multiplyMatrix(
    multiplyMatrix(translationMatrix(node.translation), rotationMatrix(node.rotation)),
    scaleMatrix(node.scale)
  );
}

function transformPoint(matrix, point) {
  const x = point[0];
  const y = point[1];
  const z = point[2];
  return [
    matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
    matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
    matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14]
  ];
}

export function parseGlbBuffer(buffer) {
  if (buffer.length < 20 || buffer.toString("utf8", 0, 4) !== "glTF") {
    throw new Error("GLB magic must be glTF");
  }
  if (buffer.readUInt32LE(4) !== 2) throw new Error("GLB version must be 2");
  if (buffer.readUInt32LE(8) !== buffer.length) {
    throw new Error("GLB declared length does not match file length");
  }

  let offset = 12;
  let gltf = null;
  let binBuffer = Buffer.alloc(0);
  while (offset + 8 <= buffer.length) {
    const chunkLength = buffer.readUInt32LE(offset);
    const chunkType = buffer.readUInt32LE(offset + 4);
    const start = offset + 8;
    const end = start + chunkLength;
    if (end > buffer.length) throw new Error("GLB chunk length exceeds file size");
    const chunk = buffer.subarray(start, end);
    if (chunkType === GLB_JSON) {
      gltf = JSON.parse(chunk.toString("utf8").replace(/\0+$/g, "").trim());
    } else if (chunkType === GLB_BIN && binBuffer.length === 0) {
      binBuffer = chunk;
    }
    offset = end;
  }
  if (!gltf) throw new Error("GLB JSON chunk is required");
  return { gltf, binBuffer };
}

function readComponent(buffer, offset, componentType) {
  if (componentType === 5120) return buffer.readInt8(offset);
  if (componentType === 5121) return buffer.readUInt8(offset);
  if (componentType === 5122) return buffer.readInt16LE(offset);
  if (componentType === 5123) return buffer.readUInt16LE(offset);
  if (componentType === 5125) return buffer.readUInt32LE(offset);
  if (componentType === 5126) return buffer.readFloatLE(offset);
  throw new Error(`Unsupported accessor componentType ${componentType}`);
}

function accessorView(gltf, binBuffer, accessorIndex) {
  const accessor = gltf.accessors?.[accessorIndex];
  if (!accessor) throw new Error(`Missing accessor ${accessorIndex}`);
  if (accessor.sparse) throw new Error(`Sparse accessor ${accessorIndex} is not supported for geometry metrics`);
  const view = gltf.bufferViews?.[accessor.bufferView];
  if (!view || view.buffer !== 0) throw new Error(`Accessor ${accessorIndex} must use the embedded GLB buffer`);
  const count = accessor.count ?? 0;
  const itemSize = typeCount(accessor.type);
  const bytesPerComponent = componentSize(accessor.componentType);
  const stride = view.byteStride ?? bytesPerComponent * itemSize;
  const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  return { accessor, count, itemSize, stride, start };
}

function readAccessorItems(gltf, binBuffer, accessorIndex) {
  const { accessor, count, itemSize, stride, start } = accessorView(gltf, binBuffer, accessorIndex);
  const items = [];
  const bytesPerComponent = componentSize(accessor.componentType);
  for (let itemIndex = 0; itemIndex < count; itemIndex += 1) {
    const item = [];
    const base = start + itemIndex * stride;
    for (let component = 0; component < itemSize; component += 1) {
      item.push(readComponent(binBuffer, base + component * bytesPerComponent, accessor.componentType));
    }
    items.push(item);
  }
  return items;
}

function accessorBoundsCorners(accessor) {
  if (!Array.isArray(accessor?.min) || !Array.isArray(accessor?.max) || accessor.min.length < 3 || accessor.max.length < 3) {
    return [];
  }
  const [minX, minY, minZ] = accessor.min.map(Number);
  const [maxX, maxY, maxZ] = accessor.max.map(Number);
  return [
    [minX, minY, minZ],
    [minX, minY, maxZ],
    [minX, maxY, minZ],
    [minX, maxY, maxZ],
    [maxX, minY, minZ],
    [maxX, minY, maxZ],
    [maxX, maxY, minZ],
    [maxX, maxY, maxZ]
  ];
}

function readPositionItems(gltf, binBuffer, accessorIndex) {
  const accessor = gltf.accessors?.[accessorIndex];
  try {
    const items = readAccessorItems(gltf, binBuffer, accessorIndex);
    const declared = accessorBoundsCorners(accessor);
    if (declared.length > 0 && items.length > 0) {
      const actualBounds = emptyBounds();
      for (const item of items) extendBounds(actualBounds, item);
      const actual = finalizeBounds(actualBounds);
      const declaredDimensions = accessor.max.map((value, index) => Number(value) - Number(accessor.min[index]));
      const actualDegenerate = actual.dimensionsMeters.every((value) => Math.abs(value) < 0.000001);
      const declaredNonDegenerate = declaredDimensions.some((value) => Math.abs(value) > 0.000001);
      if (actualDegenerate && declaredNonDegenerate) return declared;
    }
    return items;
  } catch (error) {
    const fallback = accessorBoundsCorners(accessor);
    if (fallback.length > 0) return fallback;
    throw error;
  }
}

function readIndices(gltf, binBuffer, primitive, fallbackCount) {
  if (Number.isInteger(primitive.indices)) {
    try {
      return readAccessorItems(gltf, binBuffer, primitive.indices).map((entry) => entry[0]);
    } catch {
      return Array.from({ length: fallbackCount }, (_, index) => index);
    }
  }
  return Array.from({ length: fallbackCount }, (_, index) => index);
}

function triangleCountFor(mode, indexCount) {
  if (mode === 4) return Math.floor(indexCount / 3);
  if (mode === 5 || mode === 6) return Math.max(0, indexCount - 2);
  return 0;
}

function triangleVerticesFor(mode, indices, triangleIndex) {
  if (mode === 4) return [
    indices[triangleIndex * 3],
    indices[triangleIndex * 3 + 1],
    indices[triangleIndex * 3 + 2]
  ];
  if (mode === 5) {
    const a = indices[triangleIndex];
    const b = indices[triangleIndex + 1];
    const c = indices[triangleIndex + 2];
    return triangleIndex % 2 === 0 ? [a, b, c] : [b, a, c];
  }
  if (mode === 6) return [indices[0], indices[triangleIndex + 1], indices[triangleIndex + 2]];
  return [];
}

class DisjointSet {
  constructor(size) {
    this.parent = Array.from({ length: size }, (_, index) => index);
    this.rank = new Array(size).fill(0);
  }

  find(value) {
    if (this.parent[value] !== value) this.parent[value] = this.find(this.parent[value]);
    return this.parent[value];
  }

  union(a, b) {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA === rootB) return;
    if (this.rank[rootA] < this.rank[rootB]) this.parent[rootA] = rootB;
    else if (this.rank[rootA] > this.rank[rootB]) this.parent[rootB] = rootA;
    else {
      this.parent[rootB] = rootA;
      this.rank[rootA] += 1;
    }
  }
}

function quantizePoint(point) {
  return point.map((value) => Math.round(value * 100000)).join(",");
}

function emptyBounds() {
  return {
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity]
  };
}

function extendBounds(bounds, point) {
  for (let index = 0; index < 3; index += 1) {
    bounds.min[index] = Math.min(bounds.min[index], point[index]);
    bounds.max[index] = Math.max(bounds.max[index], point[index]);
  }
}

function finalizeBounds(bounds) {
  if (!Number.isFinite(bounds.min[0])) {
    return {
      min: [0, 0, 0],
      max: [0, 0, 0],
      dimensionsMeters: [0, 0, 0],
      originMeters: [0, 0, 0],
      centeredXZ: false,
      groundedY: false
    };
  }
  const dimensionsMeters = bounds.max.map((value, index) => Number((value - bounds.min[index]).toFixed(6)));
  const originMeters = bounds.max.map((value, index) => Number(((value + bounds.min[index]) / 2).toFixed(6)));
  return {
    min: bounds.min.map((value) => Number(value.toFixed(6))),
    max: bounds.max.map((value) => Number(value.toFixed(6))),
    dimensionsMeters,
    originMeters,
    centeredXZ: Math.abs(bounds.min[0] + bounds.max[0]) < 0.001 && Math.abs(bounds.min[2] + bounds.max[2]) < 0.001,
    groundedY: Math.abs(bounds.min[1]) < 0.001
  };
}

function sceneRootNodes(gltf) {
  const scene = gltf.scenes?.[gltf.scene ?? 0];
  if (Array.isArray(scene?.nodes) && scene.nodes.length > 0) return scene.nodes;
  const childNodes = new Set();
  for (const node of gltf.nodes ?? []) {
    for (const child of node.children ?? []) childNodes.add(child);
  }
  return (gltf.nodes ?? [])
    .map((_, index) => index)
    .filter((index) => !childNodes.has(index));
}

export function analyzeGeometryFromGltf({ gltf, binBuffer }) {
  if ((!Array.isArray(gltf.nodes) || gltf.nodes.length === 0) && Array.isArray(gltf.meshes) && gltf.meshes.length > 0) {
    gltf = {
      ...gltf,
      scene: 0,
      scenes: [{ nodes: gltf.meshes.map((_, index) => index) }],
      nodes: gltf.meshes.map((_, index) => ({ mesh: index }))
    };
  }
  const bounds = emptyBounds();
  let vertices = 0;
  let triangles = 0;
  let primitives = 0;
  const componentBounds = [];
  const duplicateSignatures = new Map();
  const duplicateTriangleSignatures = new Map();

  function visitNode(nodeIndex, parentMatrix) {
    const node = gltf.nodes?.[nodeIndex];
    if (!node) return;
    const worldMatrix = multiplyMatrix(parentMatrix, nodeMatrix(node));
    const mesh = gltf.meshes?.[node.mesh];
    if (mesh) {
      for (const primitive of mesh.primitives ?? []) {
        primitives += 1;
        const positionAccessor = primitive.attributes?.POSITION;
        if (!Number.isInteger(positionAccessor)) continue;
        const positionAccessorDef = gltf.accessors?.[positionAccessor] ?? {};
        const positions = readPositionItems(gltf, binBuffer, positionAccessor)
          .map((point) => transformPoint(worldMatrix, point));
        const positionCount = Number(positionAccessorDef.count) || positions.length;
        vertices += positionCount;
        for (const point of positions) extendBounds(bounds, point);
        const mode = primitive.mode ?? 4;
        const indices = readIndices(gltf, binBuffer, primitive, positionCount);
        const primitiveTriangles = triangleCountFor(mode, indices.length);
        triangles += primitiveTriangles;
        const pointKeys = new Map();
        const disjoint = new DisjointSet(positions.length);
        for (let index = 0; index < positions.length; index += 1) {
          const key = quantizePoint(positions[index]);
          const first = pointKeys.get(key);
          if (first !== undefined) disjoint.union(first, index);
          else pointKeys.set(key, index);
        }
        for (let triangleIndex = 0; triangleIndex < primitiveTriangles; triangleIndex += 1) {
          const [a, b, c] = triangleVerticesFor(mode, indices, triangleIndex);
          if ([a, b, c].every((value) => Number.isInteger(value) && value >= 0 && value < positions.length)) {
            const triangleSignature = [positions[a], positions[b], positions[c]]
              .map(quantizePoint)
              .sort()
              .join("|");
            duplicateTriangleSignatures.set(
              triangleSignature,
              (duplicateTriangleSignatures.get(triangleSignature) ?? 0) + 1
            );
            disjoint.union(a, b);
            disjoint.union(b, c);
          }
        }
        const groups = new Map();
        for (let index = 0; index < positions.length; index += 1) {
          const root = disjoint.find(index);
          const entry = groups.get(root) ?? { vertices: 0, bounds: emptyBounds() };
          entry.vertices += 1;
          extendBounds(entry.bounds, positions[index]);
          groups.set(root, entry);
        }
        for (const group of groups.values()) {
          const finalized = finalizeBounds(group.bounds);
          const maxDimension = Math.max(...finalized.dimensionsMeters);
          const signature = [
            ...finalized.min.map((value) => value.toFixed(3)),
            ...finalized.max.map((value) => value.toFixed(3)),
            group.vertices
          ].join(":");
          duplicateSignatures.set(signature, (duplicateSignatures.get(signature) ?? 0) + 1);
          componentBounds.push({
            vertices: group.vertices,
            bounds: finalized,
            maxDimensionMeters: Number(maxDimension.toFixed(6)),
            tiny: group.vertices <= 12 || maxDimension < 0.01
          });
        }
      }
    }
    for (const child of node.children ?? []) visitNode(child, worldMatrix);
  }

  for (const rootNode of sceneRootNodes(gltf)) visitNode(rootNode, identityMatrix());

  const duplicateShells = [...duplicateSignatures.values()]
    .filter((count) => count > 1)
    .reduce((sum, count) => sum + count - 1, 0);
  const duplicateTriangles = [...duplicateTriangleSignatures.values()]
    .filter((count) => count > 1)
    .reduce((sum, count) => sum + count - 1, 0);
  return {
    bounds: finalizeBounds(bounds),
    vertices,
    triangles,
    primitives,
    components: componentBounds.length,
    tinyIslandCount: componentBounds.filter((entry) => entry.tiny).length,
    duplicateShellEstimate: duplicateShells + duplicateTriangles,
    componentBounds: componentBounds
      .sort((a, b) => b.vertices - a.vertices)
      .slice(0, 24)
  };
}

export function analyzeGlbGeometryBuffer(buffer) {
  return analyzeGeometryFromGltf(parseGlbBuffer(buffer));
}

export function analyzeGlbGeometryFile(filePath) {
  return analyzeGlbGeometryBuffer(readFileSync(filePath));
}
