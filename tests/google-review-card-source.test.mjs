import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const componentPath = "components/menu/GoogleReviewCard.tsx";
const rendererPath = "components/menu/PublicMenuRenderer.tsx";
const corePath = "lib/menu/publicMenuCore.ts";

test("Google Review card uses neutral approved wording and no incentive or gating copy", async () => {
  const source = await readFile(componentPath, "utf8");

  for (const text of [
    "Votre expérience compte",
    "Partagez votre expérience chez",
    "Votre avis Google aide l’équipe à mieux comprendre chaque visite",
    "Laisser un avis Google",
    "Aucun avantage n’est offert en échange d’un avis.",
    "Votre avis doit refléter votre expérience réelle."
  ]) {
    assert.match(source, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  for (const forbidden of [
    "Laissez 5 étoiles",
    "Avis positif",
    "Si vous avez apprécié",
    "Si vous êtes satisfait",
    "Si vous n’êtes pas satisfait",
    "Vistaire presentation",
    "Présentation Vistaire",
    "contactez-nous",
    "rabais",
    "cadeau"
  ]) {
    assert.doesNotMatch(source, new RegExp(forbidden, "i"));
  }
});

test("Google Review card links out safely and tracks only the outbound click", async () => {
  const source = await readFile(componentPath, "utf8");

  assert.match(source, /target="_blank"/);
  assert.match(source, /rel="noopener noreferrer"/);
  assert.match(source, /trackMenuEvent/);
  assert.match(source, /eventName:\s*"cta_clicked"/);
  assert.match(source, /ctaName:\s*"google_review"/);
  assert.doesNotMatch(source, /posted|published|reviewed|avis publie/i);
});

test("public menu renders Google Review card from the validated CTA helper", async () => {
  const [component, renderer, core] = await Promise.all([
    readFile(componentPath, "utf8"),
    readFile(rendererPath, "utf8"),
    readFile(corePath, "utf8")
  ]);

  assert.match(component, /getGoogleReviewCta/);
  assert.match(renderer, /GoogleReviewCard/);
  assert.match(renderer, /googleReview=\{menu\.googleReview\}/);
  assert.doesNotMatch(renderer, /googleReview\.enabled[\s\S]{0,120}<a/);

  assert.match(core, /new URL/);
  assert.match(core, /parsed\.protocol === "https:"/);
  assert.doesNotMatch(component + renderer, /<iframe|<script|googleapis|gstatic|maps\.google|recaptcha/i);
});
