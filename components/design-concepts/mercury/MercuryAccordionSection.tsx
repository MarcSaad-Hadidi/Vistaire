"use client";

import Image from "next/image";
import { useState } from "react";
import shared from "./shared.module.css";
import styles from "./MercuryAccordionSection.module.css";
import { MercuryReveal } from "./MercuryReveal";

export type AccordionItem = {
  title: string;
  text: string;
  image: string;
  alt: string;
};

/**
 * Accordion (left) + sticky visual (right). Click expands an item
 * (400ms ease-out); the visual crossfades (fade + slight scale, 400ms).
 */
export function MercuryAccordionSection({
  id,
  theme,
  title,
  items
}: {
  id: string;
  theme: "dark" | "light";
  title: string;
  items: AccordionItem[];
}) {
  const [active, setActive] = useState(0);

  return (
    <section
      id={id}
      data-mtheme={theme}
      className={`${shared.section} ${theme === "light" ? shared.sectionLight : ""} ${theme === "light" ? styles.light : ""}`}
      aria-label={title}
    >
      <div className={shared.wrap}>
        <MercuryReveal as="h2" className={shared.title}>
          {title}
        </MercuryReveal>

        <div className={styles.grid}>
          <div className={styles.accord} role="tablist" aria-label={title}>
            {items.map((item, i) => {
              const open = i === active;
              return (
                <div
                  key={item.title}
                  className={`${styles.item} ${open ? styles.itemOpen : ""}`}
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={open}
                    aria-expanded={open}
                    className={styles.head}
                    onClick={() => setActive(i)}
                  >
                    <span aria-hidden="true" className={styles.dot} />
                    <span className={styles.headTitle}>{item.title}</span>
                  </button>
                  <div
                    className={styles.body}
                    role="tabpanel"
                    aria-hidden={!open}
                  >
                    <p className={styles.text}>{item.text}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className={styles.visualCol}>
            <div className={styles.visualSticky}>
              {items.map((item, i) => (
                <div
                  key={item.title}
                  className={`${styles.visual} ${i === active ? styles.visualActive : ""}`}
                  aria-hidden={i !== active}
                >
                  <Image
                    src={item.image}
                    alt={i === active ? item.alt : ""}
                    fill
                    sizes="(max-width: 900px) 100vw, 45vw"
                    style={{ objectFit: "cover" }}
                    priority={i === 0}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
