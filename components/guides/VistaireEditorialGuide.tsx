import Image from "next/image";
import type { Metadata } from "next";
import Link from "next/link";
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
} from "@/lib/seo";
import {
  PreviewFooter,
  PreviewNav,
} from "../vistaire-preview/VistairePreviewChrome";
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
      locale: LOCALE_OPEN_GRAPH[guide.locale],
    },
    twitter: {
      card: "summary",
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

export function VistaireEditorialGuide({ guide }: { guide: EditorialGuide }) {
  const isEnglish = guide.locale === "en";
  const homePath = isEnglish ? "/en" : "/";
  const breadcrumbHome = isEnglish ? "Home" : "Accueil";
  const presentation = getEditorialGuidePresentation(guide.key, guide.locale);
  const variant = presentation.guideVariant;
  const guideVariantClass = variant === "journey" ? styles.pageJourney : variant === "decision" ? styles.pageDecision : styles.pageAnatomy;
  const title = <div className={styles.heroCopy}>
    <nav aria-label={isEnglish ? "Breadcrumb" : "Fil d’Ariane"} className={styles.breadcrumb}><Link href={homePath}>{breadcrumbHome}</Link><span aria-hidden="true">/</span><span aria-current="page">{guide.h1}</span></nav>
    <p className={styles.eyebrow}>{guide.eyebrow}</p><h1>{guide.h1}</h1>
  </div>;
  const image = <figure className={styles.heroVisual}>
    <Image alt={presentation.heroImageAlt} className={styles.heroImage} fill priority sizes="(max-width: 700px) calc(100vw - 40px), (max-width: 1100px) 80vw, 900px" src={presentation.heroImage} />
  </figure>;
  const introduction = <div className={styles.guideIntroduction}><p className={styles.dek}>{guide.dek}</p><p className={styles.definition}>{guide.definition}</p><Link className={styles.heroCta} href={guide.cta.href} prefetch={false}>{guide.cta.label}<span aria-hidden="true">↗</span></Link></div>;
  const chapter = (index: number) => <GuideChapter key={guide.sections[index].id} section={guide.sections[index]} index={index} layout={presentation.sectionLayouts[guide.sections[index].id]} />;
  const checklistItems = <ul>{guide.checklist.items.map((item) => <li key={item}><span aria-hidden="true">✓</span>{item}</li>)}</ul>;

  return (
    <main className={`${styles.page} ${guideVariantClass}`} data-public-vistaire data-guide-variant={variant} data-seo-experience={`guide-${variant}`}>
      <div className={styles.navShell}><PreviewNav currentPath={guide.path} locale={guide.locale} routeMode="production" /></div>
      <JsonLd data={[
        buildWebPageJsonLd({ path: guide.path, name: guide.h1, description: guide.metadataDescription, locale: guide.locale }),
        buildArticleJsonLd({ path: guide.path, headline: guide.h1, description: guide.metadataDescription, locale: guide.locale }),
        buildBreadcrumbJsonLd([{ name: breadcrumbHome, path: homePath }, { name: guide.h1, path: guide.path }]),
      ]} />
      <article className={styles.article}><div className={styles.previewFrame}>
        {variant === "anatomy" ? <>
          <header className={styles.anatomyCover}>
            {title}
            <div className={styles.anatomyPlate}>{image}<div className={styles.plateReferences}>{guide.sections.slice(0, 4).map((section, index) => <a href={`#${section.id}`} key={section.id}><span>0{index + 1}</span>{section.title}</a>)}</div></div>
            {introduction}
          </header>
          <div className={styles.editorialGrid}><GuideContents guide={guide} /><div className={styles.body}>{guide.sections.map((_, index) => chapter(index))}</div></div>
        </> : variant === "journey" ? <>
          <header className={styles.fieldManualCover}>{title}{image}{introduction}</header>
          <GuideContents guide={guide} compact />
          <div className={styles.fieldManualPath}>
            {guide.sections.slice(0, 4).map((_, index) => chapter(index))}
          </div>
          <aside className={styles.fieldNotes} aria-label={isEnglish ? "Service field notes" : "Notes de terrain pour le service"}>{chapter(4)}{chapter(5)}</aside>
        </> : <>
          <header className={styles.decisionCover}>{title}<div className={styles.decisionOpening}>{image}{introduction}</div></header>
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
      <PreviewFooter currentPath={guide.path} locale={guide.locale} routeMode="production" width="wide" />
    </main>
  );
}
