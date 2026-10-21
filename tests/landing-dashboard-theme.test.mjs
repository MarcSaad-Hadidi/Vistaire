import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { createLaptopModel } from '../components/immersive/LaptopModel.js';

function harness(t, initialTheme = 'light') {
  let theme = initialTheme;
  const events = new EventTarget();
  const oldDocument=globalThis.document, oldWindow=globalThis.window;
  globalThis.document={ documentElement: { getAttribute: () => theme } };globalThis.window=events;
  t.after(()=>{if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;if(oldWindow===undefined)delete globalThis.window;else globalThis.window=oldWindow;});
  t.mock.method(globalThis, 'fetch', () => new Promise(() => {}));
  const requests = [];
  t.mock.method(THREE.TextureLoader.prototype, 'load', (url, onLoad) => { requests.push({url, onLoad}); return new THREE.Texture(); });
  const canvas = {dataset:{}};
  let invalidations = 0;
  const asset = createLaptopModel({canvas, onInvalidate:()=>invalidations++});
  t.after(()=>asset.dispose());
  const change = value => {theme=value;events.dispatchEvent(new Event('vistaire-public-theme-change'));};
  const complete = index => {const texture=new THREE.Texture({width:1160,height:725});requests[index].onLoad(texture);return texture;};
  return {asset,requests,canvas,change,complete,get invalidations(){return invalidations;}};
}

test('the laptop loads only the selected current dashboard theme on demand and reuses both captures', t => {
  const h=harness(t);
  h.change('dark');h.change('light');
  assert.equal(h.requests.length,0,'theme changes cannot eagerly load the laptop screen');
  h.asset.load();assert.match(h.requests[0].url,/dashboard-light\.webp$/);
  h.change('dark');assert.equal(h.requests.length,2);
  h.complete(0);assert.notEqual(h.canvas.dataset.laptopDashboardTheme,'light','late light response cannot replace current dark selection');
  h.complete(1);assert.equal(h.canvas.dataset.laptopDashboardTheme,'dark');
  h.change('light');assert.equal(h.requests.length,2,'returning to a loaded theme reuses its texture');
  assert.equal(h.canvas.dataset.laptopDashboardTheme,'light');
  h.asset.dispose();h.change('dark');assert.equal(h.requests.length,2,'teardown removes subscription');
});

test('late dashboard texture completion after disposal is discarded',t=>{
  const h=harness(t);h.asset.load();h.asset.dispose();
  const texture=new THREE.Texture({width:1160,height:725});let disposed=0;texture.addEventListener('dispose',()=>disposed++);
  h.requests[0].onLoad(texture);assert.equal(disposed,1);assert.equal(h.canvas.dataset.laptopDashboardTheme,undefined);
});

test('new closing panels and current dashboard stills follow the light site theme',()=>{
  const css=readFileSync('components/immersive/pricing.css','utf8');
  const light=css.split('/* Light on-photo surfaces follow the site theme. */')[1];assert.ok(light);
  assert.match(light,/--public-text: #28251f/);assert.match(light,/--pricing-panel: #fffcf5f2/);
  const pricing=readFileSync('components/immersive/Pricing.jsx','utf8');
  assert.match(pricing,/subscribePricingTheme/);assert.match(pricing,/dashboard-light\.webp/);
  assert.doesNotMatch(pricing,/images\/demo-walkthrough\/dashboard-studio\.webp/);
});
