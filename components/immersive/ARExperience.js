import * as THREE from "three";

const PLATE_WIDTH_METERS = 0.28;
const INTERACTIVE_OVERLAY =
  'button, a[href], input, select, textarea, [role="button"], [role="slider"], [data-ar-control]';

/**
 * Reuses Scene's renderer and decoded, static dish. Keep the source model alive
 * while active, and await dispose() before disposing that renderer or model.
 * start() must be invoked directly from the user's button event, without an
 * awaited support check. Native iOS Quick Look belongs to the caller.
 */
export function createARExperience({
  renderer,
  environment,
  getModel,
  getPlateWidthMeters,
  overlay,
  onStatus,
  onSuspend,
  onResume,
}) {
  let current = null;
  let disposed = false;

  function notify(context, status, extra = {}) {
    context.status = status;
    // UI callbacks must not interrupt native session setup or teardown.
    try {
      onStatus?.(status, {
        canPlace: Boolean(context.hasHit && !context.placed),
        scale: context.scale,
        rotation: context.yaw,
        plateWidthMeters: context.plateWidthMeters * context.scale,
        domOverlay: Boolean(context.session?.domOverlayState),
        ...extra,
      });
    } catch {
      // The owner can recover its UI without leaking a native session.
    }
  }

  function snapshotRenderer() {
    return {
      xrEnabled: renderer.xr.enabled,
      cameraAutoUpdate: renderer.xr.cameraAutoUpdate,
      clearColor: renderer.getClearColor(new THREE.Color()).clone(),
      clearAlpha: renderer.getClearAlpha(),
      autoClear: renderer.autoClear,
      autoClearColor: renderer.autoClearColor,
      autoClearDepth: renderer.autoClearDepth,
      autoClearStencil: renderer.autoClearStencil,
      shadowEnabled: renderer.shadowMap.enabled,
      shadowAutoUpdate: renderer.shadowMap.autoUpdate,
      shadowNeedsUpdate: renderer.shadowMap.needsUpdate,
      size: renderer.getSize(new THREE.Vector2()).clone(),
      pixelRatio: renderer.getPixelRatio(),
      viewport: renderer.getViewport(new THREE.Vector4()).clone(),
      scissor: renderer.getScissor(new THREE.Vector4()).clone(),
      scissorTest: renderer.getScissorTest(),
      renderTarget: renderer.getRenderTarget(),
    };
  }

  function restoreRenderer(saved) {
    renderer.setAnimationLoop(null);
    renderer.xr.enabled = saved.xrEnabled;
    renderer.xr.cameraAutoUpdate = saved.cameraAutoUpdate;
    // Scene uses the manager's unmodified local-floor default outside AR.
    renderer.xr.setReferenceSpaceType("local-floor");
    renderer.resetState();
    renderer.setPixelRatio(saved.pixelRatio);
    renderer.setSize(saved.size.x, saved.size.y, false);
    renderer.setRenderTarget(saved.renderTarget);
    renderer.setViewport(saved.viewport);
    renderer.setScissor(saved.scissor);
    renderer.setScissorTest(saved.scissorTest);
    renderer.setClearColor(saved.clearColor, saved.clearAlpha);
    renderer.autoClear = saved.autoClear;
    renderer.autoClearColor = saved.autoClearColor;
    renderer.autoClearDepth = saved.autoClearDepth;
    renderer.autoClearStencil = saved.autoClearStencil;
    renderer.shadowMap.enabled = saved.shadowEnabled;
    renderer.shadowMap.autoUpdate = saved.shadowAutoUpdate;
    renderer.shadowMap.needsUpdate = saved.shadowNeedsUpdate;
  }

  function createContext(source) {
    const providedWidth = getPlateWidthMeters?.();
    const plateWidthMeters =
      Number.isFinite(providedWidth) &&
      providedWidth >= 0.05 &&
      providedWidth <= 1
        ? providedWidth
        : PLATE_WIDTH_METERS;
    const scene = new THREE.Scene();
    scene.environment = environment?.texture ?? environment ?? null;
    scene.environmentIntensity = 0.6;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x777777, 2));
    const light = new THREE.DirectionalLight(0xffffff, 2.5);
    light.position.set(-2, 4, 3);
    scene.add(light);

    // A separate camera keeps the normal scene's projection/pose untouched.
    const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 30);
    const anchor = new THREE.Group();
    anchor.matrixAutoUpdate = false;
    anchor.visible = false;
    const scaledModel = new THREE.Group();
    const normalizedModel = new THREE.Group();
    const clone = source.clone(true); // geometry, materials and textures shared
    clone.visible = true;
    // Scene's foreground scissor uses layer 1; this independent AR camera and
    // its lights use layer 0. Reset only clone metadata, keeping source layers
    // and the shared geometry/material/texture resources untouched.
    clone.traverse((object) => object.layers.set(0));
    normalizedModel.add(clone);
    const bounds = new THREE.Box3().setFromObject(normalizedModel);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const width = Math.max(size.x, size.z);
    if (bounds.isEmpty() || !Number.isFinite(width) || width <= 0.000001) {
      throw new Error(
        "Le modèle chargé ne possède pas de dimensions AR valides.",
      );
    }
    normalizedModel.position.set(-center.x, -bounds.min.y, -center.z);
    const baseScale = plateWidthMeters / width;
    scaledModel.scale.setScalar(baseScale);
    scaledModel.add(normalizedModel);
    anchor.add(scaledModel);
    scene.add(anchor);

    const reticle = new THREE.Mesh(
      new THREE.RingGeometry(0.085, 0.11, 48).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({
        color: 0xdf8b32,
        opacity: 0.9,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    reticle.renderOrder = 10;
    scene.add(reticle);

    return {
      scene,
      camera,
      anchor,
      scaledModel,
      reticle,
      baseScale,
      plateWidthMeters,
      saved: snapshotRenderer(),
      session: null,
      hitTestSource: null,
      controllers: [],
      scale: 1,
      yaw: 0,
      status: "requesting",
      placed: false,
      hasHit: false,
      initializing: true,
      cancelled: false,
      cleaned: false,
      suspended: false,
      rendererTouched: false,
      sessionEnded: false,
    };
  }

  function cleanup(context) {
    // Ending a native session can cancel its hit-test subscription first.
    try {
      context.hitTestSource?.cancel();
    } catch {
      // InvalidStateError means that subscription is already inactive.
    }
    context.hitTestSource = null;
    if (context.cleaned) return;
    context.cleaned = true;
    context.session?.removeEventListener("end", context.onSessionEnd);
    renderer.xr.removeEventListener("sessionend", context.onRendererEnd);
    overlay?.removeEventListener("beforexrselect", context.onBeforeSelect);
    for (const { controller, parent } of context.controllers) {
      controller.removeEventListener("select", context.onSelect);
      controller.removeFromParent();
      parent?.add(controller);
    }
    context.controllers.length = 0;
    context.scene.clear();
    // These are the only geometry/material resources owned by this helper.
    context.reticle.geometry.dispose();
    context.reticle.material.dispose();
    if (context.rendererTouched) restoreRenderer(context.saved);
    if (current === context) current = null;
    notify(context, "idle", { canPlace: false, error: context.error });
    if (context.suspended) {
      context.suspended = false;
      try {
        onResume?.();
      } catch {
        // Renderer/native resources have already been restored.
      }
    }
  }

  function assertCurrent(context) {
    if (
      disposed ||
      context.cancelled ||
      context.sessionEnded ||
      current !== context
    ) {
      throw new DOMException("Session AR interrompue.", "AbortError");
    }
  }

  function updateHit(context, frame) {
    const previous = context.hasHit;
    context.hasHit = false;
    const referenceSpace = renderer.xr.getReferenceSpace();
    if (frame && referenceSpace && context.hitTestSource) {
      for (const hit of frame.getHitTestResults(context.hitTestSource)) {
        const pose = hit.getPose(referenceSpace);
        if (!pose) continue;
        context.reticle.matrix.fromArray(pose.transform.matrix);
        // Hit-test poses have their Y axis along the surface normal. Ignore
        // walls/ceilings: this experience places a plate on a horizontal table.
        if (context.reticle.matrix.elements[5] < 0.75) continue;
        context.hasHit = true;
        break;
      }
    }
    context.reticle.visible = context.hasHit;
    if (previous !== context.hasHit) notify(context, "scanning");
  }

  function place(context) {
    if (
      context !== current ||
      context.cancelled ||
      context.placed ||
      !context.hasHit
    ) {
      return false;
    }
    context.anchor.matrix.copy(context.reticle.matrix);
    context.anchor.matrixWorldNeedsUpdate = true;
    context.anchor.visible = true;
    context.reticle.visible = false;
    context.placed = true;
    notify(context, "placed");
    return true;
  }

  function start() {
    if (disposed) return Promise.reject(new Error("Le module AR est fermé."));
    if (current) return current.startTask;
    const xr = globalThis.navigator?.xr;
    if (!xr?.requestSession) {
      return Promise.reject(
        new Error("WebXR AR est indisponible dans ce navigateur."),
      );
    }
    if (renderer.xr.isPresenting || renderer.xr.getSession()) {
      return Promise.reject(
        new Error("Une autre session XR est déjà ouverte."),
      );
    }
    const source = getModel?.();
    if (!source?.isObject3D) {
      return Promise.reject(
        new Error("Chargez le modèle du plat avant d’ouvrir l’AR."),
      );
    }

    let context;
    let requestedSession;
    try {
      context = createContext(source);
      // No awaited capability check precedes this call: retain user activation.
      requestedSession = xr.requestSession("immersive-ar", {
        requiredFeatures: ["hit-test"],
        optionalFeatures: ["dom-overlay"],
        ...(overlay ? { domOverlay: { root: overlay } } : {}),
      });
    } catch (error) {
      if (context) cleanup(context);
      return Promise.reject(error);
    }
    current = context;
    context.startTask = (async () => {
      try {
        context.session = await requestedSession;
        context.onSessionEnd = () => {
          context.sessionEnded = true;
          // Three restores its framebuffer before this microtask runs, even
          // though this listener was attached before xr.setSession().
          queueMicrotask(() => {
            if (!context.initializing) cleanup(context);
          });
        };
        context.session.addEventListener("end", context.onSessionEnd);
        assertCurrent(context);
        const viewerSpace =
          await context.session.requestReferenceSpace("viewer");
        assertCurrent(context);
        context.hitTestSource = await context.session.requestHitTestSource({
          space: viewerSpace,
        });
        assertCurrent(context);

        context.onBeforeSelect = (event) => {
          const control = event.target?.closest?.(INTERACTIVE_OVERLAY);
          if (control && overlay.contains(control)) event.preventDefault();
        };
        overlay?.addEventListener("beforexrselect", context.onBeforeSelect);
        context.onSelect = () => place(context);
        for (let index = 0; index < 2; index += 1) {
          const controller = renderer.xr.getController(index);
          context.controllers.push({ controller, parent: controller.parent });
          controller.addEventListener("select", context.onSelect);
          context.scene.add(controller);
        }
        context.onRendererEnd = () => {
          if (!context.initializing) cleanup(context);
        };
        renderer.xr.addEventListener("sessionend", context.onRendererEnd);
        context.rendererTouched = true;
        renderer.xr.enabled = true;
        renderer.xr.cameraAutoUpdate = true;
        renderer.xr.setReferenceSpaceType("local");
        renderer.shadowMap.enabled = false;
        renderer.autoClear = true;
        renderer.autoClearColor = true;
        renderer.autoClearDepth = true;
        renderer.autoClearStencil = true;
        renderer.setScissorTest(false);
        renderer.setClearColor(0x000000, 0);
        await renderer.xr.setSession(context.session);
        assertCurrent(context);
        context.initializing = false;
        renderer.setAnimationLoop((_time, frame) => {
          if (!frame || current !== context || context.cancelled) return;
          try {
            if (!context.placed) updateHit(context, frame);
            renderer.render(context.scene, context.camera);
          } catch (error) {
            context.error = error;
            void end().catch(() => {});
          }
        });
        notify(context, "scanning");
        return true;
      } catch (error) {
        context.error = error;
        if (context.session && !context.sessionEnded) {
          try {
            await context.session.end();
          } catch {
            // The browser may already have ended a partially initialized session.
          }
        }
        context.initializing = false;
        cleanup(context);
        throw error;
      }
    })();
    context.suspended = true;
    try {
      onSuspend?.();
    } catch {
      // Native permission handling must still be allowed to settle/close.
    }
    notify(context, "requesting");
    return context.startTask;
  }

  async function end() {
    const context = current;
    if (!context) return;
    if (context.endTask) return context.endTask;
    context.cancelled = true;
    context.endTask = (async () => {
      // Do not end midway through Three's asynchronous makeXRCompatible/setup.
      // Startup checks cancellation after every await and closes the session.
      if (context.initializing) {
        await context.startTask.catch(() => {});
        return;
      }
      if (!context.sessionEnded) await context.session.end();
      cleanup(context);
    })();
    return context.endTask;
  }

  return {
    start,
    end,
    get active() {
      return Boolean(current);
    },
    dispose() {
      disposed = true;
      return end();
    },
    setScale(multiplier) {
      if (!current || !Number.isFinite(multiplier)) return;
      current.scale = THREE.MathUtils.clamp(multiplier, 0.5, 2);
      current.scaledModel.scale.setScalar(current.baseScale * current.scale);
      notify(current, current.status);
      return current.scale;
    },
    rotate(deltaRadians = Math.PI / 6) {
      if (!current || !Number.isFinite(deltaRadians)) return;
      current.yaw = THREE.MathUtils.euclideanModulo(
        current.yaw + deltaRadians,
        Math.PI * 2,
      );
      current.scaledModel.rotation.y = current.yaw;
      notify(current, current.status);
      return current.yaw;
    },
    reposition() {
      if (!current || current.initializing || current.cancelled) return false;
      current.placed = false;
      current.hasHit = false;
      current.anchor.visible = false;
      current.reticle.visible = false;
      notify(current, "scanning");
      return true;
    },
  };
}
