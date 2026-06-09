import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const routePath = "app/vistaire-preview/menu-qr-code-restaurant/page.tsx";
const componentPath =
  "components/vistaire-preview/VistaireMenuQrCodeRestaurantPreview.tsx";
const cssPath =
  "components/vistaire-preview/VistaireMenuDigitalRestaurantPreview.module.css";
const chromeComponentPath =
  "components/vistaire-preview/VistairePreviewChrome.tsx";

async function readText(path) {
  return readFile(path, "utf8");
}

function literalPattern(value) {
  return new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
}

test("menu QR code restaurant preview has a distinct glass SEO page", async () => {
  const [route, component, css, chromeComponent] = await Promise.all([
    readText(routePath),
    readText(componentPath),
    readText(cssPath),
    readText(chromeComponentPath)
  ]);
  const source = `${route}\n${component}\n${chromeComponent}`;

  for (const requiredCopy of [
    "Vistaire preview | Menu QR code restaurant",
    "Menu QR code restaurant : le scan doit ouvrir une expérience",
    "Le QR code n'est qu'une porte d'entrée",
    "Du scan à la décision",
    "Le scan doit mener à quelque chose de désirable",
    "QR code seul ou QR code Vistaire",
    "Votre QR code mérite mieux qu'un PDF",
    "Voir la carte",
    "Prendre rendez-vous",
    "/vistaire-preview/demo",
    "/vistaire-preview/menu-digital-restaurant",
    "/vistaire-preview/pdf-vs-menu-digital",
    "/vistaire-preview/contact",
    "routes.appointment"
  ]) {
    assert.match(source, literalPattern(requiredCopy));
  }

  assert.match(route, /index:\s*false/);
  assert.match(route, /follow:\s*false/);
  assert.match(route, /canonical:\s*"\/vistaire-preview\/menu-qr-code-restaurant"/);
  assert.match(component, /<PreviewNav[\s\S]*activeSection="home"[\s\S]*locale=\{locale\}[\s\S]*routeMode=\{routeMode\}/);
  assert.match(component, /<PreviewFooter[\s\S]*locale=\{locale\}[\s\S]*routeMode=\{routeMode\}[\s\S]*width="wide"[\s\S]*\/>/);
  assert.match(component, /PhotoRestoComplet6\.png/);
  assert.match(component, /PhotoQRcode1\.png/);
  assert.match(component, /PhotoQRcode2\.png/);
  assert.match(component, /src=\{photoQrCode1\}/);
  assert.match(component, /src=\{photoQrCode2\}/);
  assert.match(component, /className=\{styles\.backgroundImage\}/);
  assert.match(component, /styles\.qrHeroPanel/);
  assert.match(component, /styles\.qrHeroVisual/);
  assert.match(component, /styles\.qrScanPanel/);
  assert.match(component, /styles\.qrJourneyPanel/);
  assert.match(component, /styles\.qrExperiencePanel/);
  assert.match(component, /styles\.qrComparisonPanel/);
  assert.match(component, /import QRCode from "qrcode"/);
  assert.match(component, /QRCode\.toString/);
  assert.match(component, /errorCorrectionLevel:\s*"H"/);
  assert.match(component, /dangerouslySetInnerHTML=\{\{\s*__html:\s*qrSvgMarkup\s*\}\}/);
  assert.doesNotMatch(component, /qrCells/);
  assert.doesNotMatch(component, /Array\.from\(\{\s*length:\s*49\s*\}/);
  assert.doesNotMatch(component, /Table 12/);
  assert.doesNotMatch(component, /<small>\{qrTargetUrl\}<\/small>/);
  assert.match(css, /\.previewFrame[\s\S]*background:\s*transparent/);
  assert.match(css, /\.previewFrame[\s\S]*backdrop-filter:\s*blur\(9px\) saturate\(112%\)/);
  assert.match(css, /\.card[\s\S]*background:\s*transparent/);
  assert.match(css, /\.card[\s\S]*backdrop-filter:\s*blur\(5px\) saturate\(110%\)/);
  assert.match(css, /\.qrCodeMark[\s\S]*background:\s*#fff7ea/);
  assert.match(css, /\.qrCodeMark svg[\s\S]*width:\s*100%/);
  assert.match(css, /\.qrHeroPanel[\s\S]*grid-template-columns:\s*minmax\(0, 0\.48fr\) minmax\(360px, 0\.52fr\)/);
  assert.match(css, /\.qrHeroVisual[\s\S]*aspect-ratio:\s*16 \/ 9/);
  assert.match(css, /\.qrHeroVisual \.visualImage[\s\S]*object-fit:\s*contain/);
  assert.match(css, /\.qrScanPanel[\s\S]*grid-template-columns:\s*minmax\(220px, 0\.32fr\) minmax\(0, 0\.68fr\)/);
  assert.match(css, /\.qrExperiencePanel[\s\S]*grid-template-columns:\s*minmax\(0, 0\.58fr\) minmax\(280px, 0\.42fr\)/);
  assert.match(css, /\.qrJourneyList[\s\S]*grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.qrComparisonGrid[\s\S]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 920px\)[\s\S]*\.qrHeroPanel,[\s\S]*\.qrScanPanel,[\s\S]*\.qrExperiencePanel,[\s\S]*\.qrComparisonGrid[\s\S]*grid-template-columns:\s*1fr/);
  assert.match(
    chromeComponent,
    /\{\s*label:\s*"Menu QR code restaurant",\s*href:\s*"\/vistaire-preview\/menu-qr-code-restaurant"\s*\}/
  );
  assert.match(component, /next\/image/);
  assert.match(component, /<Image\b/);
  assert.doesNotMatch(source, /PhotoDigital2|PhotoDigital3|photoDigital2|photoDigital3/);
  assert.doesNotMatch(source, /Demander une d[?e]mo|Demander une d&eacute;mo/);
  assert.doesNotMatch(component, /VistairePdfToDigitalHoverReveal/);
});
