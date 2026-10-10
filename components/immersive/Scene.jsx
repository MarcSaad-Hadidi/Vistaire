import { continuousComposition, interpolatePose, interpolatePoseTrack, DEFAULT_SCENE_FRAME } from "./SceneDirector.js";
import { cameraDollyPose } from "./CameraDolly.js";
import {
  projectHullBounds,
  projectObjectBounds,
  unionScreenBounds,
} from "./ProjectedBounds.js";
import { createARExperience } from "./ARExperience.js";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { createSupportModels } from "./SupportModels";
import { createPhoneModel } from "./PhoneModel";
import { createLaptopModel } from "./LaptopModel.js";
import { dishes } from "./content";
import { createRestaurantModel } from "./RestaurantModel";
import { createRestaurantTable } from "./RestaurantTable.js";
import { arrangePresentationTable } from "./TablePresentationLayout.js";
import { createVideoPlaybackController } from "./videoPlayback.js";

const HALF_PI = Math.PI / 2;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
// The source scans use different authoring units. Size their desktop portions
// against the original table's 5.16-unit usable top, rather than making every
// dessert/plate 2.35 units wide and then enlarging it again in the viewer.
// These are presentation dimensions, not claimed real-world measurements.
const DESKTOP_DISH_FOOTPRINTS = Object.freeze({
  homard: 1.75,
  souffle: 1.65,
  huitres: 1.5,
  sushi: 2,
  "chocolat-fume": 1.5,
  poutine: 1.75,
  burger: 1.1,
});
const FRAMING_HULL_SIZE = 2.35;
const dishPresentationScale = (name, mobile) =>
  mobile
    ? name === "burger"
      ? 0.55
      : 1
    : (DESKTOP_DISH_FOOTPRINTS[name] ?? 1.75) / FRAMING_HULL_SIZE;

// Each pose is an independent composition. Scroll changes geometry and camera,
// while the DOM remains responsible for readable text and accessible controls.
function baseComposition(state, mobile) {
  if (state.openingProgress != null) {
    const p = clamp(state.openingProgress, 0, 1);
    const from = baseComposition(
      {
        ...state,
        openingProgress: null,
        section: p < 0.56 ? "hero" : "ai",
        progress: 0,
      },
      mobile,
    );
    const to = baseComposition(
      {
        ...state,
        openingProgress: null,
        section: p < 0.56 ? "ai" : "wearable",
        progress: 0,
      },
      mobile,
    );
    const t = THREE.MathUtils.smoothstep(
      p,
      p < 0.56 ? 0 : 0.56,
      p < 0.56 ? 0.56 : 1,
    );
    const pose = {};
    for (const key of Object.keys(from)) {
      pose[key] = Array.isArray(from[key])
        ? from[key].map((v, i) => THREE.MathUtils.lerp(v, to[key][i], t))
        : typeof from[key] === "number"
          ? THREE.MathUtils.lerp(from[key], to[key], t)
          : to[key];
    }
    // A physical, reversible reveal: flat objects rise while the plate recedes.
    const rise = THREE.MathUtils.smoothstep(p, 0.02, 0.56);
    pose.dishScale = THREE.MathUtils.lerp(mobile ? 1.2 : 1.45, 0.18, rise);
    pose.dishScale *= 1 - THREE.MathUtils.smoothstep(p, 0.56, 0.9);
    pose.dish = [0, 0.02, 0.45 + rise * 0.15];
    pose.dishOpacity = 1;
    return pose;
  }
  const p = clamp(state.progress || 0, 0, 1);
  const pose = {
    camera: mobile ? [0, 5.8, 7.4] : [0, 4.6, 6.4],
    look: [0, 0.6, 0],
    support: [0, 0.2, 0],
    supportRotation: [0, -0.2, 0],
    supportScale: 0,
    phone: [0, 0.8, 0],
    phoneRotation: [-0.1, -0.1, 0],
    phoneScale: 0,
    dish: [0, 0.15, 0],
    dishRotation: [0, -0.25, 0],
    dishScale: 0,
    dishOpacity: 1,
    laptop: [0, 0.08, 0],
    laptopRotation: [0, -0.1, 0],
    laptopScale: 0,
    table: 1,
    particles: false,
  };
  switch (state.section) {
    case "hero":
      Object.assign(pose, {
        camera: mobile ? [0, 2.1, 9.6] : [0, 1.8, 8.6],
        look: [0, 0.25, -1.1],
        table: 1,
        support: [-2.1, 0.13, 0.85],
        supportRotation: [-HALF_PI + 0.2, 0, -0.2],
        supportScale: mobile ? 0.65 : 0.8,
        dish: [0, 0.02, 0.45],
        dishScale: mobile ? 1.2 : 1.45,
        phone: [2.1, 0.16, 0.95],
        phoneRotation: [-HALF_PI, 0, 0.15],
        phoneScale: mobile ? 0.63 : 0.68,
      });
      break;
    case "ai":
      Object.assign(pose, {
        camera: mobile
          ? [0.18 * p, 5.8 - p * 0.6, 8.5 - p * 1.1]
          : [0.2 * p, 4.8 - p * 0.3, 7.5 - p * 1.1],
        support: [mobile ? -0.55 : -1.35, 0.35 + p * 0.25, -0.3],
        supportRotation: [-0.06, -0.35 + p * 0.2, -0.04],
        supportScale: mobile ? 0.6 : 1,
        phone: [
          mobile ? 0.45 : 0.85,
          mobile ? 1.3 + p * 0.12 : 1.55 + p * 0.28,
          mobile ? 1.7 : 1.55,
        ],
        phoneRotation: [-0.05, 0.28 - p * 0.48, 0.05 - p * 0.1],
        phoneScale: mobile ? 1 : 1.2,
      });
      break;
    case "wearable":
      Object.assign(pose, {
        phone: [0, 1.25, 1.25],
        phoneScale: 1,
        phoneRotation: [-0.02, 0.12, 0],
        camera: [0, 2.8, 7.4],
        look: [0, 2.3, 1.25],
      });
      break;
    case "features":
      Object.assign(pose, {
        dish: [mobile ? 0 : -1.0, mobile ? 1.1 : 0.2, 0.1],
        dishScale: mobile ? 0.91 : 1,
        dishRotation: [0.08, -0.55 + p * Math.PI * 1.35, 0.02],
        camera: mobile ? [0, 5.5, 6.8] : [0.4, 4.5, 6.3],
      });
      break;
    case "encryption":
      Object.assign(pose, {
        support: [0, 0.08, mobile ? 2.6 : 2.1],
        supportScale: mobile ? 1.14 : 1.1,
        supportRotation: [-0.06, state.flip ? Math.PI : -0.18, -0.025],
        look: [0, 1.1, 0],
      });
      break;
    case "grip":
      Object.assign(pose, {
        dish: [0, 0.2, 0],
        dishScale: mobile ? 0.98 : 1,
        dishRotation: [
          0.1 + (state.dishPitch || 0),
          (clamp(state.drag ?? 0.5, 0, 1) - 0.5) * Math.PI * 2,
          0,
        ],
        camera: mobile ? [0, 4.1, 6.4] : [0, 2.8, 6.3],
      });
      break;
    case "sustainability":
      Object.assign(pose, {
        laptop: [0, 0.08, 0],
        laptopScale: 1,
        laptopRotation: [0, mobile ? -0.02 : -0.12, 0],
        camera: mobile ? [0, 3.6, 7.2] : [0, 3.2, 6.6],
        look: [0, 0.95, 0],
      });
      break;
    case "testimonies":
    case "social-content":
      break;
    case "product":
      Object.assign(pose, {
        support: [0, 0.08, mobile ? 0.45 : 0.6],
        supportScale: mobile ? 0.9 : 1.1,
        supportRotation: [
          -0.06,
          -0.18 + ((state.supportAngle || 0) * Math.PI) / 180,
          0,
        ],
        look: [0, 1.1, 0],
      });
      break;
    case "open-weight":
      Object.assign(pose, {
        support: [mobile ? 0.2 : 1.3, 0.13, -0.1],
        supportScale: mobile ? 0.95 : 1.1,
        supportRotation: [-0.15, -0.3, 0],
      });
      break;
    case "footer":
      Object.assign(pose, {
        camera: mobile ? [0, 4.2, 9.2] : [0, 3.6, 8.4],
        dish: [0, 0.04, 0.55],
        dishScale: mobile ? 0.84 : 1,
        support: [mobile ? -0.9 : -1.45, 0.08, -0.25],
        supportScale: mobile ? 0.7 : 0.95,
        supportRotation: [-0.05, -0.2, 0],
        phone: [mobile ? 0.8 : 1.4, 1.18, 0.4],
        phoneScale: mobile ? 0.77 : 0.95,
        phoneRotation: [-0.07, -0.14, 0],
      });
      break;
    default:
      break;
  }
  return pose;
}

function composition(state, mobile) {
  return continuousComposition(state, mobile, baseComposition);
}

function disposeTree(root) {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  root.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    for (const material of Array.isArray(object.material)
      ? object.material
      : [object.material]) {
      if (!material) continue;
      materials.add(material);
      for (const value of Object.values(material)) {
        if (value?.isTexture) textures.add(value);
      }
    }
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  textures.forEach((texture) => {
    texture.dispose();
    // GLTFLoader may decode embedded images to ImageBitmap objects.
    if (texture.image?.close) texture.image.close();
  });
}

export default function Scene({
  stateRef,
  onReady,
  onError,
  onAssetError,
  onAssetLoading,
  onARStatus,
}) {
  const hostRef = useRef(null);
  const callbacks = useRef({
    onReady,
    onError,
    onAssetError,
    onAssetLoading,
    onARStatus,
  });
  useEffect(() => {
    callbacks.current = { onReady, onError, onAssetError, onAssetLoading, onARStatus };
  }, [onReady, onError, onAssetError, onAssetLoading, onARStatus]);

  useEffect(() => {
    const sceneState = stateRef.current;
    // A fresh canvas per effect avoids reusing a lost context in StrictMode.
    const canvas = document.createElement("canvas");
    canvas.className = "scene-canvas";
    canvas.dataset.ready = "false";
    canvas.setAttribute("aria-hidden", "true");
    Object.assign(canvas.style, {
      width: "100%",
      height: "100%",
      display: "block",
    });
    hostRef.current.appendChild(canvas);
    let disposed = false;
    let failed = false;
    let renderer;
    let arExperience;
    let frame = 0;
    let lastTime = 0;
    let assetRequest;
    let ready = false;
    let stoneReady = false;
    let decodeQueue = Promise.resolve();
    let currentDish = "";
    let currentModelUrl = "";
    let lastRetryModel = stateRef.current?.retryModel ?? 0;
    let activeDish;
    let lastCollection = "";
    const ownedTextures = new Set();
    const mobileViewport = () => window.innerWidth < 768;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#050505");
    scene.fog = new THREE.FogExp2("#050505", 0.028);
    const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 150);
    const lookAt = new THREE.Vector3(0, 0, 0);
    const cameraTarget = new THREE.Vector3();
    const objectTarget = new THREE.Vector3();
    const targetQuaternion = new THREE.Quaternion();
    const targetEuler = new THREE.Euler();
    let environmentTarget;
    let environmentScene;

    function fail(error) {
      if (disposed || failed) return;
      failed = true;
      cancelAnimationFrame(frame);
      frame = 0;
      canvas.dataset.ready = "error";
      callbacks.current.onError?.(
        error instanceof Error ? error : new Error(String(error)),
      );
    }

    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
      });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.autoUpdate = false;
      renderer.shadowMap.type = THREE.PCFShadowMap;
      environmentScene = new RoomEnvironment();
      const pmrem = new THREE.PMREMGenerator(renderer);
      environmentTarget = pmrem.fromScene(environmentScene, 0.08);
      scene.environment = environmentTarget.texture;
      scene.environmentIntensity = 0.48;
      pmrem.dispose();
    } catch (error) {
      fail(error);
      renderer?.dispose();
      environmentTarget?.dispose();
      environmentScene?.dispose();
      return () => {
        disposed = true;
        canvas.remove();
      };
    }

    const warmFill = new THREE.HemisphereLight("#f1e9da", "#1b1813", 1.5);
    scene.add(warmFill);
    const keyLight = new THREE.DirectionalLight("#fff1d8", 3.0);
    keyLight.position.set(-3.5, 7.5, 3.5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(
      mobileViewport() ? 1024 : 2048,
      mobileViewport() ? 1024 : 2048,
    );
    keyLight.shadow.camera.left = -6;
    keyLight.shadow.camera.right = 6;
    keyLight.shadow.camera.top = 6;
    keyLight.shadow.camera.bottom = -6;
    keyLight.shadow.camera.near = 0.1;
    keyLight.shadow.camera.far = 18;
    keyLight.shadow.normalBias = 0.025;
    keyLight.shadow.bias = -0.00015;
    keyLight.shadow.radius = 4;
    keyLight.shadow.intensity = 0.7;
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight("#dca66a", 2.8);
    rimLight.position.set(4, 3.5, -4);
    scene.add(rimLight);
    const frontLight = new THREE.DirectionalLight("#f1e9db", 0.8);
    frontLight.position.set(0, 2, 5);
    scene.add(frontLight);

    const textureLoader = new THREE.TextureLoader();
    const stone = textureLoader.load(
      "/immersive-assets/restaurant-stone.webp",
      (texture) => {
        if (disposed) texture.dispose();
        else stoneReady = true;
      },
      undefined,
      () =>
        fail(new Error("La matière du restaurant ne peut pas être chargée.")),
    );
    stone.colorSpace = THREE.SRGBColorSpace;
    stone.wrapS = stone.wrapT = THREE.RepeatWrapping;
    stone.repeat.set(3, 3);
    stone.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    ownedTextures.add(stone);
    let nativeTable;
    let updateTableClearance = () => {};
    const restaurantWorld = createRestaurantModel(scene, {
      renderer,
      canvas,
      disposeTree,
      onError: fail,
      onReady: (model) => {
        nativeTable = createRestaurantTable(model, {
          width: 6,
          surfaceY: -0.02,
          placements: {
            placeSetting: [-1.8, 0.01, 0.7],
            glass: [2.05, 0.01, 0.3],
            candle: [-2.05, 0.01, 0.15],
          },
        });
        const center = nativeTable.metadata.sourceCenter;
        nativeTable.group.rotation.y = Math.atan2(
          -0.38353 - center[0],
          center[2] + 10.13489,
        );
        updateTableClearance = arrangePresentationTable(nativeTable);
        canvas.dataset.roomTableTrianglesOmitted = String(
          nativeTable.excludeCopiedObjectsFromRoom(),
        );
        nativeTable.group.traverse((object) => object.layers.set(2));
        scene.add(nativeTable.group);
        for (const object of [table, tablePedestal, decor]) {
          scene.remove(object);
          disposeTree(object);
        }
        canvas.dataset.table = "original-white-table-chair-accessories";
        canvas.dataset.tableMetadata = JSON.stringify(nativeTable.metadata);
        return nativeTable.metadata;
      },
    });
    const woodMaterial = new THREE.MeshStandardMaterial({
      color: "#2c4148",
      map: stone,
      bumpMap: stone,
      bumpScale: 0.01,
      roughness: 0.64,
      metalness: 0.02,
      transparent: false,
    });
    const table = new THREE.Mesh(
      new THREE.CylinderGeometry(3.2, 3.2, 0.16, 96),
      woodMaterial,
    );
    table.position.y = -0.12;
    table.scale.x = 1.24;
    table.receiveShadow = true;
    scene.add(table);
    const tablePedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.23, 1.72, 20),
      new THREE.MeshStandardMaterial({
        color: "#ad996f",
        metalness: 0.8,
        roughness: 0.35,
      }),
    );
    tablePedestal.position.y = -1.04;
    scene.add(tablePedestal);
    const shadowCanvas = document.createElement("canvas");
    shadowCanvas.width = shadowCanvas.height = 256;
    const shadowContext = shadowCanvas.getContext("2d");
    const gradient = shadowContext.createRadialGradient(
      128,
      128,
      20,
      128,
      128,
      128,
    );
    gradient.addColorStop(0, "rgba(0,0,0,0.5)");
    gradient.addColorStop(0.65, "rgba(0,0,0,0.22)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    shadowContext.fillStyle = gradient;
    shadowContext.fillRect(0, 0, 256, 256);
    const softShadowTexture = new THREE.CanvasTexture(shadowCanvas);
    ownedTextures.add(softShadowTexture);
    const contactShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(2.8, 2.8),
      new THREE.MeshBasicMaterial({
        map: softShadowTexture,
        transparent: true,
        depthWrite: false,
        opacity: 0.8,
      }),
    );
    contactShadow.rotation.x = -HALF_PI;
    contactShadow.position.y = -0.012;
    contactShadow.layers.set(2);
    scene.add(contactShadow);

    function mesh(geometry, material, parent, x = 0, y = 0, z = 0) {
      const object = new THREE.Mesh(geometry, material);
      object.position.set(x, y, z);
      object.castShadow = true;
      object.receiveShadow = true;
      parent.add(object);
      return object;
    }

    const gold = new THREE.MeshStandardMaterial({
      color: "#b99a66",
      metalness: 0.88,
      roughness: 0.27,
    });
    const glass = new THREE.MeshPhysicalMaterial({
      color: "#fff4dc",
      roughness: 0.12,
      metalness: 0,
      transmission: 0,
      thickness: 0.05,
      transparent: true,
      opacity: 0.24,
      ior: 1.45,
    });
    const decor = new THREE.Group();
    scene.add(decor);
    const napkin = mesh(
      new RoundedBoxGeometry(1.12, 0.06, 1.6, 3, 0.025),
      new THREE.MeshStandardMaterial({ color: "#4a4136", roughness: 0.95 }),
      decor,
      -2.6,
      0.025,
      1.25,
    );
    napkin.rotation.y = 0.2;
    const cutlery = new THREE.Group();
    cutlery.position.set(-2.6, 0.07, 1.25);
    cutlery.rotation.y = 0.2;
    decor.add(cutlery);
    for (const x of [-0.23, 0.23]) {
      mesh(
        new RoundedBoxGeometry(0.055, 0.025, 0.85, 2, 0.018),
        gold,
        cutlery,
        x,
        0,
        0.15,
      );
    }
    mesh(
      new RoundedBoxGeometry(0.14, 0.025, 0.5, 2, 0.018),
      gold,
      cutlery,
      0.265,
      0,
      -0.46,
    );
    mesh(
      new THREE.BoxGeometry(0.18, 0.025, 0.11),
      gold,
      cutlery,
      -0.23,
      0,
      -0.32,
    );
    for (let i = 0; i < 4; i++)
      mesh(
        new THREE.BoxGeometry(0.023, 0.025, 0.23),
        gold,
        cutlery,
        -0.3 + i * 0.047,
        0,
        -0.45,
      );
    const wine = new THREE.Group();
    wine.position.set(2.4, 0.02, -1.5);
    decor.add(wine);
    mesh(
      new THREE.CylinderGeometry(0.31, 0.32, 0.025, 32),
      glass,
      wine,
      0,
      0.013,
      0,
    );
    mesh(
      new THREE.CylinderGeometry(0.022, 0.024, 0.64, 16),
      glass,
      wine,
      0,
      0.34,
      0,
    );
    const bowlProfile = [
      [0.045, 0.61],
      [0.14, 0.66],
      [0.28, 0.8],
      [0.34, 1.03],
      [0.31, 1.3],
      [0.28, 1.4],
    ];
    mesh(
      new THREE.LatheGeometry(
        bowlProfile.map(([x, y]) => new THREE.Vector2(x, y)),
        40,
      ),
      glass,
      wine,
    );
    const candle = new THREE.Group();
    candle.position.set(-2.4, 0.02, -1.45);
    decor.add(candle);
    mesh(
      new THREE.CylinderGeometry(0.25, 0.25, 0.37, 32, 1, true),
      glass,
      candle,
      0,
      0.19,
      0,
    );
    mesh(
      new THREE.CylinderGeometry(0.21, 0.21, 0.13, 32),
      new THREE.MeshStandardMaterial({ color: "#dccaaa", roughness: 0.9 }),
      candle,
      0,
      0.08,
      0,
    );
    const flame = mesh(
      new THREE.SphereGeometry(0.028, 12, 12),
      new THREE.MeshBasicMaterial({ color: "#ffe3a2", toneMapped: false }),
      candle,
      0,
      0.2,
      0,
    );
    flame.scale.y = 2.4;
    const candleLight = new THREE.PointLight("#f2ac55", 0.7, 4, 2);
    candleLight.position.set(-2.4, 0.5, -1.45);
    scene.add(candleLight);

    const supportAssets = createSupportModels({
      canvas,
      renderer,
      disposeTree,
      onError: fail,
    });
    const supportRoot = supportAssets.root;
    scene.add(supportRoot);

    const phoneScreenMaterial = new THREE.MeshBasicMaterial({
      color: "#ead9bd",
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    const phoneAsset = createPhoneModel({
      canvas,
      screenMaterial: phoneScreenMaterial,
      disposeTree,
      onError: fail,
    });
    const phoneRoot = phoneAsset.root;
    scene.add(phoneRoot);
    const laptopAsset = createLaptopModel({
      canvas,
      renderer,
      disposeTree,
      onError: fail,
    });
    const laptopRoot = laptopAsset.root;
    scene.add(laptopRoot);
    let posterReady = false;
    let videoReady = false;
    let videoStarted = false;
    let currentPhoneDemo = "";
    const posters = new Map();
    let currentPosterDemo = "";
    function selectPoster(demo) {
      if (currentPosterDemo === demo) return;
      currentPosterDemo = demo;
      posterReady = false;
      const applyPoster = (texture) => {
        if (disposed) {
          texture.dispose();
          return;
        }
        if (currentPosterDemo !== demo) return;
        posterReady = true;
        // A late poster must not replace a moving frame already on screen.
        if (!videoReady) {
          phoneScreenMaterial.map = texture;
          phoneScreenMaterial.color.set("#ffffff");
          phoneScreenMaterial.needsUpdate = true;
        }
      };
      if (posters.has(demo)) {
        applyPoster(posters.get(demo));
        return;
      }
      const texture = textureLoader.load(
        `/immersive-assets/phone-poster-${demo}.webp`,
        applyPoster,
        undefined,
        () =>
          fail(new Error("L’aperçu du menu mobile ne peut pas être chargé.")),
      );
      texture.colorSpace = THREE.SRGBColorSpace;
      posters.set(demo, texture);
      ownedTextures.add(texture);
    }
    selectPoster("maison-elyse");
    const phoneVideo = document.createElement("video");
    phoneVideo.muted = true;
    phoneVideo.loop = true;
    phoneVideo.playsInline = true;
    phoneVideo.preload = "none";
    phoneVideo.setAttribute("playsinline", "");
    const phonePlayback = createVideoPlaybackController(phoneVideo);
    phoneVideo.onerror = () =>
      fail(
        new Error("La démonstration du menu mobile ne peut pas être chargée."),
      );
    let phoneFrame = 0;
    let videoFrameCallback;
    if (phoneVideo.requestVideoFrameCallback) {
      const decoded = () => {
        if (disposed) return;
        phoneFrame++;
        videoFrameCallback = phoneVideo.requestVideoFrameCallback(decoded);
      };
      videoFrameCallback = phoneVideo.requestVideoFrameCallback(decoded);
    }
    const videoTexture = new THREE.VideoTexture(phoneVideo);
    videoTexture.colorSpace = THREE.SRGBColorSpace;
    ownedTextures.add(videoTexture);
    function updatePhoneVideo(shouldPlay, demo) {
      if (!shouldPlay || currentPhoneDemo !== demo) videoReady = false;
      selectPoster(demo);
      if (!shouldPlay) {
        if (!phoneVideo.paused) phoneVideo.pause();
        const still = posters.get(demo);
        if (still && posterReady && phoneScreenMaterial.map !== still) {
          phoneScreenMaterial.map = still;
          phoneScreenMaterial.needsUpdate = true;
          videoReady = false;
        }
        return;
      }
      if (!videoStarted || currentPhoneDemo !== demo) {
        phoneVideo.pause();
        phoneVideo.src = `/videos/demo/${demo}.mp4`;
        currentPhoneDemo = demo;
        videoReady = false;
        phonePlayback.reset();
        phoneVideo.defaultPlaybackRate = 2;
        phoneVideo.playbackRate = 2;
        phoneVideo.load();
        videoStarted = true;
        canvas.dataset.phoneDemo = demo;
      }
      phonePlayback.play();
      // Keep the actual menu poster until a decoded moving frame is available.
      if (
        !videoReady &&
        phoneVideo.readyState >= 2 &&
        phoneVideo.currentTime > 0.05
      ) {
        videoReady = true;
        phoneScreenMaterial.map = videoTexture;
        phoneScreenMaterial.color.set("#ffffff");
        phoneScreenMaterial.needsUpdate = true;
      }
    }

    const dishRoot = new THREE.Group();
    const originalFoodOpacity = new WeakMap();
    let foodMaterials = [];
    let dishDisplayScale = 1;
    const dishLocalBounds = new THREE.Box3();
    const dishZoomCenter = new THREE.Vector3();
    const dishZoomDirection = new THREE.Vector3();
    const dishZoomCorner = new THREE.Vector3();
    let activeModelUrl = "";
    const hullWorldMatrix = new THREE.Matrix4();
    const hullScale = new THREE.Vector3();
    let framingHulls = {};
    const hullRequest = new AbortController();
    canvas.dataset.framingReady = "false";
    fetch("/immersive-assets/dishes/framing-hulls.json", { signal: hullRequest.signal })
      .then((response) => {
        if (!response.ok)
          throw new Error("Le cadrage des plats ne peut pas être chargé.");
        return response.json();
      })
      .then((data) => {
        if (disposed) return;
        framingHulls = data.byUrl;
        canvas.dataset.framingReady = "true";
      })
      .catch((error) => {
        if (!disposed && error.name !== "AbortError") fail(error);
      });
    scene.add(dishRoot);
    const foodDraco = new DRACOLoader()
      .setDecoderPath("/immersive-assets/draco/")
      .setDecoderConfig({ type: "wasm" })
      .setWorkerLimit(1);
    const loader = new GLTFLoader()
      .setMeshoptDecoder(MeshoptDecoder)
      .setDRACOLoader(foodDraco);
    function modelUrl(name) {
      if (name === "homard")
        return mobileViewport()
          ? "/models/demo/ar-lite/homard-bisque-ar-lite-meshy.glb"
          : "/models/demo/homard-bisque-meshopt-ee44bc60.glb";
      if (
        ["huitres", "sushi", "chocolat-fume", "poutine", "burger"].includes(
          name,
        )
      )
        return `/immersive-assets/dishes/lod/${name}-mobile.glb`;
      const dish = dishes.find((dish) => dish.id === name && dish.model);
      return typeof dish?.model === "string"
        ? dish.model
        : "/models/demo/souffle-chocolat-meshopt-0ad050af.glb";
    }
    function loadDish(name) {
      currentDish = name;
      canvas.dataset.loadingModel = name;
      callbacks.current.onAssetLoading?.(name);
      assetRequest?.abort();
      assetRequest = new AbortController();
      const request = assetRequest;
      const url = modelUrl(name);
      currentModelUrl = url;
      fetch(url, { signal: request.signal })
        .then((response) => {
          if (!response.ok)
            throw new Error(
              `Le modèle 3D ne peut pas être chargé (${response.status}).`,
            );
          return response.arrayBuffer();
        })
        .then((buffer) => {
          const decoding = decodeQueue
            .catch(() => {})
            .then(() => {
              if (disposed || request.signal.aborted)
                throw new DOMException("Cancelled model", "AbortError");
              return loader.parseAsync(buffer, "/media/");
            });
          decodeQueue = decoding;
          return decoding;
        })
        .then((gltf) => {
          if (disposed || request.signal.aborted || currentDish !== name) {
            disposeTree(gltf.scene);
            return;
          }
          if (activeDish) {
            dishRoot.remove(activeDish);
            disposeTree(activeDish);
          }
          activeDish = gltf.scene;
          activeModelUrl = url;
          // Keep the approved mobile art direction. On desktop, the platter,
          // plated desserts and bare burger each have a table-sized footprint.
          // The offline hulls retain their original 2.35-unit normalization;
          // applying this same factor to their matrix keeps hit/framing bounds
          // aligned with the visible mesh without rewriting any source asset.
          dishDisplayScale = dishPresentationScale(name, mobileViewport());
          foodMaterials = [];
          const bounds = new THREE.Box3().setFromObject(activeDish);
          const size = bounds.getSize(new THREE.Vector3());
          const center = bounds.getCenter(new THREE.Vector3());
          const scale =
            (FRAMING_HULL_SIZE * dishDisplayScale) /
            Math.max(size.x, size.z, size.y * 1.3, 0.001);
          activeDish.scale.multiplyScalar(scale);
          activeDish.position.set(
            -center.x * scale,
            -bounds.min.y * scale,
            -center.z * scale,
          );
          activeDish.updateMatrixWorld(true);
          // Store the normalized geometry once. Zoom changes the camera, never
          // this mesh scale or the shared default framing across dish choices.
          dishLocalBounds.setFromObject(activeDish);
          activeDish.traverse((object) => {
            if (!object.isMesh) return;
            object.castShadow = false;
            object.receiveShadow = true;
            for (const material of Array.isArray(object.material)
              ? object.material
              : [object.material]) {
              if (material.emissiveMap) material.emissiveIntensity = 0.35;
              if ("envMapIntensity" in material) material.envMapIntensity = 0.5;
              originalFoodOpacity.set(material, material.opacity);
              foodMaterials.push(material);
              material.transparent = false;
              material.depthWrite = true;
              material.forceSinglePass = true;
              for (const texture of Object.values(material)) {
                if (texture?.isTexture)
                  texture.anisotropy = Math.min(
                    8,
                    renderer.capabilities.getMaxAnisotropy(),
                  );
              }
            }
          });
          dishRoot.add(activeDish);
          canvas.dataset.model = name;
          delete canvas.dataset.loadingModel;
          delete canvas.dataset.modelError;
          callbacks.current.onAssetLoading?.(null);
          callbacks.current.onAssetError?.(null);
        })
        .catch((error) => {
          if (disposed || request.signal.aborted || error.name === "AbortError")
            return;
          delete canvas.dataset.loadingModel;
          callbacks.current.onAssetLoading?.(null);
          if (activeDish) {
            canvas.dataset.modelError = error.message || String(error);
            callbacks.current.onAssetError?.(error);
          } else fail(error);
        });
    }

    const particlesGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(60 * 3);
    for (let i = 0; i < 60; i++) {
      const seed = Math.sin(i * 12.9898 + 0.731) * 43758.5453;
      const random = seed - Math.floor(seed);
      particlePositions[i * 3] = (random - 0.5) * 7;
      particlePositions[i * 3 + 1] = (i % 13) * 0.18 + 0.15;
      particlePositions[i * 3 + 2] = Math.sin(i * 0.75) * 3 - 1;
    }
    particlesGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(particlePositions, 3),
    );
    const particles = new THREE.Points(
      particlesGeometry,
      new THREE.PointsMaterial({
        color: "#b3915c",
        size: 0.014,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      }),
    );
    scene.add(particles);

    let drawingSize;
    let viewportRevision = 0;
    function resize() {
      if (arExperience?.active) return;
      if (disposed) return;
      // Keep native Retina detail on phones. The pixel budget bounds large
      // displays without silently reducing every mobile canvas to DPR 1.
      const pixelBudget = 4_000_000;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (!width || !height) return;
      const pixelRatio = Math.min(
        window.devicePixelRatio || 1,
        3,
        Math.sqrt(pixelBudget / (width * height)),
      );
      // Browser bars emit resize while 100lvh stays unchanged. Rewriting the
      // same canvas dimensions would still clear its drawing buffer.
      if (
        drawingSize?.width === width &&
        drawingSize.height === height &&
        drawingSize.pixelRatio === pixelRatio &&
        canvas.width === Math.floor(width * pixelRatio) &&
        canvas.height === Math.floor(height * pixelRatio)
      )
        return;
      drawingSize = { width, height, pixelRatio };
      renderer.setDrawingBufferSize(width, height, pixelRatio);
      viewportRevision++;
      canvas.dataset.viewportResizes = String(viewportRevision);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }
    function applyTransform(object, position, rotation, scale, damping) {
      objectTarget.fromArray(position);
      object.position.lerp(objectTarget, damping);
      targetEuler.set(...rotation);
      targetQuaternion.setFromEuler(targetEuler);
      object.quaternion.slerp(targetQuaternion, damping);
      const nextScale = THREE.MathUtils.lerp(object.scale.x, scale, damping);
      object.scale.setScalar(nextScale);
      object.visible = nextScale > 0.003;
    }
    const initialState = stateRef.current || { section: "hero", progress: 0 };
    const initial = composition(initialState, mobileViewport());
    camera.position.fromArray(initial.camera);
    camera.up.set(0, 1, 0);
    lookAt.fromArray(initial.look);
    applyTransform(
      supportRoot,
      initial.support,
      initial.supportRotation,
      initial.supportScale,
      1,
    );
    applyTransform(
      phoneRoot,
      initial.phone,
      initial.phoneRotation,
      initial.phoneScale,
      1,
    );
    applyTransform(
      dishRoot,
      initial.dish,
      initial.dishRotation,
      initial.dishScale,
      1,
    );
    applyTransform(
      laptopRoot,
      initial.laptop,
      initial.laptopRotation,
      initial.laptopScale,
      1,
    );
    loadDish(
      dishes.some((d) => d.id === initialState.dish && d.model)
        ? initialState.dish
        : "homard",
    );
    restaurantWorld.update(initialState, 1, canvas);
    resize();

    const corner = new THREE.Vector3();
    const referenceCamera = new THREE.PerspectiveCamera(
      40,
      camera.aspect,
      0.05,
      200,
    );
    const calibrations = new Map();
    let calibrationKey = "";
    let framingReference;
    let projectionState;
    let projectionSettling = false;
    const fallbackFocus = DEFAULT_SCENE_FRAME;
    const smooth = (t) => {
      t = clamp(t, 0, 1);
      return t * t * (3 - 2 * t);
    };
    function projectedExtent(bounds, cam = camera) {
      let minX = Infinity,
        maxX = -Infinity,
        minY = Infinity,
        maxY = -Infinity;
      for (const x of [bounds.min.x, bounds.max.x])
        for (const y of [bounds.min.y, bounds.max.y])
          for (const z of [bounds.min.z, bounds.max.z]) {
            corner.set(x, y, z).project(cam);
            minX = Math.min(minX, corner.x);
            maxX = Math.max(maxX, corner.x);
            minY = Math.min(minY, corner.y);
            maxY = Math.max(maxY, corner.y);
          }
      return { minX, maxX, minY, maxY };
    }
    // Fit immutable reference poses, never the live shrinking/rotating geometry.
    // The normal 40-degree lens remains fixed; dolly distance handles fitting.
    function calibration(section, state, openingP = null) {
      const key = `${section}:${openingP}`;
      if (calibrations.has(key)) return calibrations.get(key);
      const pose = baseComposition(
        {
          ...state,
          section,
          progress: 0,
          openingProgress: openingP,
          drag: 0.5,
          dishPitch: 0,
          flip: false,
          supportAngle: 0,
        },
        mobileViewport(),
      );
      let focus = state.sceneFrames?.[section] || fallbackFocus;
      if (openingP != null) {
        const a =
          state.sceneFrames?.[openingP < 0.56 ? "hero" : "ai"] || fallbackFocus;
        const b =
          state.sceneFrames?.[openingP < 0.56 ? "ai" : "wearable"] ||
          fallbackFocus;
        const t = smooth(
          (openingP - (openingP < 0.56 ? 0 : 0.56)) /
            (openingP < 0.56 ? 0.56 : 0.44),
        );
        focus = Object.fromEntries(
          Object.keys(a).map((key) => [key, a[key] + (b[key] - a[key]) * t]),
        );
      }
      const bounds = new THREE.Box3();
      const roots = [
        [dishRoot, "dish"],
        [supportRoot, "support"],
        [phoneRoot, "phone"],
        [laptopRoot, "laptop"],
      ];
      const snapshots = roots.map(([root]) => ({
        position: root.position.clone(),
        quaternion: root.quaternion.clone(),
        scale: root.scale.clone(),
        visible: root.visible,
      }));
      for (const [root, name] of roots)
        applyTransform(
          root,
          pose[name],
          pose[`${name}Rotation`],
          pose[`${name}Scale`],
          1,
        );
      scene.updateMatrixWorld(true);
      for (const [root, name] of roots)
        if (root.visible && (name !== "support" || supportAssets.active)) {
          if (name === "laptop" && laptopAsset.framingBounds)
            bounds.union(
              laptopAsset.framingBounds.clone().applyMatrix4(root.matrixWorld),
            );
          else if (name === "dish" && ["features", "grip"].includes(section)) {
            // A shared reference keeps table scale and lens distance stable
            // across dish selection; fitting each live model would enlarge
            // smaller portions again and make the table visibly breathe.
            const radius = (mobileViewport() ? 1.3 : 1.05) * pose.dishScale;
            bounds.union(
              new THREE.Box3(
                new THREE.Vector3(
                  pose.dish[0] - radius,
                  pose.dish[1] - radius * 0.1,
                  pose.dish[2] - radius,
                ),
                new THREE.Vector3(
                  pose.dish[0] + radius,
                  pose.dish[1] + 1.05 * pose.dishScale + radius * 0.1,
                  pose.dish[2] + radius,
                ),
              ),
            );
          } else
            bounds.expandByObject(
              name === "support" ? supportAssets.active : root,
            );
        }
      roots.forEach(([root], i) => {
        root.position.copy(snapshots[i].position);
        root.quaternion.copy(snapshots[i].quaternion);
        root.scale.copy(snapshots[i].scale);
        root.visible = snapshots[i].visible;
      });
      scene.updateMatrixWorld(true);
      const center = bounds.isEmpty()
        ? new THREE.Vector3().fromArray(pose.look)
        : bounds.getCenter(new THREE.Vector3());
      const direction = new THREE.Vector3()
        .fromArray(pose.camera)
        .sub(new THREE.Vector3().fromArray(pose.look))
        .normalize();
      let distance = new THREE.Vector3()
        .fromArray(pose.camera)
        .distanceTo(new THREE.Vector3().fromArray(pose.look));
      if (!bounds.isEmpty()) {
        referenceCamera.aspect = camera.aspect;
        referenceCamera.zoom = 1;
        referenceCamera.clearViewOffset();
        const width = focus.width * (openingP != null ? 0.87 : 0.94);
        const height = focus.height * (openingP != null ? 0.86 : 0.92);
        let lo = Math.max(
            0.3,
            bounds.getSize(new THREE.Vector3()).length() * 0.45,
          ),
          hi = 80;
        for (let i = 0; i < 24; i++) {
          const d = (lo + hi) / 2;
          referenceCamera.position.copy(center).addScaledVector(direction, d);
          referenceCamera.lookAt(center);
          referenceCamera.updateMatrixWorld(true);
          const e = projectedExtent(bounds, referenceCamera);
          if ((e.maxX - e.minX) / 2 > width || (e.maxY - e.minY) / 2 > height)
            lo = d;
          else hi = d;
        }
        distance = hi;
        referenceCamera.position
          .copy(center)
          .addScaledVector(direction, distance);
        referenceCamera.lookAt(center);
        referenceCamera.updateMatrixWorld(true);
      }
      const e = bounds.isEmpty()
        ? { minX: 0, maxX: 0, minY: 0, maxY: 0 }
        : projectedExtent(bounds, referenceCamera);
      const result = {
        camera: center.clone().addScaledVector(direction, distance).toArray(),
        look: center.toArray(),
        distance,
        shiftX: (e.maxX + e.minX) / 4,
        shiftY: (e.maxY + e.minY) / 4,
        dishOpacity: 1,
      };
      calibrations.set(key, result);
      return result;
    }
    function cameraComposition(state) {
      const key = `${canvas.dataset.model}|${canvas.dataset.support}|${canvas.dataset.supportReady}|${canvas.dataset.phoneReady}|${canvas.dataset.laptopReady}|${canvas.width}|${canvas.height}|${JSON.stringify(state.sceneFrames)}`;
      if (key !== calibrationKey) {
        calibrationKey = key;
        calibrations.clear();
      }
      const t = state.transition;
      if (t)
        return interpolatePose(
          calibration(t.from, state, t.fromOpening ? 1 : null),
          calibration(t.to, state),
          smooth(t.progress),
        );
      if (state.openingProgress != null) {
        const p = state.openingProgress,
          anchors = [0, 0.12, 0.28, 0.42, 0.56, 0.72, 0.86, 1];
        const sectionAt = (q) =>
          q < 0.56 ? "hero" : q < 1 ? "ai" : "wearable";
        return interpolatePoseTrack(
          anchors,
          anchors.map(q => calibration(sectionAt(q), state, q)),
          p,
        );
      }
      return calibration(state.section, state);
    }
    function frameSubjects(state, damping) {
      const focus = state.sceneFrame;
      const viewportWidth = canvas.clientWidth,
        viewportHeight = canvas.clientHeight;
      const desired = cameraComposition(state);
      const zoomFor = (section) =>
        section === "grip" ? clamp(state.dishZoom || 1, 0.6, 4) : 1;
      const zoom = state.transition
        ? THREE.MathUtils.lerp(
            zoomFor(state.transition.from),
            zoomFor(state.transition.to),
            smooth(state.transition.progress),
          )
        : zoomFor(state.section);
      const targetFocus = focus || fallbackFocus;
      let zoomLook = desired.look;
      let minimumDistance = camera.near * 2;
      if (zoom > 1 && activeDish) {
        dishRoot.updateWorldMatrix(true, false);
        dishLocalBounds
          .getCenter(dishZoomCenter)
          .applyMatrix4(dishRoot.matrixWorld);
        // The shared resting frame includes air above low dishes. Approach the
        // actual food center progressively, without reframing its live size.
        const aim = smooth(Math.min(1, zoom - 1));
        zoomLook = desired.look.map((v, i) =>
          THREE.MathUtils.lerp(v, dishZoomCenter.getComponent(i), aim),
        );
        dishZoomDirection
          .fromArray(desired.camera)
          .sub(new THREE.Vector3().fromArray(desired.look))
          .normalize();
        for (const x of [dishLocalBounds.min.x, dishLocalBounds.max.x])
          for (const y of [dishLocalBounds.min.y, dishLocalBounds.max.y])
            for (const z of [dishLocalBounds.min.z, dishLocalBounds.max.z]) {
              dishZoomCorner
                .set(x, y, z)
                .applyMatrix4(dishRoot.matrixWorld)
                .sub(new THREE.Vector3().fromArray(zoomLook));
              minimumDistance = Math.max(
                minimumDistance,
                dishZoomCorner.dot(dishZoomDirection) + camera.near * 2,
              );
            }
      }
      const zoomCamera = desired.camera.map(
        (v, i) => v + zoomLook[i] - desired.look[i],
      );
      const dolly = cameraDollyPose(
        zoomCamera,
        zoomLook,
        zoom,
        minimumDistance,
      );
      const targetProjection = {
        ...desired,
        ...dolly,
        dolly: zoom,
        baseCamera: desired.camera,
        baseLook: desired.look,
        focusX: targetFocus.x,
        focusY: targetFocus.y,
        focusWidth: targetFocus.width,
        focusHeight: targetFocus.height,
      };
      projectionState = projectionState
        ? interpolatePose(projectionState, targetProjection, damping)
        : targetProjection;
      projectionSettling = Object.entries(targetProjection).some(
        ([key, value]) =>
          Array.isArray(value)
            ? value.some(
                (v, i) => Math.abs(v - projectionState[key][i]) > 0.0002,
              )
            : typeof value === "number" &&
              Math.abs(value - projectionState[key]) > 0.0002,
      );
      const renderFocus = {
        x: projectionState.focusX,
        y: projectionState.focusY,
        width: projectionState.focusWidth,
        height: projectionState.focusHeight,
      };
      framingReference = { ...projectionState, focus: renderFocus };
      // The camera and focus follow the same time damping as the objects. Fast
      // native flicks can change the target without snapping the rendered scene.
      camera.position.fromArray(projectionState.camera);
      camera.lookAt(new THREE.Vector3().fromArray(projectionState.look));
      camera.zoom = 1;
      camera.setViewOffset(
        viewportWidth,
        viewportHeight,
        (0.5 - renderFocus.x + projectionState.shiftX) * viewportWidth,
        (0.5 - renderFocus.y - projectionState.shiftY) * viewportHeight,
        viewportWidth,
        viewportHeight,
      );
      camera.updateMatrixWorld(true);
      const viewport = { width: viewportWidth, height: viewportHeight };
      const rectangles = [];
      for (const [name, root] of [
        ["dish", dishRoot],
        ["support", supportRoot],
        ["phone", phoneRoot],
        ["laptop", laptopRoot],
      ]) {
        if (!root.visible || (name === "support" && !supportAssets.active)) {
          delete canvas.dataset[`${name}Bounds`];
          continue;
        }
        root.updateWorldMatrix(true, false);
        const hull = name === "dish" && framingHulls[activeModelUrl]?.vertices;
        const bounds = hull
          ? projectHullBounds(
              hull,
              hullWorldMatrix
                .copy(root.matrixWorld)
                .scale(hullScale.setScalar(dishDisplayScale)),
              camera,
              viewport,
            )
          : projectObjectBounds(
              name === "support" ? supportAssets.active : root,
              camera,
              viewport,
            );
        if (bounds) {
          rectangles.push(bounds);
          canvas.dataset[`${name}Bounds`] = JSON.stringify(bounds);
        } else delete canvas.dataset[`${name}Bounds`];
      }
      const subjectBounds = unionScreenBounds(rectangles);
      if (subjectBounds)
        canvas.dataset.subjectBounds = JSON.stringify(subjectBounds);
      else delete canvas.dataset.subjectBounds;
      if (focus)
        canvas.dataset.focusBounds = JSON.stringify({
          x: (renderFocus.x - renderFocus.width / 2) * viewportWidth,
          y: (renderFocus.y - renderFocus.height / 2) * viewportHeight,
          width: renderFocus.width * viewportWidth,
          height: renderFocus.height * viewportHeight,
        });
      else delete canvas.dataset.focusBounds;
      canvas.dataset.cameraZoom = String(camera.zoom);
      canvas.dataset.cameraFov = String(camera.fov);
      canvas.dataset.cameraDolly = String(projectionState.dolly);
      canvas.dataset.cameraDistance = String(
        camera.position.distanceTo(
          new THREE.Vector3().fromArray(projectionState.look),
        ),
      );
      canvas.dataset.cameraBaselineDistance = String(
        projectionState.baselineDistance,
      );
      canvas.dataset.dishScale = dishRoot.scale.toArray().join(",");
      canvas.dataset.dishMeshScale =
        activeDish?.scale.toArray().join(",") || "";
      if (activeDish && nativeTable) {
        const size = dishLocalBounds.getSize(dishZoomCorner);
        canvas.dataset.dishTableRatio = String(
          (Math.max(size.x, size.z) * dishRoot.scale.x) /
            Math.min(
              nativeTable.metadata.topWidth,
              nativeTable.metadata.topDepth,
            ),
        );
      }
      canvas.dataset.fittedCameraPosition = camera.position.toArray().join(",");
      canvas.dataset.fittedLook = projectionState.look.join(",");
      canvas.dataset.cameraViewOffset = JSON.stringify(camera.view);
      canvas.dataset.transition = state.transition
        ? `${state.transition.from}:${state.transition.to}`
        : "";
      canvas.dataset.transitionProgress = String(
        state.transition?.progress ?? "",
      );
      canvas.dataset.supportAngle = String(state.supportAngle || 0);
      canvas.dataset.phoneRate = String(phoneVideo.playbackRate);
    }
    let foregroundLayerKey = "";
    camera.layers.enable(1);
    renderer.info.autoReset = false;
    let renderSignature = "";
    let previousShadowSignature = "";
    let lastSceneChange = 0;
    let wasOccluded = false;
    function draw(now) {
      if (arExperience?.active) return;
      frame = 0;
      if (disposed || failed || document.hidden) return;
      const dt = lastTime ? Math.min((now - lastTime) / 1000, 0.5) : 1 / 60;
      lastTime = now;
      const state = stateRef.current || initialState;
      // The pricing section is fully opaque. Do not render its hidden room,
      // models or screen video while the native document is being scrolled.
      if (ready && state.sceneOccluded) {
        wasOccluded = true;
        lastTime = 0;
        if (!phoneVideo.paused) phoneVideo.pause();
        canvas.dataset.suspended = "true";
        canvas.dataset.section = state.section;
        canvas.dataset.progress = state.progress.toFixed(4);
        canvas.dataset.settled = "true";
        frame = requestAnimationFrame(draw);
        return;
      }
      const resume = wasOccluded;
      wasOccluded = false;
      canvas.dataset.suspended = "false";
      if (resume) {
        renderSignature = "";
        previousShadowSignature = "";
      }
      // Resume at the current pose while the first pixel is revealed, rather
      // than replaying a stale pose from before the long pricing section.
      const damping =
        resume || state.reducedMotion ? 1 : 1 - Math.exp(-dt * 10);
      const pose = composition(state, mobileViewport());
      const pointer = state.pointer || { x: 0, y: 0 };
      const cameraInteractive = false;
      cameraTarget.fromArray(pose.camera);
      camera.position.lerp(cameraTarget, damping);
      camera.up.set(0, 1, 0);
      objectTarget.fromArray(pose.look);
      lookAt.lerp(objectTarget, damping);
      camera.lookAt(lookAt);
      canvas.dataset.cameraPosition = camera.position
        .toArray()
        .map((n) => n.toFixed(3))
        .join(",");
      const roomSettling = restaurantWorld.update(state, damping, canvas);
      applyTransform(
        supportRoot,
        pose.support,
        pose.supportRotation,
        pose.supportScale,
        damping,
      );
      applyTransform(
        phoneRoot,
        pose.phone,
        pose.phoneRotation,
        pose.phoneScale,
        damping,
      );
      updatePhoneVideo(
        phoneRoot.visible &&
          state.section !== "hero" &&
          pose.phoneScale > 0.03 &&
          !state.reducedMotion &&
          !state.modalOpen &&
          !state.menuOpen,
        state.section === "wearable" || state.transition?.from === "wearable"
          ? state.phoneDemo || "maison-elyse"
          : "maison-elyse",
      );
      applyTransform(
        dishRoot,
        pose.dish,
        pose.dishRotation,
        pose.dishScale,
        damping,
      );
      applyTransform(
        laptopRoot,
        pose.laptop,
        pose.laptopRotation,
        pose.laptopScale,
        damping,
      );
      laptopAsset.update(
        state.chapterProgress?.sustainability ??
          (state.section === "sustainability"
            ? state.progress
            : state.transition?.to === "sustainability"
              ? 0
              : state.transition?.from === "sustainability"
                ? 1
                : 0),
        laptopRoot.visible ? damping : 1,
        state.reducedMotion,
      );
      for (const material of foodMaterials) {
        material.opacity =
          (originalFoodOpacity.get(material) ?? 1) * pose.dishOpacity;
        const fading = pose.dishOpacity < 0.999;
        if (material.transparent !== fading) {
          material.transparent = fading;
          material.needsUpdate = true;
        }
        material.depthWrite = !fading;
      }
      dishRoot.visible &&= pose.dishOpacity > 0.003;
      contactShadow.visible = dishRoot.visible;
      contactShadow.position.set(
        dishRoot.position.x,
        -0.012,
        dishRoot.position.z,
      );
      contactShadow.scale.setScalar(Math.max(0.001, dishRoot.scale.x));
      canvas.dataset.dishOpacity = pose.dishOpacity.toFixed(4);
      canvas.dataset.openingProgress =
        state.openingProgress == null ? "" : String(state.openingProgress);
      canvas.dataset.supportPosition = supportRoot.position.toArray().join(",");
      canvas.dataset.phonePosition = phoneRoot.position.toArray().join(",");
      woodMaterial.opacity = THREE.MathUtils.lerp(
        woodMaterial.opacity,
        pose.table,
        damping,
      );
      table.visible = woodMaterial.opacity > 0.003;
      decor.visible = woodMaterial.opacity > 0.08;
      decor.scale.setScalar(clamp(woodMaterial.opacity, 0.001, 1));
      candleLight.intensity = 0.7 * woodMaterial.opacity;
      particles.visible = pose.particles;
      if (particles.visible)
        particles.rotation.y = state.reducedMotion ? 0 : now * 0.000025;
      const collection = state.collection || "acrylique";
      if (collection !== lastCollection) {
        supportAssets.select(collection);
        lastCollection = collection;
      }
      const dish = dishes.some((d) => d.id === state.dish && d.model)
        ? state.dish
        : "homard";
      const retryModel = state.retryModel ?? 0;
      if (
        dish !== currentDish ||
        currentModelUrl !== modelUrl(dish) ||
        retryModel !== lastRetryModel
      ) {
        lastRetryModel = retryModel;
        loadDish(dish);
      }
      // A genuine responsive-width change can keep the same GLB URL. Resize
      // its presentation once without another download; toolbar height changes
      // never enter this path, and camera zoom never changes this scale.
      if (activeDish) {
        const scale = dishPresentationScale(
          canvas.dataset.model,
          mobileViewport(),
        );
        if (scale !== dishDisplayScale) {
          const ratio = scale / dishDisplayScale;
          activeDish.scale.multiplyScalar(ratio);
          activeDish.position.multiplyScalar(ratio);
          dishLocalBounds.min.multiplyScalar(ratio);
          dishLocalBounds.max.multiplyScalar(ratio);
          dishDisplayScale = scale;
          activeDish.updateMatrixWorld(true);
        }
      }
      // A settled still scene does not need another GPU frame. Keep the small
      // state loop alive so scroll, input and asynchronous media can wake it.
      updateTableClearance([
        dishRoot,
        supportRoot.visible ? supportAssets.active : null,
        phoneRoot,
        laptopRoot,
      ]);
      const geometrySignature = [
        state.section,
        state.progress,
        state.scrollDistance,
        viewportRevision,
        state.flip,
        state.collection,
        state.supportAngle,
        state.phoneDemo,
        JSON.stringify(state.sceneFrame),
        state.drag,
        state.dishZoom,
        state.dishPitch,
        state.transition?.progress,
        state.dish,
        state.retryModel,
        state.modalOpen,
        state.menuOpen,
        state.reducedMotion,
        cameraInteractive ? pointer.x : 0,
        cameraInteractive ? pointer.y : 0,
        canvas.width,
        canvas.height,
        canvas.dataset.model,
        canvas.dataset.supportReady,
        canvas.dataset.phoneReady,
        canvas.dataset.laptopReady,
        posterReady,
        videoReady,
        stoneReady,
        canvas.dataset.restaurantReady,
        nativeTable?.accessories.placeSetting.visible,
      ].join("|");
      // A moving view does not move the key light or cast geometry. Rebuilding
      // the shadow map on every page pixel needlessly stalls mobile scrolling.
      const shadowSignature = [
        ...[supportRoot, phoneRoot, laptopRoot].flatMap((root) =>
          root.visible
            ? [
                true,
                ...root.position.toArray().map((v) => v.toFixed(4)),
                ...root.quaternion.toArray().map((v) => v.toFixed(4)),
                root.scale.x.toFixed(4),
              ]
            : [false],
        ),
        laptopRoot.visible ? canvas.dataset.laptopAngle : "",
        canvas.dataset.support,
        canvas.dataset.supportReady,
        canvas.dataset.phoneReady,
        canvas.dataset.laptopReady,
        canvas.dataset.restaurantReady,
      ].join("|");
      const shadowInvalidated = shadowSignature !== previousShadowSignature;
      previousShadowSignature = shadowSignature;
      const signature = `${geometrySignature}|${phoneRoot.visible ? phoneFrame : 0}`;
      if (signature !== renderSignature) {
        renderSignature = signature;
        lastSceneChange = now;
      }
      const settled = (object, position, rotation, scale) => {
        objectTarget.fromArray(position);
        targetEuler.set(...rotation);
        targetQuaternion.setFromEuler(targetEuler);
        return (
          object.position.distanceToSquared(objectTarget) < 1e-7 &&
          Math.abs(1 - Math.abs(object.quaternion.dot(targetQuaternion))) <
            1e-7 &&
          Math.abs(object.scale.x - scale) < 0.0002
        );
      };
      const settling =
        camera.position.distanceToSquared(cameraTarget) > 1e-7 ||
        lookAt.distanceToSquared(objectTarget.fromArray(pose.look)) > 1e-7 ||
        !settled(
          supportRoot,
          pose.support,
          pose.supportRotation,
          pose.supportScale,
        ) ||
        !settled(phoneRoot, pose.phone, pose.phoneRotation, pose.phoneScale) ||
        !settled(dishRoot, pose.dish, pose.dishRotation, pose.dishScale) ||
        !settled(
          laptopRoot,
          pose.laptop,
          pose.laptopRotation,
          pose.laptopScale,
        ) ||
        (laptopRoot.visible && !laptopAsset.settled) ||
        Math.abs(woodMaterial.opacity - pose.table) > 0.0002 ||
        roomSettling ||
        projectionSettling;
      const invalidated = now === lastSceneChange;
      canvas.dataset.section = state.section;
      canvas.dataset.progress = state.progress.toFixed(4);
      canvas.dataset.supportFlipped = String(Boolean(state.flip));
      canvas.dataset.settled = String(!settling);
      const animated =
        (!phoneVideo.requestVideoFrameCallback &&
          !phoneVideo.paused &&
          phoneRoot.visible) ||
        (particles.visible &&
          !state.reducedMotion &&
          !state.modalOpen &&
          !state.menuOpen);
      try {
        if (!ready || settling || animated || invalidated) {
          // A new screen-video frame changes its pixels, not any geometry.
          // Preserve the cached shadows until a casting object or asset changes.
          renderer.shadowMap.needsUpdate = !ready || shadowInvalidated;
          const authoredCamera = camera.position.clone();
          frameSubjects(state, damping);
          canvas.dataset.settled = String(!settling && !projectionSettling);
          const layerKey = [
            canvas.dataset.model,
            canvas.dataset.supportReady,
            canvas.dataset.phoneReady,
            canvas.dataset.laptopReady,
            canvas.dataset.restaurantReady,
          ].join("|");
          if (layerKey !== foregroundLayerKey) {
            foregroundLayerKey = layerKey;
            [dishRoot, supportRoot, phoneRoot, laptopRoot].forEach((root) =>
              root.traverse((o) => o.layers.set(1)),
            );
            scene.traverse((o) => {
              if (o.isLight) {
                o.layers.enable(1);
                o.layers.enable(2);
                o.shadow?.camera.layers.enable(1);
                o.shadow?.camera.layers.enable(2);
              }
            });
          }
          renderer.info.reset();
          const startRender = performance.now();
          canvas.dataset.shadowUpdated = String(renderer.shadowMap.needsUpdate);
          const clipped =
            state.sceneFrame &&
            (state.section === "grip" ||
              state.transition?.from === "grip" ||
              state.transition?.to === "grip");
          // One physical camera sees the room, table, props and products.
          // The foreground-only pass exists solely to keep close-ups below
          // the heading. Preserve the depth buffer between both passes.
          camera.layers.set(0);
          camera.layers.enable(2);
          renderer.render(scene, camera);
          const background = scene.background;
          scene.background = null;
          renderer.autoClear = false;
          const sharedPosition = camera.position.toArray().join(",");
          canvas.dataset.tableCameraPosition = sharedPosition;
          canvas.dataset.roomCameraPosition = sharedPosition;
          canvas.dataset.cameraSceneDolly = "shared-room-table-and-products";
          if (clipped) {
            const f = framingReference.focus,
              w = canvas.clientWidth,
              h = canvas.clientHeight;
            renderer.setScissor(
              (f.x - f.width / 2) * w,
              (1 - f.y - f.height / 2) * h,
              f.width * w,
              f.height * h,
            );
            renderer.setScissorTest(true);
          }
          camera.layers.set(1);
          renderer.render(scene, camera);
          renderer.setScissorTest(false);
          renderer.autoClear = true;
          scene.background = background;
          camera.layers.set(0);
          camera.layers.enable(1);
          canvas.dataset.renderCPUms = String(performance.now() - startRender);
          canvas.dataset.zoomClipped = String(Boolean(clipped));
          camera.position.copy(authoredCamera);
          canvas.dataset.drawCalls = String(renderer.info.render.calls);
          canvas.dataset.triangles = String(renderer.info.render.triangles);
          canvas.dataset.frames = String(renderer.info.render.frame);
          canvas.dataset.renderedModel = canvas.dataset.model || "";
        }
        if (
          !ready &&
          activeDish &&
          canvas.dataset.framingReady === "true" &&
          canvas.dataset.supportReady === "true" &&
          canvas.dataset.phoneReady === "true" &&
          stoneReady &&
          canvas.dataset.restaurantReady === "true" &&
          (!phoneRoot.visible || posterReady || videoReady)
        ) {
          ready = true;
          canvas.dataset.ready = "true";
          callbacks.current.onReady?.();
        }
      } catch (error) {
        fail(error);
        return;
      }
      frame = requestAnimationFrame(draw);
    }
    function visibilityChanged() {
      if (arExperience?.active) return;
      cancelAnimationFrame(frame);
      frame = 0;
      lastTime = 0;
      if (document.hidden) phoneVideo.pause();
      if (!document.hidden && !disposed && !failed)
        frame = requestAnimationFrame(draw);
    }
    function contextLost(event) {
      event.preventDefault();
      cancelAnimationFrame(frame);
      frame = 0;
      fail(new Error("Le contexte graphique 3D a été interrompu."));
    }
    arExperience = createARExperience({
      renderer,
      environment: environmentTarget.texture,
      getModel: () => activeDish,
      getPlateWidthMeters: () =>
        dishes.find((d) => d.id === currentDish)?.arWidthMeters,
      overlay: document.getElementById("ar-overlay"),
      onStatus: (status) => {
        if (!disposed) callbacks.current.onARStatus?.(status);
      },
      onSuspend: () => {
        cancelAnimationFrame(frame);
        frame = 0;
        phoneVideo.pause();
      },
      onResume: () => {
        if (disposed || failed) return;
        lastTime = 0;
        renderSignature = "";
        drawingSize = null;
        resize();
        if (!document.hidden) frame = requestAnimationFrame(draw);
      },
    });
    Object.assign(stateRef.current, {
      startAR: arExperience.start,
      endAR: arExperience.end,
      scaleAR: arExperience.setScale,
      rotateAR: arExperience.rotate,
      repositionAR: arExperience.reposition,
    });
    canvas.addEventListener("webglcontextlost", contextLost);
    const sizeObserver = new ResizeObserver(resize);
    sizeObserver.observe(canvas);
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", visibilityChanged);
    if (!document.hidden) frame = requestAnimationFrame(draw);

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      assetRequest?.abort();
      hullRequest.abort();
      canvas.removeEventListener("webglcontextlost", contextLost);
      sizeObserver.disconnect();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", visibilityChanged);
      if (sceneState.startAR === arExperience.start) {
        for (const key of [
          "startAR",
          "endAR",
          "scaleAR",
          "rotateAR",
          "repositionAR",
        ])
          delete sceneState[key];
      }
      // AR clones share the source geometry and materials. End the native
      // session before releasing those resources or its reused renderer.
      arExperience
        .dispose()
        .catch(() => {})
        .finally(() => {
          decodeQueue.catch(() => {}).finally(() => foodDraco.dispose());
          supportAssets.dispose();
          phoneAsset.dispose();
          laptopAsset.dispose();
          nativeTable?.dispose();
          restaurantWorld.dispose();
          phoneScreenMaterial.dispose();
          phoneVideo.pause();
          if (videoFrameCallback !== undefined)
            phoneVideo.cancelVideoFrameCallback?.(videoFrameCallback);
          phoneVideo.onerror = null;
          phoneVideo.removeAttribute("src");
          phoneVideo.load();
          disposeTree(scene);
          ownedTextures.forEach((texture) => texture.dispose());
          environmentTarget?.dispose();
          environmentScene?.dispose();
          keyLight.shadow.map?.dispose();
          renderer.renderLists.dispose();
          renderer.dispose();
          renderer.forceContextLoss();
          canvas.remove();
        });
    };
  }, [stateRef]);

  return (
    <div
      ref={hostRef}
      className="scene-layer"
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
    />
  );
}
