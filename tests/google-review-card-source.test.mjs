import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const componentPath = "components/menu/GoogleReviewCard.tsx";
const trackingPath = "components/menu/googleReviewTracking.ts";
const rendererPath = "components/menu/PublicMenuRenderer.tsx";
const controlsPath = "components/menu/trouvableMenuControls.ts";
const corePath = "lib/menu/publicMenuCore.ts";

test("Google Review card uses neutral approved wording and no incentive or gating copy", async () => {
  const [source, controls] = await Promise.all([
    readFile(componentPath, "utf8"),
    readFile(controlsPath, "utf8")
  ]);

  for (const text of [
    "Votre expérience compte",
    "Partagez votre expérience chez",
    "Votre avis Google aide l'équipe à mieux comprendre chaque visite",
    "Laisser un avis Google",
    "Aucun avantage n'est offert en échange d'un avis.",
    "Votre avis doit refléter votre expérience réelle."
  ]) {
    assert.match(controls, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  for (const forbidden of [
    "Laissez 5 étoiles",
    "Avis positif",
    "Si vous avez apprécié",
    "Si vous êtes satisfait",
    "Si vous n'êtes pas satisfait",
    "Vistaire presentation",
    "Présentation Vistaire",
    "contactez-nous",
    "rabais",
    "cadeau"
  ]) {
    assert.doesNotMatch(source + controls, new RegExp(forbidden, "i"));
  }
});

test("Google Review card links out safely and tracks only the outbound click", async () => {
  const [source, tracking] = await Promise.all([
    readFile(componentPath, "utf8"),
    readFile(trackingPath, "utf8")
  ]);

  assert.match(source, /target="_blank"/);
  assert.match(source, /rel="noopener noreferrer"/);
  assert.match(source, /trackGoogleReviewClick/);
  assert.match(tracking, /trackMenuEvent/);
  assert.match(tracking, /eventName:\s*"cta_clicked"/);
  assert.match(tracking, /ctaName:\s*"google_review"/);
  assert.doesNotMatch(source, /posted|published|reviewed|avis publie/i);
});

test("public menu renders Google Review card from the validated CTA helper", async () => {
  const [component, renderer, core] = await Promise.all([
    readFile(componentPath, "utf8"),
    readFile(rendererPath, "utf8"),
    readFile(corePath, "utf8")
  ]);

  assert.match(component, /getGoogleReviewCta/);
  assert.match(component, /resolveGoogleReviewCopy/);
  assert.match(component, /resolveTrouvableCopy/);
  assert.match(renderer, /GoogleReviewCard/);
  assert.match(renderer, /googleReview=\{menu\.googleReview\}/);
  assert.match(
    renderer,
    /const googleReviewLocale =\s*menu\.activeLocale \?\? query\?\.lang \?\? menu\.settings\.defaultLocale/
  );
  assert.match(renderer, /locale=\{googleReviewLocale\}/);
  assert.match(renderer, /localizedUiCopy=\{menu\.localizedUiCopy\}/);
  assert.doesNotMatch(renderer, /googleReview\.enabled[\s\S]{0,120}<a/);

  assert.match(core, /new URL/);
  assert.match(core, /parsed\.protocol === "https:"/);
  assert.doesNotMatch(component + renderer, /<iframe|<script|googleapis|gstatic|maps\.google|recaptcha/i);
});

test("Google Review card uses the shared Trouvable UI copy pack", async () => {
  const [source, controls] = await Promise.all([
    readFile(componentPath, "utf8"),
    readFile(controlsPath, "utf8")
  ]);

  assert.match(controls, /es:\s*\{/);
  assert.match(controls, /it:\s*\{/);
  assert.match(controls, /ar:\s*\{/);
  assert.match(controls, /googleReview:\s*TROUVABLE_GOOGLE_REVIEW_COPY/);
  assert.match(source, /resolveTrouvableCopy/);
  assert.match(source, /copy\.googleReview/);
  assert.match(source, /renderGoogleReviewTemplate/);
  assert.match(source, /restaurantName\|rating\|count/);
  assert.match(source, /presentationRatingLabel/);
  assert.doesNotMatch(source, /const resolvedLocale = normalizeLocale\(locale\)/);
  assert.match(source, /new Intl\.NumberFormat\(resolvedLocale/);
});
