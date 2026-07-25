import test from "node:test";
import assert from "node:assert/strict";

import { capitalizeListItem, capitalizeListItems } from "../lib/menu/listText.ts";

test("capitalizes the first letter of ingredient and option labels only", () => {
  assert.equal(capitalizeListItem("crabe des neiges"), "Crabe des neiges");
  assert.equal(capitalizeListItem("sans lait d’amande"), "Sans lait d’amande");
  assert.equal(capitalizeListItem("portion supplémentaire +3 $"), "Portion supplémentaire +3 $");
  assert.equal(capitalizeListItem(""), "");
});

test("capitalizes lists without changing their order", () => {
  assert.deepEqual(capitalizeListItems(["yuzu", "shiso"]), ["Yuzu", "Shiso"]);
});
