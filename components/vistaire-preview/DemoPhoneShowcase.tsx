import Image from "next/image";
import restaurantBackground from "@/Framer/PhotoRestoComplet2.png";
import menuVisual from "@/Framer/pageCarte.png";
import { MaisonElyseQrMenu } from "@/components/menu/MaisonElyseQrMenu";
import type { Locale } from "@/lib/i18n";
import type { PublicMenu } from "@/lib/menu/publicMenu";
import {
  PreviewFooter,
  PreviewNav
} from "./VistairePreviewChrome";
import styles from "./DemoPhoneShowcase.module.css";

type DemoPhoneShowcaseProps = {
  currentPath?: string;
  locale?: Locale;
  menu: PublicMenu;
};

export function DemoPhoneShowcase({
  currentPath,
  locale = "fr",
  menu
}: DemoPhoneShowcaseProps) {
  const isEnglish = locale === "en";
  const resolvedPath = currentPath ?? (isEnglish ? "/en/vistaire-menu" : "/demo");

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

      <section className={styles.hero} aria-label="Carte client premium">
        <div className={styles.showcaseFrame} id="carte">
          <article className={styles.visualPanel} aria-label="Carte digitale">
            <Image
              alt={
                "Carte digitale Vistaire pr\u00e9sent\u00e9e sur une table de restaurant"
              }
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
              <small>
                {isEnglish
                  ? "A food-first mobile experience designed to present the menu at the table."
                  : "Une exp\u00e9rience mobile food-first, pens\u00e9e pour pr\u00e9senter la carte \u00e0 table."}
              </small>
            </div>
          </article>

          <aside
            className={styles.phoneStage}
            aria-label={"Aper\u00e7u mobile Maison \u00c9lyse"}
          >
            <div className={styles.phoneLabel}>
              <span>{"Exp\u00e9rience Vistaire"}</span>
              <strong>{"Maison \u00c9lyse"}</strong>
            </div>

            <div className={styles.phoneShell} data-testid="demo-phone-mockup">
              <div className={styles.phoneHighlight} aria-hidden="true" />
              <div className={styles.phoneNotch} aria-hidden="true" />
              <div
                className={`${styles.phoneViewport} phone-mockup-scroll--premium`}
                data-lenis-prevent
                data-phone-mockup-scroll
                data-testid="demo-phone-viewport"
              >
                <MaisonElyseQrMenu
                  displayMode="phone-preview"
                  menu={menu}
                  showGoogleReview={false}
                />
              </div>
            </div>

            <p className={styles.phoneFootnote}>
              {isEnglish
                ? "Sample restaurant used to present the Vistaire guest experience."
                : "Restaurant exemple utilis\u00e9 pour pr\u00e9senter l'exp\u00e9rience client Vistaire."}
            </p>
          </aside>
        </div>

        <PreviewNav
          activeSection="menu"
          currentPath={resolvedPath}
          locale={locale}
          routeMode="production"
        />
      </section>

      <PreviewFooter
        currentPath={resolvedPath}
        locale={locale}
        routeMode="production"
        width="wide"
      />
    </main>
  );
}
