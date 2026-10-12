import * as THREE from "three";
import {
  projectPricingScreen,
  PRICING_ENTRY_VIEWPORTS,
} from "./PricingPhoneLayout.js";
import {
  FAIR_HAND_ASSET,
  createFairHandGeometry,
  configureFairHandMaterial,
  moveFairHandEntry,
} from "./PricingFairHand.js";

export const PRICING_PHONE_POSE = Object.freeze({
  position: [-0.001, 0.0086, -0.009],
  scale: (0.146 / 2.16) * 0.95,
});

export function placePricingPhone(phone) {
  phone.position.fromArray(PRICING_PHONE_POSE.position);
  phone.quaternion.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  phone.quaternion.premultiply(
    new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      Math.PI,
    ),
  );
  phone.scale.setScalar(PRICING_PHONE_POSE.scale);
  phone.visible = true;
}

export function pricingHandProgress(introTop, height, reducedMotion = false) {
  if (reducedMotion) return 1;
  return THREE.MathUtils.clamp(
    -introTop / (height * PRICING_ENTRY_VIEWPORTS),
    0,
    1,
  );
}

export function configurePricingHandCamera(
  camera,
  width,
  height,
) {
  camera.clearViewOffset();
  const aspect = width / height;
  const stackedCopy =
    width < 1024 && !(width >= 700 && height <= 500);
  const halfHeight = Math.max(
    0.1,
    (0.14 * height) / (2 * Math.max(180, height - (stackedCopy ? 300 : 170))),
    0.043 / aspect,
  );
  camera.position.x = -0.011576;
  // Keep the supplied PNG's left-edge wrist crop below the desktop frame.
  // On mobile the natural forearm leaves the viewport at lower left; reserve
  // space below the phone for the real external links and terms.
  const wristDrop = !stackedCopy ? height * 0.07 + 20 : 0;
  camera.position.z = -0.057515 + (2 * halfHeight * (20 + wristDrop)) / height;
  camera.left = -halfHeight * aspect;
  camera.right = halfHeight * aspect;
  camera.top = halfHeight;
  camera.bottom = -halfHeight;
  camera.updateProjectionMatrix();
}

export function createPricingHandCamera(aspect = 1, height = 740) {
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 4);
  camera.position.y = 1.225260853767395;
  camera.quaternion.fromArray([-2.376301608819631e-6, -0.7071067690849304, -0.7071067690849304, -1.584052552061621e-5]);
  configurePricingHandCamera(camera, aspect * height, height);
  camera.updateMatrixWorld(true);
  return camera;
}

// The checkpoint's current fair-photo hand uses the final captured product
// and camera pose. These exact Float32 values come from the verified source
// tracks; no legacy skeleton, alternate grip or extra model is imported.
// The caller owns the existing renderer and the borrowed phone model.
export function createPricingHandScene({
  renderer,
  phoneRoot,
  environment,
  invalidate,
  renderBackground,
}) {
  const scene = new THREE.Scene();
  scene.environment = environment;
  scene.environmentIntensity = 0.65;
  const camera = createPricingHandCamera();
  const light = new THREE.DirectionalLight("#fff3d9", 3);
  light.position.set(-0.3, 1.5, 0.3);
  scene.add(light, new THREE.HemisphereLight("#fff5df", "#33261c", 2));
  const rim = new THREE.DirectionalLight("#ffd60a", 2.2);
  rim.position.set(0.3, 0.8, -0.1);
  scene.add(rim);

  const material = new THREE.MeshBasicMaterial({ toneMapped: false });
  configureFairHandMaterial(material);
  // This transparent, depth-tested hole reveals the real HTML UI beneath the
  // shared canvas. The case, island and native fingers still occlude the screen.
  const screenMaterial = new THREE.MeshBasicMaterial({
    color: 0x000000,
    opacity: 0,
    transparent: true,
    blending: THREE.NoBlending,
    depthWrite: true,
    toneMapped: false,
  });
  const product = new THREE.Group();
  scene.add(product);
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let hand, phone, texture;
  let loading = false, unavailable = false, disposed = false;
  let lastSignature = "", projection = null;
  let projectionWidth = 0, projectionHeight = 0;
  let progress = -1, poseWidth = 0, poseHeight = 0;
  function load() {
    if (loading || unavailable || disposed) return;
    loading = true;
    addPhone();
    texture = new THREE.TextureLoader().load(
      FAIR_HAND_ASSET.src,
      () => {
        if (disposed) { texture.dispose(); return; }
        material.map = texture;
        material.needsUpdate = true;
        lastSignature = "";
        addPhone();
        // Warm only this hand scene without moving/resizing the shared canvas.
        // Synchronous compile leaves no polling timer to outlive disposal.
        try { renderer.compile(scene, camera); } catch { unavailable = true; }
        invalidate();
      },
      undefined,
      () => { unavailable = true; if (!disposed) invalidate(); },
    );
    texture.colorSpace = THREE.SRGBColorSpace;
  }
  function addPhone() {
    if (phone || !phoneRoot.children.length) return;
    phone = phoneRoot.clone(true);
    phone.traverse((mesh) => {
      mesh.layers.set(0);
      if (!mesh.isMesh) return;
      mesh.castShadow = mesh.receiveShadow = false;
      mesh.layers.set(0);
      if (mesh.name === "Object_18") mesh.material = screenMaterial;
    });
    placePricingPhone(phone);
    product.add(phone);
    hand = new THREE.Mesh(createFairHandGeometry(phone), material);
    hand.name = "VistaireFairHand";
    hand.frustumCulled = false;
    product.add(hand);
  }
  return {
    preload: load,
    render(
      offer,
      ratio,
      width,
      height,
      viewport = { top: 0, canvasHeight: height },
    ) {
      load();
      addPhone();
      if (unavailable || !hand || !material.map || !phone || !offer)
        return false;
      const signature = JSON.stringify([
        ratio,
        width,
        height,
        renderer.domElement?.width,
        renderer.domElement?.height,
        viewport.top,
        viewport.canvasHeight,
        offer,
      ]);
      if (signature === lastSignature) return false;
      lastSignature = signature;
      if (
        progress !== ratio ||
        projectionWidth !== width ||
        projectionHeight !== height
      )
        projection = null;
      const poseChanged =
        progress !== ratio ||
        poseWidth !== width || poseHeight !== height;
      if (poseChanged) {
        progress = ratio;
        poseWidth = width;
        poseHeight = height;
        product.position.set(-0.010575857944786549, 0.54819256067276, -0.04851460084319115);
        product.quaternion.identity();
      }
      configurePricingHandCamera(camera, width, height);
      if (poseChanged) moveFairHandEntry(product, ratio, camera.top - camera.bottom);
      // Extend the same pixel projection to the whole fixed canvas. The
      // frozen chapter height may differ from Safari's expanding viewport;
      // moving a smaller GL viewport would visibly cut off the wrist.
      camera.setViewOffset(
        width,
        height,
        0,
        -viewport.top,
        width,
        viewport.canvasHeight,
      );
      // Leave every borrowed renderer setting exactly as found, including
      // failure paths. The original cinematic scene resumes this same context.
      const previous = {
        target: renderer.getRenderTarget(),
        viewport: renderer.getViewport(new THREE.Vector4()),
        scissor: renderer.getScissor(new THREE.Vector4()),
        scissorTest: renderer.getScissorTest(),
        autoClear: renderer.autoClear,
        shadowUpdate: renderer.shadowMap.needsUpdate,
        shaderError: renderer.debug?.onShaderError,
      };
      let shaderFailed = false;
      let contentTriangles = 0;
      try {
        renderer.setRenderTarget(null);
        renderer.setScissorTest(false);
        renderer.setViewport(0, 0, width, height);
        renderer.autoClear = true;
        renderer.shadowMap.needsUpdate = false;
        renderer.info.reset();
        if (renderer.debug) renderer.debug.onShaderError = () => { shaderFailed = true; };
        if (renderBackground) {
          renderBackground(width, viewport.canvasHeight);
          renderer.autoClear = false;
          renderer.clearDepth();
        }
        renderer.setViewport(0, 0, width, viewport.canvasHeight);
        const beforeTriangles = renderer.info.autoReset ? 0 : renderer.info.render.triangles;
        renderer.render(scene, camera);
        contentTriangles = renderer.info.render.triangles - beforeTriangles;
      } finally {
        renderer.setRenderTarget(previous.target);
        renderer.setViewport(previous.viewport);
        renderer.setScissor(previous.scissor);
        renderer.setScissorTest(previous.scissorTest);
        renderer.autoClear = previous.autoClear;
        renderer.shadowMap.needsUpdate = previous.shadowUpdate;
        if (renderer.debug) renderer.debug.onShaderError = previous.shaderError;
      }
      if (shaderFailed) {
        unavailable = true;
        throw new Error("The pricing hand shader could not be compiled");
      }
      const visible = contentTriangles >= 2;
      if (!visible) lastSignature = "";
      return visible;
    },
    screenProjection(width, height) {
      if (!phone) return null;
      if (
        projection &&
        projectionWidth === width &&
        projectionHeight === height
      )
        return projection;
      scene.updateMatrixWorld(true);
      camera.updateMatrixWorld(true);
      projectionWidth = width;
      projectionHeight = height;
      const screenCamera = camera.clone();
      screenCamera.clearViewOffset();
      screenCamera.updateMatrixWorld(true);
      projection = projectPricingScreen(
        phone.getObjectByName("Object_18"),
        screenCamera,
        width,
        height,
      );
      return projection;
    },
    screenIsVisible(x, y, width, height) {
      if (!hand || !phone) return true;
      pointer.set((x / width) * 2 - 1, 1 - (y / height) * 2);
      const hitCamera = camera.clone();
      hitCamera.clearViewOffset();
      hitCamera.updateMatrixWorld(true);
      raycaster.setFromCamera(pointer, hitCamera);
      const surface = raycaster.intersectObject(
        phone.getObjectByName("Object_18"),
        false,
      )[0];
      if (!surface) return false;
      const finger = raycaster.intersectObject(hand, false)[0];
      return !finger || finger.distance >= surface.distance;
    },
    get ready() {
      return Boolean(!unavailable && hand && material.map && phone);
    },
    get unavailable() {
      return unavailable;
    },
    reset() {
      lastSignature = "";
    },
    dispose() {
      disposed = true;
      hand?.geometry.dispose();
      material.dispose();
      texture?.dispose();
      screenMaterial.dispose();
      // The phone clone borrows the original meshes and PBR materials.
      // Their lifetime remains owned by Vistaire's main scene.
      product.clear();
    },
  };
}

