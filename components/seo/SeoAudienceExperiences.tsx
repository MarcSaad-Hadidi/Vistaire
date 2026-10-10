import Link from "next/link";
import {
  GeoAnswer, GeoChapterNav, GeoComparison, GeoContext, GeoFeatures,
  GeoPhoto, GeoProof, GeoTitle, geoText, type GeoExperienceProps,
} from "./SeoGeoExperiencePrimitives";
import styles from "./SeoGeoExperiences.module.css";

export function MontrealExperience(props: GeoExperienceProps) {
  const { page } = props;
  const en = page.locale === "en";
  return <div className={styles.montrealDossier} data-seo-composition="montreal-editorial-dossier">
    <section id="accueil" className={styles.dossierOpening} aria-labelledby={`${page.slug}-title`}>
      <GeoTitle page={page} /><GeoPhoto {...props} placement="hero" priority />
      <div className={styles.dossierMarginalia}><p>{en ? "Dining rooms. Identities. A menu to match." : "Des salles. Des identités. Une carte à leur hauteur."}</p><a href="#montreal-menu">{en ? "Explore the experience" : "Explorer l’expérience"}<span aria-hidden="true">↓</span></a></div>
    </section>
    <div className={styles.dossierContext}><GeoAnswer page={page} /><GeoContext page={page} /></div>
    <section id="montreal-menu" className={styles.bilingualSpread}>
      <div><p className={styles.eyebrow}>{en ? "Two languages, one attention to detail" : "Deux langues, une même attention"}</p><GeoProof page={page} />
        <nav className={styles.languageEdition} aria-label={en ? "Read this guide in your language" : "Lire ce guide dans votre langue"}>
          <Link href="/menu-digital-restaurant-montreal" lang="fr" hrefLang="fr-CA" aria-current={!en ? "page" : undefined}>Français</Link>
          <Link href="/en/digital-restaurant-menu-montreal" lang="en" hrefLang="en-CA" aria-current={en ? "page" : undefined}>English</Link>
        </nav>
      </div><GeoPhoto {...props} placement="proof" />
    </section>
    <div className={styles.dossierSignature}><GeoPhoto {...props} placement="premium" /><GeoFeatures page={page} /></div>
    <GeoComparison page={page} />
  </div>;
}

export function LavalExperience(props: GeoExperienceProps) {
  const { page } = props;
  const en = page.locale === "en";
  return <div className={styles.sharedTable} data-seo-composition="laval-shared-table-story">
    <section id="accueil" className={styles.tableOpening} aria-labelledby={`${page.slug}-title`}>
      <GeoTitle page={page} />
      <div className={styles.tableDiptych}><GeoPhoto {...props} placement="hero" priority /><GeoPhoto {...props} placement="proof" /></div>
      <GeoChapterNav page={page} links={[
        { id: "together", label: en ? "At the table" : "À table" },
        { id: "categories", label: en ? "Find your way" : "Se repérer" },
        { id: "signature", label: en ? "Discover a signature" : "Découvrir une signature" },
      ]} />
    </section>
    <div id="together" className={styles.tableIntroduction}><GeoAnswer page={page} /><GeoContext page={page} /></div>
    <div id="categories" className={styles.tableService}><GeoProof page={page} /><GeoFeatures page={page} /></div>
    <section id="signature" className={styles.tableSignature}><GeoPhoto {...props} placement="premium" />
      <div><p className={styles.eyebrow}>{en ? "Around the same table" : "Autour d’une même table"}</p>
        <ul className={styles.serviceNotes}>{page.context.points?.map((point) => <li key={point}>{geoText(page, point)}</li>)}</ul>
        <Link className={styles.secondaryAction} href={page.secondaryCta.href}>{geoText(page, page.secondaryCta.label)}</Link>
      </div>
    </section>
    <GeoComparison page={page} />
  </div>;
}

export function BrossardExperience(props: GeoExperienceProps) {
  const { page } = props;
  const en = page.locale === "en";
  return <div className={styles.destinationSequence} data-seo-composition="brossard-destination-arrival">
    <section id="accueil" className={styles.destinationOpening} aria-labelledby={`${page.slug}-title`}>
      <GeoPhoto {...props} placement="hero" priority /><GeoTitle page={page} />
    </section>
    <GeoChapterNav page={page} links={[
      { id: "arrival", label: en ? "Arrive" : "Arriver" },
      { id: "scan", label: en ? "Open the menu" : "Ouvrir la carte" },
      { id: "discover", label: en ? "Discover" : "Découvrir" },
    ]} />
    <div id="arrival" className={styles.arrivalCopy}><GeoAnswer page={page} /><GeoContext page={page} /></div>
    <section id="scan" className={styles.destinationBridge}>
      <div className={styles.bridgeLabel}><span aria-hidden="true">02</span><p>{en ? "From the table to the menu." : "De la table à la carte."}</p></div>
      <GeoPhoto {...props} placement="proof" /><GeoProof page={page} />
    </section>
    <div id="discover" className={styles.destinationDish}><GeoPhoto {...props} placement="premium" /><GeoFeatures page={page} /></div>
    <GeoComparison page={page} />
  </div>;
}

export function HighEndExperience(props: GeoExperienceProps) {
  const { page } = props;
  const en = page.locale === "en";
  return <div className={styles.brandManifesto} data-seo-composition="high-end-brand-manifesto">
    <section id="accueil" className={styles.manifestoOpening} aria-labelledby={`${page.slug}-title`}>
      <GeoTitle page={page} /><GeoPhoto {...props} placement="hero" priority />
    </section>
    <div className={styles.manifestoThesis}><GeoAnswer page={page} /></div>
    <section className={styles.manifestoPrinciples} aria-labelledby={`${page.slug}-context-title`}>
      <GeoContext page={page} showPoints={false} />
      <div className={styles.principleLedger}>{page.context.points?.map((point, index) => <div key={point}><span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><p>{geoText(page, point)}</p></div>)}</div>
    </section>
    <div className={styles.manifestoDish}><GeoPhoto {...props} placement="proof" /><GeoProof page={page} /></div>
    <div className={styles.manifestoDetail}><div><p className={styles.eyebrow}>{en ? "The attention is in the details" : "L’attention se joue dans les détails"}</p><GeoFeatures page={page} /></div><GeoPhoto {...props} placement="premium" /></div>
    <GeoComparison page={page} />
  </div>;
}

export function GastronomyExperience(props: GeoExperienceProps) {
  const { page } = props;
  const en = page.locale === "en";
  return <div className={styles.tastingNarrative} data-seo-composition="gastronomy-paced-narrative">
    <section id="accueil" className={styles.tastingOpening} aria-labelledby={`${page.slug}-title`}>
      <GeoTitle page={page} /><GeoPhoto {...props} placement="hero" priority />
    </section>
    <div className={styles.tastingPreface}><GeoAnswer page={page} /></div>
    <section className={styles.tastingChapter}><div className={styles.chapterMark} aria-hidden="true">I</div><GeoContext page={page} /></section>
    <section className={styles.tastingInterlude}><GeoPhoto {...props} placement="proof" /><div><p className={styles.eyebrow}>{en ? "The signature" : "La signature"}</p><GeoProof page={page} /></div></section>
    <section className={styles.tastingChapter}><div className={styles.chapterMark} aria-hidden="true">II</div><div className={styles.tastingNotes}><GeoFeatures page={page} /></div></section>
    <section className={styles.tastingRoom}><GeoPhoto {...props} placement="premium" /><p>{en ? "A digital experience at the pace of service." : "Une expérience digitale au rythme du service."}</p></section>
    <GeoComparison page={page} />
  </div>;
}
