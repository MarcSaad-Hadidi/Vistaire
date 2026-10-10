import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import type { SeoGeoPageData } from "@/lib/seoGeoTypes";
import { seoGeoPublicText } from "@/lib/seoGeoPublicText";
import { getSeoMarketingImage } from "@/lib/seoMarketingImages";
import styles from "./SeoGeoExperiences.module.css";

export type GeoExperienceProps = { page: SeoGeoPageData; group: string };

export function geoText(page: SeoGeoPageData, value: string) {
  return seoGeoPublicText(value, page.locale ?? "fr");
}

export function GeoActions({ page }: { page: SeoGeoPageData }) {
  return <div className={styles.actions}>
    <Link className={styles.primaryAction} href={page.primaryCta.href} prefetch={false}>
      {geoText(page, page.primaryCta.label)}
      <svg aria-hidden="true" viewBox="0 0 16 16"><path d="M3 13 13 3M4 3h9v9" /></svg>
    </Link>
    <Link className={styles.secondaryAction} href={page.secondaryCta.href} prefetch={false}>{geoText(page, page.secondaryCta.label)}</Link>
  </div>;
}

export function GeoTitle({ page, children }: { page: SeoGeoPageData; children?: ReactNode }) {
  return <header className={styles.titleBlock}>
    <p className={styles.eyebrow}>{geoText(page, page.eyebrow)}</p>
    <h1 id={`${page.slug}-title`}>{geoText(page, page.h1)}</h1>
    {children}
    <GeoActions page={page} />
  </header>;
}

export function GeoPhoto({ page, group, placement, priority = false, caption }: GeoExperienceProps & {
  placement: "hero" | "proof" | "premium";
  priority?: boolean;
  caption?: string;
}) {
  const slot = `${group}:${placement}`;
  const photo = getSeoMarketingImage(slot, page.locale ?? "fr");
  const showEnlargement = group === "G7" && placement !== "premium";
  const frame = <div className={styles.photoFrame}>
    <Image alt={photo.alt} src={photo.src} fill priority={priority} quality={84}
      sizes="(max-width: 640px) calc(100vw - 40px), (max-width: 1000px) 80vw, 960px" />
  </div>;
  return <figure className={styles.photo} data-seo-photo-slot={slot}>
    {showEnlargement ? <a className={styles.enlargePhoto} href={photo.src} target="_blank" rel="noopener noreferrer">
      {frame}<span>{page.locale === "en" ? "View the allergen panel at full size (new tab)" : "Voir le panneau des allergènes en grand (nouvel onglet)"}</span>
    </a> : frame}
    {caption ? <figcaption>{caption}</figcaption> : null}
  </figure>;
}

export function GeoAnswer({ page }: { page: SeoGeoPageData }) {
  return <div className={styles.answer}>
    <p className={styles.eyebrow}>{page.locale === "en" ? "In a few words" : "En quelques mots"}</p>
    <p>{geoText(page, page.directAnswer)}</p>
  </div>;
}

export function GeoContext({ page, children, showPoints = true }: { page: SeoGeoPageData; children?: ReactNode; showPoints?: boolean }) {
  return <section className={styles.context} aria-labelledby={`${page.slug}-context-title`}>
    <h2 id={`${page.slug}-context-title`}>{geoText(page, page.context.heading)}</h2>
    <div className={styles.prose}>{page.context.body.map((text) => <p key={text}>{geoText(page, text)}</p>)}</div>
    {children ?? (showPoints && page.context.points?.length ? <ul className={styles.contextPoints}>{page.context.points.map((point) => <li key={point}>{geoText(page, point)}</li>)}</ul> : null)}
  </section>;
}

export function GeoProof({ page, children }: { page: SeoGeoPageData; children?: ReactNode }) {
  return <section className={styles.proof} aria-labelledby={`${page.slug}-proof-title`}>
    <p className={styles.eyebrow}>Vistaire</p>
    <h2 id={`${page.slug}-proof-title`}>{geoText(page, page.productProof.heading)}</h2>
    <p>{geoText(page, page.productProof.body)}</p>
    {children}
    <ul className={styles.proofPoints}>{page.productProof.points.map((point) => <li key={point}>{geoText(page, point)}</li>)}</ul>
  </section>;
}

export function GeoFeatures({ page }: { page: SeoGeoPageData }) {
  return <section className={styles.features} aria-labelledby={`${page.slug}-included-title`}>
    <h2 id={`${page.slug}-included-title`}>{page.locale === "en" ? "What a Vistaire menu includes" : "Ce que le menu Vistaire inclut"}</h2>
    <dl>{page.included.map((item, index) => <div key={item.title}>
      <dt><span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>{geoText(page, item.title)}</dt>
      <dd>{geoText(page, item.text)}</dd>
    </div>)}</dl>
  </section>;
}

export function GeoChapterNav({ page, links }: { page: SeoGeoPageData; links: Array<{ id: string; label: string }> }) {
  return <nav className={styles.chapterNav} aria-label={page.locale === "en" ? "Explore this page" : "Explorer cette page"}>
    {links.map((link, index) => <a href={`#${link.id}`} key={link.id}><span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>{link.label}<svg aria-hidden="true" viewBox="0 0 16 16"><path d="M8 2v12m-5-5 5 5 5-5" /></svg></a>)}
  </nav>;
}

export function GeoComparison({ page }: { page: SeoGeoPageData }) {
  const en = page.locale === "en";
  return <section className={styles.comparison} aria-labelledby={`${page.slug}-comparison-title`}>
    <div className={styles.comparisonHeading}><p className={styles.eyebrow}>{en ? "A closer look" : "Pour comparer"}</p><h2 id={`${page.slug}-comparison-title`}>{geoText(page, page.comparison.heading)}</h2></div>
    <table>
      <thead><tr><th scope="col">{en ? "Criterion" : "Critère"}</th><th scope="col">{geoText(page, page.comparison.basicLabel)}</th><th scope="col">{geoText(page, page.comparison.vistaireLabel)}</th></tr></thead>
      <tbody>{page.comparison.rows.map((row, index) => <tr key={row.label} id={`${page.slug}-criterion-${index}`} tabIndex={-1}>
        <th scope="row">{geoText(page, row.label)}</th>
        <td data-label={geoText(page, page.comparison.basicLabel)}>{geoText(page, row.basic)}</td>
        <td data-label={geoText(page, page.comparison.vistaireLabel)}>{geoText(page, row.vistaire)}</td>
      </tr>)}</tbody>
    </table>
  </section>;
}
