import type { PublicMenuDish } from "@/lib/menu/publicMenuCore";
import {
  getAllergenDisplayGroups,
  getAllergenPublicCopy
} from "@/lib/menu/allergens";
import styles from "./AllergenDisclosure.module.css";

type AllergenDisclosureProps = {
  dish: Pick<PublicMenuDish, "allergens" | "allergenDeclarations">;
  locale?: string;
  includeWarning?: boolean;
};

function StatusGroup({
  label,
  values
}: {
  label: string;
  values: string[];
}) {
  if (values.length === 0) return null;
  return (
    <div className={styles.group}>
      <dt>{label}</dt>
      <dd>{values.join(", ")}</dd>
    </div>
  );
}

export function AllergenWarning({ locale = "fr" }: { locale?: string }) {
  const copy = getAllergenPublicCopy(locale);
  return (
    <aside className={styles.warning} role="note" aria-label={copy.warningTitle}>
      <strong>{copy.warningTitle}</strong>
      <p>{copy.warning}</p>
    </aside>
  );
}

export function AllergenDisclosure({
  dish,
  locale = "fr",
  includeWarning = true
}: AllergenDisclosureProps) {
  const copy = getAllergenPublicCopy(locale);
  const groups = getAllergenDisplayGroups(dish, locale);
  const hasGroups =
    groups.contains.length > 0 ||
    groups.mayContain.length > 0 ||
    groups.confirmedFree.length > 0 ||
    groups.unknownCount > 0;

  return (
    <>
      {includeWarning ? <AllergenWarning locale={locale} /> : null}
      <section className={styles.disclosure} aria-labelledby="allergen-disclosure-title">
        <h2 id="allergen-disclosure-title">{copy.detailsTitle}</h2>
        {hasGroups ? (
          <dl>
            <StatusGroup label={copy.contains} values={groups.contains} />
            <StatusGroup label={copy.mayContain} values={groups.mayContain} />
            <StatusGroup label={copy.confirmedFree} values={groups.confirmedFree} />
            {groups.unknownCount > 0 ? (
              <div className={styles.group}>
                <dt>{copy.unknown}</dt>
                <dd>{copy.unknownBody(groups.unknownCount)}</dd>
              </div>
            ) : null}
          </dl>
        ) : (
          <p className={styles.unknown}>{copy.unknownBody(1)}</p>
        )}
      </section>
    </>
  );
}
