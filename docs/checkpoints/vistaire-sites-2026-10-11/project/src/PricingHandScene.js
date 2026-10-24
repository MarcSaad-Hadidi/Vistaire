import * as THREE from "three";
import {
  decodeOryzoBuffer,
  applyOryzoTrack,
  sampleOryzoHand,
} from "./OryzoAnimation.js";
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
  fairGrip = false,
) {
  camera.clearViewOffset();
  const aspect = width / height;
  const stackedCopy =
    fairGrip && width < 1024 && !(width >= 700 && height <= 500);
  const halfHeight = Math.max(
    0.1,
    (0.14 * height) / (2 * Math.max(180, height - (stackedCopy ? 300 : 170))),
    0.043 / aspect,
  );
  camera.position.x = -0.011576;
  // Keep the supplied PNG's left-edge wrist crop below the desktop frame.
  // On mobile the natural forearm leaves the viewport at lower left; reserve
  // space below the phone for the real external links and terms.
  const wristDrop = fairGrip && !stackedCopy ? height * 0.07 + 20 : 0;
  camera.position.z = -0.057515 + (2 * halfHeight * (20 + wristDrop)) / height;
  camera.left = -halfHeight * aspect;
  camera.right = halfHeight * aspect;
  camera.top = halfHeight;
  camera.bottom = -halfHeight;
  camera.updateProjectionMatrix();
}

export function createPricingHandCamera(aspect = 1, height = 740) {
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 4);
  camera.position.y = 1.22526;
  camera.quaternion.set(0, -Math.SQRT1_2, -Math.SQRT1_2, 0);
  configurePricingHandCamera(camera, aspect * height, height);
  camera.updateMatrixWorld(true);
  return camera;
}

// Both grips share the fixed canvas, native phone, camera and HTML aperture.
// The original rig is retained for geometry regression checks. The production
// grip is a photographic cutout matching the user's new front-facing reference.
export function createPricingHandScene({
  renderer,
  phoneRoot,
  environment,
  invalidate,
  renderBackground,
  grip = "fair",
}) {
  const fairGrip = grip === "fair";
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

  const positions = Array.from({ length: 36 }, () => new THREE.Vector3());
  const orientations = Array.from({ length: 36 }, () => new THREE.Quaternion());
  const atlasDelta = { value: new THREE.Vector2() };
  const atlasMix = { value: 0 };
  const material = new THREE.MeshBasicMaterial({ toneMapped: false });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.handAtlasDelta = atlasDelta;
    shader.uniforms.handAtlasMix = atlasMix;
    shader.fragmentShader =
      "uniform vec2 handAtlasDelta; uniform float handAtlasMix;\n" +
      shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      `
      #ifdef USE_MAP
        vec4 sampledDiffuseColor = mix(texture2D(map, vMapUv), texture2D(map, vMapUv + handAtlasDelta), handAtlasMix);
        diffuseColor *= sampledDiffuseColor;
      #endif
    `,
    );
  };
  material.customProgramCacheKey = () =>
    "vistaire-native-hand-atlas-skinned-v3";
  if (fairGrip) configureFairHandMaterial(material);
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
  let hand,
    handMesh,
    handTrack,
    productTrack,
    cameraTrack,
    phone,
    loading,
    unavailable = false,
    disposed = false,
    atlas;
  let lastSignature = "",
    projection = null,
    projectionWidth = 0,
    projectionHeight = 0,
    progress = -1,
    poseWidth = 0,
    poseHeight = 0;
  const request = new AbortController();
  async function load() {
    if (loading || unavailable || disposed) return;
    loading = true;
    try {
      const names = fairGrip
        ? ["product_animation", "hero_camera"]
        : ["hand", "hand_animation", "product_animation", "hero_camera"];
      const files = await Promise.all(
        names.map(async (name) => {
          const response = await fetch(`/assets/pricing-hand/${name}.buf`, {
            signal: request.signal,
          });
          if (!response.ok) throw new Error("Pricing hand asset unavailable");
          return decodeOryzoBuffer(await response.arrayBuffer());
        }),
      );
      if (fairGrip) {
        productTrack = files[0];
        cameraTrack = files[1];
        if (disposed) return;
        addPhone();
      } else {
        handMesh = files[0];
        const geometry = new THREE.BufferGeometry();
        geometry.setIndex(
          new THREE.BufferAttribute(handMesh.attributes.indices.array, 1),
        );
        geometry.setAttribute(
          "position",
          new THREE.BufferAttribute(handMesh.attributes.position.array, 3),
        );
        geometry.setAttribute(
          "skinIndex",
          new THREE.BufferAttribute(handMesh.attributes.boneIndices.array, 4),
        );
        geometry.setAttribute(
          "skinWeight",
          new THREE.BufferAttribute(handMesh.attributes.boneWeights.array, 4),
        );
        geometry.setAttribute(
          "uv",
          new THREE.BufferAttribute(
            Float32Array.from(
              handMesh.attributes.uv.array,
              (value) => value * 0.5,
            ),
            2,
          ),
        );
        if (disposed) {
          geometry.dispose();
          return;
        }
        handTrack = files[1];
        productTrack = files[2];
        cameraTrack = files[3];
        hand = new THREE.SkinnedMesh(geometry, material);
        const bones = positions.map(() => new THREE.Bone());
        hand.add(...bones);
        hand.bind(new THREE.Skeleton(bones), new THREE.Matrix4());
        hand.frustumCulled = false;
        scene.add(hand);
      }
      atlas = new THREE.TextureLoader().load(
        fairGrip ? FAIR_HAND_ASSET.src : "/assets/pricing-hand/hand-atlas.webp",
        () => {
          if (disposed) atlas.dispose();
          else {
            material.map = atlas;
            material.needsUpdate = true;
            lastSignature = "";
            addPhone();
            // Compile while approaching the section, without drawing or
            // changing the live canvas. Keep the first hand frame atomic.
            renderer
              .compileAsync?.(scene, camera)
              .then(invalidate)
              .catch(() => {
                unavailable = true;
                invalidate();
              });
            invalidate();
          }
        },
        undefined,
        () => {
          unavailable = true;
          invalidate();
        },
      );
      atlas.colorSpace = THREE.SRGBColorSpace;
      invalidate();
    } catch (error) {
      if (!disposed && error.name !== "AbortError") {
        unavailable = true;
        invalidate();
      }
    }
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
    if (fairGrip) {
      hand = new THREE.Mesh(createFairHandGeometry(phone), material);
      hand.name = "VistaireFairHand";
      hand.frustumCulled = false;
      product.add(hand);
    }
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
        (fairGrip && (poseWidth !== width || poseHeight !== height));
      if (poseChanged) {
        progress = ratio;
        poseWidth = width;
        poseHeight = height;
        if (!fairGrip) {
          const frame = sampleOryzoHand(
            handTrack,
            ratio,
            positions,
            orientations,
          );
          const appearance = Math.max(0, Math.min(1, (frame - 20) / 20));
          const atlasPose = 2 * (1 - (1 - appearance) ** 3);
          const from = Math.floor(atlasPose),
            to = Math.ceil(atlasPose);
          atlas.offset.set((from % 2) / 2, Math.floor(from / 2) / 2);
          atlasDelta.value.set(
            ((to % 2) - (from % 2)) / 2,
            (Math.floor(to / 2) - Math.floor(from / 2)) / 2,
          );
          atlasMix.value = atlasPose - from;
          hand.skeleton.bones.forEach((bone, index) => {
            bone.position.copy(positions[index]);
            bone.quaternion.copy(orientations[index]);
          });
          hand.updateMatrixWorld(true);
          hand.skeleton.update();
          hand.boundingSphere = null;
        }
        // The photographic grip needs a stable front view; legacy product
        // yaw/scale tracks caused a sudden tilt and repeated layout measures.
        const trackRatio = fairGrip ? 1 : (71 + ratio * 44) / 115;
        applyOryzoTrack(productTrack, trackRatio, product);
        applyOryzoTrack(cameraTrack, trackRatio, camera);
      }
      configurePricingHandCamera(camera, width, height, fairGrip);
      if (fairGrip && poseChanged)
        moveFairHandEntry(product, ratio, camera.top - camera.bottom);
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
      // Reset the shared renderer's target, viewport and scissor explicitly.
      // A new drawing buffer must be repainted even if the CSS size is unchanged.
      renderer.setRenderTarget(null);
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, width, height);
      renderer.autoClear = true;
      renderer.shadowMap.needsUpdate = false;
      renderer.info.reset();
      const previousShaderError = renderer.debug?.onShaderError;
      let shaderFailed = false;
      let contentTriangles = 0;
      if (renderer.debug)
        renderer.debug.onShaderError = () => {
          shaderFailed = true;
        };
      try {
        if (renderBackground) {
          renderBackground(width, height);
          renderer.autoClear = false;
          renderer.clearDepth();
        }
        renderer.setViewport(0, 0, width, viewport.canvasHeight);
        const beforeTriangles = renderer.info.render.triangles;
        renderer.render(scene, camera);
        contentTriangles = renderer.info.render.triangles - beforeTriangles;
      } finally {
        renderer.autoClear = true;
        if (renderer.debug) renderer.debug.onShaderError = previousShaderError;
      }
      if (shaderFailed) {
        unavailable = true;
        throw new Error("The pricing hand shader could not be compiled");
      }
      const visible = fairGrip ? contentTriangles >= 2 : contentTriangles > 2;
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
      request.abort();
      hand?.geometry.dispose();
      hand?.skeleton?.dispose();
      material.dispose();
      atlas?.dispose();
      screenMaterial.dispose();
      // The phone clone borrows the original meshes and PBR materials.
      // Their lifetime remains owned by Vistaire's main scene.
      product.clear();
    },
  };
}
