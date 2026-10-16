import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';
import { applyLinearRestaurantFog } from '../components/immersive/RestaurantFog.js';

const fog = '#include <fog_fragment>';
const tone = '#include <tonemapping_fragment>';
const color = '#include <colorspace_fragment>';
const hdrRenderer = { getRenderTarget: () => ({ texture: { colorSpace: THREE.LinearSRGBColorSpace } }), outputColorSpace: THREE.SRGBColorSpace };
const mainRenderer = { getRenderTarget: () => null, outputColorSpace: THREE.SRGBColorSpace };

test('restaurant fog uses the approved HDR order without changing any other shader operation or material value', () => {
  for (const Material of [THREE.MeshStandardMaterial, THREE.MeshPhysicalMaterial]) {
    const material = new Material({ color: '#e9b884', roughness: .7, metalness: .15, transparent: true, opacity: .4 });
    const before = JSON.stringify(material.toJSON());
    const fragmentShader = THREE.ShaderLib.standard.fragmentShader;
    assert.ok(fragmentShader.indexOf(fog) > fragmentShader.indexOf(color), 'the installed baseline is the reproduced output-space fog path');
    applyLinearRestaurantFog(material);
    const shader = { fragmentShader };
    material.onBeforeCompile(shader, hdrRenderer);
    assert.ok(shader.fragmentShader.indexOf(fog) < shader.fragmentShader.indexOf(tone));
    assert.ok(shader.fragmentShader.indexOf(tone) < shader.fragmentShader.indexOf(color));
    assert.equal(shader.fragmentShader.split(fog).length, 2, 'fog is applied exactly once');
    assert.equal(shader.fragmentShader.replace(fog, '').replace(/\s/g, ''), fragmentShader.replace(fog, '').replace(/\s/g, ''), 'no lighting, alpha, texture or output operation is added or removed');
    assert.equal(JSON.stringify(material.toJSON()), before, 'source material parameters remain identical');
    const key = material.customProgramCacheKey();
    applyLinearRestaurantFog(material);
    assert.equal(material.customProgramCacheKey(), key, 'repeated shared-material visits do not stack hooks');
    material.dispose();
  }
});

test('existing restaurant fades retain the same fog pipeline on cloned materials', () => {
  const material = new THREE.MeshStandardMaterial();
  applyLinearRestaurantFog(material);
  const clone = material.clone();
  applyLinearRestaurantFog(clone);
  for (const value of [material, clone]) {
    const shader = { fragmentShader: THREE.ShaderLib.standard.fragmentShader };
    value.onBeforeCompile(shader, hdrRenderer);
    assert.ok(shader.fragmentShader.indexOf(fog) < shader.fragmentShader.indexOf(tone));
    assert.match(value.customProgramCacheKey(), /restaurant-linear-fog/);
  }
  assert.match(readFileSync('components/immersive/RestaurantModel.js', 'utf8'), /applyLinearRestaurantFog\(material\)/);
  assert.match(readFileSync('components/immersive/RestaurantTable.js', 'utf8'), /material = original\.clone\(\);\s*applyLinearRestaurantFog\(material\)/);
  material.dispose(); clone.dispose();
});


test('output-space fog uniforms are converted only for the main sRGB path, never twice for the HDR cache', () => {
  const material = new THREE.MeshStandardMaterial();
  applyLinearRestaurantFog(material);
  const main = { fragmentShader: THREE.ShaderLib.standard.fragmentShader };
  const cached = { fragmentShader: THREE.ShaderLib.standard.fragmentShader };
  material.onBeforeCompile(main, mainRenderer);
  material.onBeforeCompile(cached, hdrRenderer);
  assert.match(main.fragmentShader, /sRGBTransferEOTF\( vec4\( fogColor, 1\.0 \) \)\.rgb/);
  assert.doesNotMatch(cached.fragmentShader, /sRGBTransferEOTF/);
  const fogLinear = new THREE.Color('#594737');
  const uploadedSRGB = new THREE.Color();
  fogLinear.getRGB(uploadedSRGB, THREE.SRGBColorSpace);
  uploadedSRGB.convertSRGBToLinear();
  assert.ok(Math.max(...['r','g','b'].map(key => Math.abs(uploadedSRGB[key]-fogLinear[key]))) < 5e-6);
  material.dispose();
});
