import type { Metadata } from "next";
import Link from "next/link";
import { CinematicPage, type CinematicChapter } from "../immersive/CinematicPage.jsx";
import { CinematicFooter } from "../immersive/pages/CinematicFooter";
import { JsonLd } from "../JsonLd";
import {
  getEditorialGuidePresentation,
  type GuideSectionLayout,
} from "./editorialGuidePresentation";
import {
  getEditorialGuideByPath,
  type EditorialGuide,
  type EditorialGuideSection,
} from "@/lib/editorialGuides";
import { buildPageAlternates, LOCALE_OPEN_GRAPH } from "@/lib/i18n";
import {
  absoluteUrl,
  buildArticleJsonLd,
  buildBreadcrumbJsonLd,
  buildWebPageJsonLd,
  socialImages,
} from "@/lib/seo";
import { PreviewNav } from "../vistaire-preview/VistairePreviewChrome";
import styles from "./VistaireEditorialGuide.module.css";

const RELATED_LABELS: Record<string, { fr: string; en: string }> = {
  "/menu-digital-restaurant": {
    fr: "Comprendre le menu digital restaurant",
    en: "Understand the digital restaurant menu",
  },
  "/en/digital-restaurant-menu": {
    fr: "Comprendre le menu digital restaurant",
    en: "Understand the digital restaurant menu",
  },
  "/menu-qr-code-restaurant": {
    fr: "Le menu QR code pour restaurant",
    en: "The QR code restaurant menu",
  },
  "/en/qr-code-restaurant-menu": {
    fr: "Le menu QR code pour restaurant",
    en: "The QR code restaurant menu",
  },
  "/menu-3d-ar-restaurant": {
    fr: "La 3D et la réalité augmentée au restaurant",
    en: "3D and augmented reality for restaurants",
  },
  "/en/3d-ar-restaurant-menu": {
    fr: "La 3D et la réalité augmentée au restaurant",
    en: "3D and augmented reality for restaurants",
  },
  "/menu-digital-sans-application": {
    fr: "Le menu digital sans application",
    en: "The digital menu without an app",
  },
  "/en/digital-menu-without-app": {
    fr: "Le menu digital sans application",
    en: "The digital menu without an app",
  },
  "/demo": {
    fr: "Explorer une carte digitale",
    en: "Explore a digital menu",
  },
  "/en/vistaire-menu": {
    fr: "Explorer une carte digitale",
    en: "Explore a digital menu",
  },
};

const guideSocial = (guide: EditorialGuide) =>
  socialImages(getEditorialGuidePresentation(guide.key, guide.locale).heroImageSlot, guide.locale);

export function buildEditorialGuideMetadata(guide: EditorialGuide): Metadata {
  return {
    title: { absolute: guide.metadataTitle },
    description: guide.metadataDescription,
    alternates: buildPageAlternates(guide.path),
    openGraph: {
      images: guideSocial(guide).openGraph,
      type: "article",
      url: absoluteUrl(guide.path),
      title: guide.metadataTitle,
      description: guide.metadataDescription,
      locale: LOCALE_OPEN_GRAPH[guide.locale],
    },
    twitter: {
      card: "summary_large_image",
      images: guideSocial(guide).twitter,
      title: guide.metadataTitle,
      description: guide.metadataDescription,
    },
  };
}

function relatedLabel(path: string, guide: EditorialGuide) {
  const editorialGuide = getEditorialGuideByPath(path);
  if (editorialGuide) return editorialGuide.cardTitle;
  return RELATED_LABELS[path]?.[guide.locale] ?? path;
}

function relatedCardMeta(path: string, guide: EditorialGuide) {
  return getEditorialGuideByPath(path)
    ? "Guide"
    : guide.locale === "en"
      ? "Related page"
      : "Page associée";
}

function relatedCardAction(path: string, guide: EditorialGuide) {
  return getEditorialGuideByPath(path)
    ? guide.locale === "en"
      ? "Read the guide"
      : "Lire le guide"
    : guide.locale === "en"
      ? "Explore the page"
      : "Explorer la page";
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

function GuideContents({ guide, compact = false }: { guide: EditorialGuide; compact?: boolean }) {
  return <nav aria-label={guide.locale === "en" ? "In this guide" : "Dans ce guide"} className={`${styles.contents} ${compact ? styles.contentsCompact : ""}`}>
    <p>{guide.locale === "en" ? "In this guide" : "Dans ce guide"}</p>
    <ol>{guide.sections.map((section, index) => <li key={section.id}><a href={`#${section.id}`}><span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>{section.title}</a></li>)}<li><a href="#checklist"><span aria-hidden="true">✓</span>{guide.checklist.title}</a></li></ol>
  </nav>;
}

function GuideChapter({ section, index, layout = "quiet" }: { section: EditorialGuideSection; index: number; layout?: GuideSectionLayout }) {
  return <section className={`${styles.guideSection} ${layoutClass(layout)}`} id={section.id} tabIndex={-1}>
    <div className={styles.sectionHeading}><p className={styles.sectionNumber}>{String(index + 1).padStart(2, "0")}</p><h2>{section.title}</h2></div>
    <div className={styles.sectionContent}>{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}{section.bullets ? <ul className={styles.criteria}>{section.bullets.map((item) => <li key={item}>{item}</li>)}</ul> : null}</div>
    {section.table ? <div aria-label={section.table.caption} className={styles.tableScroll} data-guide-table-scroll role="region" tabIndex={0}>
      <table><caption>{section.table.caption}</caption><thead><tr>{section.table.headers.map((header) => <th key={header} scope="col">{header}</th>)}</tr></thead><tbody>{section.table.rows.map((row) => <tr key={row[0]}><th scope="row">{row[0]}</th><td>{row[1]}</td><td>{row[2]}</td></tr>)}</tbody></table>
    </div> : null}
  </section>;
}

// Each guide tells its own story in the room before the article: scan, read
// and sit down (journey); the plan, the screen and the plate (anatomy); the
// dish alone, against a flat menu, at the table (decision).
const GUIDE_SCENES = {
  journey: { shots: ["guide-journey-scan", "guide-journey-read", "guide-journey-table"], scene: { dish: "huitres", phoneDemo: "sauge-noire", collection: "acrylique" } },
  anatomy: { shots: ["guide-anatomy-plan", "guide-anatomy-screen", "guide-anatomy-plate"], scene: { dish: "homard", phoneDemo: "maison-elyse" } },
  decision: { shots: ["guide-decision-dish", "guide-decision-versus", "guide-decision-table"], scene: { dish: "poutine", phoneDemo: "trouvable" } },
} as const;

export function VistaireEditorialGuide({ guide }: { guide: EditorialGuide }) {
  const isEnglish = guide.locale === "en";
  const homePath = isEnglish ? "/en" : "/";
  const breadcrumbHome = isEnglish ? "Home" : "Accueil";
  const presentation = getEditorialGuidePresentation(guide.key, guide.locale);
  const variant = presentation.guideVariant;
  const guideVariantClass = variant === "journey" ? styles.pageJourney : variant === "decision" ? styles.pageDecision : styles.pageAnatomy;
  const { shots, scene } = GUIDE_SCENES[variant];
  const chapter = (index: number) => <GuideChapter key={guide.sections[index].id} section={guide.sections[index]} index={index} layout={presentation.sectionLayouts[guide.sections[index].id]} />;
  const checklistItems = <ul>{guide.checklist.items.map((item) => <li key={item}><span aria-hidden="true">✓</span>{item}</li>)}</ul>;
  const chapters: CinematicChapter[] = [
    {
      id: "guide-introduction",
      shot: shots[0],
      titleId: "guide-title",
      content: (
        <>
          <nav aria-label={isEnglish ? "Breadcrumb" : "Fil d’Ariane"} className="cinematic-breadcrumb"><Link href={homePath}>{breadcrumbHome}</Link><span aria-hidden="true">/</span><span aria-current="page">{guide.h1}</span></nav>
          <span className="eyebrow">{guide.eyebrow}</span>
          <h1 id="guide-title">{guide.h1}</h1>
          <p>{guide.dek}</p>
        </>
      ),
    },
    {
      id: "guide-definition",
      shot: shots[1],
      align: "right",
      titleId: "guide-definition-title",
      content: (
        <>
          <h2 id="guide-definition-title">{isEnglish ? "In short" : "En bref"}</h2>
          <p>{guide.definition}</p>
          <div className="cinematic-actions">
            <a className="action" href={`#${guide.sections[0].id}`}>{isEnglish ? "Read the guide" : "Lire le guide"}</a>
          </div>
        </>
      ),
    },
    {
      id: "guide-team",
      shot: shots[2],
      titleId: "guide-cta-title",
      content: (
        <>
          <span className="eyebrow">{guide.cta.eyebrow}</span>
          <h2 id="guide-cta-title">{guide.cta.title}</h2>
          <p>{guide.cta.text}</p>
          <div className="cinematic-actions">
            <Link className="action" href={guide.cta.href} prefetch={false}>{guide.cta.label}</Link>
            <a className="action action-dark" href="#checklist">{guide.checklist.title}</a>
          </div>
        </>
      ),
    },
  ];

  return (
    <>
      <PreviewNav currentPath={guide.path} locale={guide.locale} routeMode="production" />
      <JsonLd data={[
        buildWebPageJsonLd({ path: guide.path, name: guide.h1, description: guide.metadataDescription, locale: guide.locale }),
        buildArticleJsonLd({ path: guide.path, headline: guide.h1, description: guide.metadataDescription, locale: guide.locale, image: guideSocial(guide).twitter[0] }),
        buildBreadcrumbJsonLd([{ name: breadcrumbHome, path: homePath }, { name: guide.h1, path: guide.path }]),
      ]} />
      <CinematicPage chapters={chapters} scene={scene} footer={<CinematicFooter locale={guide.locale} id={`guide-${variant}`} />}>
        <div className={`${styles.page} ${guideVariantClass} cinematic-article-sheet`} data-public-vistaire data-guide-variant={variant} data-seo-experience={`guide-${variant}`}>
          <article className={styles.article} aria-labelledby="guide-title"><div className={styles.previewFrame}>
            {variant === "anatomy" ? (
              <div className={styles.editorialGrid}><GuideContents guide={guide} /><div className={styles.body}>{guide.sections.map((_, index) => chapter(index))}</div></div>
            ) : variant === "journey" ? <>
              <GuideContents guide={guide} compact />
              <div className={styles.fieldManualPath}>{guide.sections.slice(0, 4).map((_, index) => chapter(index))}</div>
              <aside className={styles.fieldNotes} aria-label={isEnglish ? "Service field notes" : "Notes de terrain pour le service"}>{chapter(4)}{chapter(5)}</aside>
            </> : <>
              <details className={styles.decisionQuestion} open><summary>{isEnglish ? "Which question are you trying to answer?" : "Quelle question cherchez-vous à résoudre ?"}</summary><GuideContents guide={guide} compact /></details>
              <div className={styles.decisionThesis}>{chapter(0)}</div>
              <div className={styles.decisionSpread}>{chapter(1)}{chapter(2)}</div>
              <aside className={styles.criticalBand} aria-label={isEnglish ? "Performance and compatibility" : "Performance et compatibilité"}>{chapter(3)}{chapter(4)}</aside>
              <div className={styles.decisionGovernance}>{chapter(5)}</div>
            </>}
            <section className={styles.checklist} id="checklist" aria-labelledby="guide-checklist-title">
              <div className={styles.sectionHeading}><p className={styles.sectionNumber}>✓</p><div><p className={styles.sectionKicker}>{isEnglish ? "For the team" : "Pour l’équipe"}</p><h2 id="guide-checklist-title">{guide.checklist.title}</h2></div></div>
              <p className={styles.checklistIntro}>{guide.checklist.introduction}</p>
              {variant === "journey" ? <form className={styles.fieldChecklist}>
                <p>{isEnglish ? "A preparation aid on this page. Checking a box does not configure your restaurant." : "Un aide-mémoire sur cette page. Cocher une case ne configure pas votre restaurant."}</p>
                <fieldset><legend className={styles.checklistLegend}>{isEnglish ? "Preparation checklist" : "Liste de préparation"}</legend>{guide.checklist.items.map((item, index) => <label key={item}><input type="checkbox" name={`preparation-${index}`} /><span>{item}</span></label>)}</fieldset>
                <button type="reset">{isEnglish ? "Reset the checklist" : "Réinitialiser la liste"}</button>
              </form> : variant === "anatomy" ? <details className={styles.checklistDisclosure} open><summary>{isEnglish ? "Review the reference points" : "Revoir les points de référence"}</summary>{checklistItems}</details> : checklistItems}
            </section>
            <section className={styles.related} aria-labelledby="related-guides-title">
              <div className={styles.sectionHeading}><p className={styles.sectionNumber}>↗</p><h2 id="related-guides-title">{guide.relatedTitle}</h2></div>
              <div className={styles.relatedGrid}>{guide.relatedPaths.map((path, index) => <Link href={path} key={path} prefetch={false}><span className={styles.relatedCardMeta}>{String(index + 1).padStart(2, "0")} · {relatedCardMeta(path, guide)}</span><span className={styles.relatedCardTitle}>{relatedLabel(path, guide)}</span><span className={styles.relatedCardAction}>{relatedCardAction(path, guide)}<span aria-hidden="true" className={styles.relatedArrow}>↗</span></span></Link>)}</div>
            </section>
            <section className={styles.cta} aria-label={guide.cta.eyebrow}><div><p className={styles.eyebrow}>{guide.cta.eyebrow}</p><h2>{guide.cta.title}</h2><p>{guide.cta.text}</p></div><Link className={styles.ctaButton} href={guide.cta.href} prefetch={false}>{guide.cta.label}<span aria-hidden="true">↗</span></Link></section>
          </div></article>
        </div>
      </CinematicPage>
    </>
  );
}
