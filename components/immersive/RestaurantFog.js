import { ColorManagement, ShaderChunk, SRGBColorSpace } from "three";

// Three's default material output applies fog after display conversion. The
// approved offers backdrop blends the same fog in linear HDR before conversion.
// Keep the room consistent in both paths without another render target/pass.
const patched = new WeakSet();
export function applyLinearRestaurantFog(material) {
  if (patched.has(material)) return;
  const previousCompile = material.onBeforeCompile;
  const previousKey = material.customProgramCacheKey();
  material.onBeforeCompile = function (shader, renderer) {
    previousCompile.call(this, shader, renderer);
    const fog = '#include <fog_fragment>';
    const tone = '#include <tonemapping_fragment>';
    if (!shader.fragmentShader.includes(fog) || !shader.fragmentShader.includes(tone))
      throw new Error('Restaurant fog requires the verified Three material output chunks.');
    // Match WebGLMaterials' fog upload space. The renderer already keys its
    // programs by outputColorSpace, so display and HDR variants stay separate.
    const target = renderer.getRenderTarget();
    const fogSpace = target === null ? renderer.outputColorSpace
      : target.isXRRenderTarget ? target.texture.colorSpace : ColorManagement.workingColorSpace;
    const linearFog = fogSpace === SRGBColorSpace
      ? ShaderChunk.fog_fragment.replace('fogColor', 'sRGBTransferEOTF( vec4( fogColor, 1.0 ) ).rgb')
      : fog;
    shader.fragmentShader = shader.fragmentShader.replace(fog, '').replace(tone, `${linearFog}\n${tone}`);
  };
  material.customProgramCacheKey = () => `${previousKey}:restaurant-linear-fog-v1`;
  material.needsUpdate = true;
  patched.add(material);
}
