import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { registerHooks } from "node:module";
import { sep } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const projectRootUrl = pathToFileURL(`${process.cwd()}${sep}`).href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return {
        url: "data:text/javascript,export%20default%20undefined",
        shortCircuit: true
      };
    }
    if (specifier.startsWith("@/")) {
      const baseUrl = new URL(specifier.slice(2), projectRootUrl);
      for (const extension of ["", ".ts", ".tsx", ".mjs", "/index.ts", "/index.tsx"]) {
        const url = new URL(`${baseUrl.href}${extension}`);
        if (existsSync(url)) return { url: url.href, shortCircuit: true };
      }
    }
    if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL) {
      const baseUrl = new URL(specifier, context.parentURL);
      for (const extension of ["", ".ts", ".tsx", ".mjs", "/index.ts", "/index.tsx"]) {
        const url = new URL(`${baseUrl.href}${extension}`);
        if (existsSync(url)) return { url: url.href, shortCircuit: true };
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith(".ts") || url.endsWith(".tsx")) {
      return {
        format: "module",
        source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
          compilerOptions: {
            jsx: ts.JsxEmit.ReactJSX,
            module: ts.ModuleKind.ESNext,
            target: ts.ScriptTarget.ES2022
          }
        }).outputText,
        shortCircuit: true
      };
    }
    return nextLoad(url, context);
  }
});

test("Maison editorial copy is complete for every built-in public locale", async () => {
  const { getMaisonElyseEditorialCopy } = await import(
    "../lib/menu/maisonElyseLocalization.ts"
  );

  assert.equal(getMaisonElyseEditorialCopy("fr-CA").collectionTitle, "LA CARTE");
  assert.equal(getMaisonElyseEditorialCopy("en-CA").collectionTitle, "THE MENU");
  assert.equal(getMaisonElyseEditorialCopy("es-ES").collectionKicker, "LA COLECCIÓN");
  assert.equal(getMaisonElyseEditorialCopy("it-IT").collectionTitle, "LA CARTA");
  assert.equal(getMaisonElyseEditorialCopy("de-DE").collectionTitle, "DIE KARTE");
  assert.equal(getMaisonElyseEditorialCopy("el-GR").collectionTitle, "ΤΟ ΜΕΝΟΥ");
  assert.equal(getMaisonElyseEditorialCopy("ar").collectionTitle, "القائمة");
  assert.equal(getMaisonElyseEditorialCopy("es-ES").detailBackToMenu, "Volver a la carta");
  assert.equal(getMaisonElyseEditorialCopy("ar").detailBackToMenu, "العودة إلى القائمة");
});

test("Maison category semantics prefer stable identity over translated display labels", async () => {
  const { getMaisonElyseCategoryKind, getMaisonElyseCategoryLabel } = await import(
    "../lib/menu/maisonElyseLocalization.ts"
  );

  const spanishSignature = { label: "Platos de autor", slug: "plats-signatures" };
  const arabicStarter = { label: "المقبلات", slug: "entrees" };

  assert.equal(getMaisonElyseCategoryKind(spanishSignature), "signature");
  assert.equal(getMaisonElyseCategoryKind(arabicStarter), "starter");
  assert.equal(getMaisonElyseCategoryLabel(spanishSignature, "es-ES"), "Platos de autor");
  assert.equal(getMaisonElyseCategoryLabel(arabicStarter, "ar"), "المقبلات");
});

test("Maison exposes only locales with both ready menu data and a complete Maison UI pack", async () => {
  const { getMaisonElyseLanguageOptions } = await import(
    "../lib/menu/maisonElyseLocalization.ts"
  );

  const settings = {
    defaultLocale: "fr-CA",
    supportedLocales: ["fr-CA", "en-CA", "es-ES", "ar", "pt-BR"]
  };
  const statuses = [
    { locale: "fr-CA", status: "source" },
    { locale: "en-CA", status: "up_to_date" },
    { locale: "es-ES", status: "up_to_date" },
    { locale: "ar", status: "up_to_date" },
    { locale: "pt-BR", status: "up_to_date" }
  ];

  assert.deepEqual(
    getMaisonElyseLanguageOptions(settings, statuses).map((option) => option.id),
    ["fr-CA", "en-CA", "es-ES", "ar"]
  );
});

test("Maison menu reuses shared currency infrastructure and never mirrors its chrome", async () => {
  const source = await readFile("components/menu/MaisonElyseQrMenu.tsx", "utf8");

  assert.match(source, /type SheetId = "menu" \| "filter" \| "language" \| "currency" \| null/);
  assert.match(source, /formatTrouvableDishPrice/);
  assert.match(source, /getTrouvableCurrencyOptions/);
  assert.match(source, /TROUVABLE_CURRENCY_STORAGE_KEY/);
  assert.match(source, /exchangeRates: MenuExchangeRates/);
  assert.match(source, /toggleSheet\("currency"/);
  assert.match(source, /dir="ltr"/);
  assert.match(source, /data-text-direction=\{textDirection\}/);
  assert.doesNotMatch(source, /PhonePreviewDishDetailFr/);
  assert.doesNotMatch(source, /PhonePreviewDishDetailEn/);
  assert.doesNotMatch(source, /badges\.push\("Signature"\)/);
});

test("Maison dish detail keeps currency and translated semantic badges end to end", async () => {
  const source = await readFile("components/menu/MaisonElyseDishDetail.tsx", "utf8");

  assert.match(source, /formatTrouvableDishPrice/);
  assert.match(source, /exchangeRates\?: MenuExchangeRates/);
  assert.match(source, /currency\?: TrouvableCurrency/);
  assert.match(source, /getMaisonElyseEditorialCopy/);
  assert.match(source, /dir="ltr"/);
  assert.doesNotMatch(source, /LazyDishModelViewerFr/);
  assert.doesNotMatch(source, /LazyDishModelViewerEn/);
  assert.doesNotMatch(source, /badges\.push\("Signature"\)/);
  assert.doesNotMatch(source, /DETAIL_COPY\[language === "fr" \? "fr" : "en"\]/);
});

test("Maison public routes load and pass exchange rates for both menu and dish", async () => {
  const [context, menuRoute, dishRoute] = await Promise.all([
    readFile("lib/menu/publicMenuRenderContext.ts", "utf8"),
    readFile("app/(fr)/menu/[slug]/page.tsx", "utf8"),
    readFile("app/(fr)/menu/[slug]/dishes/[dishSlug]/page.tsx", "utf8")
  ]);

  assert.match(
    context,
    /experience\.kind === "maison-elyse"[\s\S]{0,120}experience\.kind === "trouvable"/
  );
  assert.match(menuRoute, /<MaisonElyseQrMenu[\s\S]*exchangeRates=\{exchangeRates\}/);
  assert.match(dishRoute, /<MaisonElyseDishDetail[\s\S]*exchangeRates=\{exchangeRates\}/);
});

test("Sauge Noire keeps the document and book chrome LTR for Arabic", async () => {
  const source = await readFile(
    "components/menu/unique/sauge-noire/SaugeNoireBookMenu.tsx",
    "utf8"
  );

  assert.match(source, /root\.dir = "ltr"/);
  assert.match(source, /<main[\s\S]{0,300}dir="ltr"/);
  assert.doesNotMatch(
    source,
    /root\.dir = copyLocale\(language\) === "ar" \? "rtl" : "ltr"/
  );
});
