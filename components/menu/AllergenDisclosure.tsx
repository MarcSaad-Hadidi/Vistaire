import type { PublicMenuDish } from "@/lib/menu/publicMenuCore";
import {
  customAllergensFromLegacyValues,
  getAllergenDisplayGroups,
  getAllergenPublicCopy,
  getRequestedModificationsAllergenDisclaimer
} from "@/lib/menu/allergens";
import styles from "./AllergenDisclosure.module.css";

type AllergenDisclosureProps = {
  dish: Pick<
    PublicMenuDish,
    "allergens" | "customAllergens" | "allergenDeclarations" | "allergenLegacyValues"
  >;
  locale?: string;
  includeWarning?: boolean;
  localizedUiCopy?: Record<string, unknown>;
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

export function AllergenWarning({
  locale = "fr",
  localizedUiCopy
}: {
  locale?: string;
  localizedUiCopy?: Record<string, unknown>;
}) {
  const copy = getAllergenPublicCopy(locale);
  const requestedDisclaimer = getRequestedModificationsAllergenDisclaimer(
    locale,
    localizedUiCopy
  );
  return (
    <aside className={styles.warning} role="note" aria-label={copy.warningTitle}>
      <strong>{copy.warningTitle}</strong>
      <p>{copy.warning}</p>
      {requestedDisclaimer ? <p>{requestedDisclaimer}</p> : null}
    </aside>
  );
}

export function AllergenDisclosure({
  dish,
  locale = "fr",
  includeWarning = true,
  localizedUiCopy
}: AllergenDisclosureProps) {
  const copy = getAllergenPublicCopy(locale);
  const groups = getAllergenDisplayGroups(dish, locale);
  const customAllergens = customAllergensFromLegacyValues(
    dish.customAllergens ?? dish.allergenLegacyValues ?? dish.allergens
  );
  const customLabel = locale.toLowerCase().startsWith("en")
    ? "Other allergens"
    : locale.toLowerCase().startsWith("es")
      ? "Otros alérgenos"
      : locale.toLowerCase().startsWith("it")
        ? "Altri allergeni"
        : "Autres allergènes";
  const hasGroups =
    groups.contains.length > 0 ||
    groups.mayContain.length > 0 ||
    groups.confirmedFree.length > 0 ||
    customAllergens.length > 0;

  return (
    <>
      {includeWarning ? (
        <AllergenWarning locale={locale} localizedUiCopy={localizedUiCopy} />
      ) : null}
      {hasGroups ? (
        <section className={styles.disclosure} aria-labelledby="allergen-disclosure-title">
          <h2 id="allergen-disclosure-title">{copy.detailsTitle}</h2>
          <dl>
            <StatusGroup label={copy.contains} values={groups.contains} />
            <StatusGroup label={customLabel} values={customAllergens} />
            <StatusGroup label={copy.mayContain} values={groups.mayContain} />
            <StatusGroup label={copy.confirmedFree} values={groups.confirmedFree} />
          </dl>
        </section>
      ) : null}
    </>
  );
}
