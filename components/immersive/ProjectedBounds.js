import * as THREE from "three";

const clipPoint = new THREE.Vector4();
const projection = new THREE.Matrix4();
const localPoint = new THREE.Vector3();

function emptyExtent() {
  return { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
}

function includePoint(extent, x, y, z, matrix, viewport) {
  clipPoint.set(x, y, z, 1).applyMatrix4(matrix);
  // A point behind a perspective camera does not have a useful screen bound.
  if (clipPoint.w <= 0.000001) return;
  const screenX = ((clipPoint.x / clipPoint.w + 1) / 2) * viewport.width;
  const screenY = ((1 - clipPoint.y / clipPoint.w) / 2) * viewport.height;
  if (!Number.isFinite(screenX) || !Number.isFinite(screenY)) return;
  extent.minX = Math.min(extent.minX, screenX);
  extent.minY = Math.min(extent.minY, screenY);
  extent.maxX = Math.max(extent.maxX, screenX);
  extent.maxY = Math.max(extent.maxY, screenY);
}

function rectangle(extent) {
  return Number.isFinite(extent.minX)
    ? {
        x: extent.minX,
        y: extent.minY,
        width: extent.maxX - extent.minX,
        height: extent.maxY - extent.minY,
      }
    : null;
}

function validViewport(viewport) {
  return viewport?.width > 0 && viewport?.height > 0;
}

function updateProjection(camera) {
  camera.updateWorldMatrix(true, false);
  projection.multiplyMatrices(
    camera.projectionMatrix,
    camera.matrixWorldInverse,
  );
}

/**
 * Project an offline convex hull in its root's local coordinates. Points may be
 * a flat numeric array/typed array or an array of [x, y, z] / Vector3 values.
 * matrixWorld must be current. Returned coordinates use logical viewport pixels
 * and remain unclamped, so an actual overflow is still detectable by QA.
 */
export function projectHullBounds(points, matrixWorld, camera, viewport) {
  if (!points?.length || !validViewport(viewport)) return null;
  updateProjection(camera);
  projection.multiply(matrixWorld);
  const extent = emptyExtent();
  if (typeof points[0] === "number") {
    for (let i = 0; i + 2 < points.length; i += 3)
      includePoint(
        extent,
        points[i],
        points[i + 1],
        points[i + 2],
        projection,
        viewport,
      );
  } else {
    for (const point of points) {
      localPoint.set(
        point.x ?? point[0],
        point.y ?? point[1],
        point.z ?? point[2],
      );
      includePoint(
        extent,
        localPoint.x,
        localPoint.y,
        localPoint.z,
        projection,
        viewport,
      );
    }
  }
  return rectangle(extent);
}

/**
 * Project each visible mesh's LOCAL geometry bounds through its own transform,
 * then union in 2D. This deliberately never creates or projects a world AABB.
 * These bounds remain conservative within each mesh; use a hull for food.
 */
export function projectObjectBounds(root, camera, viewport) {
  if (!root || !validViewport(viewport)) return null;
  for (let ancestor = root; ancestor; ancestor = ancestor.parent)
    if (!ancestor.visible) return null;
  root.updateWorldMatrix(true, true);
  updateProjection(camera);
  const viewProjection = projection.clone();
  const extent = emptyExtent();

  function visit(object) {
    if (!object.visible) return;
    const geometry = object.isMesh ? object.geometry : null;
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    if (geometry && materials.some((material) => material?.visible !== false)) {
      if (!geometry.boundingBox) geometry.computeBoundingBox();
      const bounds = geometry.boundingBox;
      if (bounds && !bounds.isEmpty()) {
        projection.multiplyMatrices(viewProjection, object.matrixWorld);
        for (const x of [bounds.min.x, bounds.max.x])
          for (const y of [bounds.min.y, bounds.max.y])
            for (const z of [bounds.min.z, bounds.max.z])
              includePoint(extent, x, y, z, projection, viewport);
      }
    }
    for (const child of object.children) visit(child);
  }

  visit(root);
  return rectangle(extent);
}

/** Union independently projected objects without inventing corners between them. */
export function unionScreenBounds(rectangles) {
  const extent = emptyExtent();
  for (const bounds of rectangles) {
    if (!bounds) continue;
    if (
      ![bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite)
    )
      continue;
    extent.minX = Math.min(extent.minX, bounds.x);
    extent.minY = Math.min(extent.minY, bounds.y);
    extent.maxX = Math.max(extent.maxX, bounds.x + bounds.width);
    extent.maxY = Math.max(extent.maxY, bounds.y + bounds.height);
  }
  return rectangle(extent);
}
