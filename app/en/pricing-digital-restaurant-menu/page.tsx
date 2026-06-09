import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import restaurantBackground from "@/Framer/PhotoRestoComplet5.png";
import pageDigitalPhoto from "@/Framer/PageDigital.png";
import { JsonLd } from "@/components/JsonLd";
import { SeoFaq } from "@/components/seo/SeoFaq";
import {
  getVistaireChromeRoutes,
  PreviewFooter,
  PreviewNav
} from "@/components/vistaire-preview/VistairePreviewChrome";
import { buildPageAlternates, LOCALE_OPEN_GRAPH } from "@/lib/i18n";
import {
  buildPricingPageJsonLd,
  getPricingMetadata,
  getPricingPage,
  PRICING_PATH_EN
} from "@/lib/pricingPage";
import { absoluteUrl } from "@/lib/seo";
import styles from "@/components/vistaire-preview/VistaireMenuDigitalRestaurantPreview.module.css";

const page = getPricingPage("en");
const pricingMetadata = getPricingMetadata("en");
const routes = getVistaireChromeRoutes("production", "en");
const socialImage = "/frames/menualive/frame_0001.webp";

export const metadata: Metadata = {
  title: {
    absolute: pricingMetadata.title
  },
  description: pricingMetadata.description,
  alternates: buildPageAlternates(PRICING_PATH_EN),
  robots: {
    index: true,
    follow: true
  },
  openGraph: {
    title: pricingMetadata.title,
    description: pricingMetadata.description,
    url: absoluteUrl(PRICING_PATH_EN),
    locale: LOCALE_OPEN_GRAPH.en,
    type: "website",
    images: [
      {
        url: absoluteUrl(socialImage),
        alt: "Dish served in a premium restaurant atmosphere"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: pricingMetadata.title,
    description: pricingMetadata.description,
    images: [absoluteUrl(socialImage)]
  }
};

function ArrowIcon() {
  return (
    <svg
      aria-hidden="true"
      className={styles.buttonIcon}
      fill="none"
      viewBox="0 0 12 12"
    >
      <path
        d="M3.1 8.9 8.7 3.3m0 0H4.1m4.6 0v4.6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
    </svg>
  );
}

function PlanCard({ plan }: { plan: (typeof page.plans)[number] }) {
  return (
    <article
      className={`rounded-[14px] border p-5 backdrop-blur-[5px] ${
        plan.recommended
          ? "border-[#e8cf9b]/55 bg-black/10 shadow-[inset_0_1px_0_rgba(255,250,240,0.18)]"
          : "border-white/20 bg-black/5"
      }`}
    >
      {plan.recommended ? <p className={styles.badge}>Recommended</p> : null}
      <h3 className="mt-4 font-[var(--vistaire-font-display)] text-[34px] font-normal leading-[0.96] text-[#fffaf0]">
        {plan.name}
      </h3>
      <p className="mt-4 text-[14px] font-medium leading-[1.55] text-[#f4e5cd]/80">
        {plan.bestFor}
      </p>
      <div className="mt-5 border-t border-white/10 pt-5">
        <p className="font-[var(--vistaire-font-display)] text-[30px] font-normal leading-none text-[#e8cf9b]">
          {plan.setupPrice}
        </p>
        <p className="mt-2 font-[var(--vistaire-font-display)] text-[22px] font-normal leading-none text-[#fffaf0]">
          {plan.monthlyPrice}
        </p>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-[12px] border border-white/16 bg-black/10 p-3">
          <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#e8cf9b]/70">
            Menu
          </dt>
          <dd className="mt-2 text-[13px] font-bold leading-[1.35] text-[#fffaf0]">
            Up to {plan.menuDishLimit} dishes
          </dd>
        </div>
        <div className="rounded-[12px] border border-[#e8cf9b]/30 bg-black/10 p-3">
          <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#e8cf9b]/70">
            3D
          </dt>
          <dd className="mt-2 text-[13px] font-bold leading-[1.35] text-[#fffaf0]">
            {plan.included3dDishCount} included 3D dishes
          </dd>
        </div>
      </dl>
      <ul className="mt-5 grid gap-2">
        {plan.highlights.map((item) => (
          <li
            className="text-[13.5px] font-medium leading-[1.45] text-[#f4e5cd]/82"
            key={item}
          >
            {item}
          </li>
        ))}
      </ul>
      <details className="mt-5 border-t border-white/10 pt-4">
        <summary className="cursor-pointer text-[13px] font-bold text-[#e8cf9b] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e8cf9b]">
          See what is included
        </summary>
        <ul className="mt-4 grid gap-2">
          {plan.included.map((item) => (
            <li
              className="text-[13px] font-medium leading-[1.45] text-[#f4e5cd]/72"
              key={item}
            >
              {item}
            </li>
          ))}
        </ul>
      </details>
      <Link
        className={`${styles.primaryButton} mt-6 w-full`}
        href={plan.cta.href}
        prefetch={false}
      >
        {plan.cta.label}
        <ArrowIcon />
      </Link>
    </article>
  );
}

export default function PricingDigitalRestaurantMenuRouteEn() {
  return (
    <>
      <JsonLd data={buildPricingPageJsonLd(undefined, "en")} />
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

        <div className={styles.topNav}>
          <PreviewNav
            activeSection="home"
            currentPath={page.path}
            locale="en"
            routeMode="production"
          />
        </div>

        <section aria-labelledby="pricing-vistaire-title" className={styles.hero}>
          <div className={styles.previewFrame}>
            <article className={`${styles.card} ${styles.heroCopy}`}>
              <p className={styles.badge}>Vistaire pricing</p>
              <h1 id="pricing-vistaire-title">{page.h1}</h1>
              <p className={styles.heroLead}>{page.subtitle}</p>
              <div className={styles.heroActions} aria-label="Primary actions">
                <Link
                  className={styles.primaryButton}
                  href={page.primaryCta.href}
                  prefetch={false}
                >
                  {page.primaryCta.label}
                  <ArrowIcon />
                </Link>
                <Link
                  className={styles.secondaryButton}
                  href={page.secondaryCta.href}
                  prefetch={false}
                >
                  {page.secondaryCta.label}
                </Link>
              </div>
              <figure className={`${styles.visualFigure} ${styles.heroVisual}`}>
                <Image
                  alt="Vistaire digital menu shown on a phone in a restaurant atmosphere"
                  className={styles.visualImage}
                  fill
                  quality={100}
                  sizes="(max-width: 920px) calc(100vw - 56px), 20vw"
                  src={pageDigitalPhoto}
                  unoptimized
                />
              </figure>
            </article>

            <section
              className={`${styles.card} ${styles.problemCard}`}
              aria-labelledby="pricing-proof-title"
            >
              <p className={styles.badge}>More than a QR code</p>
              <h2 id="pricing-proof-title">
                The restaurant buys a premium digital menu, not a simple access link.
              </h2>
              <p>
                Vistaire replaces the file-to-scan logic with a readable,
                structured and guided mobile experience.
              </p>
            </section>

            <section
              className={`${styles.card} ${styles.comparisonCard}`}
              id="packages"
              aria-labelledby="packages-title"
            >
              <div className={styles.sectionIntro}>
                <p className={styles.badge}>Packages</p>
                <h2 id="packages-title">
                  Clear pricing for a guided mobile menu.
                </h2>
                <p>{page.proof}</p>
              </div>
              <div className="mt-8 grid gap-4 lg:grid-cols-3">
                {page.plans.map((plan) => (
                  <PlanCard key={plan.name} plan={plan} />
                ))}
              </div>
              <div className="mt-6 rounded-[14px] border border-white/16 bg-black/5 p-5 text-[13px] font-medium leading-[1.55] text-[#f4e5cd]/68 backdrop-blur-[5px]">
                <p>Prices in CAD. Applicable taxes are extra.</p>
                <p className="mt-2">
                  Pricing can vary depending on dish count, photo quality,
                  writing depth, visual complexity and specific needs.
                </p>
              </div>
            </section>

            <section
              className={`${styles.card} ${styles.mobileProofCard}`}
              aria-labelledby="packs-title"
            >
              <figure className={styles.visualFigure}>
                <Image
                  alt="Guest consulting a Vistaire menu on a phone at the table"
                  className={styles.visualImage}
                  fill
                  quality={100}
                  sizes="(max-width: 920px) calc(100vw - 56px), 58vw"
                  src={pageDigitalPhoto}
                  unoptimized
                />
              </figure>
              <div className={styles.visualCopy}>
                <p className={styles.badge}>Additional 3D packs</p>
                <h2 id="packs-title">
                  3D is already included. Packs extend it.
                </h2>
                <p>
                  Every package already includes selected 3D dishes. Additional
                  packs simply extend the experience to more dishes.
                </p>
                <div className="mt-6 grid gap-3">
                  {page.threeDPacks.map((pack) => (
                    <article
                      className="rounded-[13px] border border-white/18 bg-black/5 p-4"
                      key={pack.label}
                    >
                      <h3 className="font-[var(--vistaire-font-display)] text-[25px] font-normal leading-none text-[#fffaf0]">
                        {pack.label}
                      </h3>
                      <p className="mt-2 text-[18px] font-bold text-[#e8cf9b]">
                        {pack.price}
                      </p>
                      <p className="mt-2 text-[13px] font-medium leading-[1.45] text-[#f4e5cd]/70">
                        {pack.description}
                      </p>
                    </article>
                  ))}
                </div>
              </div>
            </section>

            <section
              className={`${styles.card} ${styles.comparisonCard}`}
              aria-labelledby="faq-title"
            >
              <div className={styles.sectionIntro}>
                <p className={styles.badge}>FAQ</p>
                <h2 id="faq-title">Common questions about digital menu pricing.</h2>
              </div>
              <div className="mt-8">
                <SeoFaq faqs={[...page.faq]} layout="stack" locale="en" />
              </div>
            </section>

            <section
              className={`${styles.card} ${styles.finalCta}`}
              aria-labelledby="final-cta-title"
            >
              <div>
                <p className={styles.badge}>Next step</p>
                <h2 id="final-cta-title">
                  Ready to replace your PDF with a premium digital menu?
                </h2>
                <p>
                  Vistaire creates your premium digital menu, QR code and dish
                  pages with selected 3D dishes included from the start.
                </p>
              </div>
              <div className={styles.finalActions}>
                <Link
                  className={styles.primaryButton}
                  href={routes.appointment}
                  prefetch={false}
                >
                  Talk about your menu
                  <ArrowIcon />
                </Link>
                <Link
                  className={styles.secondaryButton}
                  href={routes.menu}
                  prefetch={false}
                >
                  View a Vistaire menu
                </Link>
              </div>
            </section>
          </div>
        </section>

        <PreviewFooter
          currentPath={page.path}
          locale="en"
          routeMode="production"
          width="wide"
        />
      </main>
    </>
  );
}
