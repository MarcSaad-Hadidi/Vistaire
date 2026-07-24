import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

test("public menu route loads the published UI config and shared renderer", async () => {
  const source = await readFile("app/menu/[slug]/page.tsx", "utf8");

  assert.match(source, /getPublishedMenuUiConfigForRestaurant/);
  assert.match(source, /PublicMenuRenderer/);
  assert.match(source, /resolvePublicMenuExperience/);
  assert.doesNotMatch(source, /<PublicMenuExperience[\s/>]/);
  assert.doesNotMatch(source, /from ["']@\/components\/menu\/PublicMenuExperience["']/);
});

test("shared public menu renderer avoids heavy 3D auto-loads", async () => {
  const source = await readFile("components/menu/PublicMenuRenderer.tsx", "utf8");

  assert.match(source, /mode:\s*"public" \| "builder-preview"/);
  assert.doesNotMatch(source, /DishModelViewer/);
  assert.doesNotMatch(source, /model-viewer/);
  assert.doesNotMatch(source, /@google\/model-viewer/);
  assert.doesNotMatch(source, /\.glb/);
  assert.doesNotMatch(source, /\.usdz/);
});

test("public menu renderer dispatches each experience blueprint to a distinct renderer", async () => {
  const source = await readFile("components/menu/PublicMenuRenderer.tsx", "utf8");

  for (const functionName of [
    "renderClassicTabs",
    "renderEditorialMagazine",
    "renderPhotoGrid",
    "renderFastBoard",
    "renderBentoShowcase",
    "renderStoryFirst",
    "renderMinimalList",
    "renderLoungeCocktail",
    "renderFamilyComfort",
    "renderImmersiveFirst",
    "renderTastingJourney",
    "renderCompactQr"
  ]) {
    assert.match(source, new RegExp(`function ${functionName}\\(`));
  }

  assert.match(source, /switch \(config\.experience\.blueprint\)/);
  assert.match(source, /case "compact-qr"/);
  assert.match(source, /case "editorial-magazine"/);
  assert.match(source, /case "immersive-first"/);
});

test("blueprint renderers expose genuinely different public structures", async () => {
  const source = await readFile("components/menu/PublicMenuRenderer.tsx", "utf8");

  assert.match(source, /data-blueprint=\{config\.experience\.blueprint\}/);
  assert.match(source, /styles\.compactQrLayout/);
  assert.match(source, /styles\.editorialLayout/);
  assert.match(source, /styles\.fastBoardLayout/);
  assert.match(source, /styles\.bentoLayout/);
  assert.match(source, /styles\.immersiveLayout/);
  assert.match(source, /styles\.tastingLayout/);
  assert.match(source, /immersiveDishes/);
  assert.match(source, /priceBoard/);
  assert.match(source, /featuredDishes/);
});

test("tabbed compact blueprint lists honor the active category tab", async () => {
  const source = await readFile("components/menu/PublicMenuRenderer.tsx", "utf8");

  assert.match(source, /const activeCategoryList =[\s\S]*filteredCategories\.filter/);
  assert.match(
    source,
    /function renderFastBoard\(\)[\s\S]*renderFullMenuList\(activeCategoryList, \{ priceBoard: true \}\)/
  );
  assert.match(
    source,
    /function renderMinimalList\(\)[\s\S]*renderFullMenuList\(activeCategoryList, \{ className: styles\.minimalLines \}\)/
  );
  assert.match(
    source,
    /function renderCompactQr\(\)[\s\S]*renderFullMenuList\(activeCategoryList, \{ className: styles\.compactList \}\)/
  );
});

test("featured public menu previews honor quick filters", async () => {
  const source = await readFile("components/menu/PublicMenuRenderer.tsx", "utf8");

  assert.match(source, /const featuredDishes = filteredDishes\s*\.filter/);
  assert.match(source, /const immersiveDishes = filteredDishes\s*\.filter/);
  assert.match(
    source,
    /dishes = featuredDishes\.length \? featuredDishes : filteredDishes\.slice\(0, 3\)/
  );
  assert.match(
    source,
    /renderFeaturedSection\("Photos a explorer", "A decouvrir", filteredDishes\.slice\(0, 8\)/
  );
});

test("public menu renderer keeps owner-only status copy out of public mode", async () => {
  const source = await readFile("components/menu/PublicMenuRenderer.tsx", "utf8");
  const detailSource = await readFile(
    "components/menu/PublicDishDetailExperience.tsx",
    "utf8"
  );

  assert.match(
    source,
    /mode === "builder-preview" &&\s*config\.photos\.ownerMissingWarnings &&\s*!dish\.hasPhoto/
  );
  assert.match(detailSource, /mode === "builder-preview"[\s\S]*A faire owner/);
  assert.doesNotMatch(source, /A faire owner/);
  assert.doesNotMatch(source, /mode === "public"[\s\S]{0,220}Photo a faire/);
});

test("builder preview opens dish details as a full detail experience, not a compressed overlay", async () => {
  const source = await readFile("components/menu/PublicMenuRenderer.tsx", "utf8");

  assert.match(source, /import \{ PublicDishDetailExperience \}/);
  assert.match(source, /mode === "builder-preview" && selectedDish/);
  assert.match(source, /mode="builder-preview"/);
  assert.match(source, /onBack=\{\(\) => setSelectedDish\(null\)\}/);
});

test("generic public dish sheets render structured allergen declarations and active locale", async () => {
  const source = await readFile("components/menu/PublicMenuRenderer.tsx", "utf8");
  const detailRouteSource = await readFile(
    "app/menu/[slug]/dishes/[dishSlug]/page.tsx",
    "utf8"
  );

  assert.match(
    source,
    /import \{[^}]*AllergenDisclosure[^}]*\} from "\.\/AllergenDisclosure"/
  );
  assert.match(
    source,
    /<AllergenDisclosure[\s\S]*dish=\{selectedDish\}[\s\S]*locale=\{activeLocale\}[\s\S]*includeWarning=\{false\}/
  );
  assert.ok(
    (source.match(/locale=\{activeLocale\}/g) ?? []).length >= 2,
    "public and builder detail experiences both receive the active locale"
  );
  assert.match(
    detailRouteSource,
    /<PublicDishDetailExperience[\s\S]*locale=\{activeLocale\}/
  );
});

test("public menu CSS prevents letter-by-letter wrapping and fragile mobile grids", async () => {
  const css = await readFile("components/menu/PublicMenuRenderer.module.css", "utf8");

  assert.doesNotMatch(css, /word-break:\s*break-all/);
  assert.doesNotMatch(css, /overflow-wrap:\s*anywhere/);
  assert.match(css, /\.dishName\s*\{[\s\S]*overflow-wrap:\s*break-word;[\s\S]*word-break:\s*normal;/);
  assert.match(css, /\.categoryCard strong\s*\{[\s\S]*overflow-wrap:\s*break-word;[\s\S]*word-break:\s*normal;/);
  assert.match(css, /\.tabs\s*\{[\s\S]*overflow-x:\s*auto;[\s\S]*white-space:\s*nowrap;/);
  assert.match(css, /\.tabs button\s*\{[\s\S]*flex:\s*0 0 auto;[\s\S]*min-width:\s*max-content;/);
  assert.match(
    css,
    /@media \(max-width: 430px\)[\s\S]*\.photoGridCards \.dishList,[\s\S]*\.photoGridCards \+ \.fullMenuList \.dishList[\s\S]*grid-template-columns:\s*1fr;/
  );
});

test("public menu renderer links dish cards to shareable detail routes with QR context", async () => {
  const pageSource = await readFile("app/menu/[slug]/page.tsx", "utf8");
  const rendererSource = await readFile(
    "components/menu/PublicMenuRenderer.tsx",
    "utf8"
  );

  assert.match(pageSource, /query=\{menuQuery\}/);
  assert.match(rendererSource, /import Link from "next\/link"/);
  assert.match(rendererSource, /buildPublicDishPath/);
  assert.match(rendererSource, /query\?: PublicMenuContextQuery/);
  assert.match(
    rendererSource,
    /const dishHref = buildPublicDishPath\(menu\.slug, dish\.slug, query\)/
  );
  assert.match(rendererSource, /href=\{dishHref\}/);
  assert.match(rendererSource, /prefetch=\{false\}/);
  assert.match(rendererSource, /mode === "public"/);
  assert.match(rendererSource, /onClick=\{\(\) => openDish\(dish\)\}/);
});
