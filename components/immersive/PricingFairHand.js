import * as THREE from "three";
import { fairHandEase } from "./PricingPhoneLayout.js";

export { fairHandEase };

// Measured on the owner-supplied PNG. The photographic phone is masked
// in the shader; Vistaire's actual 3D case and live HTML screen replace it.
export const FAIR_HAND_ASSET = Object.freeze({
  src: "/immersive-assets/pricing-hand/fair-hand-grip-v3.png",
  width: 1071,
  height: 1469,
  phone: Object.freeze({
    left: 329,
    top: 72,
    right: 845,
    bottom: 1106,
    radius: 78,
  }),
});

export function createFairHandGeometry(phone) {
  const bounds = new THREE.Box3().setFromObject(phone.clone(true));
  const { width, height, phone: frame } = FAIR_HAND_ASSET;
  const sx = (bounds.max.x - bounds.min.x) / (frame.right - frame.left);
  const sy = (bounds.max.z - bounds.min.z) / (frame.bottom - frame.top);
  const left = bounds.max.x + frame.left * sx;
  const right = left - width * sx;
  const top = bounds.max.z + frame.top * sy;
  const bottom = top - height * sy;
  // All fingers stay behind the case, as in the supplied front-facing grip.
  const depth = bounds.min.y - 0.0005;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [
        left,
        depth,
        top,
        right,
        depth,
        top,
        left,
        depth,
        bottom,
        right,
        depth,
        bottom,
      ],
      3,
    ),
  );
  geometry.setAttribute(
    "uv",
    new THREE.Float32BufferAttribute([0, 1, 1, 1, 0, 0, 1, 0], 2),
  );
  geometry.setIndex([0, 2, 1, 2, 3, 1]);
  geometry.computeBoundingSphere();
  return geometry;
}

export function configureFairHandMaterial(material) {
  material.transparent = true;
  material.alphaTest = 0.12;
  material.side = THREE.DoubleSide;
  const { width, height, phone } = FAIR_HAND_ASSET;
  // A two-pixel allowance also removes the generated side buttons/bezel.
  const mask = new THREE.Vector4(
    (phone.left - 2) / width,
    1 - (phone.bottom + 2) / height,
    (phone.right + 2) / width,
    1 - (phone.top - 2) / height,
  );
  material.onBeforeCompile = (shader) => {
    shader.uniforms.handPhoneMask = { value: mask };
    shader.uniforms.handAssetSize = { value: new THREE.Vector2(width, height) };
    shader.uniforms.handPhoneRadius = { value: phone.radius + 2 };
    shader.fragmentShader =
      "uniform vec4 handPhoneMask; uniform vec2 handAssetSize; uniform float handPhoneRadius;\n" +
      shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      `
      #ifdef USE_MAP
        vec2 phoneCentre = (handPhoneMask.xy + handPhoneMask.zw) * .5 * handAssetSize;
        vec2 phoneHalfSize = (handPhoneMask.zw - handPhoneMask.xy) * .5 * handAssetSize;
        vec2 corner = abs(vMapUv * handAssetSize - phoneCentre) - phoneHalfSize + handPhoneRadius;
        float phoneDistance = length(max(corner, vec2(0.))) + min(max(corner.x, corner.y), 0.) - handPhoneRadius;
        if (phoneDistance <= 0.) discard;
      #endif
      #include <map_fragment>
      `,
    );
  };
  material.customProgramCacheKey = () => "vistaire-fair-hand-grip-rounded-v3";
}

export function moveFairHandEntry(product, ratio, viewportSpan = 0.2) {
  const remaining = 1 - fairHandEase(ratio);
  // Start just below the frame, rather than flying up from 1.25 viewports away.
  // Position, velocity and acceleration settle together, including in reverse.
  product.position.z -= remaining * viewportSpan * 0.85;
  product.quaternion.premultiply(
    new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      (remaining * -Math.PI) / 60,
    ),
  );
}

