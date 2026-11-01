import * as THREE from "three";

const SOURCE_SHA256 = "594123340aa71cf74cb0e83c69b966c399230fc03e2188ed5cb80931d05f4f66";
const PROTECTED = new Set([0, 1, 20, 23, 25, 26, 33, 34]);
const requireProof = (condition) => {
  if (!condition) throw new Error("Restaurant index crop: unsupported source or invalid coverage proof.");
};

/**
 * Inactive unless explicitly installed by the experiment. Keep original vertex
 * attributes and index storage; only compact the retained, ordered index prefix.
 * Every removed face is enclosed by a padded world-space box. Before EACH real
 * scene draw, every box must remain outside the actual expanded camera frustum.
 * One uncertain draw permanently restores the full room before GPU submission.
 */
export function installRestaurantIndexCrop({ scene, model, certificate, sourceSHA256, ready }) {
  requireProof(sourceSHA256 === SOURCE_SHA256 && certificate.sourceSHA256 === SOURCE_SHA256);
  requireProof(certificate.version === 1 && certificate.sourceTriangles === 81821 && certificate.margin === 0.05);
  requireProof(certificate.boxes.length > 0 && certificate.boxes.length <= 64 && typeof ready === "function");
  const sources = new Map();
  model.traverse((object) => {
    if (!object.isMesh) return;
    requireProof(!sources.has(object.name));
    sources.set(object.name, object);
  });
  const entries = new Map(), point = new THREE.Vector3();
  const boxes = new Float64Array(certificate.boxes.length * 6);
  let removedTriangles = 0, backupBytes = 0;
  for (let b = 0; b < certificate.boxes.length; b++) {
    const box = certificate.boxes[b];
    requireProof(box.min.length === 3 && box.max.length === 3);
    for (let axis = 0; axis < 3; axis++) {
      requireProof(Number.isFinite(box.min[axis]) && Number.isFinite(box.max[axis]) && box.max[axis] > box.min[axis]);
      boxes[b * 6 + axis] = box.min[axis]; boxes[b * 6 + axis + 3] = box.max[axis];
    }
    for (const [meshIndex, ranges] of box.selections) {
      requireProof(Number.isInteger(meshIndex) && !PROTECTED.has(meshIndex) && ranges.length % 2 === 0);
      let entry = entries.get(meshIndex);
      if (!entry) {
        const mesh = sources.get(`FrontSide_${meshIndex}`), geometry = mesh?.geometry, index = geometry?.index;
        requireProof(mesh && !mesh.isSkinnedMesh && !mesh.isInstancedMesh && !mesh.castShadow && !mesh.morphTargetInfluences && mesh.layers.mask === 1);
        requireProof(index && index.itemSize === 1 && (index.array instanceof Uint16Array || index.array instanceof Uint32Array));
        requireProof(index.count === certificate.sourceFaceCounts[meshIndex] * 3 && geometry.groups.length === 0);
        requireProof(geometry.drawRange.start === 0 && geometry.drawRange.count === Infinity);
        requireProof(mesh.onBeforeRender === THREE.Object3D.prototype.onBeforeRender && mesh.material?.onBeforeRender === THREE.Material.prototype.onBeforeRender);
        requireProof(!Array.isArray(mesh.material) && mesh.material.isMeshStandardMaterial && !mesh.material.displacementMap);
        requireProof(Object.keys(geometry.morphAttributes).length === 0);
        const attributes = Object.entries(geometry.attributes).map(([name, attribute]) => {
          requireProof(!attribute.isInterleavedBufferAttribute && !attribute.normalized);
          return { name, attribute, array: attribute.array, version: attribute.version };
        });
        const position = geometry.getAttribute("position");
        requireProof(position && position.itemSize === 3);
        const matrix = mesh.matrixWorld.elements.slice();
        requireProof(matrix.every(Number.isFinite) && mesh.matrixWorld.determinant() !== 0);
        entry = { mesh, geometry, index, array: index.array, version: index.version, backup: index.array.slice(),
          removed: new Uint8Array(index.count / 3), attributes, position, matrix,
          material: mesh.material, compile: mesh.material.onBeforeCompile, before: mesh.onBeforeRender,
          materialBefore: mesh.material.onBeforeRender, count: index.count };
        entries.set(meshIndex, entry); backupBytes += entry.backup.byteLength;
      }
      for (let r = 0; r < ranges.length; r += 2) {
        const start = ranges[r], end = ranges[r + 1];
        requireProof(Number.isInteger(start) && Number.isInteger(end) && start >= 0 && end > start && end <= entry.removed.length);
        for (let face = start; face < end; face++) {
          requireProof(!entry.removed[face]);
          for (let corner = 0; corner < 3; corner++) {
            const vertex = entry.backup[face * 3 + corner];
            requireProof(vertex < entry.position.count);
            point.fromBufferAttribute(entry.position, vertex).applyMatrix4(entry.mesh.matrixWorld);
            // Require nearly the full 0.05-world-unit cushion, not merely box membership.
            for (let axis = 0; axis < 3; axis++) requireProof(Number.isFinite(point.getComponent(axis)) &&
              point.getComponent(axis) >= box.min[axis] + 0.049 && point.getComponent(axis) <= box.max[axis] - 0.049);
          }
          entry.removed[face] = 1; removedTriangles++;
        }
      }
    }
  }
  requireProof(removedTriangles === certificate.removedTriangles && removedTriangles > 0);
  const rows = [...entries.values()];
  const projection = new THREE.Matrix4(), frustum = new THREE.Frustum(), viewport = new THREE.Vector4();
  const stats = { state: "pending", reason: "waiting-for-ready", removedTriangles, backupBytes,
    roomDraws: 0, croppedRoomDraws: 0, restoreUploadBytes: 0 };
  const previous = scene.onBeforeRender;

  function restore(reason) {
    if (stats.state === "full") return;
    if (stats.state === "cropped") for (const row of rows) {
      row.array.set(row.backup);
      row.geometry.setDrawRange(0, Infinity);
      row.index.needsUpdate = true;
      stats.restoreUploadBytes += row.backup.byteLength;
    }
    for (const row of rows) { row.backup = null; row.removed = null; }
    stats.state = "full"; stats.reason = reason;
  }

  function safe(renderer, camera) {
    if (!camera.isPerspectiveCamera || camera.isArrayCamera || camera.coordinateSystem !== THREE.WebGLCoordinateSystem ||
      camera.reversedDepth || camera.fov !== 40 || camera.near !== 0.05 || camera.far !== 150 || camera.zoom !== 1 ||
      renderer.shadowMap?.type !== THREE.PCFShadowMap || renderer.xr?.enabled || renderer.capabilities?.precision !== "highp" || scene.overrideMaterial) return "unsupported-render-context";
    const p = camera.projectionMatrix.elements, inverse = camera.matrixWorldInverse.elements;
    for (let i = 0; i < 16; i++) if (!Number.isFinite(p[i]) || !Number.isFinite(inverse[i])) return "invalid-camera";
    if (p[3] !== 0 || p[7] !== 0 || p[11] !== -1 || p[15] !== 0) return "unsupported-projection";
    for (const row of rows) {
      const mesh = row.mesh, geometry = row.geometry;
      if (mesh.geometry !== geometry || geometry.index !== row.index || row.index.array !== row.array || row.index.version !== row.version ||
        mesh.material !== row.material || mesh.castShadow || mesh.layers.mask !== 1 || mesh.morphTargetInfluences || mesh.onBeforeRender !== row.before ||
        row.material.onBeforeCompile !== row.compile || row.material.onBeforeRender !== row.materialBefore || row.material.displacementMap ||
        geometry.groups.length !== 0 || geometry.drawRange.start !== 0 || geometry.drawRange.count !== (stats.state === "cropped" ? row.count : Infinity)) return "changed-room";
      for (let j = 0; j < 16; j++) if (mesh.matrixWorld.elements[j] !== row.matrix[j]) return "changed-room-transform";
      for (const a of row.attributes) if (geometry.attributes[a.name] !== a.attribute || a.attribute.array !== a.array || a.attribute.version !== a.version) return "changed-room-attributes";
    }
    renderer.getCurrentViewport(viewport);
    if (!Number.isFinite(viewport.z) || !Number.isFinite(viewport.w) || viewport.z < 1 || viewport.w < 1) return "invalid-viewport";
    projection.copy(camera.projectionMatrix);
    // Expand the actual rendered frustum by two physical pixels on every edge,
    // in addition to the 0.05-world-unit box cushion. Reuse all math storage.
    const e = projection.elements, x = 1 + 4 / viewport.z, y = 1 + 4 / viewport.w;
    for (let i = 0; i < 16; i += 4) { e[i] /= x; e[i + 1] /= y; }
    projection.multiply(camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projection, THREE.WebGLCoordinateSystem, false);
    for (const plane of frustum.planes) if (!Number.isFinite(plane.constant) || !Number.isFinite(plane.normal.x) || !Number.isFinite(plane.normal.y) || !Number.isFinite(plane.normal.z)) return "invalid-frustum";
    for (let i = 0; i < boxes.length; i += 6) {
      let outside = false;
      for (const plane of frustum.planes) {
        const n = plane.normal;
        const distance = n.x * boxes[i + (n.x >= 0 ? 3 : 0)] + n.y * boxes[i + (n.y >= 0 ? 4 : 1)] + n.z * boxes[i + (n.z >= 0 ? 5 : 2)] + plane.constant;
        if (distance < -0.001) { outside = true; break; }
      }
      if (!outside) return "visible-removed-region";
    }
    return null;
  }

  function beforeRender(renderer, renderedScene, camera, target) {
    previous.call(this, renderer, renderedScene, camera, target);
    // The foreground layer contains no cropped room. Its pass cannot expose a
    // removed face, and must not inflate room-draw coverage diagnostics.
    let drawsRoom = false;
    for (let i = 0; i < rows.length; i++) if (camera.layers.test(rows[i].mesh.layers)) { drawsRoom = true; break; }
    if (!drawsRoom) return;
    stats.roomDraws++;
    if (stats.state === "full") return;
    if (stats.state === "pending" && !ready()) return;
    const reason = safe(renderer, camera);
    if (reason) { restore(reason); return; }
    if (stats.state === "pending") {
      for (const row of rows) {
        let write = 0;
        for (let face = 0; face < row.removed.length; face++) if (!row.removed[face]) {
          for (let corner = 0; corner < 3; corner++) row.array[write++] = row.backup[face * 3 + corner];
        }
        row.removed = null;
        row.count = write; row.geometry.setDrawRange(0, write);
        row.index.needsUpdate = true; row.version = row.index.version;
      }
      stats.state = "cropped"; stats.reason = "current-frustum-proved";
    }
    stats.croppedRoomDraws++;
  }
  scene.onBeforeRender = beforeRender;
  return { stats, dispose() {
    restore("disposed");
    if (scene.onBeforeRender === beforeRender) scene.onBeforeRender = previous;
  } };
}
