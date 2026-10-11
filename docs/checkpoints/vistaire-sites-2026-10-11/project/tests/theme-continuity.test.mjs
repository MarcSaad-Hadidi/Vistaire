import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import postcss from 'postcss';
import * as THREE from 'three';
import { pricingFixture } from './helpers/pricing-hand-fixture.mjs';
import { createPricingPhonePresenter, pricingExitOffset } from '../src/PricingPhonePresenter.js';
import { pricingScrollLayout, pricingScreenScroll } from '../src/PricingPhoneLayout.js';
import { arrangePresentationTable } from '../src/TablePresentationLayout.js';

// This is a scene-graph/state check, not a browser screenshot or a GPU FPS test.
test('the fair hand, phone HTML and external link visibility agree for every entry/read/exit sample in both directions', async t => {
  const f=await pricingFixture({grip:'fair',background:true});
  const layer={style:{},dataset:{},parentElement:{style:{}},setAttribute(){}};
  const aside={style:{},setAttribute(){}};
  const screen={style:{}},viewport={scrollTop:0};
  const presenter=createPricingPhonePresenter(screen,viewport,layer,aside);
  const viewports=[[1897,865],[1440,900],[1024,768],[768,1024],[393,747],[390,844],[320,600],[844,390]];
  let samples=0;
  try {
    for(const[w,h]of viewports){
      const layout=pricingScrollLayout(h,1400,530,0.8);
      const stages=Array.from({length:101},(_,i)=>({progress:i/100,top:0,page:7000+i/100*layout.entry}));
      for(let i=0;i<=100;i++)stages.push({progress:1,top:0,page:7000+layout.readingStart+layout.reading*i/100});
      for(let i=0;i<=100;i++)stages.push({progress:1,top:pricingExitOffset(-h*i/100,h),page:7000+layout.travel+h*i/100});
      for(const sample of [...stages,...stages.toReversed()]){
        f.pricing.render(f.offer,sample.progress,w,h,{top:sample.top,canvasHeight:h});
        const p=f.pricing.screenProjection(w,h);
        presenter.project(p,sample.top);
        presenter.scroll(sample.page,7000,layout);
        const visible=sample.top<h;
        presenter.show(visible,true);presenter.copy(visible,sample.progress,sample.top,h);
        const alpha=Number(aside.style.opacity);
        assert.equal(aside.inert,alpha<=0.5);
        assert.equal(aside.style.visibility,alpha>0?'visible':'hidden');
        assert.equal(layer.inert,!visible);
        assert.equal(viewport.scrollTop,pricingScreenScroll(7000-sample.page,layout));
        const matrix=screen.style.transform.match(/matrix\((.*)\)/)[1].split(',').map(Number);
        assert.ok(matrix.every(Number.isFinite));
        assert.ok(Math.abs(matrix[5]-(p.matrix[5]+sample.top))<1e-9);
        const {scene,camera}=f.captures.at(-1),mesh=scene.getObjectByName('Object_18');
        const b=mesh.geometry.boundingBox;
        const point=new THREE.Vector3((b.min.x+b.max.x)/2,(b.min.y+b.max.y)/2,(b.min.z+b.max.z)/2).applyMatrix4(mesh.matrixWorld).project(camera);
        const htmlX=matrix[0]*p.width/2+matrix[2]*p.height/2+matrix[4];
        const htmlY=matrix[1]*p.width/2+matrix[3]*p.height/2+matrix[5];
        assert.ok(Math.abs(htmlX-(point.x+1)*w/2)<0.01);
        assert.ok(Math.abs(htmlY-(1-point.y)*h/2)<0.01);
        samples++;
      }
    }
  } finally {f.close()}
  t.diagnostic(`${samples} numerical presentation samples, forward and reverse, across ${viewports.length} desktop/mobile sizes. No browser pixels rendered.`);
});

test('the light scene shade has valid explicit pseudo-element selectors before and during pricing',async()=>{
  const css=postcss.parse(await fs.readFile('src/styles.css','utf8'));
  const themes=new Set();
  css.walkRules(rule=>{
    // Pseudo-elements inside a forgiving functional list are not matching
    // selectors. This was why the shade changed only at pricing entry.
    assert.doesNotMatch(rule.selector,/:is\([^)]*::/);
    if(rule.selector.includes('html[data-vistaire-theme="light"]')&&rule.nodes.some(n=>n.prop==='background'&&n.value==='transparent'))
      for(const pseudo of ['.world::after','.world::before']) if(rule.selector.includes(pseudo)) themes.add(pseudo);
  });
  assert.deepEqual([...themes].sort(),['.world::after','.world::before']);
  const pricing=postcss.parse(await fs.readFile('src/pricing.css','utf8'));
  let continuous=false;
  pricing.walkRules(rule=>{if(rule.selector.includes('.world[data-pricing-active="true"]::after')&&rule.nodes.some(n=>n.prop==='background'&&n.value==='transparent'))continuous=true});
  assert.ok(continuous);
  // The readable actions cannot inherit the transparent gold text of an em.
  for(const selector of ['.pricing-aside-layer .pricing-cta','.action, .action-dark']){
    const rules=[];css.walkRules(rule=>{if(rule.selector.includes('html[data-vistaire-theme="light"]')&&rule.selector.includes(selector))rules.push(rule)});
    assert.ok(rules.length);
    for(const rule of rules){
      assert.ok(rule.nodes.some(n=>n.prop==='color'&&n.value==='#050505'));
      assert.ok(rule.nodes.some(n=>n.prop==='background'&&['#ffc300','#ffd60a'].includes(n.value)));
    }
  }
});

test('the empty decorative setting never returns when subjects move, switch or leave the table',async()=>{
  const decorations=()=>new THREE.Group();
  const table={accessories:{lamp:decorations(),glass:decorations(),placeSetting:decorations()}};
  const update=arrangePresentationTable(table);
  for(let i=0;i<101;i++){
    const subject=new THREE.Group();subject.visible=i%2===0;
    subject.position.set(i/10,0,-i/10);
    update(i%3===0?[]:[subject]);
    for(const prop of Object.values(table.accessories))assert.equal(prop.visible,false);
  }
  const source=await fs.readFile('src/RestaurantTable.js','utf8');
  assert.match(source,/\["table", "chair", "placeSetting"\]\.includes\(recipe.id\)/);
});
