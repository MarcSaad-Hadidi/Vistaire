import { test, expect } from "@playwright/test";
import { dishes, collections, experiences } from "../../src/content.js";

async function chapter(page, id, progress = 0.35) {
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
  await expect(page.locator(".scene-canvas")).toHaveAttribute(
    "data-section",
    id,
    { timeout: 45000 },
  );
  await expect(page.locator(".scene-canvas")).toHaveAttribute(
    "data-settled",
    "true",
    { timeout: 45000 },
  );
}
async function frame(page, id) {
  const result = await page.locator(`#${id}`).evaluate((el) => {
    const c = document.querySelector(".scene-canvas");
    const focus = el.querySelector(".scene-focus");
    if (!focus || !c.dataset.subjectBounds) return null;
    // During the continuous opening the active framing rectangle interpolates
    // between panels. The individual panel's DOM slot is not that moving frame.
    const model = JSON.parse(c.dataset.subjectBounds),
      f = c.dataset.focusBounds
        ? JSON.parse(c.dataset.focusBounds)
        : focus.getBoundingClientRect();
    return {
      model,
      focus: { x: f.x, y: f.y, width: f.width, height: f.height },
      width: document.documentElement.scrollWidth,
      viewport: innerWidth,
    };
  });
  if (!result) return;
  expect(result.width).toBeLessThanOrEqual(result.viewport);
  const { model: m, focus: f } = result;
  expect(m.x).toBeGreaterThanOrEqual(f.x - 2);
  expect(m.y).toBeGreaterThanOrEqual(f.y - 2);
  expect(m.x + m.width).toBeLessThanOrEqual(f.x + f.width + 2);
  expect(m.y + m.height).toBeLessThanOrEqual(f.y + f.height + 2);
}

test("parcours, sept plats, quatre supports, vidéos 2×, AR, tarifs et navigation", async ({
  page,
}, info) => {
  test.setTimeout(480000);
  const errors = [],
    failed = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
  });
  await page.goto("/");
  const canvas = page.locator(".scene-canvas");
  await expect(canvas).toHaveAttribute("data-ready", "true", {
    timeout: 90000,
  });
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator(".chapter")).toHaveCount(12);
  await expect(
    page.getByRole("textbox", { name: "Nom du restaurant" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Voir l’expérience Vistaire en vidéo" }),
  ).toHaveCount(0);
  await expect(page.locator(".model-tab")).toHaveCount(0);
  await page.screenshot({
    timeout: 60000,
    path: `artifacts/${info.project.name}-hero.png`,
  });
  await page
    .getByRole("button", { name: "Explorer la carte", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator(".menu-preview-dishes img")).toHaveCount(7);
  await page.waitForFunction(() =>
    [...document.querySelectorAll(".menu-preview-dishes img")].every(
      (x) => x.complete && x.naturalWidth >= 900,
    ),
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Homard bleu, bisque/ })
    .click();
  await expect(
    page.getByRole("dialog").getByText("Crustacés, lait"),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  for (const id of [
    "ai",
    "wearable",
    "features",
    "encryption",
    "grip",
    "sustainability",
    "testimonies",
    "social-content",
    "product",
    "open-weight",
    "footer",
  ]) {
    await chapter(page, id);
    await frame(page, id);
    await page.screenshot({
      timeout: 60000,
      path: `artifacts/${info.project.name}-${id}.png`,
    });
  }
  await chapter(page, "encryption");
  await page
    .getByRole("button", { name: "Retourner le support", exact: true })
    .click();
  await expect(canvas).toHaveAttribute("data-support-flipped", "true");
  await page
    .getByRole("button", { name: "Voir le QR code", exact: true })
    .click();
  await chapter(page, "grip");
  await expect(page.locator(".dish-switch button")).toHaveCount(7);
  for (const item of dishes) {
    await page
      .locator(".dish-switch")
      .getByRole("button", { name: item.label, exact: true })
      .click();
    await expect(canvas).toHaveAttribute("data-model", item.id, {
      timeout: 90000,
    });
    await expect(canvas).toHaveAttribute("data-settled", "true", {
      timeout: 45000,
    });
    await frame(page, "grip");
    await page.screenshot({
      timeout: 60000,
      path: `artifacts/${info.project.name}-dish-${item.id}.png`,
    });
    const response = await page.request.head(item.iosModel);
    expect(response.status()).toBe(200);
  }
  const rotation = page.getByRole("slider", {
    name: "Faire tourner le plat en 3D",
    exact: true,
  });
  await rotation.focus();
  await rotation.press("ArrowRight");
  await expect(rotation).toHaveAttribute("aria-valuenow", "189");
  await page
    .locator("#grip")
    .getByRole("button", { name: "Voir à ma table", exact: true })
    .click();
  await expect(page.locator(".ar-qr")).toBeVisible();
  await expect(page.locator(".ar-page-link")).toHaveAttribute(
    "href",
    /\?dish=burger#grip$/,
  );
  await page.keyboard.press("Escape");
  await chapter(page, "product");
  for (const item of collections) {
    await page.getByRole("tab", { name: item.name, exact: true }).click();
    await expect(canvas).toHaveAttribute("data-support", item.id, {
      timeout: 45000,
    });
    const control = page.getByRole("slider", {
      name: `Tourner le support ${item.name} en 3D`,
      exact: true,
    });
    await control.focus();
    await control.press("ArrowRight");
    await expect(control).toHaveAttribute("aria-valuenow", "15");
    const b = await control.boundingBox();
    if (info.project.name === "desktop") {
      await page.mouse.move(b.x + b.width * 0.4, b.y + b.height * 0.5);
      await page.mouse.down();
      await page.mouse.move(b.x + b.width * 0.65, b.y + b.height * 0.5, {
        steps: 5,
      });
      await page.mouse.up();
    } else {
      const cdp = await page.context().newCDPSession(page),
        y = b.y + b.height * 0.5;
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x: b.x + b.width * 0.4, y }],
      });
      for (let i = 1; i <= 5; i++) {
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x: b.x + b.width * (0.4 + i * 0.05), y }],
        });
        await page.waitForTimeout(30);
      }
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      await cdp.detach();
    }
    expect(Number(await control.getAttribute("aria-valuenow"))).toBeGreaterThan(
      50,
    );
    await page
      .getByRole("button", { name: "Recentrer le support", exact: true })
      .click();
    await expect(control).toHaveAttribute("aria-valuenow", "0");
    await expect(canvas).toHaveAttribute("data-settled", "true", {
      timeout: 45000,
    });
    await frame(page, "product");
  }
  await page
    .locator("#product")
    .getByRole("button", { name: "Composer votre expérience", exact: true })
    .click();
  await page.getByRole("spinbutton", { name: "Nombre de supports" }).fill("25");
  await expect(page.locator(".estimate-extra")).toContainText("sur devis");
  await expect(page.locator(".estimate-price strong")).toContainText("2 200");
  await page.keyboard.press("Escape");
  for (let i = 0; i < 3; i++) {
    await chapter(page, "social-content", (i + 0.15) / 3);
    const video = page.locator(".social-rail article").nth(i).locator("video");
    await expect.poll(() => video.evaluate((v) => v.playbackRate)).toBe(1);
    await page.waitForFunction(
      (i) => {
        const v = document.querySelectorAll(".social-rail video")[i];
        return v.currentTime > 0.15 && !v.paused && !v.error;
      },
      i,
      { timeout: 30000 },
    );
    await expect(video).toHaveClass("has-decoded-frame");
    const link = page
      .locator(".social-rail article")
      .nth(i)
      .locator(".restaurant-menu-link");
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute(
      "href",
      `https://www.vistaire.ca/menu/${experiences[i].id}?lang=fr-CA`,
    );
    const videoLayout = await video.evaluate((v) => ({
      ratio: v.clientWidth / v.clientHeight,
      fit: getComputedStyle(v).objectFit,
    }));
    expect(videoLayout.ratio).toBeCloseTo(390 / 844, 2);
    expect(videoLayout.fit).toBe("contain");
    await page.screenshot({
      timeout: 60000,
      path: `artifacts/${info.project.name}-menu-${experiences[i].id}.png`,
    });
  }
  await chapter(page, "open-weight");
  await expect(page.locator("#open-weight")).toContainText("12 mois");
  await expect(page.locator("#open-weight")).toContainText("200");
  await expect(page.locator("#open-weight")).toContainText("Pilotage");
  await page
    .locator(".pricing-collections")
    .getByRole("button", { name: /Carré/ })
    .click();
  await expect(page.locator(".pricing-amount").first()).toContainText("2 100");
  await page
    .getByRole("switch", {
      name: "Ajouter Vistaire Pilotage pour 100 CAD par mois",
    })
    .check();
  await expect(page.locator(".pricing-amount").nth(1)).toContainText("300");
  await page.screenshot({
    timeout: 60000,
    path: `artifacts/${info.project.name}-pricing-options.png`,
  });
  await page
    .locator("#open-weight")
    .getByRole("button", { name: "Composer votre expérience", exact: true })
    .click();
  await expect(page.locator(".estimate-price")).toContainText("300 CAD / mois");
  await page.keyboard.press("Escape");
  if (info.project.name === "desktop")
    await page
      .getByRole("navigation", { name: "Navigation principale" })
      .getByRole("button", { name: "Contact", exact: true })
      .click();
  else {
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await expect(page.locator("#mobile-menu button").first()).toBeFocused();
    await page
      .locator("#mobile-menu")
      .getByRole("button", { name: /Contact/ })
      .click();
  }
  await expect(page.locator("html")).toHaveAttribute("data-chapter", "footer", {
    timeout: 30000,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  expect(failed).toEqual([]);
  await info.attach("runtime", {
    body: JSON.stringify({ errors, failed }),
    contentType: "application/json",
  });
});

test("défilement natif conservé sur les objets interactifs", async ({
  page,
}, info) => {
  await page.goto("/");
  await expect(page.locator(".scene-canvas")).toHaveAttribute(
    "data-ready",
    "true",
    { timeout: 90000 },
  );
  await chapter(page, "product", 0.1);
  const focus = await page.locator("#product .scene-focus").boundingBox(),
    before = await page.evaluate(() => scrollY);
  if (info.project.name === "desktop") {
    await page.mouse.move(
      focus.x + focus.width / 2,
      focus.y + focus.height / 2,
    );
    await page.mouse.wheel(0, 300);
  } else {
    const cdp = await page.context().newCDPSession(page);
    const x = focus.x + focus.width / 2,
      y = focus.y + focus.height * 0.75;
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y }],
    });
    for (let i = 1; i <= 6; i++) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x, y: y - i * 30 }],
      });
      await page.waitForTimeout(30);
    }
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await cdp.detach();
  }
  await expect
    .poll(() => page.evaluate(() => scrollY))
    .toBeGreaterThan(before + 80);
  await chapter(page, "grip", 0.1);
  const b = await page.locator("#grip .scene-focus").boundingBox(),
    start = await page.evaluate(() => scrollY);
  if (info.project.name === "desktop") {
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.wheel(0, 250);
  } else {
    const cdp = await page.context().newCDPSession(page),
      x = b.x + b.width / 2,
      y = b.y + b.height * 0.75;
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y }],
    });
    for (let i = 1; i <= 6; i++) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x, y: y - i * 30 }],
      });
      await page.waitForTimeout(30);
    }
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await cdp.detach();
  }
  await expect
    .poll(() => page.evaluate(() => scrollY))
    .toBeGreaterThan(start + 80);
  const sizes = await page
    .locator(".chapter:not(.pricing)")
    .evaluateAll((xs) => xs.map((x) => x.offsetHeight / window.innerHeight));
  expect(Math.max(...sizes)).toBeLessThanOrEqual(4.01);
});
