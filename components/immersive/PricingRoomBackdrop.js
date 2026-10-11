import * as THREE from "three";

// Cache the real restaurant once per entry/size. The hand shares the same
// renderer and draws over this texture; reading and the FAQ need no room loop.
export function createPricingRoomBackdrop({ renderer, scene, camera }) {
  const target = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
  });
  target.texture.colorSpace = THREE.LinearSRGBColorSpace;
  const screenScene = new THREE.Scene();
  const screenCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.MeshBasicMaterial({
      map: target.texture,
      toneMapped: true,
      depthTest: false,
      depthWrite: false,
    }),
  );
  quad.frustumCulled = false;
  quad.material.onBeforeCompile = (shader) => {
    // Match .world::after's CSS gradient in output color space. The shared
    // canvas's CSS shade is disabled over the hand, so the cached room alone
    // receives that same shade in both themes, without an entry brightness pop.
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <colorspace_fragment>",
      `#include <colorspace_fragment>
       float roomY = 1. - vMapUv.y;
       float roomShade = roomY < .29 ? mix(191./255., 102./255., roomY/.29)
         : roomY < .52 ? mix(102./255., 0., (roomY-.29)/.23)
         : roomY < .70 ? mix(0., 48./255., (roomY-.52)/.18)
         : mix(48./255., 143./255., (roomY-.70)/.30);
       gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(5./255.), roomShade);`,
    );
  };
  quad.material.customProgramCacheKey = () => "vistaire-pricing-existing-room-shade-v1";
  screenScene.add(quad);
  let valid = false, generation = 0, pose = "";
  const previousViewport = new THREE.Vector4();
  const previousScissor = new THREE.Vector4();
  return {
    draw(width, height, lightTheme = false) {
      // Linear HDR capture must not silently clip bright restaurant lighting.
      if (!renderer.extensions.has("EXT_color_buffer_float"))
        throw new Error("Floating-point pricing framebuffer unavailable");
      const previousTarget = renderer.getRenderTarget();
      renderer.getViewport(previousViewport);
      renderer.getScissor(previousScissor);
      const previousScissorTest = renderer.getScissorTest();
      const previousAutoClear = renderer.autoClear;
      const previousShadowUpdate = renderer.shadowMap.needsUpdate;
      const previousShaderError = renderer.debug?.onShaderError;
      let shaderFailed = false;
      try {
        if (renderer.debug) renderer.debug.onShaderError = () => { shaderFailed = true; };
        const pixelWidth = renderer.domElement.width;
        const pixelHeight = renderer.domElement.height;
        if (target.width !== pixelWidth || target.height !== pixelHeight) {
          target.setSize(pixelWidth, pixelHeight);
          valid = false;
        }
        if (!valid) {
          const mask = camera.layers.mask;
          try {
            camera.layers.set(0);
            camera.layers.enable(2);
            renderer.setRenderTarget(target);
            // Check once for a fresh allocation, never during cached reading.
            const gl = renderer.getContext();
            if (gl.isContextLost?.() || gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE)
              throw new Error("Pricing framebuffer is incomplete");
            renderer.setScissorTest(false);
            renderer.autoClear = true;
            renderer.shadowMap.needsUpdate = false;
            renderer.render(scene, camera);
            if (shaderFailed) throw new Error("Pricing room shader unavailable");
            pose = "pricing-entry:" + [...camera.position.toArray(), ...camera.quaternion.toArray(),
              ...camera.projectionMatrix.elements].map(value => value.toFixed(6)).join(",") +
              ":" + scene.background?.getHexString();
            valid = true;
            generation++;
          } finally {
            camera.layers.mask = mask;
            renderer.setRenderTarget(null);
          }
        }
        renderer.setRenderTarget(null);
        renderer.setViewport(0, 0, width, height);
        renderer.setScissorTest(false);
        renderer.autoClear = true;
        renderer.render(screenScene, screenCamera);
        if (shaderFailed) throw new Error("Pricing backdrop shader unavailable");
        return { generation, pose, width: target.width, height: target.height,
          theme: lightTheme ? "light" : "dark" };
      } finally {
        if (shaderFailed) valid = false;
        if (renderer.debug) renderer.debug.onShaderError = previousShaderError;
        renderer.setRenderTarget(previousTarget);
        renderer.setViewport(previousViewport);
        renderer.setScissor(previousScissor);
        renderer.setScissorTest(previousScissorTest);
        renderer.autoClear = previousAutoClear;
        renderer.shadowMap.needsUpdate = previousShadowUpdate;
      }
    },
    release() {
      target.setSize(1, 1);
      valid = false;
    },
    dispose() {
      target.dispose();
      quad.geometry.dispose();
      quad.material.dispose();
    },
  };
}

