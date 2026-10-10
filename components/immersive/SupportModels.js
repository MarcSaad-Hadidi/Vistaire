import { publicModelBaseUrl, resolvePublicModelUrl } from "../../lib/publicModelAssets.ts";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";

export const supportModels = {
  acrylique: resolvePublicModelUrl("immersive.support.acrylique"),
  sculpte: resolvePublicModelUrl("immersive.support.sculpte"),
  carre: resolvePublicModelUrl("immersive.support.carre"),
  signature: resolvePublicModelUrl("immersive.support.signature"),
};

// These are the user's original optimized files. Only their scene transforms
// change; geometry, embedded QR artwork and PBR materials stay intact.
export function createSupportModels({
  canvas,
  renderer,
  disposeTree,
  onError,
}) {
  const root = new THREE.Group();
  const groups = {};
  const requests = [];
  const loading = new Map();
  const draco = new DRACOLoader()
    .setDecoderPath("/immersive-assets/draco/")
    .setDecoderConfig({ type: "wasm" })
    .setWorkerLimit(1);
  const loader = new GLTFLoader().setDRACOLoader(draco);
  let disposed = false;
  let collection = "acrylique";
  let visibleCollection;
  function select(name) {
    if (disposed) return;
    collection = Object.hasOwn(supportModels, name) ? name : "acrylique";
    if (groups[collection]) visibleCollection = collection;
    Object.entries(groups).forEach(([id, group]) => {
      group.visible = id === visibleCollection;
    });
    canvas.dataset.support = visibleCollection || collection;
    canvas.dataset.supportReady = String(Boolean(groups[collection]));
    if (!loading.has(collection)) {
      loading.set(collection, load(collection));
    }
  }

  async function load(id) {
    const url = supportModels[id];
    const request = new AbortController();
    requests.push(request);
    let model;
    let attached = false;
    try {
      const response = await fetch(url, {
        signal: request.signal,
      });
      if (!response.ok)
        throw new Error(
          `Le support QR ne peut pas être chargé (${response.status}).`,
        );
      const data = await response.arrayBuffer();
      if (disposed) return;
      const gltf = await loader.parseAsync(data, publicModelBaseUrl(url));
      model = gltf.scene;
      if (disposed) {
        disposeTree(model);
        return;
      }
      const bounds = new THREE.Box3().setFromObject(model);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      const scale =
        id === "signature"
          ? 2.2 / size.x
          : (id === "carre" ? 1.68 : 1.95) / size.y;
      model.scale.multiplyScalar(scale);
      model.position.set(
        -center.x * scale,
        -bounds.min.y * scale,
        -center.z * scale,
      );
      model.traverse((object) => {
        if (!object.isMesh) return;
        object.castShadow = true;
        object.receiveShadow = true;
        for (const material of Array.isArray(object.material)
          ? object.material
          : [object.material]) {
          for (const texture of Object.values(material)) {
            if (texture?.isTexture)
              texture.anisotropy = Math.min(
                8,
                renderer.capabilities.getMaxAnisotropy(),
              );
          }
        }
      });
      const group = new THREE.Group();
      group.add(model);
      group.updateMatrixWorld(true);
      group.visible = false;
      groups[id] = group;
      root.add(group);
      attached = true;
      if (id === collection) select(collection);
    } catch (error) {
      loading.delete(id);
      if (model && !attached) disposeTree(model);
      if (!disposed && id === collection && error.name !== "AbortError")
        onError(error);
    }
  }
  // Acrylic is visible on the opening table. Other collections load only
  // when selected; retain the displayed stand until its replacement is ready.
  select(collection);

  return {
    root,
    select,
    get active() {
      return groups[visibleCollection];
    },
    dispose() {
      disposed = true;
      requests.forEach((request) => request.abort());
      // Three may create a worker after its asynchronous decoder initializer
      // resolves. Finish/discard pending parses before terminating that worker.
      Promise.allSettled(loading.values()).finally(() => draco.dispose());
    },
  };
}
