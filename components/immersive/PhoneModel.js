import { publicModelBaseUrl, resolvePublicModelUrl } from "../../lib/publicModelAssets.ts";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export function createPhoneModel({
  canvas,
  screenMaterial,
  disposeTree,
  onInvalidate,
  onError,
}) {
  const root = new THREE.Group();
  const request = new AbortController();
  let disposed = false;
  canvas.dataset.phoneReady = "false";
  const url = resolvePublicModelUrl("immersive.phone");
  fetch(url, { signal: request.signal })
    .then((response) => {
      if (!response.ok)
        throw new Error(
          `L’iPhone ne peut pas être chargé (${response.status}).`,
        );
      return response.arrayBuffer();
    })
    .then(async (buffer) => {
      if (disposed) return;
      const gltf = await new GLTFLoader().parseAsync(buffer, publicModelBaseUrl(url));
      const model = gltf.scene;
      if (disposed) {
        disposeTree(model);
        return;
      }
      // Verified against the supplied file: Object_18 is the rounded, flat
      // 167-triangle front screen. Keep the real glass, island and case meshes.
      const screen = model.getObjectByName("Object_18");
      if (!screen?.isMesh) {
        disposeTree(model);
        throw new Error("La surface d’écran de l’iPhone est introuvable.");
      }
      screen.geometry.computeBoundingBox();
      const screenBounds = screen.geometry.boundingBox;
      const screenSize = screenBounds.getSize(new THREE.Vector3());
      const positions = screen.geometry.getAttribute("position");
      const uv = new Float32Array(positions.count * 2);
      for (let i = 0; i < positions.count; i++) {
        uv[i * 2] = (positions.getX(i) - screenBounds.min.x) / screenSize.x;
        uv[i * 2 + 1] = (positions.getY(i) - screenBounds.min.y) / screenSize.y;
      }
      screen.geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
      screen.material.dispose();
      screen.material = screenMaterial;
      screen.castShadow = false;
      screen.receiveShadow = false;
      const bounds = new THREE.Box3().setFromObject(model);
      const scale = 2.16 / bounds.getSize(new THREE.Vector3()).y;
      const center = bounds.getCenter(new THREE.Vector3());
      model.scale.multiplyScalar(scale);
      model.position.copy(center).multiplyScalar(-scale);
      model.traverse((object) => {
        if (!object.isMesh || object === screen) return;
        object.castShadow = true;
        object.receiveShadow = true;
      });
      root.add(model);
      canvas.dataset.phoneReady = "true";
      canvas.dataset.phone = "iphone-16";
      onInvalidate?.();
    })
    .catch((error) => {
      if (!disposed && error.name !== "AbortError") onError(error);
    });
  return {
    root,
    dispose() {
      disposed = true;
      request.abort();
    },
  };
}
