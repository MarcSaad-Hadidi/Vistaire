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

test("currency availability requires real finite positive conversion rates", async () => {
  const { isCurrencyConversionAvailable } = await import(
    "../lib/currency/formatMenuPrice.ts"
  );
  const validRates = { CAD: 1, USD: 0.73, EUR: 0.64 };
  const canConvert = (targetCurrency, rates) =>
    isCurrencyConversionAvailable({
      sourceCurrency: "CAD",
      targetCurrency,
      baseCurrency: "CAD",
      rates
    });

  assert.equal(canConvert("CAD", validRates), true);
  assert.equal(canConvert("USD", validRates), true);
  assert.equal(canConvert("EUR", validRates), true);

  const providerFallback = { CAD: 1 };
  assert.equal(canConvert("CAD", providerFallback), true);
  assert.equal(canConvert("USD", providerFallback), false);
  assert.equal(canConvert("EUR", providerFallback), false);

  assert.equal(canConvert("USD", { CAD: 1, USD: 0 }), false);
  assert.equal(canConvert("EUR", { CAD: 1, EUR: Number.NaN }), false);
  assert.equal(canConvert("USD", { CAD: 1 }), false);
  assert.equal(canConvert("EUR", { CAD: 1 }), false);

  assert.equal(
    isCurrencyConversionAvailable({
      sourceCurrency: "USD",
      targetCurrency: "USD",
      baseCurrency: "CAD",
      rates: {}
    }),
    true
  );
  assert.equal(
    isCurrencyConversionAvailable({
      sourceCurrency: "USD",
      targetCurrency: "CAD",
      baseCurrency: "CAD",
      rates: { CAD: 1, USD: 0.73 }
    }),
    true
  );
  assert.equal(
    isCurrencyConversionAvailable({
      sourceCurrency: "USD",
      targetCurrency: "CAD",
      baseCurrency: "CAD",
      rates: { CAD: 1 }
    }),
    false
  );
});

test("Maison menu reuses shared currency infrastructure and never mirrors its chrome", async () => {
  const source = await readFile("components/menu/MaisonElyseQrMenu.tsx", "utf8");

  assert.match(source, /type SheetId = "menu" \| "filter" \| "language" \| "currency" \| null/);
  assert.match(source, /formatTrouvableDishPrice/);
  assert.match(source, /getTrouvableCurrencyOptions/);
  assert.match(source, /isCurrencyConversionAvailable/);
  assert.match(source, /availableCurrencyOptions/);
  assert.match(source, /TROUVABLE_CURRENCY_STORAGE_KEY/);
  assert.match(source, /exchangeRates\?: MenuExchangeRates/);
  assert.match(source, /toggleSheet\("currency"/);
  assert.doesNotMatch(source, /Boolean\(exchangeRates\)/);
  assert.match(source, /dir="ltr"/);
  assert.match(source, /data-text-direction=\{textDirection\}/);
  assert.doesNotMatch(source, /PhonePreviewDishDetailFr/);
  assert.doesNotMatch(source, /PhonePreviewDishDetailEn/);
  assert.doesNotMatch(source, /badges\.push\("Signature"\)/);
});

test("Maison dish detail keeps currency and translated semantic badges end to end", async () => {
  const source = await readFile("components/menu/MaisonElyseDishDetail.tsx", "utf8");

  assert.match(source, /formatTrouvableDishPrice/);
  assert.match(source, /isCurrencyConversionAvailable/);
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

test("Arabic shared text surfaces keep LTR layout and local RTL text", async () => {
  const [allergens, googleReview] = await Promise.all([
    readFile("components/menu/AllergenDisclosure.tsx", "utf8"),
    readFile("components/menu/GoogleReviewCard.tsx", "utf8")
  ]);

  assert.match(allergens, /case "ar":[\s\S]*مسببات حساسية أخرى/);
  assert.match(allergens, /dir="ltr"/);
  assert.match(allergens, /<h2[^>]*dir=\{direction\}/);
  assert.match(allergens, /<dt dir=\{direction\}>\{label\}<\/dt>/);
  assert.match(allergens, /<dd dir=\{direction\}>\{values\.join\(", "\)\}<\/dd>/);

  assert.match(googleReview, /const textDirection = getTextDirection\(resolvedLocale\)/);
  assert.match(googleReview, /data-google-review-card="true"[\s\S]{0,180}dir="ltr"/);
  assert.match(googleReview, /className=\{styles\.googleReviewCopy\} dir=\{textDirection\}/);
  assert.match(googleReview, /<span key=\{item\} dir=\{textDirection\}>/);
});

test("Sauge Noire keeps the document and book chrome LTR while localized text owns bidi direction", async () => {
  const [book, pages] = await Promise.all([
    readFile("components/menu/unique/sauge-noire/SaugeNoireBookMenu.tsx", "utf8"),
    readFile("components/menu/unique/sauge-noire/SaugeNoireMenuPages.tsx", "utf8")
  ]);

  assert.match(book, /root\.dir = "ltr"/);
  assert.match(book, /<main[\s\S]{0,300}dir="ltr"/);
  assert.match(book, /data-text-direction=\{copyLocale\(activeLocaleValue\) === "ar" \? "rtl" : "ltr"\}/);
  assert.doesNotMatch(
    book,
    /root\.dir = copyLocale\(language\) === "ar" \? "rtl" : "ltr"/
  );

  assert.match(pages, /data-sauge-typography-role="title" dir="auto"/);
  assert.match(pages, /<h2 dir="auto">\{dish\.name\}<\/h2>/);
  assert.match(pages, /<span dir="auto">\{dish\.name\}<\/span>/);
  assert.match(pages, /<p dir="auto">\{copy\}<\/p>/);
});
