import * as THREE from "three";

// Cache the real restaurant once per entry/size. The hand shares the same
// renderer and draws over this texture; reading and the FAQ need no room loop.
export function createPricingRoomBackdrop({ renderer, scene, camera }) {
  const target = new THREE.WebGLRenderTarget(1, 1, {
    type:
      renderer.extensions?.has("EXT_color_buffer_float") === false
        ? THREE.UnsignedByteType
        : THREE.HalfFloatType,
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
  const light = { value: 0 };
  quad.material.onBeforeCompile = (shader) => {
    shader.uniforms.pricingLight = light;
    shader.fragmentShader = "uniform float pricingLight;\n" + shader.fragmentShader;
    // Match .world::after's CSS gradient in output color space. The shared
    // canvas's CSS shade is disabled over the hand, so the cached room alone
    // receives the same shade. Its lighting stays constant throughout pricing.
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <colorspace_fragment>",
      `#include <colorspace_fragment>
       float roomY = 1. - vMapUv.y;
       float roomShade = roomY < .29 ? mix(191./255., 102./255., roomY/.29)
         : roomY < .52 ? mix(102./255., 0., (roomY-.29)/.23)
         : roomY < .70 ? mix(0., 48./255., (roomY-.52)/.18)
         : mix(48./255., 143./255., (roomY-.70)/.30);
       gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(5./255.), roomShade * (1.-pricingLight));`,
    );
  };
  quad.material.customProgramCacheKey = () => "vistaire-pricing-room-theme-v4";
  screenScene.add(quad);
  let valid = false;
  return {
    draw(width, height, lightTheme = false) {
      light.value = lightTheme ? 1 : 0;
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
          renderer.setScissorTest(false);
          renderer.autoClear = true;
          renderer.shadowMap.needsUpdate = false;
          renderer.render(scene, camera);
          valid = true;
        } finally {
          camera.layers.mask = mask;
          renderer.setRenderTarget(null);
        }
      }
      renderer.setViewport(0, 0, width, height);
      renderer.setScissorTest(false);
      renderer.autoClear = true;
      renderer.render(screenScene, screenCamera);
    },
    invalidate() {
      valid = false;
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
