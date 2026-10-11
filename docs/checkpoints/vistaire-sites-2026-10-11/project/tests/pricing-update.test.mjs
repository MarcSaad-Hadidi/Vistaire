import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { build } from 'esbuild';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as THREE from 'three';
import { createPricingRoomBackdrop } from '../src/PricingRoomBackdrop.js';
import { pricingFixture } from './helpers/pricing-hand-fixture.mjs';
import { FAIR_HAND_ASSET } from '../src/PricingFairHand.js';

const source=path.resolve('src/pages/source'),cache=path.resolve('node_modules/.cache/pricing-update-test.mjs');
await build({stdin:{contents:`export {App} from './src/App.jsx'; export {PricingPhoneContent, PricingStageContent} from './src/Pricing.jsx'; export {LandingLocaleProvider} from './src/locale.jsx'; export {RestaurateurDashboardDemo} from './src/pages/source/components/vistaire-preview/RestaurateurDashboardDemo.tsx'; export {createPublicStudioDemo} from './src/pages/source/lib/restaurateurPreview/studioFixture.ts'; export {AdminStudio} from './src/pages/source/components/admin/studio/AdminStudio.tsx'; export {StudioLocaleProvider} from './src/pages/source/components/admin/studio/studioLocale.tsx';`,resolveDir:process.cwd(),loader:'jsx'},outfile:cache,bundle:true,platform:'node',format:'esm',packages:'external',jsx:'automatic',alias:{'@':source,'next/link':path.resolve('src/pages/NativeLink.tsx'),'next/image':path.resolve('src/pages/NativeImage.tsx'),'next/navigation':path.resolve('src/pages/NativeNavigation.ts')},plugins:[{name:'css-for-node',setup(b){b.onResolve({filter:/\.css$/},args=>({path:args.path,namespace:'css-stub'}));b.onLoad({filter:/.*/,namespace:'css-stub'},()=>({contents:'export default new Proxy({}, {get: (_, key) => key});',loader:'js'}));}}],logLevel:'error'});
const ui=await import(cache);
const awaitableCss=await fs.readFile('src/pricing.css','utf8');

const markup=(component,locale='fr')=>renderToStaticMarkup(createElement(ui.LandingLocaleProvider,{locale},createElement(component)));

test('the phone contains four real offers, menu subscription and Pilotage, with details outside',()=>{
 for(const locale of ['fr','en']){
  const phone=markup(ui.PricingPhoneContent,locale),aside=markup(ui.PricingStageContent,locale);
  for(const name of ['Acrylique','Sculpté','Carré','Signature'])assert.ok(phone.includes(name));
  assert.match(phone,/pricing-pilotage-price/);assert.match(phone,/100/);assert.match(phone,/200/);
  assert.doesNotMatch(phone,/pricing-details-prompt|pricing-short-terms|pricing-cta|pricing-details-link/);
  assert.match(phone,/studio-mobile-overview.webp/);
  const links=[...aside.matchAll(/href="([^"]+)"/g)].map(m=>m[1]);
  assert.deepEqual(links,locale==='fr'?['/tarifs-menu-digital-restaurant','/prendre-rendez-vous','/apercu-restaurateur']:['/en/pricing-digital-restaurant-menu','/en/book-a-call','/en/restaurant-preview']);
  assert.match(aside,/pricing-aside-terms/);
 }
 const app=markup(ui.App);
 assert.ok(app.indexOf('id="pricing-actions-host"') < app.indexOf('<main'));
 const css=awaitableCss;
 assert.match(css,/#pricing-actions-host\s*\{[^}]*z-index: 20;/);
 assert.match(css,/pricing-aside-layer \.pricing-cta\s*\{[^}]*pointer-events: auto;/);
});

test('the supplied wrist crop falls below desktop frames and the phone remains inside',async()=>{
 const f=await pricingFixture({grip:'fair',background:true});
 try{for(const[w,h]of[[1897,865],[1440,900],[1024,768],[844,390]]){
  f.pricing.render(f.offer,1,w,h);
  const {scene,camera}=f.captures.at(-1),mesh=scene.getObjectByName('VistaireFairHand'),pos=mesh.geometry.attributes.position;
  const tl=new THREE.Vector3().fromBufferAttribute(pos,0),bl=new THREE.Vector3().fromBufferAttribute(pos,2);
  const first=tl.clone().addScaledVector(bl.sub(tl),1210/FAIR_HAND_ASSET.height).applyMatrix4(mesh.matrixWorld).project(camera);
  assert.ok((1-first.y)*h/2>=h,'source left edge is below the frame');
  const p=f.pricing.screenProjection(w,h);
  assert.ok(p.matrix[5]>80);assert.ok(p.matrix[5]+p.matrix[3]*p.height<h);
 }}finally{f.close()}
});

test('mobile phone framing leaves room for the title and equally aligned external actions',async()=>{
 const f=await pricingFixture({grip:'fair',background:true});
 try{for(const[w,h]of[[393,747],[390,740],[390,844],[320,600],[430,932],[768,1024]]){
  f.pricing.render(f.offer,1,w,h);
  const {scene,camera}=f.captures.at(-1),hand=scene.getObjectByName('VistaireFairHand');
  const phone=hand.parent.children.find(x=>x!==hand),box=new THREE.Box3().setFromObject(phone),edges=[];
  for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])edges.push((1-new THREE.Vector3(x,y,z).project(camera).y)*h/2);
  assert.ok(Math.min(...edges)>=160,`${w}x${h}: below the mobile title`);
  assert.ok(Math.max(...edges)<=h-128,`${w}x${h}: at least 20px above external actions`);
 }}finally{f.close()}
 assert.match(awaitableCss,/pricing-aside-layer \.pricing-cta\s*\{[^}]*margin: 0;/);
});

test('theme changes update the cached room material without recapturing the restaurant',async()=>{
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();let quad,captures=0;
 const renderer={domElement:{width:780,height:1480},extensions:{has:()=>true},shadowMap:{},setRenderTarget(){},setScissorTest(){},setViewport(){},render(s){if(s===scene)captures++;else quad=s.children[0];}};
 const room=createPricingRoomBackdrop({renderer,scene,camera});
 try{
  room.draw(390,740,false);const shader={uniforms:{},fragmentShader:'#include <colorspace_fragment>'};quad.material.onBeforeCompile(shader);
  assert.equal(shader.uniforms.pricingLight.value,0);
  room.draw(390,740,true);assert.equal(shader.uniforms.pricingLight.value,1);assert.equal(captures,1);
  room.draw(390,740,false);assert.equal(shader.uniforms.pricingLight.value,0);assert.equal(captures,1);
  assert.match(shader.fragmentShader,/roomShade \* \(1.-pricingLight\)/);
  assert.doesNotMatch(shader.fragmentShader,/pricingIvory|lifted|pricingShade/);
  const css=await fs.readFile('src/styles.css','utf8');
  assert.match(css,/\.world:after\s*\{[^}]*#050505bf,[\s\S]*?#05050566 29%,[\s\S]*?transparent 52%,[\s\S]*?#05050530 70%,[\s\S]*?#0505058f/);
  // The shader reproduces the CSS output-space gradient, without a progress
  // dimmer. No white lift or removal of the existing dark shade at hand entry.
  assert.match(shader.fragmentShader,/191\.\/255\.[\s\S]*102\.\/255\.[\s\S]*48\.\/255\.[\s\S]*143\.\/255\./);
  assert.doesNotMatch(awaitableCss,/--public-text:\s*#f5ead8|--public-muted:\s*#cec8bd/);
 }finally{room.dispose()}
});

test('the new dashboard uses the actual PR Studio and the consistent synthetic fixture',()=>{
 for(const locale of ['fr','en'])for(const range of ['today-utc','7d','30d']){
  const data=ui.createPublicStudioDemo(range,locale);
  assert.equal(data.synthetic,true);
  for(const field of ['dishOpened','three','ar']){
   const id={dishOpened:'dish-opens',three:'three',ar:'ar'}[field];
   assert.equal(data.analytics.metricSeries[field].current.reduce((n,p)=>n+p.value,0),data.analytics.metrics.find(m=>m.id===id).value);
  }
 }
 for(const locale of ['fr','en']){
  const html=renderToStaticMarkup(createElement(ui.RestaurateurDashboardDemo,{locale}));
  assert.match(html,/data-admin-studio/);assert.match(html,/RESTAURANT STUDIO/);
  assert.ok(html.includes(locale==='fr'?'Planning':'Scheduling'));
  assert.ok(html.includes(locale==='fr'?'Démonstration':'Demo'));
 }
});
