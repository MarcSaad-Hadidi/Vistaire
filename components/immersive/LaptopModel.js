import { publicModelBaseUrl, resolvePublicModelUrl } from "../../lib/publicModelAssets.ts";
import * as THREE from "three";
import { cinematicEase } from "./SceneDirector.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

const MODEL_URL = resolvePublicModelUrl("immersive.laptop");
const SCREEN_URL = "/immersive-assets/dashboard/dashboard-black-gold.webp";
const clamp = (value, low = 0, high = 1) =>
  Math.min(high, Math.max(low, Number.isFinite(value) ? value : low));

function disposeResources(object) {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  object.traverse((child) => {
    if (child.geometry) geometries.add(child.geometry);
    const surfaces = Array.isArray(child.material)
      ? child.material
      : [child.material];
    for (const surface of surfaces) {
      if (!surface) continue;
      materials.add(surface);
      for (const value of Object.values(surface)) {
        if (value?.isTexture) textures.add(value);
      }
    }
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((surface) => surface.dispose());
  textures.forEach((texture) => {
    texture.dispose();
    texture.image?.close?.();
  });
}

/**
 * User-provided MacBook Pro, with its original authored hinge animation.
 * The original GLB, all geometries, UVs and other materials remain unchanged.
 * The screen shows a captured public Vistaire demonstration, not live data.
 * Root width: 3.12; closed base at y=0. framingBounds is local and stable.
 * update(progress, damping=1, reducedMotion=false) returns whether it moved.
 * No internal animation loop: the scene stops scheduling when settled=true.
 */
export function createLaptopModel({
  canvas,
  renderer,
  disposeTree = disposeResources,
  onReady,
  onError,
} = {}) {
  const root = new THREE.Group();
  root.name = "vistaire-macbook";
  root.userData.dashboardSource = "/apercu-restaurateur";
  root.userData.dashboardDemo = true;
  root.userData.modelSource = MODEL_URL;
  let disposed = false;
  let settled = true;
  let modelReady = false;
  let imageReady = false;
  let lid = null;
  let screen = null;
  let model = null;
  let framingBounds = new THREE.Box3();
  let mixer = null;
  let action = null;
  let screenTexture = null;
  let originalScreenMaterial = null;
  let currentTime = 0;
  let openingStart = 0;
  let openingEnd = 0;
  let desiredProgress = 0;
  let desiredReduced = false;
  const abort = new AbortController();
  const draco = new DRACOLoader();
  draco.setDecoderPath("/immersive-assets/draco/");
  draco.setDecoderConfig({ type: "wasm" });
  draco.setWorkerLimit(1);
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);
  loader.setMeshoptDecoder(MeshoptDecoder);
  const screenMaterial = new THREE.MeshBasicMaterial({
    color: "#10100f",
    toneMapped: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  if (canvas?.dataset) canvas.dataset.laptopReady = "false";

  function fail(error) {
    if (disposed || error.name === "AbortError") return;
    if (canvas?.dataset) canvas.dataset.laptopReady = "error";
    onError?.(error);
  }
  function notifyReady() {
    if (disposed || !modelReady || !imageReady) return;
    if (canvas?.dataset) {
      canvas.dataset.laptopReady = "true";
      canvas.dataset.laptopModel = "macbook-pro-13-2020";
    }
    onReady?.();
  }
  function setNativeTime(time) {
    // Explicitly evaluate the authored animation at this scroll-selected time.
    action.paused = false;
    action.time = time;
    mixer.update(0);
    action.paused = true;
    model.updateMatrixWorld(true);
  }

  new THREE.TextureLoader().load(
    SCREEN_URL,
    (texture) => {
      if (disposed) {
        texture.dispose();
        return;
      }
      if (Math.max(texture.image.width, texture.image.height) > 2048) {
        texture.dispose();
        fail(new Error("Dashboard texture exceeds the 2048-pixel budget."));
        return;
      }
      texture.flipY = true;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(
        8,
        renderer?.capabilities.getMaxAnisotropy?.() ?? 4,
      );
      screenTexture = texture;
      screenMaterial.map = texture;
      screenMaterial.color.set(0xffffff);
      screenMaterial.needsUpdate = true;
      imageReady = true;
      notifyReady();
    },
    undefined,
    fail,
  );

  fetch(MODEL_URL, { signal: abort.signal })
    .then((response) => {
      if (!response.ok)
        throw new Error(`MacBook asset: HTTP ${response.status}`);
      return response.arrayBuffer();
    })
    .then((buffer) => loader.parseAsync(buffer, publicModelBaseUrl(MODEL_URL)))
    .then((gltf) => {
      if (disposed) {
        disposeTree(gltf.scene);
        return;
      }
      model = gltf.scene;
      lid = model.getObjectByName("Bevels_2");
      screen = model.getObjectByName("Object_7");
      const clip = gltf.animations.find((animation) =>
        animation.tracks.some((track) => track.name === "Bevels_2.quaternion"),
      );
      const track = clip?.tracks.find(
        (candidate) => candidate.name === "Bevels_2.quaternion",
      );
      if (!lid || !screen?.isMesh || !track) {
        throw new Error(
          "The supplied MacBook hinge, screen or animation is missing.",
        );
      }
      const identity = new THREE.Quaternion();
      const quaternion = new THREE.Quaternion();
      let openIndex = 0;
      let widestAngle = 0;
      for (let index = 0; index < track.times.length; index++) {
        quaternion.fromArray(track.values, index * 4);
        const angle = quaternion.angleTo(identity);
        if (angle > widestAngle) {
          widestAngle = angle;
          openIndex = index;
        }
      }
      openingStart = track.times[1];
      openingEnd = track.times[openIndex];
      mixer = new THREE.AnimationMixer(model);
      action = mixer.clipAction(clip);
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.play();
      setNativeTime(openingStart);
      const closed = new THREE.Box3().setFromObject(model);
      const center = closed.getCenter(new THREE.Vector3());
      const scale = 3.12 / closed.getSize(new THREE.Vector3()).x;
      model.scale.multiplyScalar(scale);
      model.position.set(
        -center.x * scale,
        -closed.min.y * scale,
        -center.z * scale,
      );
      const normalized = new THREE.Group();
      normalized.name = "normalized-original-macbook";
      normalized.add(model);
      // Include every opening keyframe: at 90 degrees the lid is taller than
      // at the final 120-degree pose. Compute before external scene transforms.
      for (const time of track.times) {
        if (time < openingStart || time > openingEnd) continue;
        setNativeTime(time);
        framingBounds.union(new THREE.Box3().setFromObject(normalized));
      }
      framingBounds.expandByScalar(0.025);
      currentTime = openingStart;
      setNativeTime(currentTime);
      model.traverse((object) => {
        if (object.isMesh) {
          object.castShadow = true;
          object.receiveShadow = true;
        }
      });
      originalScreenMaterial = screen.material;
      screen.material = screenMaterial;
      screen.castShadow = false;
      screen.receiveShadow = false;
      root.add(normalized);
      root.userData.nativeAnimation = clip.name;
      root.userData.openingRange = [openingStart, openingEnd];
      root.userData.openAngleDegrees = THREE.MathUtils.radToDeg(widestAngle);
      modelReady = true;
      update(desiredProgress, 1, desiredReduced);
      notifyReady();
    })
    .catch(fail);

  function update(progress, damping = 1, reducedMotion = false) {
    if (typeof damping === "boolean") {
      reducedMotion = damping;
      damping = 1;
    }
    desiredProgress = clamp(progress);
    desiredReduced = Boolean(reducedMotion);
    if (disposed || !modelReady) return false;
    const openingProgress = desiredReduced
      ? 1
      : cinematicEase(desiredProgress);
    const target = THREE.MathUtils.lerp(
      openingStart,
      openingEnd,
      openingProgress,
    );
    const previous = currentTime;
    currentTime = THREE.MathUtils.lerp(
      currentTime,
      target,
      desiredReduced ? 1 : clamp(damping),
    );
    settled = Math.abs(target - currentTime) < 0.0001;
    if (settled) currentTime = target;
    const changed = Math.abs(currentTime - previous) > 0.00001;
    if (changed) setNativeTime(currentTime);
    if (canvas?.dataset) {
      canvas.dataset.laptopProgress = desiredProgress.toFixed(3);
      canvas.dataset.laptopAngle = THREE.MathUtils.radToDeg(
        lid.quaternion.angleTo(new THREE.Quaternion()),
      ).toFixed(2);
      canvas.dataset.laptopOpen = String(openingProgress > 0.95);
    }
    return changed;
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    abort.abort();
    draco.dispose();
    mixer?.stopAllAction();
    if (model) mixer?.uncacheRoot(model);
    root.removeFromParent();
    disposeTree(root);
    if (originalScreenMaterial) {
      originalScreenMaterial.map?.dispose();
      originalScreenMaterial.map?.image?.close?.();
      originalScreenMaterial.dispose();
    }
    screenMaterial.dispose();
    screenTexture?.dispose();
  }
  return {
    root,
    get lid() {
      return lid;
    },
    get screen() {
      return screen;
    },
    get framingBounds() {
      return framingBounds;
    },
    get settled() {
      return settled;
    },
    update,
    dispose,
  };
}
