import { Matrix4, Object3D, Quaternion, Vector3 } from "three";

const STORAGE = {
  Int8Array,
  Uint8Array,
  Int16Array,
  Uint16Array,
  Float32Array,
  Uint32Array,
};
// The reference's BUF format stores the original mesh and sampled poses.
// Decode its quantization without changing topology or animation samples.
export function decodeOryzoBuffer(buffer) {
  const view = new DataView(buffer);
  const headerLength = view.getUint32(0, true);
  const metadata = JSON.parse(
    new TextDecoder().decode(new Uint8Array(buffer, 4, headerLength)),
  );
  let offset = 4 + headerLength;
  const attributes = {};
  for (const attribute of metadata.attributes) {
    const Type = STORAGE[attribute.storageType];
    if (!Type) throw new Error("Unsupported reference geometry storage");
    const count =
      attribute.id === "indices" ? metadata.indexCount : metadata.vertexCount;
    const length = count * attribute.componentSize;
    const packed = new Type(
      buffer.slice(offset, offset + length * Type.BYTES_PER_ELEMENT),
    );
    offset += length * Type.BYTES_PER_ELEMENT;
    let array = packed;
    if (attribute.needsPack) {
      array = new Float32Array(length);
      const range = 2 ** (Type.BYTES_PER_ELEMENT * 8);
      const bias = attribute.storageType.startsWith("Int") ? range / 2 : 0;
      for (let i = 0; i < length; i++) {
        const component =
          attribute.packedComponents[i % attribute.componentSize];
        array[i] =
          ((packed[i] + bias) / (range - 1)) * component.delta + component.from;
      }
    }
    attributes[attribute.id] = {
      array,
      itemSize: attribute.componentSize,
      count,
    };
  }
  if (offset !== buffer.byteLength)
    throw new Error("Invalid reference geometry length");
  return { metadata, attributes };
}

export function applyOryzoTrack(track, ratio, target) {
  const { position, orient, scale } = track.attributes;
  const frameCount = position.count;
  const frame = Math.max(0, Math.min(1, ratio)) * (frameCount - 1);
  const from = Math.floor(frame),
    to = Math.min(from + 1, frameCount - 1),
    mix = frame - from;
  target.position
    .fromArray(position.array, from * 3)
    .lerp(new Vector3().fromArray(position.array, to * 3), mix);
  if (orient)
    target.quaternion
      .fromArray(orient.array, from * 4)
      .slerp(new Quaternion().fromArray(orient.array, to * 4), mix);
  if (scale?.itemSize === 1)
    target.scale.setScalar(
      scale.array[from] * (1 - mix) + scale.array[to] * mix,
    );
  else if (scale)
    target.scale
      .fromArray(scale.array, from * 3)
      .lerp(new Vector3().fromArray(scale.array, to * 3), mix);
}

export function sampleOryzoHand(track, ratio, positions, orientations) {
  const bones = positions.length;
  const frames = track.attributes.position.count / bones;
  const frame = Math.max(0, Math.min(1, ratio)) * (frames - 1);
  const from = Math.floor(frame),
    to = Math.min(from + 1, frames - 1),
    mix = frame - from;
  const nextPosition = new Vector3(),
    nextOrientation = new Quaternion();
  for (let bone = 0; bone < bones; bone++) {
    positions[bone]
      .fromArray(track.attributes.position.array, (from * bones + bone) * 3)
      .lerp(
        nextPosition.fromArray(
          track.attributes.position.array,
          (to * bones + bone) * 3,
        ),
        mix,
      );
    orientations[bone]
      .fromArray(track.attributes.orient.array, (from * bones + bone) * 4)
      .slerp(
        nextOrientation.fromArray(
          track.attributes.orient.array,
          (to * bones + bone) * 4,
        ),
        mix,
      );
  }
  correctNativeFingerTransforms(track, positions, orientations);
  return frame;
}

// The 8,441 vertices use exactly the native four-bone quaternion deformation.
// Update only on a changed pose, through Three's ordinary mesh/texture pipeline.
export function deformOryzoHand(mesh, positions, orientations, output) {
  const source = mesh.attributes.position.array;
  const indices = mesh.attributes.boneIndices.array;
  const weights = mesh.attributes.boneWeights.array;
  for (let vertex = 0; vertex < source.length / 3; vertex++) {
    const offset = vertex * 3;
    const x = source[offset],
      y = source[offset + 1],
      z = source[offset + 2];
    let sx = 0,
      sy = 0,
      sz = 0;
    for (let slot = 0; slot < 4; slot++) {
      const index = vertex * 4 + slot,
        weight = weights[index];
      if (!weight) continue;
      const bone = indices[index],
        p = positions[bone],
        q = orientations[bone];
      const tx = 2 * (q.y * z - q.z * y);
      const ty = 2 * (q.z * x - q.x * z);
      const tz = 2 * (q.x * y - q.y * x);
      sx += (x + q.w * tx + q.y * tz - q.z * ty + p.x) * weight;
      sy += (y + q.w * ty + q.z * tx - q.x * tz + p.y) * weight;
      sz += (z + q.w * tz + q.x * ty - q.y * tx + p.z) * weight;
    }
    output[offset] = sx;
    output[offset + 1] = sy;
    output[offset + 2] = sz;
  }
  return output;
}

const nativeRigs = new WeakMap();
const ROOT = new Matrix4()
  .fromArray([
    1.08842, 0, -0.159194, 0, 1.9082e-18, 1.1, 7.63278e-18, 0, 0.159194, 0,
    1.08842, 0, -0.00995603, 0.524108, -0.0576238, 1,
  ])
  .transpose();
const ROOT_INVERSE = ROOT.clone().invert();
function correctNativeFingerTransforms(track, positions, orientations) {
  let rig = nativeRigs.get(track);
  if (!rig) {
    const root = new Object3D(),
      nodes = [];
    for (const entry of track.metadata.sceneData || []) {
      const node = new Object3D();
      node.name = entry.name;
      node.position.fromArray(entry.position || [0, 0, 0]);
      node.quaternion.fromArray(entry.quaternion || [0, 0, 0, 1]);
      node.scale.fromArray(entry.scale || [1, 1, 1]);
      node.userData = { ...entry.data };
      (entry.parentIndex >= 0 ? nodes[entry.parentIndex] : root).add(node);
      nodes.push(node);
    }
    root.children[0]?.removeFromParent();
    root.updateMatrixWorld(true);
    root.traverse((node) => {
      node.userData.defaultWorld = node.matrixWorld.clone();
      node.userData.defaultInverse = node.matrixWorld.clone().invert();
      node.userData.target = Number.parseInt(node.name, 10);
    });
    rig = {
      root,
      inverse: new Matrix4(),
      temporary: new Matrix4(),
      scale: new Vector3(),
      unit: new Vector3(1, 1, 1),
      position: new Vector3(),
      orientation: new Quaternion(),
    };
    nativeRigs.set(track, rig);
  }
  const { root, inverse, temporary, scale, unit, position, orientation } = rig;
  root.traverse((node) => {
    if (node === root) return;
    const bone = node.userData.target;
    node.matrixWorld
      .compose(positions[bone], orientations[bone], unit)
      .premultiply(ROOT_INVERSE)
      .multiply(node.userData.defaultWorld);
    if (node.parent === root) {
      const parent = node.userData.parentIdx.value;
      inverse
        .compose(positions[parent], orientations[parent], unit)
        .premultiply(ROOT_INVERSE)
        .multiply(temporary.fromArray(node.userData.parentMatrix.value))
        .invert();
    } else inverse.copy(node.parent.matrixWorld).invert();
    node.matrix
      .multiplyMatrices(inverse, node.matrixWorld)
      .decompose(node.position, node.quaternion, scale);
  });
  root.traverse((node) => {
    if (node === root) return;
    ROOT_INVERSE.decompose(position, orientation, scale);
    node.matrix.compose(node.position, node.quaternion, unit);
    if (node.parent === root) {
      const parent = node.userData.parentIdx.value;
      inverse
        .compose(positions[parent], orientations[parent], scale)
        .premultiply(ROOT_INVERSE)
        .multiply(temporary.fromArray(node.userData.parentMatrix.value));
      node.matrixWorld.multiplyMatrices(inverse, node.matrix);
    } else
      node.matrixWorld.multiplyMatrices(node.parent.matrixWorld, node.matrix);
    temporary
      .copy(node.matrixWorld)
      .multiply(node.userData.defaultInverse)
      .premultiply(ROOT)
      .decompose(
        positions[node.userData.target],
        orientations[node.userData.target],
        scale,
      );
  });
}
