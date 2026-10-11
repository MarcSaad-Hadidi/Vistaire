import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const assets=JSON.parse(await fs.readFile(path.join(root,'checkpoint-assets.json'),'utf8'));
const valid=(bytes,asset)=>bytes.length===asset.bytes&&createHash('sha256').update(bytes).digest('hex')===asset.sha256;
for(const asset of assets){
  const target=path.resolve(root,asset.path);
  if(!target.startsWith(root+path.sep))throw Error('Invalid checkpoint asset path');
  let bytes;try{bytes=await fs.readFile(target)}catch{}
  if(bytes&&valid(bytes,asset))continue;
  const response=await fetch(asset.url);
  if(!response.ok)throw Error(`Asset unavailable: ${asset.path} (${response.status})`);
  bytes=Buffer.from(await response.arrayBuffer());
  if(!valid(bytes,asset))throw Error(`Checkpoint checksum mismatch: ${asset.path}`);
  await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,bytes);
}
console.log(`${assets.length} checkpoint asset references restored and verified.`);
