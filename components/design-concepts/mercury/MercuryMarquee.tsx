import styles from "./MercuryMarquee.module.css";

const CUISINES = [
  "Gastronomique",
  "Bistronomique",
  "Brasserie",
  "Italienne",
  "Japonaise",
  "Fruits de mer",
  "Végétale",
  "Bistro de quartier"
] as const;

/**
 * Logo marquee: items drift slowly left, infinite loop, duplicated content,
 * very slow (80s per loop), no pause on hover.
 */
export function MercuryMarquee() {
  const row = [...CUISINES, ...CUISINES];

  return (
    <section
      data-mercury-theme="dark"
      className={styles.marquee}
      aria-label="Types de cuisine"
    >
      <div className={styles.track}>
        {row.map((cuisine, i) => (
          <span key={`${cuisine}-${i}`} className={styles.item} aria-hidden={i >= CUISINES.length}>
            {cuisine}
            <span className={styles.dot} aria-hidden="true">
              ·
            </span>
          </span>
        ))}
      </div>
    </section>
  );
}
