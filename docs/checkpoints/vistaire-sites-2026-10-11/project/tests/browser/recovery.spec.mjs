import { test, expect } from "@playwright/test";
test("réduction du mouvement, erreur de modèle et reprise explicite", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".scene-canvas")).toHaveAttribute(
    "data-ready",
    "true",
    { timeout: 60000 },
  );
  await page.locator("#wearable").evaluate((el) =>
    window.scrollTo({
      top:
        el.id === "wearable"
          ? (document.querySelector(".opening-journey").offsetHeight -
              document.querySelector(".opening-stage").clientHeight) *
            0.95
          : el.getBoundingClientRect().top + scrollY + 200,
      behavior: "instant",
    }),
  );
  await expect(page.locator("html")).toHaveAttribute(
    "data-chapter",
    "wearable",
  );
  const bounds = await page.locator("#wearable .scene-focus").boundingBox();
  expect(bounds.width).toBeGreaterThan(300);
  expect(bounds.x).toBeGreaterThan(10);
  await page.screenshot({ path: "artifacts/mobile-reduced-motion.png" });
  await page.route("**/media/souffle.glb", (r) =>
    r.fulfill({ status: 503, body: "Controlled asset failure" }),
  );
  await page.locator("#grip").evaluate((el) =>
    window.scrollTo({
      top: el.getBoundingClientRect().top + scrollY + 200,
      behavior: "instant",
    }),
  );
  await page
    .getByRole("button", { name: "Soufflé chocolat", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Réessayer", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".scene-canvas")).toHaveAttribute(
    "data-model",
    "homard",
  );
  await expect(page.locator(".scene-canvas")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page.unroute("**/media/souffle.glb");
  await page.getByRole("button", { name: "Réessayer", exact: true }).click();
  await expect(page.locator(".scene-canvas")).toHaveAttribute(
    "data-model",
    "souffle",
    { timeout: 30000 },
  );
  await expect(page.locator(".model-error")).toHaveCount(0);
  await page.screenshot({ path: "artifacts/mobile-model-recovery.png" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("secours sans WebGL : le QR de continuité AR reste accessible", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (
        type === "webgl" ||
        type === "webgl2" ||
        type === "experimental-webgl"
      )
        return null;
      return getContext.call(this, type, ...args);
    };
  });
  await page.goto("/");
  await expect(page.locator(".gpu-status")).toBeVisible();
  await page.locator("#grip").evaluate((el) =>
    scrollTo({
      top: el.getBoundingClientRect().top + scrollY + 100,
      behavior: "instant",
    }),
  );
  await page
    .locator("#grip")
    .getByRole("button", { name: "Voir à ma table", exact: true })
    .click();
  await expect(page.locator(".ar-qr")).toBeVisible();
  await expect(page.locator(".ar-page-link")).toHaveAttribute(
    "href",
    /dish=homard#grip$/,
  );
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
