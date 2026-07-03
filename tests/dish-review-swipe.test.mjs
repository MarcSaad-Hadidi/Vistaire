import test from "node:test";
import assert from "node:assert/strict";

const {
  resolveDishSwipeGesture,
  DISH_SWIPE_MIN_DISTANCE,
  DISH_SWIPE_AXIS_RATIO
} = await import("../lib/menu/dishReviewSwipe.ts");

test("resolveDishSwipeGesture opens review on upward vertical swipe", () => {
  assert.equal(
    resolveDishSwipeGesture(0, -DISH_SWIPE_MIN_DISTANCE - 4, 0),
    "reviewOpen"
  );
  assert.equal(
    resolveDishSwipeGesture(12, -DISH_SWIPE_MIN_DISTANCE - 8, 0),
    "reviewOpen"
  );
});

test("resolveDishSwipeGesture ignores ambiguous diagonal swipes", () => {
  assert.equal(
    resolveDishSwipeGesture(-DISH_SWIPE_MIN_DISTANCE - 10, -20, 0),
    "next"
  );
  assert.equal(resolveDishSwipeGesture(30, -40, 0), null);
});

test("resolveDishSwipeGesture ignores gestures during scroll", () => {
  assert.equal(resolveDishSwipeGesture(0, -80, 12), null);
});

test("resolveDishSwipeGesture keeps horizontal dish navigation", () => {
  const horizontalDistance = DISH_SWIPE_MIN_DISTANCE + 6;
  const verticalNoise = Math.floor(horizontalDistance / DISH_SWIPE_AXIS_RATIO) - 1;

  assert.equal(
    resolveDishSwipeGesture(-horizontalDistance, verticalNoise, 0),
    "next"
  );
  assert.equal(
    resolveDishSwipeGesture(horizontalDistance, -verticalNoise, 0),
    "previous"
  );
});
