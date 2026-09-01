import assert from "node:assert/strict";
import test from "node:test";

import {
  EXTRA_TABLE_PRICE_BY_COLLECTION,
  INCLUDED_TABLE_COUNT,
  MIN_TABLE_COUNT,
  calculateEstimatedSetupPrice,
  calculateExtraTableCount,
  normalizeTableCount
} from "../lib/pricingCalculator.ts";

const COLLECTIONS = {
  acrylique: { baseSetupAmount: 2_000, extraTablePrice: 40 },
  sculpte: { baseSetupAmount: 2_050, extraTablePrice: 45 },
  carre: { baseSetupAmount: 2_100, extraTablePrice: 55 },
  signature: { baseSetupAmount: 2_200, extraTablePrice: 55 }
};

function estimate(collectionId, tableCount) {
  return calculateEstimatedSetupPrice({
    collectionId,
    baseSetupAmount: COLLECTIONS[collectionId].baseSetupAmount,
    tableCount
  });
}

test("pricing table rules expose the approved included quantity and supplements", () => {
  assert.equal(INCLUDED_TABLE_COUNT, 20);
  assert.equal(MIN_TABLE_COUNT, 1);
  assert.deepEqual(EXTRA_TABLE_PRICE_BY_COLLECTION, {
    acrylique: 40,
    sculpte: 45,
    carre: 55,
    signature: 55
  });
});

test("Acrylique matches the complete approved pricing matrix", () => {
  const matrix = new Map([
    [1, 2_000],
    [10, 2_000],
    [20, 2_000],
    [21, 2_040],
    [25, 2_200],
    [30, 2_400],
    [40, 2_800],
    [50, 3_200]
  ]);

  for (const [tableCount, expected] of matrix) {
    assert.equal(estimate("acrylique", tableCount), expected, `${tableCount} tables`);
  }
});

test("Sculpté, Carré and Signature match the approved boundary matrices", () => {
  const matrices = {
    sculpte: new Map([
      [20, 2_050],
      [25, 2_275],
      [30, 2_500],
      [40, 2_950],
      [50, 3_400]
    ]),
    carre: new Map([
      [20, 2_100],
      [25, 2_375],
      [30, 2_650],
      [40, 3_200],
      [50, 3_750]
    ]),
    signature: new Map([
      [20, 2_200],
      [25, 2_475],
      [30, 2_750],
      [40, 3_300],
      [50, 3_850]
    ])
  };

  for (const [collectionId, matrix] of Object.entries(matrices)) {
    for (const [tableCount, expected] of matrix) {
      assert.equal(estimate(collectionId, tableCount), expected, `${collectionId}: ${tableCount}`);
    }
  }
});

test("37 tables yields the exact four approved estimates", () => {
  assert.deepEqual(
    Object.fromEntries(
      Object.keys(COLLECTIONS).map((collectionId) => [collectionId, estimate(collectionId, 37)])
    ),
    {
      acrylique: 2_680,
      sculpte: 2_815,
      carre: 3_035,
      signature: 3_135
    }
  );
});

test("table counts are normalized safely and never reduce the setup minimum", () => {
  assert.equal(normalizeTableCount(Number.NaN), 1);
  assert.equal(normalizeTableCount(Number.POSITIVE_INFINITY), 1);
  assert.equal(normalizeTableCount(-12), 1);
  assert.equal(normalizeTableCount(7.9), 7);
  assert.equal(calculateExtraTableCount(1), 0);
  assert.equal(calculateExtraTableCount(20), 0);
  assert.equal(calculateExtraTableCount(21), 1);
  assert.equal(estimate("signature", -100), 2_200);
});
