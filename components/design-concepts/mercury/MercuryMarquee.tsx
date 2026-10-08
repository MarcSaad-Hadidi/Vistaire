import styles from "./MercuryMarquee.module.css";

const WORDS = [
  "Gastronomique",
  "Bistronomique",
  "Brasserie",
  "Italienne",
  "Japonaise",
  "Café de spécialité",
  "Bar à vin",
  "Traiteur"
];

/** Slow infinite marquee — seamless loop via 3x duplicated sets, translateX(-33.333%). */
export function MercuryMarquee() {
  return (
    <div className={styles.marquee} data-mtheme="dark" aria-label="Types de restaurants">
      <div className={styles.track}>
        {[0, 1, 2].map((copy) => (
          <div key={copy} className={styles.set} aria-hidden={copy > 0}>
            {WORDS.map((w) => (
              <span key={w} className={styles.word}>
                {w}
                <span aria-hidden="true" className={styles.sep}>
                  {"  •  "}
                </span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
