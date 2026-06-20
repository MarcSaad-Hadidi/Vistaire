import test from "node:test";
import assert from "node:assert/strict";

import {
  formatPriceCentsForMenu,
  parsePriceToCents
} from "../lib/owner/price.ts";

test("parsePriceToCents accepts integer, decimal dot, and decimal comma prices", () => {
  assert.equal(parsePriceToCents("14,99").cents, 1499);
  assert.equal(parsePriceToCents("14.99").cents, 1499);
  assert.equal(parsePriceToCents("15").cents, 1500);
  assert.equal(parsePriceToCents("15.00").cents, 1500);
  assert.equal(parsePriceToCents(15).cents, 1500);
});

test("parsePriceToCents rejects invalid, zero, negative, and over-precise prices", () => {
  for (const input of ["14.999", "abc", "-2", "0", "", "  "]) {
    const result = parsePriceToCents(input);
    assert.equal(result.ok, false, String(input));
    assert.match(result.error, /prix/i);
  }
});

test("formatPriceCentsForMenu preserves decimal intent without rounding", () => {
  assert.equal(
    formatPriceCentsForMenu(1499, "CAD", { displayPriceMode: "decimal" }),
    "14,99\u00a0$"
  );
  assert.equal(
    formatPriceCentsForMenu(1500, "CAD", { displayPriceMode: "integer" }),
    "15\u00a0$"
  );
  assert.equal(
    formatPriceCentsForMenu(1500, "CAD", { displayPriceMode: "decimal" }),
    "15,00\u00a0$"
  );
});
