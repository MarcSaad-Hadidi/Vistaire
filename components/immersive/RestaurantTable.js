import * as THREE from "three";
import inventory from "./restaurant-table-inventory.json";

/**
 * Extract exact table/chair/accessory triangles from the already loaded room.
 * The source model, its BufferAttributes, materials and textures are untouched.
 * `width` fits the complete cloth bounds; metadata.topWidth is the usable top.
 */
export function createRestaurantTable(
  model,
  { width = 6.4, surfaceY = -0.02, placements = {} } = {},
) {
  if (
    !model?.isObject3D ||
    !Number.isFinite(width) ||
    width <= 0 ||
    !Number.isFinite(surfaceY)
  ) {
    throw new Error(
      "Une scène restaurant et des dimensions valides sont requises.",
    );
  }
  model.updateWorldMatrix(true, true);
  const frame = model.matrixWorld.clone().invert();
  const sources = [];
  model.traverse((object) => {
    if (object.isMesh) sources.push(object);
  });
  const group = new THREE.Group();
  group.name = "Table blanche et chaise originales — katydid";
  group.userData.source = inventory.asset;
  const geometries = new Set();
  const materialClones = new Map();
  const originalMaterials = new Map();
  const parts = {};
  let disposed = false;

  const tableRecipe = inventory.recipes.find((recipe) => recipe.id === "table");
  const bounds = tableRecipe.sourceBounds;
  const centerX = (bounds.min[0] + bounds.max[0]) / 2;
  const centerZ = (bounds.min[2] + bounds.max[2]) / 2;
  const topY = bounds.max[1];
  const sourceWidth = Math.max(
    bounds.max[0] - bounds.min[0],
    bounds.max[2] - bounds.min[2],
  );
  const scale = width / sourceWidth;
  group.scale.setScalar(scale);
  group.position.y = surfaceY;
  const tableFrame = new THREE.Matrix4().makeTranslation(
    -centerX,
    -topY,
    -centerZ,
  );

  function sourceFor(selection) {
    const candidates = sources.filter(
      (source) =>
        (source.name === selection.name ||
          (selection.name === "BackSide_0" &&
            /^BackSide_0(?:_\d+)?$/.test(source.name))) &&
        source.geometry.index?.count === selection.sourceTriangleCount * 3,
    );
    const source = candidates.find((candidate) => {
      const index = candidate.geometry.index;
      return selection.indexProbes.every(
        (probe) => index.getX(probe.offset) === probe.value,
      );
    });
    if (!source)
      throw new Error(`Géométrie source non reconnue : ${selection.name}.`);
    const position = source.geometry.getAttribute("position");
    for (const probe of selection.positionProbes) {
      const actual = [
        position.getX(probe.index),
        position.getY(probe.index),
        position.getZ(probe.index),
      ];
      if (
        !actual.every(
          (value, axis) =>
            Math.abs(value - probe.value[axis]) <=
            1e-5 * Math.max(1, Math.abs(value)),
        )
      ) {
        throw new Error(`Attributs source non reconnus : ${selection.name}.`);
      }
    }
    return source;
  }

  function selectedMesh(selection, localFrame) {
    const source = sourceFor(selection);
    const indices = selection.faces.flatMap((face) => [
      source.geometry.index.getX(face * 3),
      source.geometry.index.getX(face * 3 + 1),
      source.geometry.index.getX(face * 3 + 2),
    ]);
    const IndexArray = Math.max(...indices) < 65536 ? Uint16Array : Uint32Array;
    const geometry = new THREE.BufferGeometry();
    geometries.add(geometry);
    for (const [name, attribute] of Object.entries(
      source.geometry.attributes,
    )) {
      geometry.setAttribute(name, attribute);
    }
    geometry.setIndex(new THREE.BufferAttribute(new IndexArray(indices), 1));
    // Full-room attribute arrays are shared. Bounds must cover only selected indices.
    const selectedBounds = new THREE.Box3();
    const point = new THREE.Vector3();
    const positions = geometry.getAttribute("position");
    for (const index of indices) {
      selectedBounds.expandByPoint(point.fromBufferAttribute(positions, index));
    }
    geometry.boundingBox = selectedBounds;
    geometry.boundingSphere = selectedBounds.getBoundingSphere(
      new THREE.Sphere(),
    );
    const mesh = new THREE.Mesh(geometry, source.material);
    mesh.name = `${selection.name} — sélection originale`;
    mesh.matrixAutoUpdate = false;
    mesh.matrix.copy(localFrame).multiply(frame).multiply(source.matrixWorld);
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    mesh.userData.sourceMesh = source.name;
    mesh.userData.sourceTriangles = selection.faces;
    originalMaterials.set(mesh, source.material);
    return mesh;
  }

  try {
    for (const recipe of inventory.recipes) {
      const part = new THREE.Group();
      part.name = `Restaurant original — ${recipe.label ?? recipe.id}`;
      part.userData.objectType = recipe.objectType ?? recipe.id;
      parts[recipe.id] = part;
      let localFrame = tableFrame;
      if (!["table", "chair"].includes(recipe.id)) {
        const donor = recipe.sourceBounds;
        localFrame = new THREE.Matrix4().makeTranslation(
          -(donor.min[0] + donor.max[0]) / 2,
          -donor.min[1],
          -(donor.min[2] + donor.max[2]) / 2,
        );
      }
      for (const selection of recipe.parts)
        part.add(selectedMesh(selection, localFrame));
      group.add(part);
    }
  } catch (error) {
    dispose();
    throw error;
  }

  // Donor objects keep their native size relative to the original table.
  // Caller may move/hide the setting when a large scanned dish occupies it.
  const defaults = {
    placeSetting: [0, 0.008, 0],
    glass: [sourceWidth * 0.3, 0.008, -sourceWidth * 0.3],
    candle: [-sourceWidth * 0.32, 0.008, -sourceWidth * 0.29],
  };
  for (const [id, fallback] of Object.entries(defaults)) {
    // `candle` is retained as a legacy API alias for the authentic table lamp.
    const supplied =
      id === "candle" ? (placements.lamp ?? placements.candle) : placements[id];
    const placement =
      Array.isArray(supplied) &&
      supplied.length === 3 &&
      supplied.every(Number.isFinite)
        ? supplied
        : fallback;
    // Public placements use the final scene units, unlike internal source units.
    parts[id].position.fromArray(
      supplied === placement
        ? placement.map((value) => value / scale)
        : placement,
    );
  }
  group.updateMatrixWorld(true);
  const nativeBounds = new THREE.Box3().union(
    new THREE.Box3().setFromObject(parts.table),
  );
  nativeBounds.union(new THREE.Box3().setFromObject(parts.chair));
  const tabletop = tableRecipe.usableTopBounds;
  const metadata = {
    source: inventory.asset,
    sourceCenter: [centerX, topY, centerZ],
    sourceScale: scale,
    width,
    depth: (bounds.max[2] - bounds.min[2]) * scale,
    topWidth: tabletop ? (tabletop.max[0] - tabletop.min[0]) * scale : null,
    topDepth: tabletop ? (tabletop.max[2] - tabletop.min[2]) * scale : null,
    surfaceY,
    floorY: nativeBounds.min.y,
    height: surfaceY - nativeBounds.min.y,
    triangles: inventory.recipes.reduce(
      (sum, recipe) =>
        sum +
        recipe.parts.reduce(
          (total, selection) => total + selection.selectedTriangleCount,
          0,
        ),
      0,
    ),
    recipes: inventory.recipes.map((recipe) => ({
      id: recipe.id,
      label: recipe.label,
      objectType: recipe.objectType,
      triangles: recipe.parts.reduce(
        (total, selection) => total + selection.selectedTriangleCount,
        0,
      ),
      sourceBounds: recipe.sourceBounds,
    })),
    validation: inventory.inspection,
  };
  group.userData.restaurantTable = metadata;

  function setOpacity(opacity) {
    if (disposed) return;
    const value = THREE.MathUtils.clamp(
      Number.isFinite(opacity) ? opacity : 1,
      0,
      1,
    );
    group.visible = value > 0.003;
    for (const [mesh, source] of originalMaterials) {
      const originals = Array.isArray(source) ? source : [source];
      mesh.material = originals.map((original) => {
        let material = materialClones.get(original);
        if (!material && value === 1) return original;
        if (!material) {
          material = original.clone();
          materialClones.set(original, material);
        }
        const transparent = original.transparent || value < 0.999;
        if (material.transparent !== transparent) material.needsUpdate = true;
        material.opacity = original.opacity * value;
        material.transparent = transparent;
        material.depthWrite = original.depthWrite && value >= 0.999;
        return material;
      });
      if (!Array.isArray(source)) mesh.material = mesh.material[0];
    }
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    group.removeFromParent();
    for (const geometry of geometries) {
      // Three's geometry disposal releases attached attribute buffers. Remove
      // shared attributes first so the loaded room keeps its GPU buffers alive.
      for (const name of Object.keys(geometry.attributes))
        geometry.deleteAttribute(name);
      geometry.dispose();
    }
    for (const material of materialClones.values()) material.dispose();
    group.clear();
  }

  function excludeCopiedObjectsFromRoom() {
    // Keep the source file unchanged. Gather every original-index selection
    // before mutating any mesh: omit the copied table/chair and its native
    // place settings, which would overlap the curated donor accessories.
    const exclusions = new Map();
    const selections = [
      ...inventory.recipes
        .filter((recipe) => ["table", "chair"].includes(recipe.id))
        .flatMap((recipe) => recipe.parts),
      ...(inventory.foregroundExclusions ?? []),
    ];
    for (const selection of selections) {
      const source = sourceFor(selection);
      if (!exclusions.has(source)) exclusions.set(source, new Set());
      for (const face of selection.faces) exclusions.get(source).add(face);
    }
    let omitted = 0;
    for (const [source, faces] of exclusions) {
      const index = source.geometry.index;
      const retained = [];
      for (let face = 0; face < index.count / 3; face++) {
        if (faces.has(face)) {
          omitted++;
          continue;
        }
        retained.push(
          index.getX(face * 3),
          index.getX(face * 3 + 1),
          index.getX(face * 3 + 2),
        );
      }
      source.geometry.setIndex(retained);
    }
    return omitted;
  }

  return {
    group,
    table: parts.table,
    chair: parts.chair,
    accessories: {
      placeSetting: parts.placeSetting,
      glass: parts.glass,
      lamp: parts.candle,
      // Original room prop is a table lamp, not a candle; compatibility alias.
      candle: parts.candle,
    },
    metadata,
    setOpacity,
    excludeCopiedObjectsFromRoom,
    dispose,
  };
}
