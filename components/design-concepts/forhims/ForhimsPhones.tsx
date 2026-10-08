"use client";

import Image from "next/image";
import Link from "next/link";
import s from "./ForhimsPhones.module.css";

export const DISH = {
  homard: "/images/demo/dishes/homard-bleu-bisque-fenouil.png",
  ravioles: "/images/demo/dishes/ravioles-chevre-miel-monteregie.png",
  souffle: "/images/demo/dishes/souffle-chocolat-grand-cru.png",
  risotto: "/images/demo/dishes/risotto-cepes-parmesan.png",
  tartare: "/images/demo/dishes/tartare-saumon-label-rouge.png",
  pave: "/images/demo/dishes/pave-boeuf-mature-bordelaise.png"
} as const;

function DishImg({ src, alt, fill }: { src: string; alt: string; fill?: boolean }) {
  return (
    <Image
      src={src}
      alt={alt}
      fill={fill ?? true}
      sizes="320px"
      style={{ objectFit: "cover", position: "absolute", inset: 0, width: "100%", height: "100%" }}
    />
  );
}

function Tabbar({ active }: { active: string }) {
  const items: Array<[string, string]> = [
    ["⌂", "Carte"],
    ["◉", "Expériences"],
    ["▤", "Outils"]
  ];
  return (
    <div className={s.tabbar}>
      {items.map(([icon, label]) => (
        <div key={label} className={`${s.tabbarItem} ${active === label ? s.tabbarItemActive : ""}`}>
          <span style={{ fontSize: 15 }}>{icon}</span>
          {label}
        </div>
      ))}
    </div>
  );
}

/** Hero + pinned state 0: "Expériences" with tabs and a signature dish card. */
export function ScreenExperiences() {
  return (
    <div className={s.screenBody}>
      <div className={s.appTitle}>Expériences</div>
      <div className={s.tabsRow}>
        <span className={`${s.tab} ${s.tabActive}`}>Signatures</span>
        <span className={s.tab}>Carte</span>
        <span className={s.tab}>Desserts</span>
      </div>
      <div className={s.dishCard} style={{ height: 300 }}>
        <DishImg src={DISH.homard} alt="Homard bleu, bisque au fenouil" />
        <div className={s.cardTag}>
          Plat
          <br />
          signature
          <b>Vistaire</b>
        </div>
        <div className={s.cardMeta}>La carte · 12 plats</div>
        <div className={s.cardCaption}>
          L’art de
          <br />
          recevoir
        </div>
      </div>
      <Tabbar active="Expériences" />
    </div>
  );
}

/** Pinned state: "Signatures" tab active, homard card. */
export function ScreenSignatures() {
  return (
    <div className={s.screenBody}>
      <div className={s.tabsRow} style={{ paddingTop: 4 }}>
        <span className={s.tab}>Dégustation</span>
        <span className={`${s.tab} ${s.tabActive}`}>Signatures</span>
        <span className={s.tab}>Carte des vins</span>
      </div>
      <div className={s.dishCard} style={{ height: 340 }}>
        <DishImg src={DISH.homard} alt="Homard bleu, bisque au fenouil" />
        <div className={s.cardTag}>
          Plat
          <br />
          signature
          <b>Vistaire</b>
        </div>
        <div className={s.cardCaption}>
          Le homard,
          <br />
          sublimé
        </div>
      </div>
      <div className={s.dishCard} style={{ height: 120, marginTop: 10 }}>
        <DishImg src={DISH.souffle} alt="Soufflé au chocolat grand cru" />
        <div className={s.cardCaption} style={{ fontSize: 15 }}>
          Soufflé chocolat
        </div>
      </div>
      <Tabbar active="Expériences" />
    </div>
  );
}

/** Pinned story state 1: "Chapitre 1" on pistachio. */
export function ScreenChapter() {
  return (
    <div className={s.story} style={{ background: "#d9e8b8" }}>
      <div className={s.storyBars}>
        <i className="done" />
        <i />
        <i />
        <i />
      </div>
      <div className={s.storyKicker}>
        Expériences
        <br />
        Bienvenue à la carte
      </div>
      <div className={s.storyClose}>✕</div>
      <div className={s.storyRule} />
      <div className={s.storyChapter}>Chapitre</div>
      <div className={s.storyNumber}>1</div>
      <div style={{ position: "relative", marginTop: 12, borderRadius: 18, overflow: "hidden", height: 150 }}>
        <DishImg src={DISH.ravioles} alt="Ravioles de chèvre au miel" />
      </div>
    </div>
  );
}

/** Pinned story state 2: lesson on mint. */
export function ScreenLesson() {
  return (
    <div className={s.story} style={{ background: "#bfe3d8" }}>
      <div className={s.storyBars}>
        <i className="done" />
        <i className="done" />
        <i />
        <i />
      </div>
      <div className={s.storyKicker}>
        Expériences
        <br />
        Bienvenue à la carte
      </div>
      <div className={s.storyClose}>✕</div>
      <div className={s.storyLesson}>
        <small>1.</small>
        La mise en place
      </div>
      <div className={s.storyRule} />
      <div style={{ position: "relative", marginTop: 12, borderRadius: 18, overflow: "hidden", height: 120 }}>
        <DishImg src={DISH.risotto} alt="Risotto aux cèpes" />
      </div>
    </div>
  );
}

/** Community Q&A screen (illustrative example, marked as such). */
export function ScreenQuestions() {
  return (
    <div className={s.qa}>
      <div className={s.qaMeta}>Exemple illustratif</div>
      <div className={s.qaQ}>Q : Puis-je voir les allergènes d’un plat avant de le choisir ?</div>
      <div className={s.qaA}>
        R : Oui. Chaque fiche plat Vistaire affiche les allergènes de façon claire, avec la photo, les
        ingrédients et les accords proposés par la maison.
      </div>
      <div className={s.qaIllustrative}>Reconstitution illustrative — pas un avis réel.</div>
      <div className={s.qaCta}>Une question à nous poser ?</div>
    </div>
  );
}

/** Programs "Service" schedule screen. */
export function ScreenService() {
  const lessons = [
    { title: "Bienvenue à votre carte guidée", meta: "Aperçu · 2 min", next: false },
    { title: "Raconter le plat", meta: "Chapitre 1 · 5 min", next: true },
    { title: "Le dressage en salle", meta: "Chapitre 2 · 3 min", next: false }
  ];
  return (
    <div className={s.screenBody}>
      <div className={s.tabsRow} style={{ paddingTop: 4 }}>
        <span className={`${s.tab} ${s.tabActive}`}>Service</span>
        <span className={s.tab}>Plats</span>
        <span className={s.tab}>Convives</span>
      </div>
      <div className={s.appTitle}>Service</div>
      <div className={s.weekRow}>
        Semaine 1 : L’art du service <span>⌃</span>
      </div>
      {lessons.map((l) => (
        <div key={l.title} className={s.lesson}>
          <div className={s.lessonThumb}>
            <div className={s.lessonPlay}>
              <span>▶</span>
            </div>
          </div>
          <div>
            <div className={s.lessonTitle}>{l.title}</div>
            <div className={s.lessonMeta}>
              {l.meta} {l.next && <span className={s.lessonNext}> · À suivre</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Shop "Popular" grid of signature dishes (no invented prices). */
export function ScreenPopular() {
  const dishes = [
    { src: DISH.homard, name: "Homard bleu", tag: "Plat signature" },
    { src: DISH.souffle, name: "Soufflé chocolat", tag: "Dessert signature" },
    { src: DISH.ravioles, name: "Ravioles de chèvre", tag: "Entrée" },
    { src: DISH.tartare, name: "Tartare de saumon", tag: "Entrée" }
  ];
  return (
    <div className={s.screenBody}>
      <div className={s.appTitle} style={{ textAlign: "center" }}>
        Signatures
      </div>
      <div className={s.popularGrid}>
        {dishes.map((d) => (
          <div key={d.name} className={s.popDish}>
            <div className={s.popDishImg}>
              <DishImg src={d.src} alt={d.name} />
            </div>
            <div className={s.popDishName}>{d.name}</div>
            <div className={s.popDishTag}>{d.tag}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Dish sheet (product page adapted). */
export function ScreenDishSheet() {
  return (
    <div className={s.screenBody}>
      <div className={s.sheetImg}>
        <DishImg src={DISH.souffle} alt="Soufflé au chocolat grand cru" />
      </div>
      <div className={s.sheetName}>Soufflé au chocolat grand cru</div>
      <div className={s.sheetDesc}>
        Un soufflé aérien au chocolat grand cru, servi brûlant. La fiche plat affiche allergènes,
        accords et l’histoire du dessert.
      </div>
      <div className={s.sheetRow}>
        Fiche plat <span>⌄</span>
      </div>
      <div className={s.sheetCtas}>
        <Link href="/demo" className={s.sheetCta}>
          Voir la démo
        </Link>
        <Link href="/prendre-rendez-vous" className={s.sheetCta}>
          Rendez-vous
        </Link>
      </div>
    </div>
  );
}

/** Order confirmation adapted: "carte publiée" checklist (no fake order). */
export function ScreenPublished() {
  const rows: Array<[string, string]> = [
    ["Fiches plats vérifiées", "12 plats"],
    ["Photos premium", "En ligne"],
    ["3D sur les signatures", "Activée"]
  ];
  return (
    <div className={s.confirm}>
      <div className={s.confirmTitle}>
        Votre carte
        <br />
        est prête.
      </div>
      <div className={s.confirmImgs}>
        <div>
          <DishImg src={DISH.homard} alt="Homard bleu" />
        </div>
        <div>
          <DishImg src={DISH.souffle} alt="Soufflé au chocolat" />
        </div>
      </div>
      <div>
        {rows.map(([k, v]) => (
          <div key={k} className={s.confirmRow}>
            <span>
              <span className={s.confirmCheck}>✓</span>
              {k}
            </span>
            <b>{v}</b>
          </div>
        ))}
      </div>
    </div>
  );
}
