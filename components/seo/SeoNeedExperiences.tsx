import {
  GeoAnswer, GeoChapterNav, GeoComparison, GeoContext, GeoFeatures,
  GeoPhoto, GeoProof, GeoTitle, geoText, type GeoExperienceProps,
} from "./SeoGeoExperiencePrimitives";
import styles from "./SeoGeoExperiences.module.css";

export function QrWithoutPdfExperience(props: GeoExperienceProps) {
  const { page } = props;
  const en = page.locale === "en";
  return <div className={styles.qrGate} data-seo-composition="qr-access-gate">
    <section className={styles.gateOpening} id="accueil" aria-labelledby={`${page.slug}-title`}>
      <GeoTitle page={page} />
      <GeoPhoto {...props} placement="hero" priority />
      <div className={styles.gatePath} aria-label={en ? "The path to the dish" : "Le chemin vers le plat"}>
        <a href="#reading">{en ? "Scan" : "Scanner"}</a><span aria-hidden="true" />
        <a href="#discovery">{en ? "Explore the menu" : "Parcourir la carte"}</a><span aria-hidden="true" />
        <a href={page.secondaryCta.href}>{en ? "Discover a dish" : "Découvrir un plat"}</a>
      </div>
    </section>
    <div className={styles.gateReading} id="reading"><GeoAnswer page={page} /><GeoContext page={page} /></div>
    <div className={styles.gateDiscovery} id="discovery"><GeoPhoto {...props} placement="proof" /><GeoProof page={page} /></div>
    <GeoComparison page={page} />
    <div className={styles.gateClosing}><GeoFeatures page={page} /><GeoPhoto {...props} placement="premium" /></div>
  </div>;
}

export function AppFreeExperience(props: GeoExperienceProps) {
  const { page } = props;
  const en = page.locale === "en";
  return <div className={styles.browserJourney} data-seo-composition="browser-first-story">
    <section className={styles.browserOpening} id="accueil" aria-labelledby={`${page.slug}-title`}>
      <GeoTitle page={page} />
      <GeoPhoto {...props} placement="hero" priority />
      <GeoChapterNav page={page} links={[
        { id: "open", label: en ? "Open" : "Ouvrir" },
        { id: "browse", label: en ? "Browse" : "Parcourir" },
        { id: "choose", label: en ? "Choose" : "Choisir" },
      ]} />
    </section>
    <div className={styles.browserRail}>
      <section id="open" className={styles.browserStop}><span className={styles.chapterNumber} aria-hidden="true">01</span><div><GeoAnswer page={page} /><GeoContext page={page} /></div></section>
      <section id="browse" className={styles.browserStop}><span className={styles.chapterNumber} aria-hidden="true">02</span><div className={styles.browserContents}><GeoPhoto {...props} placement="premium" /><GeoProof page={page} /></div></section>
      <section id="choose" className={styles.browserStop}><span className={styles.chapterNumber} aria-hidden="true">03</span><div><GeoPhoto {...props} placement="proof" /><GeoFeatures page={page} /></div></section>
    </div>
    <GeoComparison page={page} />
  </div>;
}

export function ReplacePdfExperience(props: GeoExperienceProps) {
  const { page } = props;
  const en = page.locale === "en";
  return <div className={styles.migrationFolio} data-seo-composition="pdf-migration-folio">
    <section id="accueil" className={styles.folioCover} aria-labelledby={`${page.slug}-title`}>
      <GeoTitle page={page} /><GeoPhoto {...props} placement="hero" priority />
      <ol className={styles.folioContents}>{page.productProof.points.map((point, index) => <li key={point}><a href={`#migration-${index + 1}`}><span>{String(index + 1).padStart(2, "0")}</span>{geoText(page, point)}</a></li>)}</ol>
    </section>
    <div id="migration-1" className={styles.folioIntro}><GeoAnswer page={page} /><GeoContext page={page} showPoints={false} /></div>
    <section id="migration-2" className={styles.preparation}>
      <form>
        <fieldset><legend>{en ? "Prepare your menu" : "Préparer votre carte"}</legend>
          <p>{en ? "A checklist for your team. Your choices stay on this page." : "Un aide-mémoire pour votre équipe. Vos choix restent sur cette page."}</p>
          {page.context.points?.map((point, index) => <label key={point}><input type="checkbox" name={`preparation-${index}`} /><span>{geoText(page, point)}</span></label>)}
          <button type="reset">{en ? "Start again" : "Recommencer"}</button>
        </fieldset>
      </form>
      <div className={styles.folioMargin}><span aria-hidden="true">02</span><p>{en ? "The structure comes first." : "La structure, d’abord."}</p></div>
    </section>
    <div id="migration-3" className={styles.folioEnrichment}><GeoPhoto {...props} placement="proof" /><GeoProof page={page} /></div>
    <div id="migration-4" className={styles.folioLaunch}><GeoFeatures page={page} /><GeoPhoto {...props} placement="premium" /></div>
    <GeoComparison page={page} />
  </div>;
}

export function PdfAlternativeExperience(props: GeoExperienceProps) {
  const { page } = props;
  return <div className={styles.choiceSpread} data-seo-composition="pdf-alternative-choice-spread">
    <section id="accueil" className={styles.choiceOpening} aria-labelledby={`${page.slug}-title`}>
      <GeoTitle page={page} /><GeoPhoto {...props} placement="hero" priority /><GeoAnswer page={page} />
    </section>
    <div className={styles.choiceDesk}>
      <GeoContext page={page} />
      <GeoChapterNav page={page} links={page.comparison.rows.map((row, index) => ({ id: `${page.slug}-criterion-${index}`, label: geoText(page, row.label) }))} />
      <GeoComparison page={page} />
    </div>
    <div className={styles.choicePlate}><GeoProof page={page} /><GeoPhoto {...props} placement="proof" /></div>
    <div className={styles.choiceService}><GeoPhoto {...props} placement="premium" /><GeoFeatures page={page} /></div>
  </div>;
}

export function DishPageExperience(props: GeoExperienceProps) {
  const { page } = props;
  const en = page.locale === "en";
  const anatomy = [page.included[3], page.included[2], page.included[4], page.included[5]];
  return <div className={styles.dishPortrait} data-seo-composition="annotated-dish-portrait">
    <section id="accueil" className={styles.portraitOpening} aria-labelledby={`${page.slug}-title`}><GeoPhoto {...props} placement="hero" priority /><GeoTitle page={page} /></section>
    <GeoAnswer page={page} />
    <div className={styles.anatomySpread}>
      <div className={styles.anatomyImage}><GeoPhoto {...props} placement="premium" /><p className={styles.imageNote}>{en ? "The dish stays at the center." : "Le plat reste au centre."}</p></div>
      <section className={styles.anatomyNotes} aria-label={en ? "Explore a dish page" : "Explorer une fiche plat"}>
        <GeoProof page={page} />
        {anatomy.map((item, index) => <details key={item.title}><summary><span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>{geoText(page, item.title)}</summary><p>{geoText(page, item.text)}</p></details>)}
      </section>
    </div>
    <div className={styles.portraitVariation}><GeoContext page={page} /><GeoPhoto {...props} placement="proof" /></div>
    <GeoFeatures page={page} /><GeoComparison page={page} />
  </div>;
}

export function MenuPhotosExperience(props: GeoExperienceProps) {
  const { page } = props;
  const en = page.locale === "en";
  return <div className={styles.foodEssay} data-seo-composition="food-photography-essay">
    <section id="accueil" className={styles.essayOpening} aria-labelledby={`${page.slug}-title`}>
      <GeoTitle page={page} /><GeoPhoto {...props} placement="hero" priority />
      <p className={styles.photoIndex}>{en ? "The dish. The detail. The menu." : "Le plat. Le détail. La carte."}</p>
    </section>
    <div className={styles.essayStatement}><GeoAnswer page={page} /><GeoContext page={page} /></div>
    <div className={styles.essayMenu}><GeoPhoto {...props} placement="proof" /><GeoProof page={page} /></div>
    <div className={styles.essayDetail}>
      <div><p className={styles.eyebrow}>{en ? "Look closely" : "Regarder de près"}</p>
        <ol className={styles.photoCriteria}>{page.context.points?.map((point) => <li key={point}>{geoText(page, point)}</li>)}</ol>
        <a className={styles.secondaryAction} href={`#${page.slug}-comparison-title`}>{en ? "A gallery or a visual menu?" : "Une galerie ou une carte visuelle ?"}</a>
      </div>
      <GeoPhoto {...props} placement="premium" />
    </div>
    <GeoFeatures page={page} /><GeoComparison page={page} />
  </div>;
}

export function AllergensExperience(props: GeoExperienceProps) {
  const { page } = props;
  const en = page.locale === "en";
  return <div className={styles.allergenInspection} data-seo-composition="allergen-information-inspection">
    <section id="accueil" className={styles.allergenOpening} aria-labelledby={`${page.slug}-title`}>
      <GeoTitle page={page} /><GeoPhoto {...props} placement="hero" priority />
      <aside className={styles.serviceCaution}>{en ? "For a sensitive dietary need, always confirm the information with the restaurant team." : "Pour un besoin alimentaire sensible, confirmez toujours l’information avec l’équipe du restaurant."}</aside>
    </section>
    <GeoAnswer page={page} />
    <div className={styles.allergenProof}><GeoProof page={page} /><GeoPhoto {...props} placement="proof" /></div>
    <div className={styles.allergenResponsibilities}>
      <GeoContext page={page} />
      <details data-allergen-service-note><summary>{en ? "What to confirm with the team" : "Ce qu’il faut confirmer avec l’équipe"}</summary><p>{geoText(page, page.context.body[0])}</p><p>{geoText(page, page.comparison.rows[2].vistaire)}</p></details>
    </div>
    <GeoComparison page={page} />
    <div className={styles.allergenClosing}><GeoPhoto {...props} placement="premium" caption={en ? "A dish example. Its photograph does not establish its allergen information." : "Un exemple de plat. Sa photographie ne permet pas d’établir ses allergènes."} /><GeoFeatures page={page} /></div>
  </div>;
}
