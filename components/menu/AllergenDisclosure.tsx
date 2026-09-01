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

type TextDirection = "ltr" | "rtl";

function localeLanguage(locale: string): string {
  try {
    return new Intl.Locale(locale).language.toLowerCase();
  } catch {
    return locale.toLowerCase().split(/[-_]/)[0] ?? "fr";
  }
}

function textDirection(locale: string): TextDirection {
  return localeLanguage(locale) === "ar" ? "rtl" : "ltr";
}

function customAllergenLabel(locale: string): string {
  switch (localeLanguage(locale)) {
    case "en":
      return "Other allergens";
    case "es":
      return "Otros alérgenos";
    case "it":
      return "Altri allergeni";
    case "de":
      return "Weitere Allergene";
    case "el":
      return "Άλλα αλλεργιογόνα";
    case "ar":
      return "مسببات حساسية أخرى";
    default:
      return "Autres allergènes";
  }
}

function StatusGroup({
  direction,
  label,
  values
}: {
  direction: TextDirection;
  label: string;
  values: string[];
}) {
  if (values.length === 0) return null;
  return (
    <div className={styles.group} dir="ltr">
      <dt dir={direction}>{label}</dt>
      <dd dir={direction}>{values.join(", ")}</dd>
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
  const direction = textDirection(locale);
  const requestedDisclaimer = getRequestedModificationsAllergenDisclaimer(
    locale,
    localizedUiCopy
  );
  return (
    <aside className={styles.warning} role="note" aria-label={copy.warningTitle} dir="ltr">
      <strong dir={direction}>{copy.warningTitle}</strong>
      <p dir={direction}>{copy.warning}</p>
      {requestedDisclaimer ? <p dir={direction}>{requestedDisclaimer}</p> : null}
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
  const direction = textDirection(locale);
  const groups = getAllergenDisplayGroups(dish, locale);
  const customAllergens = customAllergensFromLegacyValues(
    dish.customAllergens ?? dish.allergenLegacyValues ?? dish.allergens
  );
  const customLabel = customAllergenLabel(locale);
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
        <section
          className={styles.disclosure}
          aria-labelledby="allergen-disclosure-title"
          dir="ltr"
        >
          <h2 id="allergen-disclosure-title" dir={direction}>{copy.detailsTitle}</h2>
          <dl>
            <StatusGroup direction={direction} label={copy.contains} values={groups.contains} />
            <StatusGroup direction={direction} label={customLabel} values={customAllergens} />
            <StatusGroup direction={direction} label={copy.mayContain} values={groups.mayContain} />
            <StatusGroup direction={direction} label={copy.confirmedFree} values={groups.confirmedFree} />
          </dl>
        </section>
      ) : null}
    </>
  );
}