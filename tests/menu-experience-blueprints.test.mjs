import test from "node:test";
import assert from "node:assert/strict";

import {
  MENU_EXPERIENCE_BLUEPRINTS,
  MENU_EXPERIENCE_BLUEPRINT_IDS,
  getMenuExperienceBlueprint
} from "../lib/menu/menuExperienceBlueprints.ts";

const REQUIRED_BLUEPRINTS = [
  "classic-tabs",
  "editorial-magazine",
  "photo-grid",
  "fast-board",
  "bento-showcase",
  "story-first",
  "minimal-list",
  "lounge-cocktail",
  "family-comfort",
  "immersive-first",
  "tasting-journey",
  "compact-qr"
];

test("menu experience blueprints expose the 12 required structures", () => {
  assert.ok(MENU_EXPERIENCE_BLUEPRINTS.length >= 12);
  assert.deepEqual(
    REQUIRED_BLUEPRINTS.filter(
      (blueprint) => !MENU_EXPERIENCE_BLUEPRINT_IDS.includes(blueprint)
    ),
    []
  );
});

test("each blueprint has structural defaults and a render strategy", () => {
  const renderStrategies = new Set();

  for (const id of REQUIRED_BLUEPRINTS) {
    const blueprint = getMenuExperienceBlueprint(id);
    assert.equal(blueprint.id, id);
    assert.ok(blueprint.name.length > 0);
    assert.ok(blueprint.description.length > 0);
    assert.ok(blueprint.bestFor.length > 0);
    assert.ok(blueprint.previewNotes.length > 0);
    assert.ok(blueprint.defaultNavigation);
    assert.ok(blueprint.defaultCardVariant);
    assert.ok(blueprint.defaultDetailStyle);
    assert.ok(blueprint.defaultDishOpenMode);
    assert.ok(blueprint.defaultWelcomeLayout);
    assert.ok(blueprint.sectionOrder.length > 0);
    assert.ok(blueprint.renderStrategy);
    renderStrategies.add(blueprint.renderStrategy);
  }

  assert.ok(renderStrategies.size >= 10);
});

test("unknown blueprint falls back to classic tabs", () => {
  assert.equal(getMenuExperienceBlueprint("missing-layout").id, "classic-tabs");
});
