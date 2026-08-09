import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import {
  PreviewFooter,
  PreviewNav
} from "@/components/vistaire-preview/VistairePreviewChrome";
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

export function VistaireEditorialGuide({ guide }: { guide: EditorialGuide }) {
  const isEnglish = guide.locale === "en";
  const homePath = isEnglish ? "/en" : "/";
  const breadcrumbLabel = isEnglish ? "Breadcrumb" : "Fil d’Ariane";
  const breadcrumbHome = isEnglish ? "Home" : "Accueil";
  const contentsLabel = isEnglish ? "In this guide" : "Dans ce guide";

  return (
    <main className={styles.page}>
      <div aria-hidden="true" className={styles.background} />
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
        <header className={styles.hero}>
          <nav aria-label={breadcrumbLabel} className={styles.breadcrumb}>
            <Link href={homePath}>{breadcrumbHome}</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{guide.h1}</span>
          </nav>
          <p className={styles.eyebrow}>{guide.eyebrow}</p>
          <h1>{guide.h1}</h1>
          <p className={styles.dek}>{guide.dek}</p>
          <p className={styles.definition}>{guide.definition}</p>
        </header>

        <div className={styles.editorialGrid}>
          <aside className={styles.contents} aria-label={contentsLabel}>
            <p>{contentsLabel}</p>
            <ol>
              {guide.sections.map((section) => (
                <li key={section.id}>
                  <a href={`#${section.id}`}>{section.title}</a>
                </li>
              ))}
              <li>
                <a href="#checklist">{guide.checklist.title}</a>
              </li>
            </ol>
          </aside>

          <div className={styles.body}>
            {guide.sections.map((section) => (
              <section id={section.id} key={section.id}>
                <h2>{section.title}</h2>
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
            ))}

            <section className={styles.checklist} id="checklist">
              <p className={styles.sectionKicker}>
                {isEnglish ? "For the team" : "Pour l’équipe"}
              </p>
              <h2>{guide.checklist.title}</h2>
              <p>{guide.checklist.introduction}</p>
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
              <h2 id="related-guides-title">{guide.relatedTitle}</h2>
              <div className={styles.relatedGrid}>
                {guide.relatedPaths.map((path) => (
                  <Link href={path} key={path}>
                    <span>{relatedLabel(path, guide)}</span>
                    <span aria-hidden="true">↗</span>
                  </Link>
                ))}
              </div>
            </section>
          </div>
        </div>

        <aside className={styles.cta} aria-label={guide.cta.eyebrow}>
          <p className={styles.eyebrow}>{guide.cta.eyebrow}</p>
          <h2>{guide.cta.title}</h2>
          <p>{guide.cta.text}</p>
          <Link href={guide.cta.href}>{guide.cta.label}<span aria-hidden="true">↗</span></Link>
        </aside>
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
