import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const landingRoutePath = "app/vistaire-preview/page.tsx";
const menuRoutePath = "app/vistaire-preview/demo/page.tsx";
const dishDetailRoutePath =
  "app/vistaire-preview/demo/dishes/[slug]/page.tsx";
const aboutRoutePath = "app/vistaire-preview/a-propos/page.tsx";
const contactRoutePath = "app/vistaire-preview/contact/page.tsx";
const rendezVousRoutePath =
  "app/vistaire-preview/prendre-rendez-vous/page.tsx";
const pdfVsDigitalPreviewRoutePath =
  "app/vistaire-preview/pdf-vs-menu-digital/page.tsx";
const menuDigitalPreviewRoutePath =
  "app/vistaire-preview/menu-digital-restaurant/page.tsx";
const menuQrCodePreviewRoutePath =
  "app/vistaire-preview/menu-qr-code-restaurant/page.tsx";
const videoRoutePath = "app/vistaire-preview/video/route.ts";
const globalCssPath = "app/globals.css";
const landingComponentPath =
  "components/vistaire-preview/VistairePreviewLanding.tsx";
const landingCssPath =
  "components/vistaire-preview/VistairePreviewLanding.module.css";
const menuComponentPath =
  "components/vistaire-preview/VistaireMenuPreview.tsx";
const menuCssPath =
  "components/vistaire-preview/VistaireMenuPreview.module.css";
const dishDetailComponentPath =
  "components/vistaire-preview/VistaireDishDetailPreview.tsx";
const dishDetailCssPath =
  "components/vistaire-preview/VistaireDishDetailPreview.module.css";
const aboutComponentPath =
  "components/vistaire-preview/VistaireAboutPreview.tsx";
const aboutCssPath =
  "components/vistaire-preview/VistaireAboutPreview.module.css";
const contactComponentPath =
  "components/vistaire-preview/VistaireContactPreview.tsx";
const contactFormComponentPath =
  "components/vistaire-preview/VistaireContactForm.tsx";
const contactCssPath =
  "components/vistaire-preview/VistaireContactPreview.module.css";
const rendezVousComponentPath =
  "components/vistaire-preview/VistaireRendezVousPreview.tsx";
const rendezVousCssPath =
  "components/vistaire-preview/VistaireRendezVousPreview.module.css";
const pdfVsDigitalPreviewComponentPath =
  "components/vistaire-preview/VistairePdfVsMenuDigitalPreview.tsx";
const pdfVsDigitalPreviewCssPath =
  "components/vistaire-preview/VistairePdfVsMenuDigitalPreview.module.css";
const pdfVsDigitalPreviewSliderPath =
  "components/vistaire-preview/VistairePreviewPdfCompareSlider.tsx";
const pdfVsDigitalPreviewSliderCssPath =
  "components/vistaire-preview/VistairePreviewPdfCompareSlider.module.css";
const menuDigitalPreviewComponentPath =
  "components/vistaire-preview/VistaireMenuDigitalRestaurantPreview.tsx";
const menuDigitalPreviewCssPath =
  "components/vistaire-preview/VistaireMenuDigitalRestaurantPreview.module.css";
const menuQrCodePreviewComponentPath =
  "components/vistaire-preview/VistaireMenuQrCodeRestaurantPreview.tsx";
const chromeComponentPath =
  "components/vistaire-preview/VistairePreviewChrome.tsx";
const chromeCssPath =
  "components/vistaire-preview/VistairePreviewChrome.module.css";
const seoMenuDigitalPagePath =
  "components/seo/pages/MenuDigitalRestaurantPage.tsx";
const seoMenu3dArPagePath =
  "components/seo/pages/Menu3dArRestaurantPage.tsx";
const seoDigitalScenePath = "components/seo/VistaireDigitalMenuScene.tsx";
const previewFontFiles = [
  "public/fonts/vistaire-preview/btsuave-regular.otf",
  "public/fonts/vistaire-preview/btsuave-medium.otf",
  "public/fonts/vistaire-preview/btsuave-bold.otf",
  "public/fonts/vistaire-preview/NeueMontreal-Light.otf",
  "public/fonts/vistaire-preview/NeueMontreal-Regular.otf",
  "public/fonts/vistaire-preview/NeueMontreal-Medium.otf",
  "public/fonts/vistaire-preview/NeueMontreal-Bold.otf"
];

async function readText(path) {
  return readFile(path, "utf8");
}

function literalPattern(value) {
  return new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
}

test("literalPattern escapes every regex metacharacter occurrence", () => {
  const pattern = literalPattern("{{dish}}.{{price}}?[x]");

  assert.match("{{dish}}.{{price}}?[x]", pattern);
  assert.doesNotMatch("{dish}.{{price}}?[x]", pattern);
});

test("production SEO preview pages keep canonical H1s and text depth visible", async () => {
  const [
    digitalRoute,
    qrRoute,
    arRoute,
    pdfRoute,
    appendix,
    digitalPreview,
    qrPreview,
    arPreview,
    pdfPreview
  ] = await Promise.all([
    readText("app/(seo)/menu-digital-restaurant/page.tsx"),
    readText("app/(seo)/menu-qr-code-restaurant/page.tsx"),
    readText("app/(seo)/menu-3d-ar-restaurant/page.tsx"),
    readText("app/(seo)/menu-pdf-vs-menu-digital/page.tsx"),
    readText("components/vistaire-preview/VistaireSeoProductionSections.tsx"),
    readText(menuDigitalPreviewComponentPath),
    readText(menuQrCodePreviewComponentPath),
    readText("components/vistaire-preview/VistaireMenu3dArRestaurantPreview.tsx"),
    readText(pdfVsDigitalPreviewComponentPath)
  ]);

  for (const route of [digitalRoute, qrRoute, arRoute, pdfRoute]) {
    assert.match(route, /h1=\{page\.h1\}/);
    assert.match(route, /buildSeoPillarJsonLd\(page\)/);
    assert.match(route, /VistaireSeoProductionSections page=\{page\}/);
  }

  assert.match(appendix, /page\.answer\.map/);
  assert.match(appendix, /page\.sections\.map/);
  assert.match(appendix, /section\.body\.map/);
  assert.match(appendix, /section\.points\.map/);
  assert.match(appendix, /SeoFaq faqs=\{page\.faq\}/);
  assert.match(appendix, /InternalSeoLinks currentSlug=\{page\.slug\}/);
  assert.match(appendix, /col-span-full/);
  assert.match(appendix, /bg-transparent/);
  assert.doesNotMatch(appendix, /PhotoRestoComplet5\.png/);
  assert.doesNotMatch(appendix, /guideBackground|<Image/);

  for (const component of [
    digitalPreview,
    qrPreview,
    arPreview,
    pdfPreview
  ]) {
    assert.match(component, /h1\?: string/);
    assert.match(component, /const pageTitle =\s*h1 \?\?/);
    const appendixIndex = component.lastIndexOf("{seoAppendix}");
    const frameIndex = component.indexOf("className={styles.previewFrame}");
    const footerIndex = component.indexOf("<PreviewFooter");

    assert.ok(
      appendixIndex > frameIndex,
      "SEO guide appendix should be rendered inside the preview frame"
    );
    assert.ok(
      appendixIndex < footerIndex,
      "SEO guide appendix should appear before the footer, not as a detached band"
    );
  }
});

test("vistaire preview routes stay noindex while production pages reuse the validated preview UI", async () => {
  const [
    home,
    landingRoute,
    menuRoute,
    dishDetailRoute,
    aboutRoute,
    contactRoute,
    rendezVousRoute,
    pdfVsDigitalPreviewRoute,
    menuDigitalPreviewRoute,
    menuQrCodePreviewRoute,
    landingComponent,
    menuComponent,
    dishDetailComponent,
    aboutComponent,
    contactComponent,
    rendezVousComponent,
    pdfVsDigitalPreviewComponent,
    menuDigitalPreviewComponent,
    menuQrCodePreviewComponent,
    chromeComponent
  ] = await Promise.all([
      readText("app/page.tsx"),
      readText(landingRoutePath),
      readText(menuRoutePath),
      readText(dishDetailRoutePath),
      readText(aboutRoutePath),
      readText(contactRoutePath),
      readText(rendezVousRoutePath),
      readText(pdfVsDigitalPreviewRoutePath),
      readText(menuDigitalPreviewRoutePath),
      readText(menuQrCodePreviewRoutePath),
      readText(landingComponentPath),
      readText(menuComponentPath),
      readText(dishDetailComponentPath),
      readText(aboutComponentPath),
      readText(contactComponentPath),
      readText(rendezVousComponentPath),
      readText(pdfVsDigitalPreviewComponentPath),
      readText(menuDigitalPreviewComponentPath),
      readText(menuQrCodePreviewComponentPath),
      readText(chromeComponentPath)
    ]);

  assert.match(home, /VistairePreviewLanding/);
  assert.match(home, /routeMode="production"/);
  assert.match(landingRoute, /VistairePreviewLanding/);
  assert.match(landingRoute, /index:\s*false/);
  assert.match(menuRoute, /VistaireMenuPreview/);
  assert.match(menuRoute, /canonical:\s*"\/vistaire-preview\/demo"/);
  assert.match(dishDetailRoute, /VistaireDishDetailPreview/);
  assert.match(
    dishDetailRoute,
    /canonical:\s*`\/vistaire-preview\/demo\/dishes\/\$\{dish\.slug\}`/
  );
  assert.match(dishDetailRoute, /notFound\(\)/);
  assert.match(aboutRoute, /VistaireAboutPreview/);
  assert.match(aboutRoute, /canonical:\s*"\/vistaire-preview\/a-propos"/);
  assert.match(contactRoute, /VistaireContactPreview/);
  assert.match(contactRoute, /canonical:\s*"\/vistaire-preview\/contact"/);
  assert.match(rendezVousRoute, /VistaireRendezVousPreview/);
  assert.match(
    rendezVousRoute,
    /canonical:\s*"\/vistaire-preview\/prendre-rendez-vous"/
  );
  assert.match(pdfVsDigitalPreviewRoute, /VistairePdfVsMenuDigitalPreview/);
  assert.match(pdfVsDigitalPreviewRoute, /index:\s*false/);
  assert.match(
    pdfVsDigitalPreviewRoute,
    /canonical:\s*"\/vistaire-preview\/pdf-vs-menu-digital"/
  );
  assert.match(menuDigitalPreviewRoute, /VistaireMenuDigitalRestaurantPreview/);
  assert.match(menuDigitalPreviewRoute, /index:\s*false/);
  assert.match(
    menuDigitalPreviewRoute,
    /canonical:\s*"\/vistaire-preview\/menu-digital-restaurant"/
  );
  assert.match(menuQrCodePreviewRoute, /VistaireMenuQrCodeRestaurantPreview/);
  assert.match(menuQrCodePreviewRoute, /index:\s*false/);
  assert.match(
    menuQrCodePreviewRoute,
    /canonical:\s*"\/vistaire-preview\/menu-qr-code-restaurant"/
  );
  assert.match(landingComponent, /const routes = getVistaireChromeRoutes\(routeMode\)/);
  assert.match(landingComponent, /href=\{routes\.menu\}/);
  assert.match(landingComponent, /href=\{routes\.about\}/);
  assert.match(landingComponent, /id="accueil"/);
  assert.match(landingComponent, /id="carte"/);
  assert.match(landingComponent, /id="a-propos"/);
  assert.match(menuComponent, /PreviewNav activeSection="menu" routeMode=\{routeMode\}/);
  assert.match(dishDetailComponent, /PreviewNav activeSection="menu" routeMode=\{routeMode\}/);
  assert.match(dishDetailComponent, /<PreviewFooter routeMode=\{routeMode\} width="wide" \/>/);
  assert.match(aboutComponent, /PreviewNav activeSection="about" routeMode=\{routeMode\}/);
  assert.match(contactComponent, /PreviewNav activeSection="contact" routeMode=\{routeMode\}/);
  assert.match(rendezVousComponent, /PreviewNav[\s\S]*activeSection="contact"/);
  assert.match(pdfVsDigitalPreviewComponent, /PreviewNav activeSection="home" routeMode=\{routeMode\}/);
  assert.match(pdfVsDigitalPreviewComponent, /<PreviewFooter routeMode=\{routeMode\} width="wide" \/>/);
  assert.match(menuDigitalPreviewComponent, /PreviewNav activeSection="home" routeMode=\{routeMode\}/);
  assert.match(menuDigitalPreviewComponent, /<PreviewFooter routeMode=\{routeMode\} width="wide" \/>/);
  assert.match(menuQrCodePreviewComponent, /PreviewNav activeSection="home" routeMode=\{routeMode\}/);
  assert.match(menuQrCodePreviewComponent, /<PreviewFooter routeMode=\{routeMode\} width="wide" \/>/);
  assert.match(
    rendezVousComponent,
    /contactHref=\{routes\.contact\}/
  );
  assert.match(chromeComponent, /href:\s*"\/vistaire-preview\/a-propos"/);
  assert.match(chromeComponent, literalPattern("/vistaire-preview/contact"));
  assert.match(
    chromeComponent,
    literalPattern("/vistaire-preview/prendre-rendez-vous")
  );
  assert.match(chromeComponent, /href:\s*"\/vistaire-preview\/pdf-vs-menu-digital"/);
  assert.match(chromeComponent, /href:\s*"\/vistaire-preview\/menu-digital-restaurant"/);
  assert.match(
    chromeComponent,
    /\{\s*label:\s*"Menu QR code restaurant",\s*href:\s*"\/vistaire-preview\/menu-qr-code-restaurant"\s*\}/
  );
  assert.doesNotMatch(chromeComponent, /href:\s*"\/(?!vistaire-preview)/);
  assert.doesNotMatch(chromeComponent, /href:\s*"\/menu-digital-restaurant"/);
  assert.doesNotMatch(chromeComponent, /href:\s*"\/menu-qr-code-restaurant"/);
  assert.match(chromeComponent, /className=\{styles\.navBrand\}/);
  assert.match(chromeComponent, /className=\{styles\.navLinks\}/);
  assert.match(chromeComponent, /className=\{styles\.navCta\}/);
  assert.match(chromeComponent, /Vistaire - accueil/);
  assert.match(chromeComponent, /Carte digitale premium/);
  assert.match(chromeComponent, /Prendre rendez-vous/);
  assert.match(chromeComponent, /id="contact"/);
});

test("vistaire PDF vs menu digital preview is premium, SEO-readable, and conversion-ready", async () => {
  const [route, component, css, sliderComponent, sliderCss, chromeComponent] = await Promise.all([
    readText(pdfVsDigitalPreviewRoutePath),
    readText(pdfVsDigitalPreviewComponentPath),
    readText(pdfVsDigitalPreviewCssPath),
    readText(pdfVsDigitalPreviewSliderPath),
    readText(pdfVsDigitalPreviewSliderCssPath),
    readText(chromeComponentPath)
  ]);
  const source = `${route}\n${component}\n${sliderComponent}\n${chromeComponent}`;

  for (const requiredCopy of [
    "Vistaire preview | PDF vs menu digital",
    "PDF vs menu digital : pourquoi les restaurants haut de gamme doivent évoluer",
    "Un menu PDF reproduit une carte papier sur un écran.",
    "Le problème du menu PDF",
    "Ce qu'apporte une carte digitale premium",
    "Menu PDF",
    "Menu digital standard",
    "Vistaire",
    "Lisibilité mobile",
    "Image haut de gamme",
    "Fiches plats",
    "Navigation",
    "Mise à jour",
    "Capacité à donner envie",
    "3D / AR",
    "Expérience client",
    "Un menu digital ne doit pas transformer le restaurant en application froide",
    "Votre carte mérite mieux qu'un PDF",
    "Prendre rendez-vous",
    "Voir la carte",
    "/vistaire-preview/demo",
    "/vistaire-preview/a-propos",
    "/vistaire-preview/contact",
    "/vistaire-preview/prendre-rendez-vous",
    "contact@vistaire.ca",
    "CONTACT_PHONE_DISPLAY"
  ]) {
    assert.match(source, literalPattern(requiredCopy));
  }

  for (const assetName of ["PhotoRestoComplet3.png"]) {
    assert.match(component, literalPattern(assetName));
  }
  assert.match(component, /PhotoComparaisonPDF\.png/);
  assert.match(component, /PhotoPDFvsDigitalDetail\.png/);
  assert.match(component, /className=\{styles\.comparisonContent\}/);
  assert.match(component, /className=\{styles\.comparisonVisual\}/);
  assert.match(component, /className=\{styles\.detailVisual\}/);
  assert.match(component, /src=\{comparisonPhoto\}[\s\S]*unoptimized/);
  assert.match(component, /src=\{detailComparisonPhoto\}[\s\S]*unoptimized/);
  assert.match(
    component,
    /alt="Deux téléphones comparent un menu PDF et une carte digitale Vistaire/
  );

  assert.match(component, /VistairePreviewPdfCompareSlider/);
  assert.match(component, /getAllDishes/);
  assert.match(component, /buildPdfComparePreviewData/);
  assert.match(component, /activeCategorySlug:\s*"tous"/);
  assert.match(component, /vistaireDishSlugs:\s*getAllDishes\(\)\.map/);
  assert.match(component, /preview=\{comparePreview\}/);
  assert.match(component, /className=\{styles\.compareSlider\}/);
  assert.match(sliderComponent, /const activeTabs = preview\.categoryTabs/);
  assert.doesNotMatch(sliderComponent, /slice\(0,\s*4\)/);
  assert.match(sliderComponent, /requestAnimationFrame/);
  assert.match(sliderCss, /\.dishList[\s\S]*overflow-y: auto/);
  assert.match(sliderCss, /will-change:\s*clip-path/);
  assert.match(sliderComponent, /Maison ?lyse|restaurant\.name/);
  assert.match(sliderComponent, /D?mo interactive Vistaire|Démo interactive Vistaire/);
  assert.match(sliderComponent, /Aper?u t?l?phone|Aperçu téléphone/);
  assert.doesNotMatch(component, /pageCarte\.png/);
  assert.doesNotMatch(component, /PlatHomard\.png/);
  assert.doesNotMatch(component, /plateCard/);
  assert.match(component, /<main className=\{styles\.page\}>/);
  assert.match(component, /<h1 id="pdf-vs-menu-digital-preview-title">/);
  assert.match(component, /<h2>/);
  assert.match(component, /<h3>/);
  assert.match(component, /aria-labelledby="pdf-vs-menu-digital-preview-title"/);
  assert.match(
    component,
    /className=\{styles\.topNav\}[\s\S]*<PreviewNav activeSection="home" routeMode=\{routeMode\} \/>/
  );
  assert.ok(
    component.indexOf("styles.topNav") < component.indexOf("styles.previewFrame"),
    "the preview nav should appear before the large content frame"
  );
  assert.ok(
    component.indexOf("digital-premium-title") > component.indexOf("styles.previewFrame"),
    "SEO content should live inside the large preview frame"
  );
  assert.match(component, /PreviewNav activeSection="home" routeMode=\{routeMode\}/);
  assert.match(component, /<PreviewFooter routeMode=\{routeMode\} width="wide" \/>/);
  assert.doesNotMatch(component, /<footer/);
  assert.doesNotMatch(component, /className=\{styles\.contentBand\}/);
  assert.doesNotMatch(component, /className=\{styles\.comparisonBand\}/);
  assert.doesNotMatch(component, /className=\{styles\.restaurantBand\}/);
  assert.doesNotMatch(source, /Demander une d[ée]mo|Demander une d&eacute;mo/);
  assert.match(route, /robots:\s*\{[\s\S]*index:\s*false[\s\S]*follow:\s*false/);
  assert.match(route, /canonical:\s*"\/vistaire-preview\/pdf-vs-menu-digital"/);
  assert.match(css, /\.previewFrame[\s\S]*grid-template-columns/);
  assert.match(css, /\.topNav/);
  assert.match(css, /\.comparisonGrid/);
  assert.match(css, /\.comparisonContent[\s\S]*grid-template-columns/);
  assert.match(css, /\.comparisonContent \.comparisonVisual[\s\S]*grid-column:\s*2/);
  assert.match(css, /\.comparisonContent \.comparisonTable[\s\S]*grid-column:\s*1 \/ -1/);
  assert.match(css, /\.comparisonVisual/);
  assert.match(css, /\.comparisonVisual img[\s\S]*object-fit:\s*cover/);
  assert.match(css, /\.comparisonTable/);
  assert.match(css, /\.detailVisual/);
  assert.match(css, /\.restaurantPanel[\s\S]*grid-template-columns/);
  assert.match(css, /\.finalCta/);
  assert.match(css, /@media \(max-width: 920px\)/);
  assert.match(css, /@media \(max-width: 520px\)/);
});

test("vistaire landing preview keeps the corrected Framer visual system", async () => {
  const [
    component,
    videoRoute,
    css,
    globalCss,
    chromeComponent,
    chromeCss,
    ...fontBuffers
  ] =
    await Promise.all([
    readText(landingComponentPath),
    readText(videoRoutePath),
    readText(landingCssPath),
    readText(globalCssPath),
    readText(chromeComponentPath),
    readText(chromeCssPath),
    ...previewFontFiles.map((path) => readFile(path))
  ]);
  const sharedSource = `${component}\n${chromeComponent}`;

  for (const requiredCopy of [
    "VISTAIRE",
    "CARTE DIGITALE PREMIUM",
    "CARTE DIGITALE",
    "Explorer",
    "À propos de Vistaire",
    "Une carte digitale qui donne envie",
    "DÉCOUVRIR",
    "Découvrir",
    "/vistaire-preview/a-propos",
    "Accueil",
    "Carte",
    "À propos",
    "Contact",
    "Carte digitale premium pour restaurants haut de gamme.",
    "Une expérience mobile pensée pour présenter les plats",
    "Fiches plats",
    "3D / AR sélective",
    "Aperçu restaurateur",
    "Menu digital restaurant",
    "Menu QR code restaurant",
    "PDF vs menu digital",
    "Restaurants haut de gamme",
    "Montréal, Québec",
    "contact@vistaire.ca",
    "CONTACT_PHONE_DISPLAY",
    "Prendre rendez-vous",
    "© 2026 Vistaire. Tous droits réservés."
  ]) {
    assert.match(sharedSource, literalPattern(requiredCopy));
  }

  assert.match(sharedSource, /mailto:contact@vistaire\.ca/);
  assert.doesNotMatch(sharedSource, /Demander une d[ée]mo/);

  for (const assetName of [
    "PhotoRestoComplet.png",
    "PlatHomard.png",
    "Photo table.png",
    "PhotoFemme.png"
  ]) {
    assert.match(component, literalPattern(assetName));
  }

  assert.match(component, /styles\.discoveryTableImage/);
  assert.match(component, /styles\.discoveryGuestImage/);
  assert.match(css, /\.discoveryTableImage[\s\S]*object-position/);
  assert.match(css, /\.discoveryGuestImage[\s\S]*object-position/);
  assert.match(css, /\.vistaire-discovery-image--first[\s\S]*firstDiscoveryImage/);
  assert.match(css, /\.vistaire-discovery-image--second[\s\S]*secondDiscoveryImage/);
  assert.match(css, /@media \(max-width: 920px\)[\s\S]*\.rightGrid\s*\{[\s\S]*display:\s*flex/);
  assert.match(css, /@media \(max-width: 920px\)[\s\S]*\.bottomGrid\s*\{[\s\S]*display:\s*contents/);
  assert.match(css, /@media \(max-width: 920px\)[\s\S]*\.aboutCard\s*\{[\s\S]*order:\s*1/);
  assert.match(css, /@media \(max-width: 920px\)[\s\S]*\.menuCard\s*\{[\s\S]*order:\s*2/);
  assert.match(css, /@media \(max-width: 920px\)[\s\S]*\.discoveryCard\s*\{[\s\S]*order:\s*3/);
  assert.match(globalCss, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(globalCss, /animation-duration:\s*0\.01ms\s*!important/);
  assert.match(globalCss, /animation-iteration-count:\s*1\s*!important/);
  assert.match(globalCss, /\.chapter-copy\s*\{[\s\S]*animation:\s*none\s*!important/);
  assert.match(
    css,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.vistaire-discovery-image--first[\s\S]*firstDiscoveryImage 8s infinite[\s\S]*!important/
  );
  assert.match(
    css,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.vistaire-discovery-image--second[\s\S]*secondDiscoveryImage 8s infinite[\s\S]*!important/
  );
  assert.match(css, /\.dotFirst\s*\{[\s\S]*firstDiscoveryDot 8s infinite !important/);
  assert.match(css, /\.dotSecond\s*\{[\s\S]*secondDiscoveryDot 8s infinite !important/);
  assert.doesNotMatch(css, /animation:\s*none\s*!important/);

  for (const videoAttribute of [
    "autoPlay",
    "loop",
    "muted",
    "playsInline",
    "controls={false}"
  ]) {
    assert.match(component, literalPattern(videoAttribute));
  }

  const videoBlock = component.match(/<video[\s\S]*?<\/video>/)?.[0] ?? "";
  assert.match(component, /const landingVideoSrc = "\/videos\/Vistaire2\.mp4"/);
  assert.match(videoBlock, /<source src=\{landingVideoSrc\} type="video\/mp4" \/>/);
  assert.doesNotMatch(videoBlock, /media=/);
  assert.doesNotMatch(videoBlock, /upscaled-video-mobile-scrub/);

  assert.match(videoRoute, /const VISTAIRE_VIDEO_SRC = "\/videos\/Vistaire2\.mp4"/);
  assert.match(videoRoute, /Response\.redirect/);
  assert.doesNotMatch(videoRoute, /upscaled-video/);
  assert.match(css, /@font-face[\s\S]*font-family: "BT Suave"/);
  assert.match(css, /@font-face[\s\S]*font-family: "Neue Montreal"/);
  for (const fontFile of previewFontFiles) {
    const publicUrl = fontFile.replace("public", "").replaceAll("\\", "/");
    assert.match(css, literalPattern(publicUrl));
  }
  for (const fontBuffer of fontBuffers) {
    assert.ok(fontBuffer.byteLength > 10000);
  }
  assert.match(css, /--vistaire-font-body: "Neue Montreal"/);
  assert.match(css, /--vistaire-font-display: "BT Suave"/);
  assert.match(chromeCss, /\.previewNav[\s\S]*grid-template-columns/);
  assert.match(chromeCss, /\.navBrand/);
  assert.match(chromeCss, /\.navLinks/);
  assert.match(chromeCss, /\.navCta/);
  assert.match(chromeCss, /\.previewFooter[\s\S]*grid-template-columns/);
  assert.match(chromeCss, /\.footerBrand/);
  assert.doesNotMatch(
    chromeCss,
    /\.footerBrand h2[\s\S]*text-transform:\s*lowercase/
  );
});

test("vistaire about preview matches the Framer bento story", async () => {
  const [route, component, css, chromeComponent, chromeCss] = await Promise.all([
    readText(aboutRoutePath),
    readText(aboutComponentPath),
    readText(aboutCssPath),
    readText(chromeComponentPath),
    readText(chromeCssPath)
  ]);
  const sharedSource = `${component}\n${chromeComponent}`;

  for (const requiredCopy of [
    "Vistaire preview | À propos",
    "Vistaire transforme le QR code restaurant en carte digitale",
    "Une maison montréalaise dédiée aux restaurants haut de gamme",
    "Vistaire aide les restaurants haut de gamme à présenter leur",
    "CARTE MOBILE",
    "PREMIUM",
    "Pensée pour le service à table",
    "Notre Vision",
    "Le digital doit prolonger l&apos;expérience du restaurant",
    "Mobile-First",
    "3D Sélective",
    "Application",
    "Découvrir Vistaire",
    "Prendre rendez-vous",
    "contact@vistaire.ca",
    "CONTACT_PHONE_DISPLAY"
  ]) {
    assert.match(`${route}\n${sharedSource}`, literalPattern(requiredCopy));
  }

  for (const assetName of [
    "PhotoRestoComplet3.png",
    "PlatHomard.png",
    "PageApropos2.png",
    "PageApropos.png"
  ]) {
    assert.match(component, literalPattern(assetName));
  }

  assert.match(component, /PreviewNav activeSection="about" routeMode=\{routeMode\}/);
  assert.match(component, /<PreviewFooter routeMode=\{routeMode\} \/>/);
  assert.match(component, /href=\{routes\.appointment\}/);
  assert.doesNotMatch(component, /<footer/);
  assert.doesNotMatch(sharedSource, /Demander une d[ée]mo/);
  assert.match(css, /grid-template-areas/);
  assert.match(css, /"intro mobile guest"/);
  assert.match(css, /"plate mobile vision"/);
  assert.match(css, /@media \(max-width: 520px\)/);
  assert.match(chromeCss, /\.previewFooter/);
});

test("vistaire contact preview stays a premium contact page", async () => {
  const [route, component, formComponent, css, chromeComponent, chromeCss] =
    await Promise.all([
      readText(contactRoutePath),
      readText(contactComponentPath),
      readText(contactFormComponentPath),
      readText(contactCssPath),
      readText(chromeComponentPath),
      readText(chromeCssPath)
    ]);
  const sharedSource = `${component}\n${chromeComponent}`;

  for (const requiredCopy of [
    "Vistaire preview | Contact",
    "CONTACT",
    "VISTAIRE",
    "POUR LES RESTAURANTS",
    "Vistaire transforme le QR code d&apos;un restaurant en carte",
    "3D/AR s&eacute;lective",
    "r&eacute;gion de",
    "Montr&eacute;al",
    "Parlez-nous de votre restaurant",
    "Prendre rendez-vous",
    "routes.appointment",
    "contact@vistaire.ca",
    "CONTACT_PHONE_DISPLAY",
    "Accueil",
    "Carte",
    "Contact"
  ]) {
    assert.match(`${route}\n${sharedSource}`, literalPattern(requiredCopy));
  }

  for (const assetName of [
    "PhotoRestoComplet4.png",
    "Boisson.png",
    "PageContact.png",
    "PhotoResto.png",
    "PlatHomard.png",
    "Desert.png",
    "Photo table.png"
  ]) {
    assert.match(component, literalPattern(assetName));
  }

  assert.match(component, /href=\{routes\.appointment\}/);
  assert.match(component, /mailto:contact@vistaire\.ca/);
  assert.match(component, /PreviewNav activeSection="contact" routeMode=\{routeMode\}/);
  assert.match(component, /<PreviewFooter routeMode=\{routeMode\} \/>/);
  assert.doesNotMatch(component, /VistaireContactForm/);
  assert.doesNotMatch(component, /<form/);
  assert.doesNotMatch(component, /placeholder="Nom"/);
  assert.match(formComponent, /"use client"/);
  assert.doesNotMatch(component, /<footer/);
  assert.doesNotMatch(sharedSource, /Demander une d[ée]mo|Demander une d&eacute;mo/);
  assert.match(css, /\.previewFrame[\s\S]*grid-template-columns/);
  assert.match(css, /\.heroImageCard/);
  assert.match(css, /\.restaurantCard/);
  assert.match(css, /\.tileGrid/);
  assert.match(css, /\.contactCard/);
  assert.doesNotMatch(css, /\.contactForm/);
  assert.match(css, /@media \(max-width: 520px\)/);
  assert.match(chromeCss, /\.previewFooter/);
});

test("vistaire rendez-vous preview owns the contact form", async () => {
  const [
    route,
    component,
    formComponent,
    css,
    chromeComponent,
    chromeCss
  ] = await Promise.all([
    readText(rendezVousRoutePath),
    readText(rendezVousComponentPath),
    readText(contactFormComponentPath),
    readText(rendezVousCssPath),
    readText(chromeComponentPath),
    readText(chromeCssPath)
  ]);
  const sharedSource = `${component}\n${formComponent}\n${chromeComponent}`;

  for (const requiredCopy of [
    "Vistaire preview | Prendre rendez-vous",
    "Prendre rendez-vous",
    "Parlez-nous de votre restaurant",
    "Nom",
    "Courriel",
    "Restaurant",
    "Message",
    "Envoyer la demande",
    "Retour au contact",
    "Votre demande est transmise directement",
    "contact@vistaire.ca",
    "CONTACT_PHONE_DISPLAY",
    "Montr&eacute;al",
    "Qu&eacute;bec"
  ]) {
    assert.match(`${route}\n${sharedSource}`, literalPattern(requiredCopy));
  }

  assert.match(route, /canonical:\s*"\/vistaire-preview\/prendre-rendez-vous"/);
  assert.match(component, /VistaireContactForm/);
  assert.match(
    component,
    /<h1 id="rendez-vous-preview-title">[\s\S]*Prendre rendez-vous pour une carte digitale Vistaire[\s\S]*<\/h1>/
  );
  assert.match(component, /href=\{routes\.contact\}/);
  assert.match(component, /PhotoRestoComplet\.png/);
  assert.match(component, /Photo table\.png/);
  assert.match(component, /tableImage/);
  assert.doesNotMatch(
    component,
    /PhotoResto\.png|restaurantImage|formPanelImage/
  );
  assert.match(component, /PreviewNav[\s\S]*activeSection="contact"/);
  assert.match(component, /contactHref=\{routes\.contact\}/);
  assert.match(component, /<PreviewFooter routeMode=\{routeMode\} \/>/);
  assert.doesNotMatch(component, /<footer/);
  assert.match(formComponent, /validateContactForm/);
  assert.match(formComponent, /buildMailtoHref/);
  assert.match(formComponent, /fetch\("\/api\/contact"/);
  assert.match(formComponent, /company:\s*company\.trim\(\)/);
  assert.match(formComponent, /styles\.honeypot/);
  assert.match(formComponent, /mailto:\$\{contactEmail\}/);
  assert.match(formComponent, /successMessage/);
  assert.match(formComponent, /serverErrorMessage/);
  assert.match(formComponent, /aria-invalid/);
  assert.match(formComponent, /aria-describedby/);
  assert.match(formComponent, /autoComplete="name"/);
  assert.match(formComponent, /autoComplete="email"/);
  assert.match(formComponent, /autoComplete="organization"/);
  assert.match(formComponent, /type="email"/);
  assert.match(formComponent, /noValidate/);
  assert.doesNotMatch(formComponent, /window\.location\.href/);
  assert.match(css, /\.contactForm/);
  assert.match(css, /\.honeypot/);
  assert.match(css, /\.formField/);
  assert.match(css, /\.formField textarea[\s\S]*resize:\s*none/);
  assert.match(css, /\.submitButton/);
  assert.match(css, /\.fieldError/);
  assert.match(css, /@media \(max-width: 520px\)/);
  assert.match(chromeCss, /\.previewFooter/);
  assert.match(
    chromeComponent,
    literalPattern("/vistaire-preview/prendre-rendez-vous")
  );
  assert.doesNotMatch(sharedSource, /Demander une d[ée]mo|Demander une d&eacute;mo/);
});

test("vistaire menu preview is a real filtered menu, not a static screenshot", async () => {
  const [component, css, chromeComponent, chromeCss] = await Promise.all([
    readText(menuComponentPath),
    readText(menuCssPath),
    readText(chromeComponentPath),
    readText(chromeCssPath)
  ]);
  const sharedSource = `${component}\n${chromeComponent}`;

  for (const requiredImport of [
    "getAllDishes",
    "getCategories",
    "getRestaurant",
    "getDishCardImageObjectPosition",
    "applyMenuFilters",
    "defaultMenuFilterState",
    "dishMatchesSearch",
    "hasActiveFilters",
    "MENU_ALL_CATEGORY_SLUG"
  ]) {
    assert.match(component, literalPattern(requiredImport));
  }

  for (const requiredCopy of [
    "Maison Élyse",
    "Démo interactive Vistaire",
    "Carte digitale premium",
    "Restaurant fictif · Carte client premium",
    "CARTE",
    "DIGITALE",
    "Tous",
    "Signatures",
    "Signature",
    "Recommandé",
    "Disponibles",
    "Vue 3D",
    "Tous les plats",
    "Sans gluten",
    "Sans lactose / laitiers",
    "Sans crustacés",
    "Rechercher un plat, un ingrédient...",
    "Sélection Maison Élyse",
    "créations affichées",
    "Les plats, prix et informations sont fictifs et servent à",
    "Réinitialiser",
    "Aucun plat dans cette sélection.",
    "Voir toute la carte",
    "Fiches plats",
    "3D / AR sélective",
    "Menu digital restaurant",
    "Montréal, Québec",
    "contact@vistaire.ca",
    "CONTACT_PHONE_DISPLAY",
    "Prendre rendez-vous",
    "© 2026 Vistaire. Tous droits réservés."
  ]) {
    assert.match(sharedSource, literalPattern(requiredCopy));
  }

  for (const assetName of ["pageCarte.png", "PhotoRestoComplet2.png"]) {
    assert.match(component, literalPattern(assetName));
  }

  assert.match(
    component,
    /href=\{`\$\{routes\.menu\}\/dishes\/\$\{dish\.slug\}`\}/
  );

  const demoData = await readText("lib/demoMenuData.ts");
  for (const fullMenuCategory of [
    "Entrées",
    "Plats signatures",
    "Desserts",
    "Cocktails"
  ]) {
    assert.match(demoData, literalPattern(fullMenuCategory));
  }

  for (const fullMenuDish of [
    "Tartare de saumon Label Rouge",
    "Canette rôtie aux figues",
    "Risotto aux cèpes",
    "Bar de ligne",
    "Pavé de bœuf",
    "Tarte citron confit",
    "Negroni vieilli en fût",
    "Élixir bergamote"
  ]) {
    assert.match(demoData, literalPattern(fullMenuDish));
  }

  for (const demoDishSlug of [
    "homard-bisque",
    "ravioles-romarin",
    "canette-aux-figues",
    "bar-ligne",
    "pave-boeuf",
    "souffle-chocolat",
    "cocktail-maison-elyse"
  ]) {
    assert.match(demoData, literalPattern(`slug: "${demoDishSlug}"`));
  }

  for (const meshyDishSlug of [
    "ravioles-romarin",
    "canette-aux-figues",
    "bar-ligne",
    "pave-boeuf",
    "souffle-chocolat",
    "tartare-saumon",
    "tarte-citron-basilic"
  ]) {
    assert.match(
      demoData,
      new RegExp(
        `slug: "${meshyDishSlug}"[\\s\\S]*?model3dUrl: "/models/demo/[^"]+-meshy\\.glb"`
      )
    );
    assert.match(
      demoData,
      new RegExp(
        `slug: "${meshyDishSlug}"[\\s\\S]*?arUsdzUrl: "/models/demo/ar-lite/[^"]+-ios-quicklook-meshy\\.usdz"`
      )
    );
  }

  assert.match(demoData, /canette-aux-figues[\s\S]*?isAvailable: true/);
  assert.match(component, /if \(dishHasImmersiveAsset\(dish\)\) badges\.push\("3D"\)/);

  assert.match(component, /useState<MenuFilterState>/);
  assert.match(component, /aria-pressed=\{isActive\}/);
  assert.match(component, /aria-pressed=\{isPhonePreview\}/);
  assert.match(component, /Aperçu téléphone/);
  assert.match(component, /aria-live="polite"/);
  assert.match(component, /return `\$\$\{price\}`/);
  assert.match(component, /visibleDishes\.map/);
  assert.match(component, /dish\.shortDescription/);
  assert.match(component, /dishHasImmersiveAsset/);
  assert.match(component, /LazyDishModelViewer/);
  assert.match(component, /phoneShowModel/);
  assert.match(component, /setPhoneShowModel\(true\)/);
  assert.match(component, /onReturnToDish=\{\(\) => setPhoneShowModel\(false\)\}/);
  assert.match(component, /prefetch=\{false\}/);
  assert.doesNotMatch(component, /prepareDemoAssetOrigin|trackMenuEvent|warmup/);
  assert.doesNotMatch(sharedSource, /Demander une d[ée]mo/);

  assert.match(css, /\.previewFrame[\s\S]*grid-template-columns/);
  assert.match(css, /\.previewFramePhone/);
  assert.match(css, /\.visualPanel[\s\S]*min-height: 620px/);
  assert.match(css, /\.menuPanel[\s\S]*max-height: 620px/);
  assert.match(css, /\.menuPanelPhone/);
  assert.match(css, /\.phoneModelPanel/);
  assert.match(css, /\.phoneModelButton/);
  assert.match(css, /\.phoneModelViewer/);
  assert.match(css, /\.viewToggle/);
  assert.match(css, /\.categoryTabs button/);
  assert.match(css, /\.filterPills button/);
  assert.match(css, /\.filterSelectRow select/);
  assert.match(css, /\.dishList[\s\S]*overflow-y: auto/);
  assert.match(css, /\.dishRow[\s\S]*grid-template-columns/);
  assert.match(css, /\.previewFooter[\s\S]*grid-template-columns/);
  assert.match(css, /\.footerBrand/);
  assert.doesNotMatch(
    css,
    /\.footerBrand h2[\s\S]*text-transform:\s*lowercase/
  );
  assert.match(css, /\.emptyState/);
  assert.match(css, /@media \(max-width: 520px\)/);
  assert.match(chromeComponent, /PreviewNav/);
  assert.match(chromeCss, /\.previewFooter[\s\S]*grid-template-columns/);
  assert.doesNotMatch(css, /#1f1006/);
});

test("vistaire preview dish detail is universal, premium, and honest about 3D", async () => {
  const [route, component, css, menuComponent, chromeComponent] =
    await Promise.all([
      readText(dishDetailRoutePath),
      readText(dishDetailComponentPath),
      readText(dishDetailCssPath),
      readText(menuComponentPath),
      readText(chromeComponentPath)
    ]);
  const source = `${route}\n${component}\n${chromeComponent}`;

  for (const requiredSource of [
    "generateStaticParams",
    "getAllDishes",
    "getDishBySlug",
    "getCategoryBySlug",
    "notFound()",
    "VistaireDishDetailPreview",
    "dishHasImmersiveAsset",
    "DishModelViewer",
    "getDishDetailImageObjectPosition",
    "formatPrice",
    "Retour à la carte",
    "Démo interactive Vistaire",
    "Maison Élyse",
    "Ingrédients principaux",
    "Allergènes",
    "Note du chef",
    "Options",
    "Accompagnements",
    "Voir en 3D",
    "Vue 3D bientôt disponible pour ce plat",
    "Les informations de ce plat sont fictives",
    "Prendre rendez-vous",
    "contact@vistaire.ca",
    "CONTACT_PHONE_DISPLAY"
  ]) {
    assert.match(source, literalPattern(requiredSource));
  }

  assert.match(
    route,
    /canonical:\s*`\/vistaire-preview\/demo\/dishes\/\$\{dish\.slug\}`/
  );
  assert.match(component, /href=\{routes\.menu\}/);
  assert.match(component, /PreviewNav activeSection="menu" routeMode=\{routeMode\}/);
  assert.match(component, /<PreviewFooter routeMode=\{routeMode\} width="wide" \/>/);
  assert.match(component, /type ModelPanelVariant = "desktop" \| "mobile"/);
  assert.match(component, /const \[activeModelPanel, setActiveModelPanel\]/);
  assert.match(component, /const isActivePanel = activeModelPanel === panelVariant/);
  assert.match(component, /aria-expanded=\{isActivePanel\}/);
  assert.match(component, /onClick=\{\(\) => setActiveModelPanel\(panelVariant\)\}/);
  assert.match(component, /isActivePanel \? \(/);
  assert.match(component, /onReturnToDish=\{\(\) => setActiveModelPanel\(null\)\}/);
  assert.match(component, /styles\.desktopModelPanel,[\s\S]*"desktop"/);
  assert.match(component, /styles\.mobileModelPanel,[\s\S]*"mobile"/);
  assert.doesNotMatch(component, /const \[showModel/);
  assert.match(component, /styles\.desktopModelPanel/);
  assert.match(component, /styles\.mobileModelPanel/);
  assert.ok(
    component.indexOf("modelPanel") < component.indexOf("actionRow"),
    "3D panel should appear before return/explore actions on dish detail"
  );
  assert.doesNotMatch(component, /Voir devant moi/);
  assert.doesNotMatch(source, /Demander une d[ée]mo/);
  assert.match(
    menuComponent,
    /href=\{`\$\{routes\.menu\}\/dishes\/\$\{dish\.slug\}`\}/
  );
  assert.match(chromeComponent, /href:\s*"\/vistaire-preview\/demo\/dishes\/homard-bisque"/);

  for (const requiredClass of [
    ".page",
    ".backgroundImage",
    ".previewFrame",
    ".dishLayout",
    ".heroImage",
    ".price",
    ".badgeList",
    ".infoGrid",
    ".modelPanel",
    ".desktopModelPanel",
    ".mobileModelPanel",
    ".modelViewer",
    ".fallback3d",
    "@media (max-width: 920px)",
    "@media (max-width: 520px)"
  ]) {
    assert.match(css, literalPattern(requiredClass));
  }
});

test("vistaire preview pages use distinct restaurant backgrounds", async () => {
  const [landingComponent, menuComponent, aboutComponent, contactComponent] =
    await Promise.all([
      readText(landingComponentPath),
      readText(menuComponentPath),
      readText(aboutComponentPath),
      readText(contactComponentPath)
    ]);

  assert.match(
    landingComponent,
    /restaurantBackground from "@\/Framer\/PhotoRestoComplet\.png"/
  );
  assert.match(
    menuComponent,
    /restaurantBackground from "@\/Framer\/PhotoRestoComplet2\.png"/
  );
  assert.match(
    aboutComponent,
    /restaurantBackground from "@\/Framer\/PhotoRestoComplet3\.png"/
  );
  assert.match(
    contactComponent,
    /contactBackground from "@\/Framer\/PhotoRestoComplet4\.png"/
  );
});

test("vistaire preview backgrounds avoid global dark shade layers", async () => {
  const previewSources = await Promise.all([
    readText(landingComponentPath),
    readText(menuComponentPath),
    readText(dishDetailComponentPath),
    readText(aboutComponentPath),
    readText(contactComponentPath),
    readText(rendezVousComponentPath),
    readText(pdfVsDigitalPreviewComponentPath),
    readText(menuDigitalPreviewComponentPath),
    readText(landingCssPath),
    readText(menuCssPath),
    readText(dishDetailCssPath),
    readText(aboutCssPath),
    readText(contactCssPath),
    readText(rendezVousCssPath),
    readText(pdfVsDigitalPreviewCssPath),
    readText(menuDigitalPreviewCssPath)
  ]);
  const source = previewSources.join("\n");

  assert.doesNotMatch(source, /backgroundShade/);
  assert.match(source, /unoptimized/);

  const previewCssSources = [
    { name: "landing", css: previewSources[8] },
    { name: "menu", css: previewSources[9] },
    { name: "dish", css: previewSources[10] },
    { name: "about", css: previewSources[11] },
    { name: "contact", css: previewSources[12] },
    { name: "rendez-vous", css: previewSources[13] },
    { name: "pdf-vs-digital", css: previewSources[14] },
    { name: "menu-digital-restaurant", css: previewSources[15] }
  ];
  const previewFrameBlocks = previewCssSources.flatMap(({ name, css }) =>
    [...css.matchAll(/\.previewFrame\s*\{[^}]*\}/g)].map((match) => ({
      name,
      block: match[0]
    }))
  );

  assert.ok(
    previewFrameBlocks.length >= 8,
    "all preview pages must expose a previewFrame block for overlay checks"
  );

  const glassFramePages = new Set([
    "landing",
    "menu",
    "dish",
    "about",
    "contact",
    "rendez-vous",
    "pdf-vs-digital",
    "menu-digital-restaurant"
  ]);

  const trueGlassFramePages = new Set([
    "landing",
    "menu",
    "dish",
    "about",
    "contact",
    "rendez-vous",
    "pdf-vs-digital",
    "menu-digital-restaurant"
  ]);

  for (const { name, block } of previewFrameBlocks) {
    assert.doesNotMatch(block, /rgba\(28, 17, 9, 0\.(?:16|17|18|2|5)\)/);
    assert.doesNotMatch(block, /rgba\(12, 8, 5, 0\.12\)/);
    assert.doesNotMatch(block, /background:\s*rgba\(255, 250, 240, 0\.025\)/);
    assert.doesNotMatch(block, /backdrop-filter:\s*blur\(6px\) saturate\(112%\)/);

    if (trueGlassFramePages.has(name) && /backdrop-filter/.test(block)) {
      assert.match(block, /background:\s*transparent/);
      assert.match(block, /-webkit-backdrop-filter:\s*blur\(9px\) saturate\(112%\)/);
      assert.match(block, /backdrop-filter:\s*blur\(9px\) saturate\(112%\)/);
    } else if (!glassFramePages.has(name)) {
      assert.doesNotMatch(block, /backdrop-filter/);
    }
  }

  for (const name of glassFramePages) {
    const css = previewCssSources.find((source) => source.name === name).css;
    assert.match(css, /\.previewFrame[\s\S]*background:\s*transparent/);
    assert.match(css, /\.previewFrame[\s\S]*-webkit-backdrop-filter:\s*blur\(9px\) saturate\(112%\)/);
    assert.match(css, /\.previewFrame[\s\S]*backdrop-filter:\s*blur\(9px\) saturate\(112%\)/);
  }
});

test("vistaire seo visuals avoid heavy black image treatments", async () => {
  const [menuDigitalPage, menu3dArPage, digitalScene] = await Promise.all([
    readText(seoMenuDigitalPagePath),
    readText(seoMenu3dArPagePath),
    readText(seoDigitalScenePath)
  ]);
  const source = `${menuDigitalPage}\n${menu3dArPage}\n${digitalScene}`;

  assert.doesNotMatch(source, /from-black\/55|bg-black\/55|opacity-50/);
  assert.doesNotMatch(source, /opacity-70/);
  assert.doesNotMatch(source, /rgba\(5,4,3,0\.92\)/);
  assert.doesNotMatch(source, /rgba\(5,4,3,0\.(?:68|88)\)/);
});
