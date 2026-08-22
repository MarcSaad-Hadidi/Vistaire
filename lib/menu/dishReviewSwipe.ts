export const DISH_SWIPE_MIN_DISTANCE = 46;
export const DISH_SWIPE_AXIS_RATIO = 1.35;
export const DISH_SWIPE_SCROLL_TOLERANCE = 8;

export type DishSwipeGesture = "previous" | "next" | null;

export function resolveDishSwipeGesture(
  deltaX: number,
  deltaY: number,
  scrollDelta: number
): DishSwipeGesture {
  if (Math.abs(scrollDelta) > DISH_SWIPE_SCROLL_TOLERANCE) {
    return null;
  }

  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);

  if (absX >= DISH_SWIPE_MIN_DISTANCE && absX > absY * DISH_SWIPE_AXIS_RATIO) {
    return deltaX < 0 ? "next" : "previous";
  }

  return null;
}

export function getDishSwipeScrollTop(root: HTMLElement): number {
  let node: HTMLElement | null = root;

  while (node) {
    if (node.scrollHeight > node.clientHeight + 1) {
      return node.scrollTop;
    }
    node = node.parentElement;
  }

  return window.scrollY;
}
