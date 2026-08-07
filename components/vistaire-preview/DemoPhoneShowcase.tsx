"use client";

import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import restaurantBackground from "@/Framer/PhotoRestoComplet2.png";
import menuVisual from "@/Framer/pageCarte.png";
import { ActiveRestaurantMenuPreview } from "@/components/restaurant-experiences/ActiveRestaurantMenuPreview";
import { RestaurantExperienceTabs } from "@/components/restaurant-experiences/RestaurantExperienceTabs";
import {
  isRestaurantExperienceId,
  payloadMatchesExperience,
  type RestaurantExperienceId,
  type RestaurantMenuPreviewPayload
} from "@/lib/restaurant-experiences/contracts";
import type { Locale } from "@/lib/i18n";
import type { LandingExperience } from "@/lib/landing/menuExperiences";
import { PreviewFooter, PreviewNav } from "./VistairePreviewChrome";
import styles from "./DemoPhoneShowcase.module.css";

type DemoPhoneShowcaseProps = {
  currentPath?: string;
  locale?: Locale;
  menuLocale?: Locale;
  experiences: LandingExperience[];
};

function experienceFromQuery(value: string | null): RestaurantExperienceId {
  if (value === "trouvable" || value === "sauge-noire") return value;
  return "maison-elyse";
}

export function DemoPhoneShowcase({
  currentPath,
  locale = "fr",
  menuLocale = locale,
  experiences
}: DemoPhoneShowcaseProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const phoneViewportRef = useRef<HTMLDivElement>(null);
  const activeId = experienceFromQuery(searchParams.get("experience"));
  const isEnglish = locale === "en";
  const resolvedPath = currentPath ?? (isEnglish ? "/en/vistaire-menu" : "/demo");
  const activeExperience =
    experiences.find((experience) => experience.id === activeId) ?? experiences[0];
  const [previewPayloads, setPreviewPayloads] = useState<
    Record<string, RestaurantMenuPreviewPayload | null | undefined>
  >(() =>
    Object.fromEntries(
      experiences.flatMap((experience) =>
        experience.renderPayload
          ? [[`${menuLocale}:${experience.id}`, experience.renderPayload] as const]
          : []
      )
    )
  );
  const activePayloadKey = `${menuLocale}:${activeId}`;
  const activePayload = previewPayloads[activePayloadKey];

  useEffect(() => {
    if (!activeExperience || activePayload !== undefined) return;

    const controller = new AbortController();
    const params = new URLSearchParams({ locale: menuLocale });
    void fetch(
      `/api/public/landing-menu-preview/${activeExperience.id}?${params.toString()}`,
      {
        headers: { Accept: "application/json" },
        signal: controller.signal
      }
    )
      .then(async (response) => {
        if (!response.ok) throw new Error("Restaurant menu preview unavailable.");
        const result = (await response.json()) as {
          ok?: boolean;
          payload?: RestaurantMenuPreviewPayload;
        };
        if (!result.ok || !result.payload) {
          throw new Error("Restaurant menu preview unavailable.");
        }
        return result.payload;
      })
      .then((payload) => {
        if (!payloadMatchesExperience(payload, activeExperience.id)) {
          throw new Error("Unexpected restaurant menu preview payload.");
        }
        setPreviewPayloads((current) => ({
          ...current,
          [activePayloadKey]: payload
        }));
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setPreviewPayloads((current) => ({
          ...current,
          [activePayloadKey]: null
        }));
      });

    return () => controller.abort();
  }, [activeExperience, activePayload, activePayloadKey, menuLocale]);

  useEffect(() => {
    const requested = searchParams.get("experience");
    if (
      !searchParams.has("experience") ||
      (requested !== null && isRestaurantExperienceId(requested))
    ) {
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    params.delete("experience");
    const query = params.toString();
    const hash = typeof window === "undefined" ? "" : window.location.hash;
    router.replace(`${pathname}${query ? `?${query}` : ""}${hash}`, {
      scroll: false
    });
  }, [pathname, router, searchParams]);

  useEffect(() => {
    const viewport = phoneViewportRef.current;
    if (viewport) viewport.scrollTop = 0;
  }, [activeId]);

  const selectExperience = (nextId: RestaurantExperienceId) => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextId === "maison-elyse") params.delete("experience");
    else params.set("experience", nextId);
    const query = params.toString();
    const hash = typeof window === "undefined" ? "" : window.location.hash;
    router.push(`${pathname}${query ? `?${query}` : ""}${hash}`, {
      scroll: false
    });
  };

  const tabs = useMemo(
    () => experiences.map(({ id, name }) => ({ id, name })),
    [experiences]
  );
  if (!activeExperience) return null;

  return (
    <main className={styles.page}>
      <Image
        alt=""
        aria-hidden="true"
        className={styles.backgroundImage}
        fill
        priority
        quality={100}
        sizes="100vw"
        src={restaurantBackground}
        unoptimized
      />

      <section className={styles.hero} aria-label={isEnglish ? "Client menu showcase" : "Aperçu de carte client"}>
        <div className={styles.showcaseFrame} id="carte">
          <article className={styles.visualPanel} aria-label={isEnglish ? "Digital menu" : "Carte digitale"}>
            <Image
              alt={isEnglish ? "Vistaire digital menu presented on a restaurant table" : "Carte digitale Vistaire présentée sur une table de restaurant"}
              className={styles.visualImage}
              fill
              priority
              quality={100}
              sizes="(max-width: 760px) calc(100vw - 20px), 570px"
              src={menuVisual}
              unoptimized
            />
            <div className={styles.visualGradient} aria-hidden="true" />
            <div className={styles.visualCopy}>
              <p>{isEnglish ? "Premium client menu" : "Carte client premium"}</p>
              <h1>
                <span>{isEnglish ? "DIGITAL" : "CARTE"}</span>
                <span>{isEnglish ? "MENU" : "DIGITALE"}</span>
              </h1>
              <small>{isEnglish ? "A food-first mobile experience designed to present the menu at the table." : "Une expérience mobile food-first, pensée pour présenter la carte à table."}</small>
            </div>
          </article>

          <aside className={styles.phoneStage} aria-label={`${isEnglish ? "Preview" : "Aperçu"} ${activeExperience.name}`}>
            <RestaurantExperienceTabs
              activeId={activeExperience.id}
              ariaLabel={isEnglish ? "Restaurant menu experiences" : "Expériences de menu restaurant"}
              experiences={tabs}
              onActiveChange={selectExperience}
            >
              <div className={styles.phoneLabel}>
                <span>{isEnglish ? "Vistaire experience" : "Expérience Vistaire"}</span>
                <strong>{activeExperience.name}</strong>
              </div>
              <div className={styles.phoneShell} data-testid="demo-phone-mockup">
                <div className={styles.phoneHighlight} aria-hidden="true" />
                <div className={styles.phoneNotch} aria-hidden="true" />
                <div
                  className={`${styles.phoneViewport} phone-mockup-scroll--premium`}
                  data-lenis-prevent
                  data-phone-mockup-scroll
                  data-testid="demo-phone-viewport"
                  ref={phoneViewportRef}
                >
                  <ActiveRestaurantMenuPreview
                    expectedExperienceId={activeExperience.id}
                    fallback={
                      <span>{isEnglish ? "This menu preview is unavailable." : "Cet aperçu de menu est indisponible."}</span>
                    }
                    payload={activePayload}
                    displayMode="phone-preview"
                  />
                </div>
              </div>
              <p className={styles.phoneFootnote}>
                {isEnglish
                  ? "Sample restaurant used to present the Vistaire guest experience."
                  : "Restaurant exemple utilisé pour présenter l'expérience client Vistaire."}
              </p>
            </RestaurantExperienceTabs>
          </aside>
        </div>

        <PreviewNav
          activeSection="menu"
          currentPath={resolvedPath}
          locale={menuLocale}
          routeMode="production"
        />
      </section>

      <PreviewFooter
        currentPath={resolvedPath}
        locale={menuLocale}
        routeMode="production"
        width="wide"
      />
    </main>
  );
}
