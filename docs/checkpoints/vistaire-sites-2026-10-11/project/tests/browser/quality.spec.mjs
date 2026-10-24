import { test, expect } from "@playwright/test";
import { dishes } from "../../src/content.js";
import { collections } from "../../src/content.js";

test("Retina natif, parcours de restaurant et sept vrais plats 3D", async ({
  page,
}, testInfo) => {
  test.setTimeout(480000);
  const errors = [],
    failed = [],
    poses = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400)
      failed.push(`${response.status()} ${response.url()}`);
  });
  await page.goto("/");
  const canvas = page.locator(".scene-canvas");
  await expect(canvas).toHaveAttribute("data-ready", "true", {
    timeout: 90000,
  });
  const resolution = await canvas.evaluate((canvas) => {
    const gl = canvas.getContext("webgl2");
    return {
      dpr: devicePixelRatio,
      size: [canvas.width, canvas.height],
      antialias: gl.getContextAttributes().antialias,
      samples: gl.getParameter(gl.SAMPLES),
    };
  });
  expect(resolution.dpr).toBe(3);
  expect(resolution.size).toEqual([1170, 2532]);
  expect(resolution.antialias).toBe(true);
  await expect(canvas).toHaveAttribute("data-support-ready", "true");
  await expect(canvas).toHaveAttribute("data-phone-ready", "true");
  await expect(canvas).toHaveAttribute("data-phone", "iphone-16");
  await expect(canvas).toHaveAttribute("data-restaurant-ready", "true");
  await expect(canvas).toHaveAttribute("data-restaurant", "uploaded-evening");

  async function chapter(id, progress = 0.33) {
    await page.locator(`#${id}`).evaluate((el, p) => {
      const journey = el.closest(".opening-journey");
      const opening = { hero: p * 0.22, ai: 0.42 + p * 0.24, wearable: 0.95 }[
        el.id
      ];
      const target = journey
        ? journey.getBoundingClientRect().top +
          scrollY +
          (journey.offsetHeight - journey.firstElementChild.clientHeight) *
            opening
        : el.getBoundingClientRect().top +
          scrollY +
          Math.max(0, el.offsetHeight - el.firstElementChild.clientHeight) * p;
      scrollTo({ top: target, behavior: "instant" });
    }, progress);
    await expect(canvas).toHaveAttribute("data-section", id, {
      timeout: 30000,
    });
    await expect(canvas).toHaveAttribute("data-settled", "true", {
      timeout: 90000,
    });
    poses.push(await canvas.evaluate((c) => ({ ...c.dataset })));
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  const ids = await page
    .locator(".chapter")
    .evaluateAll((elements) => elements.map((el) => el.id));
  expect(ids).toHaveLength(12);
  for (const id of ids) {
    await chapter(id);
    if (id === "open-weight") {
      await expect(canvas).toHaveAttribute("data-suspended", "true");
      const hiddenFrame = await canvas.getAttribute("data-frames");
      await page.waitForTimeout(300);
      expect(await canvas.getAttribute("data-frames")).toBe(hiddenFrame);
    } else await expect(canvas).toHaveAttribute("data-suspended", "false");
    await page.screenshot({
      timeout: 60000,
      path: `artifacts/retina-${id}.png`,
    });
  }
  const rendered = poses.filter((p) => p.section !== "open-weight");
  expect(new Set(rendered.map((p) => p.atmosphere)).size).toBe(11);
  expect(new Set(rendered.map((p) => p.roomPosition)).size).toBe(11);
  for (const collection of collections) {
    await chapter("product");
    await page.getByRole("tab", { name: collection.name, exact: true }).click();
    await expect(canvas).toHaveAttribute("data-support", collection.id);
    await page.screenshot({
      timeout: 60000,
      path: `artifacts/retina-support-${collection.id}-product.png`,
    });
    await chapter("encryption");
    await page.screenshot({
      timeout: 60000,
      path: `artifacts/retina-support-${collection.id}-front.png`,
    });
    await page
      .getByRole("button", { name: "Retourner le support", exact: true })
      .click();
    await expect(canvas).toHaveAttribute("data-support-flipped", "true");
    await expect(canvas).toHaveAttribute("data-settled", "true", {
      timeout: 30000,
    });
    await page.screenshot({
      timeout: 60000,
      path: `artifacts/retina-support-${collection.id}-back.png`,
    });
    await page
      .getByRole("button", { name: "Voir le QR code", exact: true })
      .click();
    await expect(canvas).toHaveAttribute("data-support-flipped", "false");
  }
  await chapter("ai", 0.12);
  const approach = await canvas.getAttribute("data-camera-position");
  await chapter("ai", 0.72);
  await expect
    .poll(() => canvas.getAttribute("data-camera-position"))
    .not.toBe(approach);
  await chapter("encryption");
  await page
    .getByRole("button", { name: "Retourner le support", exact: true })
    .click();
  await expect(canvas).toHaveAttribute("data-support-flipped", "true");
  await expect(canvas).toHaveAttribute("data-settled", "true", {
    timeout: 30000,
  });
  await page.waitForTimeout(500);
  const settledFrame = await canvas.getAttribute("data-frames");
  await page.mouse.move(180, 150);
  await page.waitForTimeout(1000);
  expect(await canvas.getAttribute("data-frames")).toBe(settledFrame);
  await chapter("grip");
  const buttons = page
    .getByRole("group", { name: "Choisir un plat 3D" })
    .getByRole("button");
  await expect(buttons).toHaveCount(7);
  for (const dish of dishes) {
    const button = page
      .getByRole("group", { name: "Choisir un plat 3D" })
      .getByRole("button", { name: dish.label || dish.name, exact: true });
    await button.click();
    await expect(canvas).toHaveAttribute("data-model", dish.id, {
      timeout: 90000,
    });
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".model-loading")).toHaveCount(0);
    await expect(page.locator(".model-error")).toHaveCount(0);
    await page.screenshot({
      timeout: 60000,
      path: `artifacts/retina-dish-${dish.id}.png`,
    });
  }
  await page
    .getByRole("slider", { name: "Rotation du plat 3D", exact: true })
    .press("Home");
  await expect(canvas).toHaveAttribute("data-settled", "true", {
    timeout: 30000,
  });
  await page.waitForTimeout(500);
  const rotationFrame = await canvas.getAttribute("data-frames");
  await page.waitForTimeout(1000);
  expect(await canvas.getAttribute("data-frames")).toBe(rotationFrame);
  expect(errors).toEqual([]);
  expect(failed).toEqual([]);
  await testInfo.attach("retina-journey", {
    body: JSON.stringify({ resolution, poses, errors, failed }, null, 2),
    contentType: "application/json",
  });
});
