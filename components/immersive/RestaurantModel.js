import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { createRestaurantJourney } from "./RestaurantWorld";

export function createRestaurantModel(
  scene,
  { renderer, canvas, disposeTree, onError, onReady },
) {
  const root = new THREE.Group();
  root.name = "Restaurant in the evening — katydid";
  scene.add(root);
  const request = new AbortController();
  const draco = new DRACOLoader()
    .setDecoderPath("/immersive-assets/draco/")
    .setDecoderConfig({ type: "wasm" })
    .setWorkerLimit(1);
  const loader = new GLTFLoader().setDRACOLoader(draco);
  let disposed = false;
  canvas.dataset.restaurantReady = "false";
  const roomLight = new THREE.PointLight("#eee8da", 45, 28, 2);
  roomLight.position.set(0, 5, -5);
  const accent = new THREE.PointLight("#edd2ac", 28, 22, 2);
  accent.position.set(-6, 2, -3);
  root.add(roomLight, accent);
  const lightTarget = new THREE.Color();
  const accentTarget = new THREE.Color();
  const journey = createRestaurantJourney(scene, root, (mood, damping) => {
    lightTarget.set(mood[2]);
    accentTarget.set(mood[1]);
    roomLight.color.lerp(lightTarget, damping);
    accent.color.lerp(accentTarget, damping);
    return (
      Math.max(
        Math.abs(roomLight.color.r - lightTarget.r),
        Math.abs(roomLight.color.g - lightTarget.g),
        Math.abs(roomLight.color.b - lightTarget.b),
        Math.abs(accent.color.r - accentTarget.r),
        Math.abs(accent.color.g - accentTarget.g),
        Math.abs(accent.color.b - accentTarget.b),
      ) > 0.0001
    );
  });
  const loading = fetch("/immersive-assets/restaurant/restaurant-evening.glb", {
    signal: request.signal,
  })
    .then((response) => {
      if (!response.ok)
        throw new Error(
          `Le restaurant ne peut pas être chargé (${response.status}).`,
        );
      return response.arrayBuffer();
    })
    .then(async (buffer) => {
      if (disposed) return;
      const gltf = await loader.parseAsync(buffer, "/immersive-assets/restaurant/");
      const model = gltf.scene;
      if (disposed) {
        disposeTree(model);
        return;
      }
      // Original root already converts Z-up and centimetres. Fit this complete
      // room uniformly to our foreground table/cinematic camera height.
      const scale = 2;
      const anchor = new THREE.Group();
      anchor.scale.setScalar(scale);
      // Centre the hero table in the clear aisle. The source's X=9/Z=-12
      // origin put a structural column through the foreground table.
      anchor.position.set(-10.5 * scale, 0.7, 5 * scale);
      anchor.add(model);
      anchor.updateMatrixWorld(true);
      // The original floor has a raised area and slope. Align the actual aisle
      // floor under the table, rather than the unrelated minimum of the GLB.
      const floors = [];
      model.traverse((object) => {
        if (!object.isMesh) return;
        if (
          ["FrontSide_20", "FrontSide_25", "FrontSide_33"].includes(object.name)
        )
          floors.push(object);
        object.castShadow = false;
        object.receiveShadow = true;
        for (const material of Array.isArray(object.material)
          ? object.material
          : [object.material]) {
          for (const texture of Object.values(material))
            if (texture?.isTexture)
              texture.anisotropy = Math.min(
                8,
                renderer.capabilities.getMaxAnisotropy(),
              );
        }
      });
      const ray = new THREE.Raycaster(
        new THREE.Vector3(0, 10, 0),
        new THREE.Vector3(0, -1, 0),
      );
      const floor = ray.intersectObjects(floors, false)[0];
      if (floor) anchor.position.y += -1.96 - floor.point.y;
      root.add(anchor);
      anchor.updateMatrixWorld(true);
      const foreground = onReady?.(model);
      if (foreground?.sourceCenter && foreground.sourceScale) {
        // This is the left table under the two curtained windows. Look toward
        // the actual painting above the large plant, rather than the aisle.
        const painting = new THREE.Vector3(-0.38353, 0.98596, -10.13489);
        const sourceCenter = new THREE.Vector3().fromArray(
          foreground.sourceCenter,
        );
        const toPainting = painting.clone().sub(sourceCenter);
        const yaw = Math.atan2(toPainting.x, -toPainting.z);
        anchor.rotation.y = yaw;
        anchor.scale.setScalar(foreground.sourceScale);
        const alignedCenter = sourceCenter
          .clone()
          .applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw)
          .multiplyScalar(foreground.sourceScale);
        anchor.position.copy(alignedCenter).negate();
        anchor.position.y += foreground.surfaceY;
        anchor.updateMatrixWorld(true);
        canvas.dataset.restaurantView = "window-tables-central-painting";
        canvas.dataset.restaurantAnchor = anchor.position.toArray().join(",");
        canvas.dataset.restaurantAnchorYaw = String(yaw);
        canvas.dataset.paintingPosition = painting
          .applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw)
          .multiplyScalar(foreground.sourceScale)
          .add(anchor.position)
          .toArray()
          .join(",");
      } else if (floor && Number.isFinite(foreground?.floorY))
        anchor.position.y += foreground.floorY + 1.96;
      canvas.dataset.restaurant = "uploaded-evening";
      canvas.dataset.restaurantReady = "true";
    });
  loading.catch((error) => {
    if (!disposed && error.name !== "AbortError") onError(error);
  });
  return {
    ...journey,
    loading,
    dispose() {
      disposed = true;
      request.abort();
      loading.catch(() => {}).finally(() => draco.dispose());
    },
  };
}
