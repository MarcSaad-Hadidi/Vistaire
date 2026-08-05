"use client";

import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import restaurantBackground from "@/Framer/PhotoRestoComplet2.png";
import menuVisual from "@/Framer/pageCarte.png";
import { ActiveRestaurantMenuPreview } from "@/components/restaurant-experiences/ActiveRestaurantMenuPreview";
import { RestaurantExperienceTabs } from "@/components/restaurant-experiences/RestaurantExperienceTabs";
import {
  isRestaurantExperienceId,
  type RestaurantExperienceId
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
  const activePayload = activeExperience?.renderPayload ?? null;

  useEffect(() => {
    const requested = searchParams.get("experience");
    if (!requested || isRestaurantExperienceId(requested)) return;
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
    router.replace(`${pathname}${query ? `?${query}` : ""}${hash}`, {
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
