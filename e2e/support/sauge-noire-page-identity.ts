import { expect, type Page } from "@playwright/test";

type PageIdentitySnapshot = {
  cloneViolations: string[];
  duplicateIndexes: string[];
  duplicateInstanceIds: string[];
  originalCount: number;
  originalViolations: string[];
  unclassifiedIndexes: string[];
};

async function readPageIdentity(page: Page): Promise<PageIdentitySnapshot> {
  return page.locator('[data-page-flip-state="ready"]').first().evaluate((viewport) => {
    const indexedPages = [
      ...viewport.querySelectorAll<HTMLElement>(
        ".stf__item[data-sauge-flip-page-index]"
      )
    ];
    const originals = indexedPages.filter(
      (element) => element.dataset.saugePageOrigin === "react-original"
    );
    const clones = indexedPages.filter(
      (element) => element.dataset.saugeFlipClone === "true"
    );
    const indexes = [
      ...new Set(
        indexedPages
          .map((element) => element.dataset.saugeFlipPageIndex)
          .filter((index): index is string => Boolean(index))
      )
    ];
    const instanceIds = originals
      .map((element) => element.dataset.saugePageInstanceId)
      .filter((instanceId): instanceId is string => Boolean(instanceId));

    return {
      originalCount: originals.length,
      duplicateIndexes: indexes.filter(
        (index) =>
          originals.filter(
            (element) => element.dataset.saugeFlipPageIndex === index
          ).length !== 1
      ),
      duplicateInstanceIds: instanceIds.filter(
        (instanceId, position) => instanceIds.indexOf(instanceId) !== position
      ),
      unclassifiedIndexes: indexes.filter((index) =>
        indexedPages
          .filter((element) => element.dataset.saugeFlipPageIndex === index)
          .some(
            (element) =>
              element.dataset.saugePageOrigin !== "react-original" &&
              element.dataset.saugeFlipClone !== "true"
          )
      ),
      originalViolations: originals.flatMap((element) => {
        const index = element.dataset.saugeFlipPageIndex ?? "unknown";
        const violations = [];
        if (element.dataset.saugeFlipClone === "true") violations.push("clone");
        if (element.getAttribute("aria-hidden") === "true") violations.push("hidden");
        if (element.hasAttribute("inert")) violations.push("inert");
        if (!element.dataset.saugePageInstanceId) violations.push("missing-instance-id");
        return violations.map((violation) => `${index}:${violation}`);
      }),
      cloneViolations: clones.flatMap((element) => {
        const index = element.dataset.saugeFlipPageIndex ?? "unknown";
        const violations = [];
        if (element.dataset.saugePageOrigin !== "pageflip-clone") {
          violations.push("origin");
        }
        if (element.getAttribute("aria-hidden") !== "true") violations.push("visible");
        if (!element.hasAttribute("inert")) violations.push("interactive");
        if (element.dataset.saugePageCloneReason !== "dom-reference-mismatch") {
          violations.push("reason");
        }
        const focusableDescendant = [
          ...element.querySelectorAll<HTMLElement>(
            "a[href], button, input, select, textarea, [tabindex]"
          )
        ].find((candidate) => candidate.tabIndex !== -1);
        if (focusableDescendant) violations.push("focusable-descendant");
        return violations.map((violation) => `${index}:${violation}`);
      })
    };
  });
}

export async function assertSaugeNoirePageIdentity(
  page: Page,
  label: string
) {
  await expect
    .poll(async () => {
      const snapshot = await readPageIdentity(page);
      return (
        snapshot.originalCount > 0 &&
        snapshot.duplicateIndexes.length === 0 &&
        snapshot.duplicateInstanceIds.length === 0 &&
        snapshot.unclassifiedIndexes.length === 0 &&
        snapshot.originalViolations.length === 0 &&
        snapshot.cloneViolations.length === 0
      );
    }, {
      message: `${label}: PageFlip originals and clones must have deterministic identities`,
      timeout: 10_000
    })
    .toBe(true);

  const snapshot = await readPageIdentity(page);
  expect(snapshot.originalCount, `${label}: expected React originals`).toBeGreaterThan(0);
  expect(snapshot.duplicateIndexes, `${label}: one original per logical index`).toEqual([]);
  expect(snapshot.duplicateInstanceIds, `${label}: unique original instance ids`).toEqual([]);
  expect(snapshot.unclassifiedIndexes, `${label}: every indexed node is classified`).toEqual([]);
  expect(snapshot.originalViolations, `${label}: originals stay visible and interactive`).toEqual([]);
  expect(snapshot.cloneViolations, `${label}: clones stay hidden and inert`).toEqual([]);
}
