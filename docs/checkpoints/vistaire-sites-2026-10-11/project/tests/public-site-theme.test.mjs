import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { build } from 'esbuild';
import React from 'react';
import { renderToPipeableStream } from 'react-dom/server';
import { PassThrough } from 'node:stream';
import { act, create } from 'react-test-renderer';
import postcss from 'postcss';

const cache = path.resolve('node_modules/.cache/public-site-theme-test.mjs');
await build({stdin:{contents:`export {default as PublicPageRouter,publicPagePaths} from './src/pages/PublicPageRouter.jsx'; export {App} from './src/App.jsx'; export {LandingLocaleProvider} from './src/locale.jsx'; export {PreviewNav} from './src/pages/source/components/vistaire-preview/PublicSiteNavigation.tsx'; export {PublicControls} from './src/pages/source/components/vistaire-preview/PublicControls.tsx'; export {RestaurateurDashboardDemo} from './src/pages/source/components/vistaire-preview/RestaurateurDashboardDemo.tsx'; export * from './src/pages/source/lib/publicTheme.ts';`,resolveDir:process.cwd(),loader:'jsx'},outfile:cache,bundle:true,platform:'node',format:'esm',packages:'external',jsx:'automatic',alias:{'@':path.resolve('src/pages/source'),'next/link':path.resolve('src/pages/NativeLink.tsx'),'next/image':path.resolve('src/pages/NativeImage.tsx'),'next/navigation':path.resolve('src/pages/NativeNavigation.ts')},plugins:[{name:'css-for-node',setup(b){b.onResolve({filter:/\.css$/},args=>({path:args.path,namespace:'css-stub'}));b.onLoad({filter:/.*/,namespace:'css-stub'},()=>({contents:'export default new Proxy({}, {get: (_, key) => key});',loader:'js'}));}}],logLevel:'error'});
const ui = await import(cache);

test('every public page shares one site navigation with theme and bilingual page links', async t => {
  const paths = ['/', ...ui.publicPagePaths];
  for (const pathname of paths) {
    const locale = pathname.startsWith('/en') ? 'en' : 'fr';
    const element = (pathname === '/' || pathname === '/en'
      ? React.createElement(ui.App,{locale})
      : React.createElement(ui.PublicPageRouter,{pathname}));
    const html=await new Promise((resolve,reject)=>{
      const output=new PassThrough(),chunks=[];
      output.on('data',chunk=>chunks.push(chunk));
      output.on('end',()=>resolve(Buffer.concat(chunks).toString()));
      output.on('error',reject);
      const render=renderToPipeableStream(element,{onAllReady(){render.pipe(output)},onError(error){reject(error);render.abort()}});
    });
    assert.equal((html.match(/data-public-navigation/g) ?? []).length,1,pathname);
    assert.equal((html.match(/data-public-theme-toggle/g) ?? []).length,1,pathname);
    for(const [,src] of html.matchAll(/<img[^>]+src="([^"]+)"/g)) if(src.startsWith('/assets/')) await fs.access(path.join('public',src.split('?')[0]));
    const nav = html.match(/<nav[^>]*data-public-navigation[\s\S]*?<\/nav>/)?.[0];
    assert.ok(nav,pathname);
    const hrefs = [...nav.matchAll(/href="([^"]+)"/g)].map(m=>m[1]);
    assert.ok(hrefs.every(href=>href.startsWith('/') && !href.includes('#')),pathname);
    assert.ok(hrefs.every(href=>paths.includes(href)),pathname);
    for (const target of locale === 'fr' ? ['/','/demo','/tarifs-menu-digital-restaurant','/a-propos','/contact','/prendre-rendez-vous','/apercu-restaurateur'] : ['/en','/en/vistaire-menu','/en/pricing-digital-restaurant-menu','/en/about','/en/contact','/en/book-a-call','/en/restaurant-preview']) assert.ok(hrefs.includes(target), `${pathname}: ${target}`);
  }
  t.diagnostic(`${paths.length} public routes checked in both languages, including local image assets.`);
});

test('a saved light theme is restored before content paints, including blocked storage', async () => {
  const html = await fs.readFile('index.html','utf8');
  const script = html.match(/<head><script>([\s\S]*?)<\/script>/)?.[1];
  assert.equal(script,ui.PUBLIC_THEME_BOOTSTRAP);
  for (const saved of ['light','dark',null]) {
    let theme;
    vm.runInNewContext(script,{localStorage:{getItem:()=>saved},document:{documentElement:{setAttribute:(_,value)=>theme=value}}});
    assert.equal(theme,saved === 'light'?'light':'dark');
  }
  let theme;
  vm.runInNewContext(script,{localStorage:{getItem(){throw Error('denied')}},document:{documentElement:{setAttribute:(_,value)=>theme=value}}});
  assert.equal(theme,'dark');
});

test('marketing page colors inherit the common theme, keeping photographic/PDF colors intentional',async()=>{
  const root='src/pages/source/components';
  const files = (await Promise.all(['vistaire-preview','guides','seo'].map(async dir=>(await fs.readdir(`${root}/${dir}`)).filter(x=>x.endsWith('.css')).map(x=>`${root}/${dir}/${x}`)))).flat();
  for (const file of files) {
    if (file.endsWith('VistairePreviewPdfCompareSlider.module.css')) continue; // Restaurant and paper comparison designs.
    const css=postcss.parse(await fs.readFile(file,'utf8'));
    css.walkDecls(decl=>{
      const value=decl.value.replace(/var\([^()]*\)/g,'');
      if (decl.parent.selector?.startsWith('.heroPhoto figcaption')) return; // Text above a fixed dark photographic shade.
      assert.doesNotMatch(value,/#(?:f8f3e8|cec8bd|b9b6ae|111110|282825|ffc300|ffd60a|050505)\b/i,`${file}: ${decl.parent.selector} ${decl.prop}`);
    });
  }
  const css=await fs.readFile('src/pages/public-pages.css','utf8');
  assert.doesNotMatch(css,/--public-text:|--public-black:/);
  assert.match(css,/color: var\(--public-on-accent\) !important/);
});

function environment() {
  const attributes = new Map([['data-vistaire-theme','dark']]);
  const values = new Map();
  globalThis.window = Object.assign(new EventTarget(),{location:{origin:'https://vistaire.test',search:''}});
  globalThis.document = Object.assign(new EventTarget(),{documentElement:{getAttribute:key=>attributes.get(key),setAttribute:(key,value)=>attributes.set(key,value)},body:{style:{overflow:''}},activeElement:null});
  globalThis.localStorage = {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
  globalThis.IS_REACT_ACT_ENVIRONMENT=true;
  return ()=>{delete globalThis.window;delete globalThis.document;delete globalThis.localStorage;delete globalThis.IS_REACT_ACT_ENVIRONMENT;};
}

test('the shared controls switch both ways, persist the theme and sync other tabs',async()=>{
  const cleanup=environment();let component;
  try {
    await act(()=>{component=create(React.createElement(ui.PublicControls,{locale:'fr',languages:[{label:'FR',href:'/',active:true},{label:'EN',href:'/en',active:false}]}));});
    const toggle=()=>component.root.findByProps({'data-public-theme-toggle':true});
    assert.equal(toggle().props['aria-pressed'],false);
    await act(()=>toggle().props.onClick());
    assert.equal(toggle().props['aria-pressed'],true);
    assert.equal(localStorage.getItem(ui.PUBLIC_THEME_KEY),'light');
    assert.match(toggle().props['aria-label'],/sombre/);
    await act(()=>toggle().props.onClick());
    assert.equal(toggle().props['aria-pressed'],false);
    const event=Object.assign(new Event('storage'),{key:ui.PUBLIC_THEME_KEY,newValue:'light'});
    await act(()=>window.dispatchEvent(event));
    assert.equal(toggle().props['aria-pressed'],true);
    window.location.search='?source=landing';
    const anchor={href:''};component.root.findAllByType('a')[1].props.onClick({currentTarget:anchor});
    assert.equal(anchor.href,'https://vistaire.test/en?source=landing');
  } finally {if(component)await act(()=>component.unmount());cleanup();}
});

test('the common menu opens, pauses page scrolling and closes with Escape',async()=>{
  const cleanup=environment();let component;const reported=[];
  const focus={focus(){document.activeElement=this},getClientRects:()=>[{}]};
  document.activeElement=focus;
  try {
    await act(()=>{component=create(React.createElement(ui.PreviewNav,{locale:'fr',currentPath:'/',onMenuChange:value=>reported.push(value)}),{createNodeMock:el=>el.type==='details'?{querySelector:()=>focus}:el.props['data-public-navigation']?{querySelectorAll:()=>[focus],contains:()=>false}:null});});
    await act(()=>component.root.findByType('details').props.onToggle({currentTarget:{open:true}}));
    assert.equal(component.root.findByType('details').props.open,true);
    assert.equal(document.body.style.overflow,'hidden');
    await act(()=>window.dispatchEvent(Object.assign(new Event('keydown'),{key:'Escape'})));
    assert.equal(component.root.findByType('details').props.open,false);
    assert.equal(document.body.style.overflow,'');
    assert.deepEqual(reported,[true,false]);
    await act(()=>component.root.findByType('details').props.onToggle({currentTarget:{open:true}}));
    const panel=component.root.findByProps({className:'mobilePanel'});
    const links=panel.findAllByType('a');
    assert.equal(links[0].props.href,'/');
    assert.equal(links[2].props.href,'/tarifs-menu-digital-restaurant');
    assert.equal(links.at(-1).props.href,'/prendre-rendez-vous');
    assert.equal(panel.findAllByType('small').length,5);
    await act(()=>panel.props.onClick());
    assert.equal(component.root.findByType('details').props.open,false);
    assert.equal(document.body.style.overflow,'');
  } finally {if(component)await act(()=>component.unmount());cleanup();}
});

test('Studio navigation, period selector and theme follow the actual public preview state',async()=>{
  const cleanup=environment();let component;
  window.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
  try{
    await act(()=>{component=create(React.createElement(ui.RestaurateurDashboardDemo,{locale:'fr'}));});
    const nav=()=>component.root.findByType('nav').findAllByType('button');
    assert.equal(nav()[0].props['aria-current'],'page');
    await act(()=>nav()[3].props.onClick());
    assert.equal(nav()[3].props['aria-current'],'page');
    await act(()=>nav()[2].props.onClick());
    assert.equal(nav()[2].props['aria-current'],'page');
    await act(()=>nav()[1].props.onClick());
    assert.equal(nav()[1].props['aria-current'],'page');
    await act(()=>nav()[0].props.onClick());
    const period=()=>component.root.findAllByType('select').find(x=>x.props.value==='today-utc'||x.props.value==='7d'||x.props.value==='30d');
    await act(()=>period().props.onChange({target:{value:'30d'}}));
    assert.equal(period().props.value,'30d');
    const studio=()=>component.root.findByProps({'data-admin-studio':true});
    assert.equal(studio().props['data-theme'],'dark');
    await act(()=>component.root.findByProps({'aria-label':'Passer au thème clair'}).props.onClick());
    assert.equal(studio().props['data-theme'],'light');
    assert.equal(localStorage.getItem(ui.PUBLIC_THEME_KEY),'light');
  }finally{if(component)await act(()=>component.unmount());cleanup();}
});
