import type { CSSProperties, ReactNode } from "react";
import {
  assignPremiumTagAccents,
  type PremiumDishTagKind,
  type PremiumTagAccent
} from "./premiumTagColors";
import styles from "./PremiumDishTags.module.css";

export type { PremiumDishTagKind } from "./premiumTagColors";

type PremiumTagChipProps = {
  label: string;
  accent: PremiumTagAccent;
  className?: string;
  title?: string;
  as?: "span" | "li";
};

function PremiumTagChip({
  label,
  accent,
  className = "",
  title,
  as = "span"
}: PremiumTagChipProps) {
  const Tag = as;
  const style = {
    "--tag-accent-border": accent.border,
    "--tag-accent-text": accent.text
  } as CSSProperties;

  return (
    <Tag
      className={`${styles.chip} ${styles.chipAccent} ${className}`.trim()}
      style={style}
      {...(title ? { title } : undefined)}
    >
      {label}
    </Tag>
  );
}

type PremiumDishTagGroupProps = {
  label: string;
  items: string[];
  kind: PremiumDishTagKind;
  labelledById?: string;
  describedBy?: string;
  itemTitlePrefix?: string;
};

export function PremiumDishTagGroup({
  label,
  items,
  kind,
  labelledById,
  describedBy,
  itemTitlePrefix
}: PremiumDishTagGroupProps) {
  const visibleItems = items.map((item) => item.trim()).filter(Boolean);
  if (visibleItems.length === 0) return null;

  const labelId = labelledById ?? undefined;
  const accents = assignPremiumTagAccents(visibleItems, kind);

  return (
    <section
      className={styles.group}
      aria-labelledby={labelId}
      aria-describedby={describedBy}
    >
      <p id={labelId} className={styles.label}>
        {label}
      </p>
      <ul className={styles.list}>
        {visibleItems.map((item, index) => (
          <PremiumTagChip
            key={item}
            as="li"
            label={item}
            accent={accents[index]}
            title={
              kind === "allergen" && itemTitlePrefix
                ? `${itemTitlePrefix}: ${item}`
                : undefined
            }
          />
        ))}
      </ul>
    </section>
  );
}

type PremiumDishCardOptionTagsProps = {
  items: string[];
  label: string;
  variant?: "card" | "detail";
};

export function PremiumDishCardOptionTags({
  items,
  label,
  variant = "card"
}: PremiumDishCardOptionTagsProps) {
  const visibleItems = items.map((item) => item.trim()).filter(Boolean);
  if (visibleItems.length === 0) return null;

  const rowClass = variant === "detail" ? styles.detailRow : styles.cardRow;
  const chipClass = variant === "detail" ? styles.detailChip : styles.cardChip;
  const accents = assignPremiumTagAccents(visibleItems, "option");

  return (
    <div className={rowClass} aria-label={label}>
      {visibleItems.map((item, index) => (
        <PremiumTagChip
          key={item}
          label={item}
          accent={accents[index]}
          className={chipClass}
        />
      ))}
    </div>
  );
}

export function PremiumDishTagsFallback({ children }: { children: ReactNode }) {
  return <p className={styles.label}>{children}</p>;
}
