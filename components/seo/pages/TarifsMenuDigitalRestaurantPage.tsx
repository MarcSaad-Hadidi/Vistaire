import Image from "next/image";
import Link from "next/link";
import restaurantBackground from "@/Framer/PhotoRestoComplet5.png";
import pageDigitalPhoto from "@/Framer/PageDigital.png";
import photoDigital2 from "@/Framer/PhotoDigital2.png";
import photoDigital3 from "@/Framer/PhotoDigital3.png";
import { SeoFaq } from "@/components/seo/SeoFaq";
import { PRICING_PAGE, SAMPLE_MENU_PATH } from "@/lib/pricingPage";
import {
  CONTACT_PHONE_DISPLAY,
  CONTACT_PHONE_TEL
} from "@/lib/seo";
import { getLocalizedPath, type Locale } from "@/lib/i18n";
import chromeStyles from "@/components/vistaire-preview/VistairePreviewChrome.module.css";
import styles from "@/components/vistaire-preview/VistaireMenuDigitalRestaurantPreview.module.css";

const qrValuePoints = [
  "Expérience mobile plus claire",
  "Carte plus lisible qu'un PDF",
  "Présentation plus premium",
  "Fiches plats plus vendeuses",
  "Plats 3D inclus",
  "Mise en ligne accompagnée",
  "QR prêt à utiliser"
] as const;

const creationSteps = [
  "Le restaurant envoie son menu actuel.",
  "Vistaire structure les catégories.",
  "Vistaire ajoute plats, prix, descriptions, allergènes et options.",
  "Les photos sont intégrées.",
  "Les plats 3D inclus sont générés et validés.",
  "Le QR code est créé.",
  "Le restaurant valide la carte.",
  "Le menu est mis en ligne.",
  "Les modifications sont gérées avec Vistaire pendant l'abonnement."
] as const;

const restaurantTargets = [
  "Restaurants indépendants",
  "Bistros premium",
  "Restaurants haut de gamme",
  "Restaurants gastronomiques",
  "Restaurants avec PDF actuel",
  "Restaurants avec menu QR basique",
  "Restaurants à Montréal",
  "Restaurants au Québec",
  "Restaurants qui veulent mieux présenter leurs plats"
] as const;

const pdfRows = [
  ["PDF", "Lent à zoomer", "Vistaire", "Mobile-first"],
  ["PDF", "Peu lisible sur mobile", "Vistaire", "Lisible à table"],
  ["PDF", "Peu premium", "Vistaire", "Fiches plats et visuels"],
  ["PDF", "Aucun plat 3D", "Vistaire", "Plats 3D inclus"],
  ["PDF", "Difficile à faire évoluer", "Vistaire", "Modifications accompagnées"],
  ["PDF", "Impression basique", "Vistaire", "Expérience plus mémorable"]
] as const;

const resourceLinks = [
  { label: "Tarifs", href: PRICING_PAGE.path },
  { label: "Menu digital restaurant", href: "/menu-digital-restaurant" },
  { label: "Menu QR code restaurant", href: "/menu-qr-code-restaurant" },
  { label: "PDF vs menu digital", href: "/menu-pdf-vs-menu-digital" },
  { label: "Restaurants haut de gamme", href: "/a-propos" }
] as const;

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

function PricingLanguageSwitcher({
  currentPath,
  locale
}: {
  currentPath: string;
  locale: Locale;
}) {
  const options = [
    { locale: "fr" as const, label: "FR", href: getLocalizedPath(currentPath, "fr") },
    { locale: "en" as const, label: "EN", href: getLocalizedPath(currentPath, "en") }
  ];

  return (
    <div aria-label="Langue" className={chromeStyles.languageSwitcher}>
      {options.map((option) => (
        <Link
          aria-current={option.locale === locale ? "true" : undefined}
          aria-label={
            option.locale === "en"
              ? "View this page in English"
              : "Voir cette page en français"
          }
          className={
            option.locale === locale
              ? `${chromeStyles.languageLink} ${chromeStyles.languageLinkActive}`
              : chromeStyles.languageLink
          }
          href={option.href}
          key={option.locale}
          prefetch={false}
        >
          {option.label}
        </Link>
      ))}
    </div>
  );
}

function PricingNav() {
  const navItems = [
    { label: "Accueil", href: "/" },
    { label: "Carte", href: SAMPLE_MENU_PATH },
    { label: "À propos", href: "/a-propos" },
    { label: "Contact", href: "/contact" }
  ] as const;

  return (
    <nav aria-label="Navigation Vistaire" className={chromeStyles.previewNav}>
      <Link
        aria-label="Vistaire - accueil"
        className={chromeStyles.navBrand}
        href="/"
        prefetch={false}
      >
        <span className={chromeStyles.navBrandName}>Vistaire</span>
        <span className={chromeStyles.navBrandSubline}>Carte digitale premium</span>
      </Link>

      <div className={chromeStyles.navLinks}>
        {navItems.map((item) => (
          <Link
            className={chromeStyles.navLink}
            href={item.href}
            key={item.href}
            prefetch={false}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <PricingLanguageSwitcher currentPath={PRICING_PAGE.path} locale="fr" />

      <Link
        className={chromeStyles.navCta}
        href="/prendre-rendez-vous"
        prefetch={false}
      >
        <span className={chromeStyles.navCtaFull}>Prendre rendez-vous</span>
        <span className={chromeStyles.navCtaShort}>Rendez-vous</span>
      </Link>
    </nav>
  );
}

function PricingFooter() {
  return (
    <footer
      className={`${chromeStyles.previewFooter} ${chromeStyles.previewFooterWide}`}
      id="contact"
    >
      <section className={chromeStyles.footerBrand} aria-label="Vistaire">
        <h2>Vistaire</h2>
        <p className={chromeStyles.footerTagline}>
          Menu digital premium avec plats 3D inclus.
        </p>
        <p className={chromeStyles.footerDescription}>
          Une carte mobile pensée pour remplacer le PDF, mieux présenter les
          plats et rester élégante à table.
        </p>
      </section>

      <section className={chromeStyles.footerColumn} aria-label="Produit">
        <h2>Produit</h2>
        <nav className={chromeStyles.footerLinkList} aria-label="Produit Vistaire">
          <Link href={SAMPLE_MENU_PATH} prefetch={false}>
            Menu exemple
          </Link>
          <Link href="/menu-3d-ar-restaurant" prefetch={false}>
            Plats 3D inclus
          </Link>
          <Link href="/prendre-rendez-vous" prefetch={false}>
            Parler de votre menu
          </Link>
        </nav>
      </section>

      <section
        className={`${chromeStyles.footerColumn} ${chromeStyles.footerColumnWide}`}
        aria-label="Ressources"
      >
        <h2>Ressources</h2>
        <nav
          className={`${chromeStyles.footerLinkList} ${chromeStyles.footerLinkListBalanced}`}
          aria-label="Guides Vistaire"
        >
          {resourceLinks.map((item) => (
            <Link href={item.href} key={item.href} prefetch={false}>
              {item.label}
            </Link>
          ))}
        </nav>
      </section>

      <section className={chromeStyles.footerColumn} aria-label="Contact">
        <h2>Contact</h2>
        <p className={chromeStyles.footerPlace}>Montréal, Québec, Canada</p>
        <a className={chromeStyles.footerEmail} href="mailto:contact@vistaire.ca">
          contact@vistaire.ca
        </a>
        <a className={chromeStyles.footerEmail} href={`tel:${CONTACT_PHONE_TEL}`}>
          {CONTACT_PHONE_DISPLAY}
        </a>
        <Link
          className={chromeStyles.footerCta}
          href="/prendre-rendez-vous"
          prefetch={false}
        >
          Parler de votre menu
        </Link>
      </section>

      <div className={chromeStyles.footerBottom}>
        <p className={chromeStyles.footerCopyright}>
          © 2026 Vistaire. Tous droits réservés.
        </p>
        <PricingLanguageSwitcher currentPath={PRICING_PAGE.path} locale="fr" />
      </div>
    </footer>
  );
}

function PlanCard({ plan }: { plan: (typeof PRICING_PAGE.plans)[number] }) {
  return (
    <article
      className={`rounded-[14px] border p-5 backdrop-blur-[5px] ${
        plan.recommended
          ? "border-[#e8cf9b]/55 bg-black/10 shadow-[inset_0_1px_0_rgba(255,250,240,0.18)]"
          : "border-white/20 bg-black/5"
      }`}
    >
      {plan.recommended ? (
        <p className={styles.badge}>Recommandé</p>
      ) : null}
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
            Carte
          </dt>
          <dd className="mt-2 text-[13px] font-bold leading-[1.35] text-[#fffaf0]">
            Jusqu&apos;à {plan.menuDishLimit} plats
          </dd>
        </div>
        <div className="rounded-[12px] border border-[#e8cf9b]/30 bg-black/10 p-3">
          <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#e8cf9b]/70">
            3D
          </dt>
          <dd className="mt-2 text-[13px] font-bold leading-[1.35] text-[#fffaf0]">
            {plan.included3dDishCount} plats 3D inclus
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
          Voir ce qui est inclus
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

export function TarifsMenuDigitalRestaurantPage() {
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

      <div className={styles.topNav}>
        <PricingNav />
      </div>

      <section
        aria-labelledby="tarifs-vistaire-title"
        className={styles.hero}
      >
        <div className={styles.previewFrame}>
          <article className={`${styles.card} ${styles.heroCopy}`}>
            <p className={styles.badge}>Tarifs Vistaire</p>
            <h1 id="tarifs-vistaire-title">{PRICING_PAGE.h1}</h1>
            <p className={styles.heroLead}>{PRICING_PAGE.subtitle}</p>
            <div className={styles.heroActions} aria-label="Actions principales">
              <Link
                className={styles.primaryButton}
                href={PRICING_PAGE.primaryCta.href}
                prefetch={false}
              >
                {PRICING_PAGE.primaryCta.label}
                <ArrowIcon />
              </Link>
              <Link
                className={styles.secondaryButton}
                href={PRICING_PAGE.secondaryCta.href}
                prefetch={false}
              >
                {PRICING_PAGE.secondaryCta.label}
              </Link>
            </div>
            <figure className={`${styles.visualFigure} ${styles.heroVisual}`}>
              <Image
                alt="Carte digitale Vistaire présentée sur téléphone dans une ambiance de restaurant"
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
            <p className={styles.badge}>Pas juste un QR code</p>
            <h2 id="pricing-proof-title">
              Le restaurant achète une carte digitale premium, pas un simple
              accès.
            </h2>
            <p>
              Vistaire remplace la logique du fichier à scanner par une
              expérience mobile lisible, structurée et accompagnée.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {qrValuePoints.map((point) => (
                <div
                  className="rounded-[14px] border border-white/20 bg-black/5 p-4 text-[13.5px] font-bold leading-[1.35] text-[#fffaf0]/90 backdrop-blur-[5px]"
                  key={point}
                >
                  {point}
                </div>
              ))}
            </div>
          </section>

          <section
            className={`${styles.card} ${styles.comparisonCard}`}
            aria-labelledby="three-d-included-title"
          >
            <div className={styles.sectionIntro}>
              <p className={styles.badge}>Plats 3D inclus</p>
              <h2 id="three-d-included-title">
                Tous les forfaits Vistaire incluent des plats en 3D.
              </h2>
              <p>
                C&apos;est ce qui différencie Vistaire d&apos;un simple menu QR ou
                d&apos;un PDF : certains plats peuvent être explorés visuellement,
                directement depuis le téléphone du client.
              </p>
            </div>
            <div className="mt-7 grid gap-3 md:grid-cols-3">
              {PRICING_PAGE.plans.map((plan) => (
                <article
                  className="rounded-[14px] border border-[#e8cf9b]/26 bg-black/5 p-5 text-center backdrop-blur-[5px]"
                  key={plan.name}
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#e8cf9b]/76">
                    {plan.name.replace("Vistaire ", "")}
                  </p>
                  <p className="mt-3 font-[var(--vistaire-font-display)] text-[48px] font-normal leading-none text-[#fffaf0]">
                    {plan.included3dDishCount}
                  </p>
                  <p className="mt-2 text-[14px] font-bold text-[#f4e5cd]/86">
                    plats 3D inclus
                  </p>
                  <p className="mt-3 text-[13px] font-medium leading-[1.45] text-[#f4e5cd]/70">
                    Validés avant publication, avec fallback photo si nécessaire.
                  </p>
                </article>
              ))}
            </div>
            <div className="mt-7 grid gap-4 border-t border-white/10 pt-6 text-[14px] font-medium leading-[1.6] text-[#f4e5cd]/78 lg:grid-cols-2">
              <p>
                Les plats 3D sont créés à partir des photos fournies par le
                restaurant, puis validés avant publication. Si un rendu n&apos;est
                pas assez fidèle, il n&apos;est pas publié : la fiche plat reste
                premium avec photo.
              </p>
              <p>
                La réalité augmentée peut être disponible sur certains appareils
                compatibles lorsque le format le permet. Vistaire parle d&apos;abord
                de plats 3D inclus, avec AR compatible selon validation, plutôt
                que de promettre une AR universelle.
              </p>
            </div>
          </section>

          <section
            className={`${styles.card} ${styles.comparisonCard}`}
            id="forfaits"
            aria-labelledby="forfaits-title"
          >
            <div className={styles.sectionIntro}>
              <p className={styles.badge}>Forfaits</p>
              <h2 id="forfaits-title">
                Des tarifs clairs pour une carte mobile clé en main.
              </h2>
              <p>
                Chaque forfait inclut la création, la structure, le QR code, la
                mise en ligne accompagnée et une sélection de plats 3D.
              </p>
            </div>
            <div className="mt-8 grid gap-4 lg:grid-cols-3">
              {PRICING_PAGE.plans.map((plan) => (
                <PlanCard key={plan.name} plan={plan} />
              ))}
            </div>
            <div className="mt-6 rounded-[14px] border border-white/16 bg-black/5 p-5 text-[13px] font-medium leading-[1.55] text-[#f4e5cd]/68 backdrop-blur-[5px]">
              <p>Prix en CAD. Taxes applicables en sus.</p>
              <p className="mt-2">
                Les tarifs peuvent varier selon le nombre de plats, la qualité
                des photos, le niveau de rédaction, la complexité visuelle et
                les besoins spécifiques.
              </p>
              <p className="mt-2">
                Une offre partenaire peut être proposée aux premiers restaurants
                sélectionnés lorsque le projet reste simple et que les contenus
                sont prêts.
              </p>
            </div>
          </section>

          <section
            className={`${styles.card} ${styles.mobileProofCard}`}
            aria-labelledby="packs-title"
          >
            <figure className={styles.visualFigure}>
              <Image
                alt="Client consultant un menu digital Vistaire sur téléphone à table"
                className={styles.visualImage}
                fill
                quality={100}
                sizes="(max-width: 920px) calc(100vw - 56px), 58vw"
                src={photoDigital3}
                unoptimized
              />
            </figure>
            <div className={styles.visualCopy}>
              <p className={styles.badge}>Packs 3D supplémentaires</p>
              <h2 id="packs-title">
                La 3D est déjà incluse. Les packs servent à l&apos;étendre.
              </h2>
              <p>
                Tous les forfaits incluent déjà des plats 3D. Les packs
                supplémentaires permettent simplement d&apos;étendre l&apos;expérience
                à plus de plats.
              </p>
              <div className="mt-6 grid gap-3">
                {PRICING_PAGE.threeDPacks.map((pack) => (
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
            aria-labelledby="pdf-comparison-title"
          >
            <div className={styles.sectionIntro}>
              <p className={styles.badge}>Pourquoi Vistaire</p>
              <h2 id="pdf-comparison-title">
                Plus clair qu&apos;un PDF, plus premium qu&apos;un QR menu basique.
              </h2>
              <p>
                Le PDF reste un fichier. Vistaire devient une carte mobile
                pensée pour être consultée à table.
              </p>
            </div>
            <div className="mt-7 grid gap-3">
              {pdfRows.map(([leftTitle, leftBody, rightTitle, rightBody]) => (
                <article
                  className="grid gap-3 rounded-[14px] border border-white/16 bg-black/5 p-3 md:grid-cols-2"
                  key={`${leftBody}-${rightBody}`}
                >
                  <div className="rounded-[12px] border border-[#d4846a]/24 bg-[#120908]/70 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#d4846a]">
                      {leftTitle}
                    </p>
                    <p className="mt-2 text-[13px] font-medium leading-[1.45] text-[#f4e5cd]/72">
                      {leftBody}
                    </p>
                  </div>
                  <div className="rounded-[12px] border border-[#e8cf9b]/24 bg-black/10 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#e8cf9b]/76">
                      {rightTitle}
                    </p>
                    <p className="mt-2 text-[13px] font-medium leading-[1.45] text-[#fffaf0]/86">
                      {rightBody}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section
            className={`${styles.card} ${styles.premiumPanel}`}
            aria-labelledby="creation-title"
          >
            <div className={styles.premiumContent}>
              <div className={styles.sectionIntro}>
                <p className={styles.badge}>Création</p>
                <h2 id="creation-title">
                  Comment se passe la création de votre menu digital Vistaire ?
                </h2>
                <p>
                  Le parcours reste accompagné, de votre menu actuel jusqu&apos;à
                  la mise en ligne et aux modifications mensuelles prévues.
                </p>
              </div>
              <ol className="grid gap-2">
                {creationSteps.map((step, index) => (
                  <li
                    className="grid grid-cols-[40px_minmax(0,1fr)] gap-3 border-b border-white/10 py-3"
                    key={step}
                  >
                    <span className="font-[var(--vistaire-font-display)] text-[22px] leading-none text-[#e8cf9b]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <p className="text-[13.5px] font-medium leading-[1.45] text-[#fffaf0]/82">
                      {step}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
            <figure className={`${styles.visualFigure} ${styles.premiumVisual}`}>
              <Image
                alt="Vue mobile Vistaire avec plats et expérience visuelle premium"
                className={styles.visualImage}
                fill
                quality={100}
                sizes="(max-width: 920px) calc(100vw - 56px), 24vw"
                src={photoDigital2}
                unoptimized
              />
            </figure>
          </section>

          <section
            className={`${styles.card} ${styles.comparisonCard}`}
            aria-labelledby="restaurants-title"
          >
            <div className={styles.sectionIntro}>
              <p className={styles.badge}>Restaurants ciblés</p>
              <h2 id="restaurants-title">
                Pour les restaurants qui veulent mieux présenter leurs plats.
              </h2>
              <p>
                Vistaire est conçu pour les établissements qui veulent une carte
                plus lisible, plus élégante et plus mémorable sur mobile.
              </p>
            </div>
            <ul className="mt-7 flex flex-wrap gap-2">
              {restaurantTargets.map((target) => (
                <li
                  className="rounded-full border border-[#e8cf9b]/26 px-3 py-1.5 text-[12px] font-bold text-[#f4e5cd]/82"
                  key={target}
                >
                  {target}
                </li>
              ))}
            </ul>
          </section>

          <section
            className={`${styles.card} ${styles.mobileProofCard}`}
            aria-labelledby="photo-quality-title"
          >
            <figure className={styles.visualFigure}>
              <Image
                alt="Carte digitale Vistaire affichant une fiche plat sur téléphone"
                className={styles.visualImage}
                fill
                quality={100}
                sizes="(max-width: 920px) calc(100vw - 56px), 58vw"
                src={pageDigitalPhoto}
                unoptimized
              />
            </figure>
            <div className={styles.visualCopy}>
              <p className={styles.badge}>Photos et qualité 3D</p>
              <h2 id="photo-quality-title">
                La qualité visuelle se valide avant publication.
              </h2>
              <p>
                De bonnes photos améliorent les résultats 3D. Vistaire peut
                démarrer avec les photos existantes, puis recommander une
                retouche ou un remplacement lorsque c&apos;est nécessaire.
              </p>
              <p>
                La 3D n&apos;est publiée que si le rendu est acceptable. Les
                photos restent toujours disponibles comme fallback premium.
              </p>
              <Link
                className={styles.secondaryButton}
                href="/menu-3d-ar-restaurant"
                prefetch={false}
              >
                Lire le guide sur les plats 3D
              </Link>
            </div>
          </section>

          <section
            className={`${styles.card} ${styles.comparisonCard}`}
            aria-labelledby="faq-title"
          >
            <div className={styles.sectionIntro}>
              <p className={styles.badge}>FAQ SEO/GEO</p>
              <h2 id="faq-title">
                Questions fréquentes sur le prix d&apos;un menu digital
                restaurant.
              </h2>
              <p>
                Réponses directes pour Google, les moteurs génératifs et les
                restaurateurs qui comparent PDF, QR code et carte mobile
                premium.
              </p>
            </div>
            <div className="mt-8">
              <SeoFaq faqs={[...PRICING_PAGE.faq]} layout="stack" />
            </div>
          </section>

          <section
            className={`${styles.card} ${styles.finalCta}`}
            aria-labelledby="final-cta-title"
          >
            <div>
              <p className={styles.badge}>Prochaine étape</p>
              <h2 id="final-cta-title">
                Vous voulez remplacer votre PDF par une carte digitale avec
                plats 3D inclus ?
              </h2>
              <p>
                Vistaire crée votre menu digital premium, votre QR code et vos
                fiches plats, avec une sélection de plats en 3D dès le départ.
              </p>
            </div>
            <div className={styles.finalActions}>
              <Link
                className={styles.primaryButton}
                href="/prendre-rendez-vous"
                prefetch={false}
              >
                Parler de votre menu
                <ArrowIcon />
              </Link>
              <Link
                className={styles.secondaryButton}
                href={PRICING_PAGE.secondaryCta.href}
                prefetch={false}
              >
                {PRICING_PAGE.secondaryCta.label}
              </Link>
            </div>
            <nav className={styles.internalLinks} aria-label="Liens internes Vistaire">
              {resourceLinks.map((item) => (
                <Link href={item.href} key={item.href} prefetch={false}>
                  {item.label}
                </Link>
              ))}
            </nav>
          </section>
        </div>
      </section>

      <PricingFooter />
    </main>
  );
}
