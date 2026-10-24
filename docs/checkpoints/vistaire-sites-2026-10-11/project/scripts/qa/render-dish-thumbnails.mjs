/**
 * Export the five supplied Vistaire dishes from their exact GLB geometry.
 * Requirements: npm dependencies, Chromium with WebGL 2, ffmpeg/libwebp.
 * Run from the project: CHROMIUM_EXECUTABLE=/path/to/chromium node scripts/qa/render-dish-thumbnails.mjs
 * Optional: --dish=burger to rerender just one supplied asset.
 * This starts Vite and Chromium in the same process/network namespace.
 */
import { createServer } from "vite";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";

const project = fileURLToPath(new URL("../../", import.meta.url));
const require = createRequire(import.meta.url);
const { chromium } = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES
  ? require(
      path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, "playwright"),
    )
  : require("@playwright/test");
const ids = ["huitres", "sushi", "chocolat-fume", "poutine", "burger"];
const requested = process.argv
  .find((arg) => arg.startsWith("--dish="))
  ?.slice(7);
if (requested && !ids.includes(requested)) throw new Error("Unknown dish id.");
const selected = requested ? [requested] : ids;
const width = 1122;
const height = 1402;
const stageModule = "virtual:vistaire-dish-thumbnail";

const stage = `
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/examples/jsm/loaders/DRACOLoader.js';
import {MeshoptDecoder} from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';

const width=${width},height=${height};
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true});
renderer.setSize(width,height);
renderer.setPixelRatio(1);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=0.9;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
const scene=new THREE.Scene();
scene.background=new THREE.Color('#10100f');
scene.fog=new THREE.FogExp2('#10100f',0.02);
const camera=new THREE.PerspectiveCamera(38,width/height,0.01,100);
const room=new RoomEnvironment();
const pmrem=new THREE.PMREMGenerator(renderer);
const env=pmrem.fromScene(room,0.08);
scene.environment=env.texture;
scene.environmentIntensity=0.4;
pmrem.dispose();
scene.add(new THREE.HemisphereLight('#fff6e9','#272321',0.7));
const key=new THREE.DirectionalLight('#fff4e5',2.0);
key.position.set(-3.5,6,3.5);
key.castShadow=true;
key.shadow.mapSize.set(2048,2048);
Object.assign(key.shadow.camera,{left:-4,right:4,top:4,bottom:-4,near:0.1,far:15});
key.shadow.normalBias=0.012;
key.shadow.bias=-0.00008;
key.shadow.radius=5;
key.shadow.intensity=0.6;
scene.add(key);
const fill=new THREE.DirectionalLight('#ffffff',0.35);
fill.position.set(3,2,4);
scene.add(fill);
const rim=new THREE.DirectionalLight('#f3dfba',1.1);
rim.position.set(2,4,-4);
scene.add(rim);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(40,40),new THREE.MeshStandardMaterial({color:'#080807',roughness:0.84,metalness:0}));
ground.rotation.x=-Math.PI/2;
ground.position.y=-0.012;
ground.receiveShadow=true;
scene.add(ground);
const draco=new DRACOLoader().setDecoderPath('/assets/draco/').setDecoderConfig({type:'wasm'}).setWorkerLimit(1);
const loader=new GLTFLoader().setDRACOLoader(draco).setMeshoptDecoder(MeshoptDecoder);
let active;
function disposeModel(root){
  if(!root)return;
  const materials=new Set(),textures=new Set(),geometries=new Set();
  root.traverse(o=>{
    if(o.geometry)geometries.add(o.geometry);
    for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[]){
      materials.add(m);
      for(const value of Object.values(m))if(value?.isTexture)textures.add(value);
    }
  });
  geometries.forEach(g=>g.dispose());
  materials.forEach(m=>m.dispose());
  textures.forEach(t=>{t.dispose();t.image?.close?.()});
  scene.remove(root);
}
window.renderVistaireDish=async function(id){
  disposeModel(active);
  active=null;
  const started=performance.now();
  const gltf=await loader.loadAsync('/assets/dishes/'+id+'.glb');
  active=gltf.scene;
  const sourceBounds=new THREE.Box3().setFromObject(active);
  const sourceSize=sourceBounds.getSize(new THREE.Vector3());
  const center=sourceBounds.getCenter(new THREE.Vector3());
  const scale=3.2/Math.max(sourceSize.x,sourceSize.z,sourceSize.y);
  active.scale.multiplyScalar(scale);
  active.position.set(-center.x*scale,-sourceBounds.min.y*scale,-center.z*scale);
  let triangles=0,vertices=0;
  const textures=new Set();
  active.traverse(object=>{
    if(!object.isMesh)return;
    object.castShadow=true;
    object.receiveShadow=true;
    triangles+=(object.geometry.index?.count||object.geometry.attributes.position.count)/3;
    vertices+=object.geometry.attributes.position.count;
    // GLTFLoader keeps the supplied PBR factors, normals and texture colors.
    // Only sampling quality is increased; texture color spaces stay untouched.
    for(const material of Array.isArray(object.material)?object.material:[object.material]){
      for(const texture of Object.values(material))if(texture?.isTexture){
        texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
        textures.add(texture);
      }
    }
  });
  scene.add(active);
  const bounds=new THREE.Box3().setFromObject(active);
  const target=bounds.getCenter(new THREE.Vector3());
  const direction=new THREE.Vector3(0.6,1.45,2).normalize();
  camera.position.copy(target).add(direction);
  camera.lookAt(target);
  const inverse=camera.quaternion.clone().invert();
  const tan=Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
  let distance=0;
  for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
    const point=new THREE.Vector3(x,y,z).sub(target).applyQuaternion(inverse);
    distance=Math.max(distance,point.z+Math.abs(point.x)/(tan*camera.aspect),point.z+Math.abs(point.y)/tan);
  }
  // 12% air around the full actual food and plate, including asymmetric dishes.
  camera.position.copy(target).addScaledVector(direction,distance*1.12);
  camera.lookAt(target);
  camera.updateProjectionMatrix();
  renderer.compile(scene,camera);
  renderer.render(scene,camera);
  const png=renderer.domElement.toDataURL('image/png').split(',')[1];
  const stats={id,width,height,triangles,vertices,sourceSize:sourceSize.toArray(),cameraDistance:distance*1.12,elapsedSeconds:(performance.now()-started)/1000,textures:[...textures].map(t=>({width:t.image?.width,height:t.image?.height,colorSpace:t.colorSpace,flipY:t.flipY}))};
  return {png,stats};
};
window.vistaireThumbnailReady=true;
`;

const server = await createServer({
  root: project,
  configFile: false,
  server: { host: "127.0.0.1", port: 5191, strictPort: true },
  plugins: [
    {
      name: "vistaire-thumbnail-render",
      resolveId(id) {
        if (id === stageModule) return "\0" + stageModule;
      },
      load(id) {
        if (id === "\0" + stageModule) return stage;
      },
      configureServer(vite) {
        vite.middlewares.use((req, res, next) => {
          if (req.url !== "/__vistaire_thumbnail") return next();
          res.setHeader("Content-Type", "text/html");
          res.end(
            `<!doctype html><html lang="fr"><meta charset="UTF-8"><title>Vistaire GLB thumbnail export</title><style>html,body{margin:0;background:#1a1917}canvas{display:block}</style><script type="module" src="/@id/${stageModule}"></script></html>`,
          );
        });
      },
    },
  ],
});

let browser;
try {
  await server.listen();
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE,
    headless: true,
    ignoreDefaultArgs: [
      "--enable-unsafe-swiftshader",
      "--unsafely-disable-devtools-self-xss-warnings",
    ],
  });
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 1,
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400)
      errors.push(`${response.status()} ${response.url()}`);
  });
  await page.goto("http://127.0.0.1:5191/__vistaire_thumbnail");
  await page.waitForFunction(() => window.vistaireThumbnailReady, undefined, {
    timeout: 120000,
  });
  for (const id of selected) {
    const model = path.join(project, "public/assets/dishes", `${id}.glb`);
    const source = await fs.readFile(model);
    const sourceHash = createHash("sha256").update(source).digest("hex");
    const result = await page.evaluate(
      (dish) => window.renderVistaireDish(dish),
      id,
    );
    if (errors.length) throw new Error(errors.join("\n"));
    const output = path.join(project, "public/assets", `${id}.webp`);
    const encoder = spawn(
      "ffmpeg",
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-f",
        "image2pipe",
        "-i",
        "pipe:0",
        "-frames:v",
        "1",
        "-c:v",
        "libwebp",
        "-quality",
        "92",
        "-compression_level",
        "6",
        output,
      ],
      { stdio: ["pipe", "ignore", "inherit"] },
    );
    const encoded = once(encoder, "close");
    encoder.stdin.end(Buffer.from(result.png, "base64"));
    const [code] = await encoded;
    if (code !== 0) throw new Error(`WebP encoding failed for ${id}: ${code}`);
    const webp = await fs.readFile(output);
    const afterHash = createHash("sha256")
      .update(await fs.readFile(model))
      .digest("hex");
    if (sourceHash !== afterHash) throw new Error(`Source GLB changed: ${id}`);
    console.log(
      JSON.stringify({
        ...result.stats,
        sourceBytes: source.length,
        sourceSha256: sourceHash,
        webpBytes: webp.length,
        webpSha256: createHash("sha256").update(webp).digest("hex"),
        output: path.relative(project, output),
        sourceUnchanged: true,
      }),
    );
  }
} finally {
  await browser?.close();
  await server.close();
}
