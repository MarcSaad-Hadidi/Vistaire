import type { Locale } from "@/lib/i18n";
import { getLandingCopy } from "@/lib/landing/landingCopy";
import { getLandingExperiences } from "@/lib/landing/menuExperiences";
import {
  getVistaireChromeRoutes,
  PreviewFooter,
  PreviewNav,
  type VistaireRouteMode
} from "@/components/vistaire-preview/VistairePreviewChrome";
import { LandingComparisonSection } from "./LandingComparisonSection";
import { LandingDishStorySection } from "./LandingDishStorySection";
import { LandingExperienceSection } from "./LandingExperienceSection";
import { LandingFinalCta } from "./LandingFinalCta";
import { LandingHero } from "./LandingHero";
import { LandingOwnerSection } from "./LandingOwnerSection";
import { LandingValueSection } from "./LandingValueSection";
import { GuidesVistaireSection } from "./GuidesVistaireSection";
import styles from "./VistaireLanding.module.css";

export async function VistaireLanding({
  locale = "fr",
  routeMode = "production"
}: {
  locale?: Locale;
  routeMode?: VistaireRouteMode;
}) {
  const copy = getLandingCopy(locale);
  const experiences = await getLandingExperiences(locale);
  const routes = getVistaireChromeRoutes(routeMode, locale);
  const maisonExperience =
    experiences.find((experience) => experience.id === "maison-elyse") ??
    experiences[0];
  const saugeExperience =
    experiences.find((experience) => experience.id === "sauge-noire") ??
    experiences[0];

  return (
    <main className={styles.page}>
      <div aria-hidden="true" className={styles.background} />
      <div className={styles.navShell}>
        <PreviewNav
          activeSection="home"
          currentPath={routes.home}
          locale={locale}
          routeMode={routeMode}
        />
      </div>
      <LandingHero
        copy={copy.hero}
        locale={locale}
        maisonHref={maisonExperience.publicMenuHref}
        saugeHref={saugeExperience.publicMenuHref}
        restaurateurHref={routes.restaurateurDashboard}
        digitalMenuHref={routes.menuDigital}
      />
      <LandingComparisonSection
        copy={copy.comparison}
        experiences={experiences}
        locale={locale}
      />
      <LandingValueSection copy={copy.value} />
      <LandingExperienceSection
        copy={copy.experiences}
        experiences={experiences}
        locale={locale}
      />
      <LandingDishStorySection
        copy={copy.dishes}
        experiences={experiences}
        locale={locale}
      />
      <LandingOwnerSection
        copy={copy.owner}
        restaurateurDashboard={routes.restaurateurDashboard}
      />
      <GuidesVistaireSection locale={locale} />
      <LandingFinalCta
        appointmentHref={routes.appointment}
        copy={copy.finalCta}
      />
      <PreviewFooter
        currentPath={routes.home}
        locale={locale}
        routeMode={routeMode}
        width="wide"
      />
    </main>
  );
}
