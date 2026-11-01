import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPageMarkdown, buildLlmsFullText } from '../lib/agent-discovery/pageMarkdown.ts';
import { getSeoPage } from '../lib/seoPages.ts';
import { getEditorialGuides } from '../lib/editorialGuides.ts';
import { getPricingPage } from '../lib/pricingPage.ts';
import { SEO_GEO_PAGES_EN } from '../lib/seoGeoPages.ts';

test('every structured public page answers agents with its own complete markdown', () => {
  const pillar = getSeoPage('menu-qr-code-restaurant');
  const md = buildPageMarkdown(pillar.path);
  assert.ok(md.startsWith(`# ${pillar.h1}
`), 'the page H1 heads the markdown');
  assert.ok(md.includes(pillar.answer[0]) && md.includes(pillar.faq[0].question) && md.includes(pillar.faq[0].answer));
  const guide = getEditorialGuides('en')[0];
  assert.ok(buildPageMarkdown(guide.path).includes(guide.sections[0].title));
  const geo = SEO_GEO_PAGES_EN[0];
  assert.ok(buildPageMarkdown(geo.path).includes(geo.directAnswer));
  const pricing = getPricingPage('fr');
  const pricingMd = buildPageMarkdown(pricing.path);
  for (const collection of pricing.collections) assert.ok(pricingMd.includes(collection.setupPrice), collection.id);
  assert.equal(buildPageMarkdown('/owner/dashboard'), null);
  assert.equal(buildPageMarkdown('/does-not-exist'), null);
});

test('llms-full.txt carries every structured page once, with its canonical URL', () => {
  const full = buildLlmsFullText();
  const pillar = getSeoPage('menu-digital-restaurant', 'en');
  assert.ok(full.includes(pillar.h1) && full.includes('https://www.vistaire.ca' + pillar.path));
  assert.equal(full.split(`\n# ${pillar.h1}\n`).length, 2, 'no duplicated page');
});
