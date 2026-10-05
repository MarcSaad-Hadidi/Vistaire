import { expect, test } from "@playwright/test";

const MODEL_REQUEST =
  /(?:\.(?:glb|usdz)(?:$|[?#])|\/model\/(?:glb|usdz)(?:\/|$|[?#])|model-viewer)/i;

const EXPERIENCES = [
  { id: "maison-elyse", name: "Maison Élyse" },
  { id: "trouvable", name: "Trouvable" },
  { id: "sauge-noire", name: "Sauge Noire" }
] as const;

const DISCOVERY_ROUTES = [
  {
    language: "French", path: "/demo", queryLang: "en", lang: "fr-CA",
    title: "Trois expériences de menu restaurant | Vistaire",
    heading: "Trois restaurants. Trois identités.", explore: "Explorer", discover: "Découvrir", show3d: "VOIR EN 3D",
    activeLanguage: "Voir cette page en français", otherLanguage: "View this page in English",
    alternatePath: "/en/vistaire-menu", alternateLocale: "en-CA"
  },
  {
    language: "English", path: "/en/vistaire-menu", queryLang: "fr", lang: "en-CA",
    title: "Three restaurant menu experiences | Vistaire",
    heading: "Three restaurants. Three identities.", explore: "Explore", discover: "Discover", show3d: "VIEW IN 3D",
    activeLanguage: "View this page in English", otherLanguage: "Voir cette page en français",
    alternatePath: "/demo", alternateLocale: "fr-CA"
  }
] as const;

for (const scenario of DISCOVERY_ROUTES) {
  const experiences = EXPERIENCES.map((experience) => ({
    ...experience, href: `/menu/${experience.id}?lang=${scenario.lang}`
  }));
  test.describe(`${scenario.language} restaurant discovery`, () => {
    test.setTimeout(90_000);
    test("presents three real experiences without previews, early models or mobile overflow", async ({ page }) => {
      const errors: string[] = [];
      const unexpectedRequests: string[] = [];
      const requestedVideos = new Set<string>();
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error" || /hydration|did not match/i.test(message.text())) {
          errors.push(message.text());
        }
      });
      page.on("request", (request) => {
        const pathname = new URL(request.url()).pathname;
        if (pathname.startsWith("/videos/demo/")) requestedVideos.add(pathname);
        if (MODEL_REQUEST.test(request.url()) || /\/api\/public\/landing-menu-preview\//.test(request.url())) {
          unexpectedRequests.push(request.url());
        }
      });
      page.on("response", (response) => {
        if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
      });
      page.on("requestfailed", (request) => {
        const errorText = request.failure()?.errorText;
        // WebKit can report a cancelled video range as resourceType "other".
        const cancelledVideoRange = errorText === "Load request cancelled"
          && /^\/videos\/demo\/(?:maison-elyse|trouvable|sauge-noire)\.mp4$/.test(new URL(request.url()).pathname);
        if (errorText !== "net::ERR_ABORTED" && !cancelledVideoRange) {
          errors.push(`${errorText} ${request.url()}`);
        }
      });

      await page.setViewportSize({ width: 390, height: 844 });
      const response = await page.goto(`${scenario.path}?lang=${scenario.queryLang}&experience=trouvable&utm_source=qa`, { waitUntil: "domcontentloaded" });
      expect(response?.status()).toBe(200);
      await expect(page.locator("html")).toHaveAttribute("lang", scenario.lang);
      await expect(page.getByRole("link", { name: scenario.activeLanguage }).first()).toHaveAttribute("aria-current", "true");
      await expect(page.getByRole("link", { name: scenario.otherLanguage }).first()).toHaveAttribute("href", scenario.alternatePath);
      for (const id of ["trouvable", "sauge-noire"]) {
        await expect(page.locator(`[data-demo-experience="${id}"] video`)).not.toHaveAttribute("src", /.+/);
        expect(requestedVideos.has(`/videos/demo/${id}.mp4`)).toBe(false);
      }
      for (const viewport of [
        { width: 390, height: 844 },
        { width: 430, height: 932 },
        { width: 1440, height: 900 }
      ]) {
        await page.setViewportSize(viewport);
        await expect(page).toHaveTitle(scenario.title);
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(scenario.heading);
        await expect(page.locator("[data-demo-experience]")).toHaveCount(3);
        for (const experience of experiences) {
          const panel = page.locator(`[data-demo-experience="${experience.id}"]`);
          await panel.scrollIntoViewIfNeeded();
          await expect(panel.getByRole("heading", { level: 2, name: experience.name, exact: true })).toBeVisible();
          const link = panel.getByRole("link", { name: `${scenario.explore} ${experience.name}`, exact: true });
          await expect(link).toBeVisible();
          await expect(link).toHaveAttribute("href", experience.href);
          await expect(panel.getByRole("link", { name: new RegExp(`^${scenario.discover} `) })).toHaveAttribute("href", new RegExp(`[?&]lang=${scenario.lang}(?:&|$)`));
          expect((await link.boundingBox())?.height).toBeGreaterThanOrEqual(44);
          const video = panel.locator("video[data-demo-video]");
          await video.scrollIntoViewIfNeeded();
          await expect(video).toHaveJSProperty("autoplay", true);
          await expect(video).toHaveJSProperty("loop", true);
          await expect(video).toHaveJSProperty("muted", true);
          await expect(video).toHaveJSProperty("playsInline", true);
          await expect(video).toHaveJSProperty("controls", false);
          await expect.poll(() => video.evaluate((element: HTMLVideoElement) =>
            element.readyState >= 2 && !element.paused && element.videoWidth > 0 && element.videoHeight > 0
          ), { timeout: 15_000 }).toBe(true);
          expect(await video.evaluate((element: HTMLVideoElement) =>
            element.videoWidth / element.videoHeight
          )).toBeCloseTo(780 / 1688, 2);
          const initialTime = await video.evaluate((element: HTMLVideoElement) => element.currentTime);
          await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime)).not.toBe(initialTime);
          expect(await video.evaluate(async (element: HTMLVideoElement) => {
            const poster = new Image();
            poster.src = element.poster;
            await poster.decode();
            return poster.naturalWidth > 0;
          })).toBe(true);
        }
        await expect(page.getByTestId("demo-phone-mockup")).toHaveCount(0);
        await expect(page.locator("[data-demo-experience] button")).toHaveCount(0);
        await expect(page.getByText("Le menu en action · en boucle", { exact: true })).toHaveCount(0);
        await expect(page.locator("[data-phone-mockup-scroll], [data-public-menu-renderer], model-viewer, iframe")).toHaveCount(0);
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        expect(await page.locator("main").evaluate((element) => getComputedStyle(element).overflowY)).toBe("visible");
        await expect(page.getByRole("contentinfo")).toBeVisible();
      }
      await page.emulateMedia({ reducedMotion: "reduce" });
      const loopingVideo = page.locator("video[data-demo-video]").first();
      await loopingVideo.scrollIntoViewIfNeeded();
      await expect.poll(() => loopingVideo.evaluate((element: HTMLVideoElement) =>
        !element.paused && element.readyState >= 2
      )).toBe(true);
      await loopingVideo.evaluate((element: HTMLVideoElement) => { element.currentTime = element.duration - 0.1; });
      await expect.poll(() => loopingVideo.evaluate((element: HTMLVideoElement) =>
        element.currentTime < 1 && !element.paused
      )).toBe(true);
      const firstLink = page.getByRole("link", { name: `${scenario.explore} Maison Élyse`, exact: true });
      await firstLink.focus();
      await expect(firstLink).toBeFocused();
      expect(await firstLink.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe("solid");
      expect(await firstLink.evaluate((element) =>
        Math.max(...getComputedStyle(element).transitionDuration.split(",").map(parseFloat))
      )).toBeLessThanOrEqual(0.001);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`${scenario.path}$`));
      await expect(page.locator(`link[rel="alternate"][hreflang="${scenario.alternateLocale}"]`)).toHaveAttribute("href", new RegExp(`${scenario.alternatePath}$`));
      await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", scenario.title);
      expect(errors, errors.join("\n")).toEqual([]);
      expect(unexpectedRequests).toEqual([]);
    });

    for (const experience of experiences) {
      test(`opens the real ${experience.name} menu through its accessible link`, async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto(scenario.path, { waitUntil: "domcontentloaded" });
        const link = page.getByRole("link", { name: `${scenario.explore} ${experience.name}`, exact: true });
        await expect(link).toHaveAttribute("href", experience.href);
        await link.scrollIntoViewIfNeeded();
        await expect(link).toBeVisible();
        await link.focus();
        await expect(link).toBeFocused();
        await link.press("Enter");
        await expect(page).toHaveURL(new RegExp(`/menu/${experience.id}\\?`), { timeout: 15_000 });
        expect(new URL(page.url()).searchParams.get("lang")).toBe(scenario.lang);
        if (experience.id === "sauge-noire") {
          await expect(page.getByTestId("sauge-noire-book")).toBeVisible();
        } else {
          await expect(page.locator(`[data-menu-ui="${experience.id}"]`)).toBeVisible();
        }
        if (scenario.language === "English" && experience.id === "maison-elyse") {
          await page.goBack({ waitUntil: "domcontentloaded" });
          await expect(page.getByRole("heading", { level: 1 })).toHaveText(scenario.heading);
          const video = page.locator('[data-demo-experience="maison-elyse"] video');
          await video.scrollIntoViewIfNeeded();
          await expect.poll(() => video.evaluate((element: HTMLVideoElement) =>
            element.readyState >= 2 && !element.paused
          ), { timeout: 15_000 }).toBe(true);
          const initialTime = await video.evaluate((element: HTMLVideoElement) => element.currentTime);
          await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime)).not.toBe(initialTime);
        }
      });
    }

    test("opens the verified Sauge 3D dish through its accessible link", async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      const modelRequests: string[] = [];
      page.on("request", (request) => {
        if (MODEL_REQUEST.test(request.url())) modelRequests.push(request.url());
      });
      await page.goto(scenario.path, { waitUntil: "domcontentloaded" });
      const dishLink = page.locator("[data-demo-3d-link]");
      await expect(dishLink).toHaveAttribute("href", `/menu/sauge-noire/dishes/truite-des-laurentides?lang=${scenario.lang}&view=sauge-2`);
      await dishLink.scrollIntoViewIfNeeded();
      await expect(dishLink).toBeVisible();
      await dishLink.focus();
      await expect(dishLink).toBeFocused();
      await dishLink.press("Enter");
      await expect(page).toHaveURL(/\/menu\/sauge-noire\/dishes\/truite-des-laurentides\?/, { timeout: 15_000 });
      expect(new URL(page.url()).searchParams.get("lang")).toBe(scenario.lang);
      await expect(page.getByTestId("sauge-noire-dish-detail")).toBeVisible();
      await page.waitForLoadState("load");
      await expect(page.locator("model-viewer")).toHaveCount(0);
      const show3d = page.getByRole("button", { name: scenario.show3d, exact: true });
      await expect(show3d).toBeVisible();
      expect(modelRequests).toEqual([]);
      await show3d.click();
      const viewer = page.locator("model-viewer");
      await expect(viewer).toBeVisible({ timeout: 15_000 });
      await expect.poll(() => modelRequests.some((url) => /\.glb(?:$|[?#])/i.test(url)), { timeout: 15_000 }).toBe(true);
      await expect.poll(() => viewer.evaluate((element) =>
        Boolean((element as HTMLElement & { loaded?: boolean }).loaded)
      ), { timeout: 15_000 }).toBe(true);
    });
  });
}
