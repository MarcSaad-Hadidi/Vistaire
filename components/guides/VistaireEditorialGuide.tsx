import Image from "next/image";
import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import restaurantBackground from "@/Framer/PhotoRestoComplet5.png";
import {
  getEditorialGuidePresentation,
  type GuideSectionLayout
} from "@/components/guides/editorialGuidePresentation";
import {
  getEditorialGuideByPath,
  type EditorialGuide
} from "@/lib/editorialGuides";
import { buildPageAlternates, LOCALE_OPEN_GRAPH } from "@/lib/i18n";
import {
  absoluteUrl,
  buildArticleJsonLd,
  buildBreadcrumbJsonLd,
  buildWebPageJsonLd
} from "@/lib/seo";
import {
  PreviewFooter,
  PreviewNav
} from "@/components/vistaire-preview/VistairePreviewChrome";
import styles from "./VistaireEditorialGuide.module.css";

const RELATED_LABELS: Record<string, { fr: string; en: string }> = {
  "/menu-digital-restaurant": {
    fr: "Comprendre le menu digital restaurant",
    en: "Understand the digital restaurant menu"
  },
  "/en/digital-restaurant-menu": {
    fr: "Comprendre le menu digital restaurant",
    en: "Understand the digital restaurant menu"
  },
  "/menu-qr-code-restaurant": {
    fr: "Le menu QR code pour restaurant",
    en: "The QR code restaurant menu"
  },
  "/en/qr-code-restaurant-menu": {
    fr: "Le menu QR code pour restaurant",
    en: "The QR code restaurant menu"
  },
  "/menu-3d-ar-restaurant": {
    fr: "La 3D et la réalité augmentée au restaurant",
    en: "3D and augmented reality for restaurants"
  },
  "/en/3d-ar-restaurant-menu": {
    fr: "La 3D et la réalité augmentée au restaurant",
    en: "3D and augmented reality for restaurants"
  },
  "/menu-digital-sans-application": {
    fr: "Le menu digital sans application",
    en: "The digital menu without an app"
  },
  "/en/digital-menu-without-app": {
    fr: "Le menu digital sans application",
    en: "The digital menu without an app"
  },
  "/demo": {
    fr: "Explorer une carte digitale",
    en: "Explore a digital menu"
  },
  "/en/vistaire-menu": {
    fr: "Explorer une carte digitale",
    en: "Explore a digital menu"
  }
};

export function buildEditorialGuideMetadata(guide: EditorialGuide): Metadata {
  return {
    title: { absolute: guide.metadataTitle },
    description: guide.metadataDescription,
    alternates: buildPageAlternates(guide.path),
    openGraph: {
      type: "article",
      url: absoluteUrl(guide.path),
      title: guide.metadataTitle,
      description: guide.metadataDescription,
      locale: LOCALE_OPEN_GRAPH[guide.locale]
    },
    twitter: {
      card: "summary",
      title: guide.metadataTitle,
      description: guide.metadataDescription
    }
  };
}

function relatedLabel(path: string, guide: EditorialGuide) {
  const editorialGuide = getEditorialGuideByPath(path);
  if (editorialGuide) return editorialGuide.cardTitle;
  return RELATED_LABELS[path]?.[guide.locale] ?? path;
}

function layoutClass(layout: GuideSectionLayout) {
  switch (layout) {
    case "feature":
      return styles.layoutFeature;
    case "split":
      return styles.layoutSplit;
    case "table":
      return styles.layoutTable;
    case "quiet":
      return styles.layoutQuiet;
    default:
      return styles.layoutQuiet;
  }
}

export function VistaireEditorialGuide({ guide }: { guide: EditorialGuide }) {
  const isEnglish = guide.locale === "en";
  const homePath = isEnglish ? "/en" : "/";
  const breadcrumbLabel = isEnglish ? "Breadcrumb" : "Fil d’Ariane";
  const breadcrumbHome = isEnglish ? "Home" : "Accueil";
  const contentsLabel = isEnglish ? "In this guide" : "Dans ce guide";
  const presentation = getEditorialGuidePresentation(guide.key, guide.locale);
  const heroImageAlt = presentation.heroImageAlt[guide.locale];
  const heroVariantClass =
    presentation.heroVariant === "visual-left"
      ? styles.heroVisualLeft
      : presentation.heroVariant === "editorial-stack"
        ? styles.heroEditorialStack
        : styles.heroVisualRight;
  const guideVariantClass =
    presentation.guideVariant === "journey"
      ? styles.pageJourney
      : presentation.guideVariant === "decision"
        ? styles.pageDecision
        : styles.pageAnatomy;

  return (
    <main
      className={`${styles.page} ${guideVariantClass}`}
      data-guide-variant={presentation.guideVariant}
    >
      <Image
        alt=""
        aria-hidden="true"
        className={styles.backgroundImage}
        fill
        loading="lazy"
        quality={75}
        sizes="100vw"
        src={restaurantBackground}
      />
      <div aria-hidden="true" className={styles.backgroundVeil} />
      <div className={styles.navShell}>
        <PreviewNav
          currentPath={guide.path}
          locale={guide.locale}
          routeMode="production"
        />
      </div>

      <JsonLd
        data={[
          buildWebPageJsonLd({
            path: guide.path,
            name: guide.h1,
            description: guide.metadataDescription,
            locale: guide.locale
          }),
          buildArticleJsonLd({
            path: guide.path,
            headline: guide.h1,
            description: guide.metadataDescription,
            locale: guide.locale
          }),
          buildBreadcrumbJsonLd([
            { name: breadcrumbHome, path: homePath },
            { name: guide.h1, path: guide.path }
          ])
        ]}
      />

      <article className={styles.article}>
        <div className={styles.previewFrame}>
          <header className={`${styles.hero} ${heroVariantClass}`}>
            <div className={styles.heroCopy}>
              <nav aria-label={breadcrumbLabel} className={styles.breadcrumb}>
                <Link href={homePath}>{breadcrumbHome}</Link>
                <span aria-hidden="true">/</span>
                <span aria-current="page">{guide.h1}</span>
              </nav>
              <p className={styles.eyebrow}>{guide.eyebrow}</p>
              <h1>{guide.h1}</h1>
              <p className={styles.dek}>{guide.dek}</p>
              <p className={styles.definition}>{guide.definition}</p>
              <Link className={styles.heroCta} href={guide.cta.href} prefetch={false}>
                {guide.cta.label}
                <span aria-hidden="true">↗</span>
              </Link>
            </div>
            <figure className={styles.heroVisual}>
              <Image
                alt={heroImageAlt}
                className={styles.heroImage}
                fill
                priority
                sizes="(max-width: 920px) calc(100vw - 64px), 42vw"
                src={presentation.heroImage}
              />
              <figcaption>
                {isEnglish ? "A Vistaire point of view" : "Un regard Vistaire"}
              </figcaption>
            </figure>
          </header>

          <nav aria-label={contentsLabel} className={styles.contents}>
            <p>{contentsLabel}</p>
            <ol>
              {guide.sections.map((section, index) => (
                <li key={section.id}>
                  <a href={`#${section.id}`}>
                    <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                    {section.title}
                  </a>
                </li>
              ))}
              <li>
                <a href="#checklist">
                  <span aria-hidden="true">↳</span>
                  {guide.checklist.title}
                </a>
              </li>
            </ol>
          </nav>

          <div className={styles.editorialGrid}>
            <div className={styles.body}>
              {guide.sections.map((section, index) => {
                const sectionLayout =
                  presentation.sectionLayouts[section.id] ?? "quiet";
                return (
                  <section
                    className={`${styles.guideSection} ${layoutClass(sectionLayout)}`}
                    id={section.id}
                    key={section.id}
                  >
                    <div className={styles.sectionHeading}>
                      <p className={styles.sectionNumber}>
                        {String(index + 1).padStart(2, "0")}
                      </p>
                      <h2>{section.title}</h2>
                    </div>
                    <div className={styles.sectionContent}>
                      {section.paragraphs.map((paragraph) => (
                        <p key={paragraph}>{paragraph}</p>
                      ))}
                      {section.bullets ? (
                        <ul className={styles.criteria}>
                          {section.bullets.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                    {section.table ? (
                      <div
                        aria-label={section.table.caption}
                        className={styles.tableScroll}
                        data-guide-table-scroll
                        role="region"
                        tabIndex={0}
                      >
                        <table>
                          <caption>{section.table.caption}</caption>
                          <thead>
                            <tr>
                              {section.table.headers.map((header) => (
                                <th key={header} scope="col">{header}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {section.table.rows.map((row) => (
                              <tr key={row[0]}>
                                <th scope="row">{row[0]}</th>
                                <td>{row[1]}</td>
                                <td>{row[2]}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                  </section>
                );
              })}
            </div>
          </div>

          <section className={styles.checklist} id="checklist">
            <div className={styles.sectionHeading}>
              <p className={styles.sectionNumber}>✓</p>
              <div>
                <p className={styles.sectionKicker}>
                  {isEnglish ? "For the team" : "Pour l’équipe"}
                </p>
                <h2>{guide.checklist.title}</h2>
              </div>
            </div>
            <p className={styles.checklistIntro}>{guide.checklist.introduction}</p>
            <ul>
              {guide.checklist.items.map((item) => (
                <li key={item}>
                  <span aria-hidden="true">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.related} aria-labelledby="related-guides-title">
            <div className={styles.sectionHeading}>
              <p className={styles.sectionNumber}>↗</p>
              <h2 id="related-guides-title">{guide.relatedTitle}</h2>
            </div>
            <div className={styles.relatedGrid}>
              {guide.relatedPaths.map((path, index) => (
                <Link href={path} key={path} prefetch={false}>
                  <span className={styles.relatedCardMeta}>
                    {String(index + 1).padStart(2, "0")} · {isEnglish ? "Guide" : "Guide"}
                  </span>
                  <span className={styles.relatedCardTitle}>{relatedLabel(path, guide)}</span>
                  <span className={styles.relatedCardAction}>
                    {isEnglish ? "Read the guide" : "Lire le guide"}
                    <span aria-hidden="true" className={styles.relatedArrow}>↗</span>
                  </span>
                </Link>
              ))}
            </div>
          </section>

          <section className={styles.cta} aria-label={guide.cta.eyebrow}>
            <div>
              <p className={styles.eyebrow}>{guide.cta.eyebrow}</p>
              <h2>{guide.cta.title}</h2>
              <p>{guide.cta.text}</p>
            </div>
            <Link className={styles.ctaButton} href={guide.cta.href} prefetch={false}>
              {guide.cta.label}
              <span aria-hidden="true">↗</span>
            </Link>
          </section>
        </div>
      </article>

      <PreviewFooter
        currentPath={guide.path}
        locale={guide.locale}
        routeMode="production"
        width="wide"
      />
    </main>
  );
}
