import { spawn } from 'node:child_process';
import { createServer } from 'vite';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import path from 'node:path';
import { once } from 'node:events';
import os from 'node:os';

const project = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(import.meta.url);
const { chromium } = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ? require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright')) : require('@playwright/test');
const sharp = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ? require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'sharp')) : null;
const executablePath = process.env.CHROMIUM_EXECUTABLE;
const sample = process.argv.includes('--sample');
const requested = process.argv.find(arg => arg.startsWith('--format='))?.split('=')[1];
const formats = requested ? [requested] : ['landscape','portrait'];
const server = await createServer({root:project,server:{host:'127.0.0.1',port:5180,strictPort:true,hmr:false}});
let browser;
try {
  await server.listen();
  browser=await chromium.launch({executablePath,headless:true,ignoreDefaultArgs:['--enable-unsafe-swiftshader','--unsafely-disable-devtools-self-xss-warnings']});
  for(const format of formats){
    const portrait=format==='portrait';
    const viewport=portrait ? {width:720,height:1280} : {width:1280,height:720};
    const page=await browser.newPage({viewport,deviceScaleFactor:1});
    page.on('pageerror',error=>{throw error});
    await page.goto(`http://127.0.0.1:5180/scripts/cinematic/stage.html?format=${format}&dish=${portrait?'souffle':'homard'}`);
    await page.waitForFunction(()=>window.cinematicReady,undefined,{timeout:120000});
    const dir=path.join(project,'public','media');
    const poster=path.join(project,'public','assets',`cinematic-${format}.webp`);
    await fs.mkdir(dir,{recursive:true});
    const first=Buffer.from(await page.evaluate(()=>window.captureCinematicFrame(0)),'base64');
    if(sharp)await sharp(first).webp({quality:92}).toFile(poster);
    else {
      const converter=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','image2pipe','-i','pipe:0','-frames:v','1','-c:v','libwebp','-quality','92',poster],{stdio:['pipe','ignore','inherit']});
      const done=once(converter,'close');
      converter.stdin.end(first);
      const [code]=await done;
      if(code!==0)throw new Error(`WebP conversion exited ${code}`);
    }
    if(sample){
      const samples=await fs.mkdtemp(path.join(os.tmpdir(),'vistaire-cinematic-'));
      for(const t of [0,2,4,6]){
        const png=Buffer.from(await page.evaluate(t=>window.captureCinematicFrame(t),t),'base64');
        await fs.writeFile(path.join(samples,`cinematic-${format}-sample-${t}.png`),png);
      }
      console.log(`${format}: samples complete in ${samples}`);
      await page.close();
      continue;
    }
    const output=path.join(dir,`cinematic-${format}.mp4`);
    const encoder=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','image2pipe','-framerate','8','-i','pipe:0','-an','-vf','minterpolate=fps=24:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1','-t','8','-c:v','libx264','-preset','slow','-crf','18','-profile:v','high','-pix_fmt','yuv420p','-movflags','+faststart',output],{stdio:['pipe','ignore','pipe']});
    const encoderDone=once(encoder,'close');
    encoder.stderr.on('data',data=>process.stderr.write(data));
    const start=Date.now();
    // 64 camera samples cover the loop. Two further samples are periodic
    // look-ahead for the optical interpolator, then the output is cut to 8 s.
    for(let frame=0;frame<66;frame++){
      const png=Buffer.from(await page.evaluate(t=>window.captureCinematicFrame(t),frame/8),'base64');
      if(!encoder.stdin.write(png))await once(encoder.stdin,'drain');
      if(frame%8===0)console.log(`${format}: ${frame}/66 source frames (${Math.round((Date.now()-start)/1000)}s)`);
    }
    encoder.stdin.end();
    const [code]=await encoderDone;
    if(code!==0)throw new Error(`ffmpeg exited ${code}`);
    await page.close();
    console.log(`${format}: encoded ${output}`);
  }
  if(!sample && !requested)await import('./inspect.mjs');
} finally {
  await browser?.close();
  await server.close();
}
