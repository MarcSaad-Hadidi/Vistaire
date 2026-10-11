import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const exec=promisify(execFile);
const project=fileURLToPath(new URL('../../',import.meta.url));
async function identify(relative){
  const data=await fs.readFile(path.join(project,relative));
  return {path:relative,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')};
}
async function inspect(relative){
  const {stdout}=await exec('ffprobe',['-v','error','-show_entries','stream=codec_name,profile,width,height,pix_fmt,r_frame_rate,avg_frame_rate,duration,nb_frames,codec_type:format=duration,size','-of','json',path.join(project,relative)]);
  return JSON.parse(stdout);
}
const videos=[];
for(const format of ['landscape','portrait']){
  const file=`public/media/cinematic-${format}.mp4`;
  const metadata=await inspect(file);
  const stream=metadata.streams.find(stream=>stream.codec_type==='video');
  const expected=format==='landscape' ? [1280,720] : [720,1280];
  if(stream.width!==expected[0]||stream.height!==expected[1]||stream.nb_frames!=='192'||stream.r_frame_rate!=='24/1'||Number(stream.duration)!==8||stream.codec_name!=='h264'||stream.pix_fmt!=='yuv420p')throw new Error(`Unexpected video format: ${file}`);
  if(metadata.streams.some(stream=>stream.codec_type==='audio'))throw new Error(`Unexpected audio: ${file}`);
  videos.push({...await identify(file),metadata,poster:await identify(`public/assets/cinematic-${format}.webp`)});
}
const output={
  createdAt:new Date().toISOString(),
  method:'Independent Three.js 3D scene rendered at native resolution, 8 source frames per second, optical motion interpolation to 24 output frames per second. No raster upscaling and no still-image camera pan.',
  sourceFrames:{fps:8,loopFrames:64,lookAheadFrames:2},
  encoding:{codec:'H.264',profile:'High',crf:18,pixelFormat:'yuv420p',outputFps:24,durationSeconds:8,frames:192,audio:false,fastStart:true,interpolation:'minterpolate=fps=24:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1'},
  scene:{camera:'Periodic slow orbit inside the uploaded Restaurant in the evening GLB; exact pose at t=8 equals t=0',lighting:'Neutral ivory key, champagne rim, warm fill and environment reflections',materials:'Original Vistaire dish PBR textures; Original white-cloth table, chair and source accessories below the windows and painting; original Vistaire dish PBR textures; uploaded restaurant geometry and native WebP materials',effects:'Static shadow map, ACES filmic tone mapping, subtle vignette'},
  sources:[await identify('public/media/homard-mobile.glb'),await identify('public/media/souffle.glb'),await identify('public/assets/restaurant/restaurant-evening.glb'),await identify('public/assets/restaurant-stone.webp')],
  sourceRepository:'https://github.com/MarcSaad-Hadidi/Vistaire',
  sourceCommit:'cd91ec7556c9d6dcafe6d2d44b27f571abd1e0be',
  generator:'scripts/cinematic/render.mjs',
  sceneSource:'scripts/cinematic/stage.js',
  videos,
  limitations:['Rendered source models retain the detail and appearance of the supplied Vistaire meshes.','These loops do not recreate the proprietary Oryzo footage.','Optical interpolation can produce small edge artifacts; selected interpolated frames must be inspected visually.','A native 1280 × 720 landscape render is HD, not 1080p or 4K.']
};
await fs.writeFile(path.join(project,'cinematic-provenance.json'),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({result:'passed',videos:videos.map(video=>({file:video.path,bytes:video.bytes,video:video.metadata.streams[0]}))},null,2));
