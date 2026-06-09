import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const routePath = "app/vistaire-preview/menu-digital-restaurant/page.tsx";
const pageComponentPath =
  "components/vistaire-preview/VistaireMenuDigitalRestaurantPreview.tsx";
const pageCssPath =
  "components/vistaire-preview/VistaireMenuDigitalRestaurantPreview.module.css";
const revealComponentPath =
  "components/vistaire-preview/VistairePdfToDigitalHoverReveal.tsx";
const revealCssPath =
  "components/vistaire-preview/VistairePdfToDigitalHoverReveal.module.css";
const chromeComponentPath =
  "components/vistaire-preview/VistairePreviewChrome.tsx";
const chromeCssPath =
  "components/vistaire-preview/VistairePreviewChrome.module.css";

async function readText(path) {
  return readFile(path, "utf8");
}

function literalPattern(value) {
  return new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
}

test("menu digital restaurant preview route stays noindex and uses the preview visual system", async () => {
  const [route, component, css, revealComponent] = await Promise.all([
    readText(routePath),
    readText(pageComponentPath),
    readText(pageCssPath),
    readText(revealComponentPath)
  ]);
  const source = `${route}\n${component}\n${revealComponent}`;

  for (const requiredCopy of [
    "Vistaire preview | Menu digital restaurant",
    "Menu digital restaurant : une carte premium pensée pour le mobile",
    "Pourquoi un menu PDF ne suffit plus",
    "Du menu PDF à l'expérience Vistaire",
    "PDF, menu digital standard ou Vistaire",
    "Carte mobile en situation",
    "Une carte pensée pour la table",
    "Pensé pour les restaurants haut de gamme",
    "Votre carte mérite mieux qu'un PDF",
    "Voir la carte",
    "Prendre rendez-vous",
    "/vistaire-preview/demo",
    "/vistaire-preview/pdf-vs-menu-digital",
    "/vistaire-preview/contact",
    "routes.appointment"
  ]) {
    assert.match(source, literalPattern(requiredCopy));
  }

  assert.match(route, /index:\s*false/);
  assert.match(route, /follow:\s*false/);
  assert.match(route, /canonical:\s*"\/vistaire-preview\/menu-digital-restaurant"/);
  assert.match(component, /className=\{styles\.previewFrame\}/);
  assert.match(component, /styles\.heroCopy/);
  assert.match(component, /aria-label=\{pageTitle\}/);
  assert.match(component, /const pageTitle =\s*h1 \?\? copy\.defaultTitle/);
  assert.match(
    component,
    /defaultTitle:\s*[\s\S]*"Menu digital restaurant : une carte premium pensée pour le mobile"/
  );
  assert.match(component, /\{pageTitle\}/);
  assert.match(component, /styles\.revealCard/);
  assert.match(component, /styles\.comparisonCard/);
  assert.match(component, /styles\.mobileProofCard/);
  assert.match(component, /styles\.heroVisual/);
  assert.match(component, /styles\.premiumVisual/);
  assert.match(component, /<PreviewNav[\s\S]*activeSection="home"[\s\S]*locale=\{locale\}[\s\S]*routeMode=\{routeMode\}/);
  assert.match(component, /<PreviewFooter[\s\S]*locale=\{locale\}[\s\S]*routeMode=\{routeMode\}[\s\S]*width="wide"[\s\S]*\/>/);
  assert.match(css, /\.previewFrame[\s\S]*width:\s*min\(1520px, calc\(100vw - 48px\)\)/);
  assert.match(css, /\.previewFrame[\s\S]*background:\s*transparent/);
  assert.match(css, /\.previewFrame[\s\S]*backdrop-filter:\s*blur\(9px\) saturate\(112%\)/);
  assert.match(css, /\.card[\s\S]*background:\s*transparent/);
  assert.match(css, /\.card[\s\S]*backdrop-filter:\s*blur\(5px\) saturate\(110%\)/);
  assert.doesNotMatch(css, /(?:\.card|\.badge|\.primaryButton|\.benefitItem)[\s\S]*backdrop-filter:\s*blur\((?:[6-9]|[1-9][0-9])px/);
  assert.doesNotMatch(css, /\.card\s*\{[\s\S]*radial-gradient/);
  assert.doesNotMatch(css, /\.card\s*\{[\s\S]*rgba\(13, 8, 4, 0\.48\)/);
  assert.match(css, /\.heroCopy[\s\S]*grid-column:\s*1 \/ -1/);
  assert.match(css, /\.problemCard[\s\S]*grid-column:\s*1 \/ -1/);
  assert.match(css, /\.revealCard[\s\S]*grid-column:\s*1 \/ -1/);
  assert.match(component, /buildPdfComparePreviewData/);
  assert.match(component, /getAllDishes\(locale\)\.map\(\(dish\) => dish\.slug\)/);
  assert.match(component, /activeCategorySlug:\s*"tous"/);
  assert.match(component, /className=\{styles\.desktopInstruction\}/);
  assert.match(component, /className=\{styles\.mobileInstruction\}/);
  assert.match(css, /\.mobileInstruction[\s\S]*display:\s*none/);
  assert.match(css, /@media \(hover: none\), \(pointer: coarse\), \(max-width: 640px\)[\s\S]*\.desktopInstruction[\s\S]*display:\s*none/);
  assert.match(component, /VistairePdfToDigitalHoverReveal/);
  assert.match(component, /PhotoRestoComplet5\.png/);
  assert.match(component, /PageDigital\.png/);
  assert.match(component, /PhotoDigital2\.png/);
  assert.match(component, /PhotoDigital3\.png/);
  assert.match(component, /src=\{pageDigitalPhoto\}/);
  assert.match(component, /src=\{photoDigital2\}/);
  assert.match(component, /src=\{photoDigital3\}/);
  assert.match(css, /\.heroCopy[\s\S]*grid-template-columns:\s*minmax\(360px, 0\.34fr\) minmax\(0, 0\.66fr\)/);
  assert.match(css, /\.heroVisual[\s\S]*grid-column:\s*1/);
  assert.match(css, /\.heroVisual[\s\S]*aspect-ratio:\s*4 \/ 3/);
  assert.match(css, /\.premiumVisual[\s\S]*aspect-ratio:\s*4 \/ 3/);
  assert.match(css, /\.mobileProofCard \.visualFigure[\s\S]*aspect-ratio:\s*4 \/ 3/);
  assert.match(css, /\.heroVisual \.visualImage,[\s\S]*\.mobileProofCard \.visualImage,[\s\S]*\.premiumVisual \.visualImage[\s\S]*object-fit:\s*contain/);
  assert.match(css, /\.mobileProofCard[\s\S]*grid-template-columns:\s*minmax\(0, 0\.66fr\) minmax\(280px, 0\.34fr\)/);
  assert.match(css, /\.premiumPanel[\s\S]*grid-template-columns:\s*minmax\(0, 0\.62fr\) minmax\(270px, 0\.38fr\)/);
  assert.match(css, /\.visualFigure[\s\S]*background:\s*transparent/);
  assert.match(css, /\.visualImage[\s\S]*object-fit:\s*cover/);
  assert.match(css, /@media \(max-width: 920px\)[\s\S]*\.mobileProofCard,[\s\S]*\.premiumPanel[\s\S]*grid-template-columns:\s*1fr/);
  assert.doesNotMatch(component, /styles\.arProofCard/);
  assert.doesNotMatch(source, /Demander une d[ée]mo|Demander une d&eacute;mo/);
  assert.doesNotMatch(source, /Cinematic Menu Bloom|CinematicMenuBloom/);
  assert.doesNotMatch(css, /linear-gradient\(180deg,\s*rgba\(5,\s*3,\s*2,\s*0\.7\)/);
});

test("PDF to Vistaire preview reveal uses hover mask, keyboard focus, finger hover and reduced motion", async () => {
  const [component, css] = await Promise.all([
    readText(revealComponentPath),
    readText(revealCssPath)
  ]);

  assert.match(component, /^"use client";/);
  assert.match(component, /data-preview-interaction="pdf-to-vistaire-hover-reveal"/);
  assert.match(component, /role="button"/);
  assert.match(component, /aria-pressed=\{revealed \|\| fingerActive\}/);
  assert.match(component, /const onPointerMove = \(event: PointerEvent<HTMLDivElement>\)/);
  assert.match(component, /onPointerMove=\{onPointerMove\}/);
  const pointerMoveHandler = component.match(
    /const onPointerMove = \(event: PointerEvent<HTMLDivElement>\) => \{[\s\S]*?\n  \};/
  );
  assert.ok(pointerMoveHandler, "pointer move handler should stay explicit");
  assert.doesNotMatch(
    pointerMoveHandler[0],
    /setFingerActive/,
    "touch movement should update CSS variables without scheduling React state"
  );
  assert.match(component, /onKeyDown=\{onKeyDown\}/);
  assert.match(component, /data-touching=\{fingerActive \? "true" : "false"\}/);
  assert.match(component, /onPointerDown=\{onPointerDown\}/);
  assert.match(component, /onPointerCancel=\{onPointerCancel\}/);
  assert.match(component, /onPointerLeave=\{onPointerLeave\}/);
  assert.doesNotMatch(
    component,
    /\.setPointerCapture\(/,
    "touch reveal should keep the gesture scoped without pointer capture"
  );
  assert.match(component, /VistairePreviewMenuLayer/);
  assert.match(component, /VistairePreviewPdfLayer/);
  assert.match(component, /VistairePreviewPdfCompareSlider\.module\.css/);
  assert.match(css, /clip-path:\s*circle\(0% at var\(--reveal-x\) var\(--reveal-y\)\)/);
  assert.match(css, /\.frame:hover \.vistaireLayer/);
  assert.match(css, /\.frame:focus-visible \.vistaireLayer/);
  assert.match(css, /\.frame\[data-touching="true"\] \.vistaireLayer/);
  assert.match(css, /@media \(hover: none\), \(pointer: coarse\), \(max-width: 640px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /touch-action:\s*none/);
  assert.match(css, /touch-action:\s*pinch-zoom/);
  assert.doesNotMatch(
    css,
    /touch-action:\s*pan-y/,
    "the reveal surface must not hand vertical drags to native page scroll"
  );
  assert.match(
    css,
    /\.frame\[data-touching="true"\] \.vistaireLayer\s*\{[\s\S]*transition:\s*none/,
    "the mobile reveal mask must not animate toward the finger while dragging"
  );
});

test("preview topbar is sharp glass without asymmetric color halos", async () => {
  const [component, css] = await Promise.all([
    readText(chromeComponentPath),
    readText(chromeCssPath)
  ]);

  const previewNavBlock = css.match(/\.previewNav\s*\{[^}]*\}/)?.[0] ?? "";

  assert.match(component, /activeSection\?: PreviewNavSection/);
  assert.match(component, /Prendre rendez-vous/);
  assert.match(component, /href:\s*"\/vistaire-preview\/menu-digital-restaurant"/);
  assert.match(
    component,
    /\{\s*label:\s*"Menu QR code restaurant",\s*href:\s*"\/vistaire-preview\/menu-qr-code-restaurant"\s*\}/
  );
  assert.doesNotMatch(component, /href:\s*"\/menu-digital-restaurant"/);
  assert.doesNotMatch(component, /href:\s*"\/menu-qr-code-restaurant"/);
  assert.match(previewNavBlock, /border-radius:\s*999px/);
  assert.match(previewNavBlock, /background:\s*transparent/);
  assert.match(previewNavBlock, /backdrop-filter:\s*blur\(5px\) saturate\(110%\)/);
  assert.doesNotMatch(previewNavBlock, /radial-gradient/);
  assert.doesNotMatch(previewNavBlock, /linear-gradient/);
  assert.doesNotMatch(previewNavBlock, /rgba\(255, 147, 40/);
  assert.doesNotMatch(previewNavBlock, /rgba\(255, 250, 240, 0\.045\)/);
  assert.doesNotMatch(previewNavBlock, /backdrop-filter:\s*blur\((?:[6-9]|[1-9][0-9])px/);
  assert.match(css, /\.navBrand[\s\S]*background:\s*transparent/);
  assert.match(css, /\.navLinks[\s\S]*background:\s*transparent/);
  assert.match(css, /\.previewFooter[\s\S]*background:\s*transparent/);
  assert.match(css, /\.previewFooter[\s\S]*backdrop-filter:\s*blur\(5px\) saturate\(110%\)/);
  assert.match(css, /\.navActive[\s\S]*rgba\(0, 0, 0, 0\.12\)/);
  assert.doesNotMatch(css, /rgba\(28, 17, 9, 0\.34\)/);
  assert.doesNotMatch(css, /\.navLinks[\s\S]*rgba\(5, 3, 2, 0\.24\)/);
});
