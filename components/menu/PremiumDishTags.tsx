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
  kind: PremiumDishTagKind;
  accent: PremiumTagAccent;
  className?: string;
  as?: "span" | "li";
};

function PremiumTagChip({
  label,
  kind,
  accent,
  className = "",
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
      {...(kind === "allergen"
        ? { title: `Allergène : ${label}` }
        : undefined)}
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
};

export function PremiumDishTagGroup({
  label,
  items,
  kind,
  labelledById,
  describedBy
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
            kind={kind}
            accent={accents[index]}
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
          kind="option"
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
