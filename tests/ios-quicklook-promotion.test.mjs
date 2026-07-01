import test from "node:test";
import assert from "node:assert/strict";

import {
  MAX_PRODUCTION_IOS_USDZ_BYTES,
  PRODUCTION_PROMOTION_ORDER,
  selectProductionPromotionCandidate
} from "../scripts/shared/ios-quicklook-promotion.mjs";

const mib = 1024 * 1024;

function candidate(
  level,
  {
    bytes = 2 * mib,
    valid = true,
    grounded = true,
    centeredXZ = true,
    failed = false
  } = {}
) {
  return {
    level,
    label: level[0].toUpperCase() + level.slice(1),
    failed,
    error: failed ? "conversion failed" : undefined,
    usdzPath: `asset-review/${level}.usdz`,
    usdz: { bytes, valid },
    bounds: { grounded, centeredXZ },
    productionBudgetPass: bytes <= MAX_PRODUCTION_IOS_USDZ_BYTES
  };
}

test("auto promotion falls back from an oversized ultra to a valid extreme candidate", () => {
  const selection = selectProductionPromotionCandidate({
    requestedLevel: "auto",
    candidates: [
      candidate("conservative", { failed: true }),
      candidate("balanced", { failed: true }),
      candidate("ultra", { bytes: 5.65 * mib }),
      candidate("extreme", { bytes: 1.93 * mib })
    ]
  });

  assert.equal(selection.selectedLevel, "extreme");
  assert.equal(selection.selectedCandidate.usdz.bytes, 1.93 * mib);
  assert.match(selection.summary, /ultra/i);
  assert.match(selection.summary, /> 5\.00 MiB|above 5\.00 MiB/i);
});

test("auto promotion chooses the highest quality valid candidate in the owner order", () => {
  assert.deepEqual(PRODUCTION_PROMOTION_ORDER, [
    "conservative",
    "balanced",
    "ultra",
    "extreme"
  ]);

  const selection = selectProductionPromotionCandidate({
    requestedLevel: "auto",
    candidates: [
      candidate("conservative", { bytes: 4.9 * mib }),
      candidate("balanced", { bytes: 3.8 * mib }),
      candidate("ultra", { bytes: 2.7 * mib }),
      candidate("extreme", { bytes: 1.2 * mib })
    ]
  });

  assert.equal(selection.selectedLevel, "conservative");
});

test("explicit ultra promotion remains strict even when another candidate is valid", () => {
  assert.throws(
    () =>
      selectProductionPromotionCandidate({
        requestedLevel: "ultra",
        candidates: [
          candidate("ultra", { bytes: 5.65 * mib }),
          candidate("extreme", { bytes: 1.93 * mib })
        ]
      }),
    /ultra.*5\.65 MiB.*above 5\.00 MiB/i
  );
});

test("auto promotion fails clearly when no candidate is production safe", () => {
  assert.throws(
    () =>
      selectProductionPromotionCandidate({
        requestedLevel: "auto",
        candidates: [
          candidate("conservative", { bytes: 5.4 * mib }),
          candidate("balanced", { valid: false }),
          candidate("ultra", { grounded: false }),
          candidate("extreme", { centeredXZ: false })
        ]
      }),
    /No production-safe USDZ candidate.*conservative.*balanced.*ultra.*extreme/is
  );
});
