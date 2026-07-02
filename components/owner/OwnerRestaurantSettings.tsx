"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/components/owner/OwnerCockpit.module.css";
import { OwnerMenuTranslationPanel } from "@/components/owner/OwnerMenuTranslationPanel";
import { Badge } from "@/components/owner/OwnerUi";
import {
  DEFAULT_PUBLIC_MENU_SETTINGS,
  PUBLIC_MENU_CURRENCIES,
  PUBLIC_MENU_LOCALE_OPTIONS,
  normalizePublicMenuCurrency,
  normalizePublicMenuLocale,
  serializePublicMenuSettings,
  type PublicMenuCurrency,
  type PublicMenuLocale,
  type PublicMenuSettings,
  type PublicMenuStyle,
  type PublicMenuThemeMode
} from "@/lib/menu/publicMenuSettings";
import type { OwnerRestaurant } from "@/lib/owner/types";

type RestaurantStatusAction = "archive" | "restore";

type RestaurantStatusFeedback = {
  tone: "success" | "error";
  message: string;
};

type DeleteRestaurantResponse = {
  ok?: boolean;
  error?: string;
  restaurantDeleted?: boolean;
  details?: {
    table?: string;
    supabaseMessage?: string;
  };
  storage?: {
    warnings?: string[];
  };
};

const localeOptions = PUBLIC_MENU_LOCALE_OPTIONS.map((option) => ({
  value: option.value,
  label: option.label
}));

const currencyOptions = PUBLIC_MENU_CURRENCIES.map((currency) => ({
  value: currency,
  label: currency
}));

const publicMenuStyleOptions: Array<{
  value: PublicMenuStyle;
  label: string;
  detail: string;
}> = [
  {
    value: "trouvable",
    label: "Style Trouvable",
    detail: "Experience immersive avec controles client et fiches plats premium."
  },
  {
    value: "maison-elyse",
    label: "Style Maison Elyse",
    detail: "Carte QR editoriale avec accueil fort et navigation visuelle."
  }
];

function compareByOptionOrder<T extends string>(
  a: T,
  b: T,
  options: readonly { value: T }[]
): number {
  const aIndex = options.findIndex((option) => option.value === a);
  const bIndex = options.findIndex((option) => option.value === b);
  if (aIndex >= 0 && bIndex >= 0) return aIndex - bIndex;
  if (aIndex >= 0) return -1;
  if (bIndex >= 0) return 1;
  return a.localeCompare(b);
}

function formatLocaleLabel(locale: PublicMenuLocale): string {
  const option = localeOptions.find((item) => item.value === locale);
  if (option) return option.label;
  try {
    return new Intl.DisplayNames(["fr-CA"], { type: "language" }).of(locale) ?? locale;
  } catch {
    return locale;
  }
}

function formatCurrencyOption(currency: PublicMenuCurrency): string {
  try {
    const name = new Intl.DisplayNames(["fr-CA"], { type: "currency" }).of(currency);
    return name ? `${currency} - ${name}` : currency;
  } catch {
    return currency;
  }
}

function normalizeLocaleInput(value: string): PublicMenuLocale | null {
  const normalized = normalizePublicMenuLocale(value, "");
  return normalized ? normalized : null;
}

function normalizeCurrencyInput(value: string): PublicMenuCurrency | null {
  const normalized = normalizePublicMenuCurrency(value, "");
  return normalized ? normalized : null;
}

export function OwnerRestaurantSettings({
  restaurant,
  menuSettings = DEFAULT_PUBLIC_MENU_SETTINGS
}: {
  restaurant: OwnerRestaurant;
  menuSettings?: PublicMenuSettings;
}) {
  const router = useRouter();
  const [settingsDraft, setSettingsDraft] = useState<PublicMenuSettings>(() =>
    serializePublicMenuSettings(menuSettings)
  );
  const [settingsPending, setSettingsPending] = useState(false);
  const [settingsFeedback, setSettingsFeedback] =
    useState<RestaurantStatusFeedback | null>(null);
  const [statusPending, setStatusPending] = useState<RestaurantStatusAction | null>(null);
  const [statusFeedback, setStatusFeedback] = useState<RestaurantStatusFeedback | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteStorage, setDeleteStorage] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [customLocale, setCustomLocale] = useState("");
  const [customCurrency, setCustomCurrency] = useState("");
  const availableLocaleOptions = localeOptions.filter(
    (option) => !settingsDraft.supportedLocales.includes(option.value)
  );
  const availableCurrencyOptions = currencyOptions.filter(
    (option) => !settingsDraft.supportedCurrencies.includes(option.value)
  );
  const hasMultipleCurrencies = settingsDraft.supportedCurrencies.length > 1;

  async function updateRestaurantStatus(action: RestaurantStatusAction) {
    setStatusPending(action);
    setStatusFeedback(null);

    try {
      const response = await fetch(`/api/owner/restaurants/${encodeURIComponent(restaurant.id)}/archive`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });
      const result = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;

      if (!response.ok || !result?.ok) {
        throw new Error(result?.error ?? "Le statut du restaurant n’a pas pu être mis à jour.");
      }

      setStatusFeedback({
        tone: "success",
        message:
          action === "archive"
            ? "Restaurant archivé. Ses plats, QR et médias restent conservés."
            : "Restaurant restauré. Il revient dans le portefeuille actif."
      });
      router.refresh();
    } catch (error) {
      setStatusFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Action restaurant indisponible."
      });
    } finally {
      setStatusPending(null);
    }
  }

  async function deleteRestaurant() {
    const confirmation = deleteConfirmation.trim();
    const confirmationTarget = restaurant.slug || restaurant.name.trim();
    if (confirmation !== confirmationTarget) {
      setStatusFeedback({
        tone: "error",
        message: "Tapez le slug exact du restaurant pour confirmer la suppression."
      });
      return;
    }

    setDeletePending(true);
    setStatusFeedback(null);

    try {
      const response = await fetch(`/api/owner/restaurants/${encodeURIComponent(restaurant.id)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation, deleteStorage })
      });
      const result = (await response.json().catch(() => null)) as
        | DeleteRestaurantResponse
        | null;

      if (!response.ok || !result?.ok || result.restaurantDeleted !== true) {
        const table = result?.details?.table;
        const storageWarning = result?.storage?.warnings?.[0];
        const detail = table
          ? ` Table bloquante: ${table}.`
          : storageWarning
            ? ` Note Storage: ${storageWarning}`
            : "";
        throw new Error(
          `${result?.error ?? "Le restaurant n’a pas pu être supprimé."}${detail}`
        );
      }

      setStatusFeedback({
        tone: "success",
        message: "Restaurant supprimé définitivement."
      });
      router.push("/owner/restaurants?deleted=1");
      router.refresh();
    } catch (error) {
      setStatusFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Suppression restaurant indisponible."
      });
      setDeletePending(false);
    }
  }

  const isArchived = restaurant.status === "archived";
  const nextAction: RestaurantStatusAction = isArchived ? "restore" : "archive";
  const actionLabel = isArchived ? "Restaurer le restaurant" : "Archiver le restaurant";
  const deleteConfirmationTarget = restaurant.slug || restaurant.name.trim();
  const deleteConfirmed = deleteConfirmation.trim() === deleteConfirmationTarget;
  const isDisabled = restaurant.isDemo || statusPending !== null || deletePending;

  function updateSettings(patch: Partial<PublicMenuSettings>) {
    setSettingsDraft((current) => serializePublicMenuSettings({ ...current, ...patch }));
  }

  function addLocale(value: string) {
    const locale = normalizeLocaleInput(value);
    if (!locale || settingsDraft.supportedLocales.includes(locale)) return;
    toggleLocale(locale);
  }

  function addCustomLocale() {
    addLocale(customLocale);
    setCustomLocale("");
  }

  function addCurrency(value: string) {
    const currency = normalizeCurrencyInput(value);
    if (!currency || settingsDraft.supportedCurrencies.includes(currency)) return;
    toggleCurrency(currency);
  }

  function addCustomCurrency() {
    addCurrency(customCurrency);
    setCustomCurrency("");
  }

  function toggleLocale(locale: PublicMenuLocale) {
    setSettingsDraft((current) => {
      const exists = current.supportedLocales.includes(locale);
      if (exists && current.supportedLocales.length === 1) return current;
      const supportedLocales = exists
        ? current.supportedLocales.filter((item) => item !== locale)
        : [...current.supportedLocales, locale].sort(
            (a, b) => compareByOptionOrder(a, b, localeOptions)
          );
      return serializePublicMenuSettings({
        ...current,
        supportedLocales,
        defaultLocale: supportedLocales.includes(current.defaultLocale)
          ? current.defaultLocale
          : supportedLocales[0] ?? "fr-CA"
      });
    });
  }

  function toggleCurrency(currency: PublicMenuCurrency) {
    setSettingsDraft((current) => {
      const exists = current.supportedCurrencies.includes(currency);
      if (exists && current.supportedCurrencies.length === 1) return current;
      const supportedCurrencies = exists
        ? current.supportedCurrencies.filter((item) => item !== currency)
        : [...current.supportedCurrencies, currency].sort(
            (a, b) => compareByOptionOrder(a, b, currencyOptions)
          );
      const fallback = supportedCurrencies[0] ?? "CAD";
      return serializePublicMenuSettings({
        ...current,
        supportedCurrencies,
        baseCurrency: supportedCurrencies.includes(current.baseCurrency)
          ? current.baseCurrency
          : fallback,
        defaultCurrency: supportedCurrencies.includes(current.defaultCurrency)
          ? current.defaultCurrency
          : fallback
      });
    });
  }

  async function saveMenuSettings() {
    setSettingsPending(true);
    setSettingsFeedback(null);

    try {
      const response = await fetch(
        `/api/owner/restaurants/${encodeURIComponent(restaurant.id)}/menu-settings`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publicMenuSettings: settingsDraft })
        }
      );
      const result = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string; settings?: PublicMenuSettings }
        | null;
      if (!response.ok || !result?.ok || !result.settings) {
        throw new Error(result?.error ?? "Settings menu indisponibles.");
      }
      setSettingsDraft(serializePublicMenuSettings(result.settings));
      setSettingsFeedback({
        tone: "success",
        message: "Settings publics du menu sauvegardes."
      });
      router.refresh();
    } catch (error) {
      setSettingsFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Settings menu indisponibles."
      });
    } finally {
      setSettingsPending(false);
    }
  }

  return (
    <div className={styles.restaurantSettingsStack}>
      <dl className={styles.definitionList}>
        <div>
          <dt>Nom</dt>
          <dd>{restaurant.name}</dd>
        </div>
        <div>
          <dt>Slug</dt>
          <dd>{restaurant.slug}</dd>
        </div>
        <div>
          <dt>Localisation</dt>
          <dd>{restaurant.location}</dd>
        </div>
        <div>
          <dt>Cuisine</dt>
          <dd>{restaurant.cuisineType}</dd>
        </div>
        <div>
          <dt>Statut</dt>
          <dd>{restaurant.statusLabel}</dd>
        </div>
        <div>
          <dt>Contact</dt>
          <dd>{restaurant.contactName || "À préciser"}</dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>{restaurant.contactEmail || "À préciser"}</dd>
        </div>
        <div>
          <dt>Téléphone</dt>
          <dd>{restaurant.contactPhone || "À préciser"}</dd>
        </div>
        <div>
          <dt>Notes</dt>
          <dd>{restaurant.notes || "Aucune note interne."}</dd>
        </div>
      </dl>

      <section
        className={styles.restaurantLifecycleControl}
        aria-labelledby="restaurant-menu-settings-title"
      >
        <div className={styles.restaurantLifecycleHeader}>
          <div>
            <h4 id="restaurant-menu-settings-title">Settings du menu public</h4>
            <p>
              Ces settings sont sauvegardes sur le menu principal et pilotent
              les langues, devises, timezone et toggles client du menu publie.
            </p>
          </div>
          <Badge tone="ready">{settingsDraft.defaultCurrency}</Badge>
        </div>

        <section className={styles.menuLanguagePanel} aria-labelledby="restaurant-public-style-title">
          <div>
            <h4 id="restaurant-public-style-title">Style du menu public</h4>
            <p>Ce rendu s&apos;applique au QR menu et aux fiches plats publiques.</p>
          </div>
          <div className={styles.toggleCardGrid} role="group" aria-label="Style du menu public">
            {publicMenuStyleOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`${styles.toggleCard} ${
                  settingsDraft.publicMenuStyle === option.value ? styles.toggleCardActive : ""
                }`}
                aria-pressed={settingsDraft.publicMenuStyle === option.value}
                disabled={settingsPending}
                onClick={() =>
                  setSettingsDraft((current) => ({
                    ...current,
                    publicMenuStyle: option.value
                  }))
                }
              >
                <strong>{option.label}</strong>
                <span>{option.detail}</span>
              </button>
            ))}
          </div>
        </section>

        <div className={styles.formGrid}>
          <label className={styles.formField}>
            <span className={styles.filterLabel}>Ajouter une langue</span>
            <select
              className={styles.control}
              value=""
              disabled={settingsPending}
              aria-label="Ajouter une langue au menu public"
              onChange={(event) => addLocale(event.target.value)}
            >
              <option value="">Choisir une langue...</option>
              {availableLocaleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} ({option.value})
                </option>
              ))}
            </select>
          </label>
          <label className={styles.formField}>
            <span className={styles.filterLabel}>Code langue personnalise</span>
            <input
              className={styles.control}
              value={customLocale}
              disabled={settingsPending}
              placeholder="ex: ja-JP, ar, es-MX"
              onChange={(event) => setCustomLocale(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addCustomLocale();
                }
              }}
            />
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSmall}`}
              disabled={settingsPending}
              onClick={addCustomLocale}
            >
              Ajouter
            </button>
          </label>
        </div>

        <div className={styles.inlineDraftList} aria-label="Langues selectionnees">
          {settingsDraft.supportedLocales.map((locale) => (
            <article key={locale} className={styles.draftChip}>
              <strong>{formatLocaleLabel(locale)}</strong>
              <small>{locale}</small>
              <button
                type="button"
                disabled={settingsPending || settingsDraft.supportedLocales.length === 1}
                onClick={() => toggleLocale(locale)}
              >
                Retirer
              </button>
            </article>
          ))}
        </div>

        <div className={styles.formGrid}>
          <label className={styles.formField}>
            <span className={styles.filterLabel}>Langue par defaut</span>
            <select
              className={styles.control}
              value={settingsDraft.defaultLocale}
              disabled={settingsPending}
              onChange={(event) =>
                updateSettings({ defaultLocale: event.target.value as PublicMenuLocale })
              }
            >
              {settingsDraft.supportedLocales.map((locale) => (
                <option key={locale} value={locale}>
                  {formatLocaleLabel(locale)}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.formField}>
            <span className={styles.filterLabel}>Timezone</span>
            <input
              className={styles.control}
              value={settingsDraft.timezone}
              disabled={settingsPending}
              onChange={(event) => updateSettings({ timezone: event.target.value })}
            />
          </label>
        </div>

        <div className={styles.formGrid}>
          <label className={styles.formField}>
            <span className={styles.filterLabel}>Ajouter une devise</span>
            <select
              className={styles.control}
              value=""
              disabled={settingsPending}
              aria-label="Ajouter une devise au menu public"
              onChange={(event) => addCurrency(event.target.value)}
            >
              <option value="">Choisir une devise...</option>
              {availableCurrencyOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {formatCurrencyOption(option.value)}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.formField}>
            <span className={styles.filterLabel}>Code devise personnalise</span>
            <input
              className={styles.control}
              value={customCurrency}
              disabled={settingsPending}
              placeholder="ex: GBP, JPY, CHF"
              maxLength={3}
              onChange={(event) => setCustomCurrency(event.target.value.toUpperCase())}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addCustomCurrency();
                }
              }}
            />
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSmall}`}
              disabled={settingsPending}
              onClick={addCustomCurrency}
            >
              Ajouter
            </button>
          </label>
        </div>

        <div className={styles.inlineDraftList} aria-label="Devises selectionnees">
          {settingsDraft.supportedCurrencies.map((currency) => (
            <article key={currency} className={styles.draftChip}>
              <strong>{currency}</strong>
              <small>{currency === "CAD" ? "Base recommandee" : "Conversion client"}</small>
              <button
                type="button"
                disabled={settingsPending || settingsDraft.supportedCurrencies.length === 1}
                onClick={() => toggleCurrency(currency)}
              >
                Retirer
              </button>
            </article>
          ))}
        </div>

        <div className={styles.formGrid}>
          <label className={styles.formField}>
            <span className={styles.filterLabel}>Devise des prix saisis</span>
            <select
              className={styles.control}
              value={settingsDraft.baseCurrency}
              disabled={settingsPending}
              aria-describedby="settings-base-currency-help"
              onChange={(event) =>
                updateSettings({ baseCurrency: event.target.value as PublicMenuCurrency })
              }
            >
              {settingsDraft.supportedCurrencies.map((currency) => (
                <option key={currency} value={currency}>
                  {formatCurrencyOption(currency)}
                </option>
              ))}
            </select>
            <small id="settings-base-currency-help" className={styles.fieldHelp}>
              Source officielle: les prix du menu sont en {settingsDraft.baseCurrency}.
            </small>
          </label>
          {hasMultipleCurrencies ? (
            <label className={styles.formField}>
              <span className={styles.filterLabel}>Devise affichee au client</span>
              <select
                className={styles.control}
                value={settingsDraft.defaultCurrency}
                disabled={settingsPending}
                aria-describedby="settings-default-currency-help"
                onChange={(event) =>
                  updateSettings({ defaultCurrency: event.target.value as PublicMenuCurrency })
                }
              >
                {settingsDraft.supportedCurrencies.map((currency) => (
                  <option key={currency} value={currency}>
                    {formatCurrencyOption(currency)}
                  </option>
                ))}
              </select>
              <small id="settings-default-currency-help" className={styles.fieldHelp}>
                Devise ouverte par defaut sur le menu public. Le client peut
                changer si le selecteur devise est autorise.
              </small>
            </label>
          ) : (
            <div className={styles.lockedSetting}>
              <span className={styles.filterLabel}>Devise affichee au client</span>
              <strong>{formatCurrencyOption(settingsDraft.defaultCurrency)}</strong>
              <small>
                Identique a la devise des prix tant qu&apos;aucune autre devise
                n&apos;est ajoutee.
              </small>
            </div>
          )}
          <label className={styles.formField}>
            <span className={styles.filterLabel}>Theme par defaut</span>
            <select
              className={styles.control}
              value={settingsDraft.defaultThemeMode}
              disabled={settingsPending}
              onChange={(event) =>
                updateSettings({ defaultThemeMode: event.target.value as PublicMenuThemeMode })
              }
            >
              <option value="dark">Dark premium</option>
              <option value="light">Light</option>
            </select>
          </label>
        </div>

        <div className={styles.toggleCardGrid}>
          <label className={styles.toggleLine}>
            <input
              type="checkbox"
              checked={settingsDraft.allowLanguageSelector}
              disabled={settingsPending}
              onChange={(event) =>
                updateSettings({ allowLanguageSelector: event.target.checked })
              }
            />
            <span>Client peut changer la langue</span>
          </label>
          <label className={styles.toggleLine}>
            <input
              type="checkbox"
              checked={settingsDraft.allowCurrencySelector}
              disabled={settingsPending}
              onChange={(event) =>
                updateSettings({ allowCurrencySelector: event.target.checked })
              }
            />
            <span>Client peut changer la devise</span>
          </label>
          <label className={styles.toggleLine}>
            <input
              type="checkbox"
              checked={settingsDraft.allowThemeToggle}
              disabled={settingsPending}
              onChange={(event) =>
                updateSettings({ allowThemeToggle: event.target.checked })
              }
            />
            <span>Client peut changer dark/light</span>
          </label>
          <label className={styles.toggleLine}>
            <input
              type="checkbox"
              checked={settingsDraft.taxIncluded}
              disabled={settingsPending}
              onChange={(event) => updateSettings({ taxIncluded: event.target.checked })}
            />
            <span>Taxes incluses</span>
          </label>
        </div>

        <div className={styles.restaurantLifecycleActions}>
          <button
            type="button"
            className={`${styles.btnPrimary} ${styles.btn}`}
            disabled={restaurant.isDemo || settingsPending}
            onClick={() => void saveMenuSettings()}
          >
            {settingsPending ? "Sauvegarde..." : "Sauvegarder les settings menu"}
          </button>
          {restaurant.isDemo ? (
            <span className={styles.sourceNote}>
              Restaurant de demonstration protege contre l&apos;edition.
            </span>
          ) : null}
        </div>

        {settingsFeedback ? (
          <p
            className={settingsFeedback.tone === "error" ? styles.errorText : styles.qrStatus}
            role="status"
          >
            {settingsFeedback.message}
          </p>
        ) : null}

        <OwnerMenuTranslationPanel
          restaurantId={restaurant.id}
          settings={settingsDraft}
          disabled={restaurant.isDemo || settingsPending}
        />
      </section>

      <section
        className={styles.restaurantLifecycleControl}
        aria-labelledby="restaurant-lifecycle-title"
      >
        <div className={styles.restaurantLifecycleHeader}>
          <div>
            <h4 id="restaurant-lifecycle-title">Zone restaurant</h4>
            <p>
              Archivez un restaurant pour le retirer du workflow actif sans supprimer ses plats,
              ses QR, ses médias ou ses URLs publiques.
            </p>
          </div>
          <Badge tone={isArchived ? "muted" : "ready"}>
            {isArchived ? "Archivé" : "Actif"}
          </Badge>
        </div>

        <div className={styles.restaurantLifecycleActions}>
          <button
            type="button"
            className={`${styles.btn} ${isArchived ? "" : styles.btnDanger}`}
            disabled={isDisabled}
            onClick={() => void updateRestaurantStatus(nextAction)}
          >
            {statusPending === nextAction ? "Mise à jour..." : actionLabel}
          </button>
          {restaurant.isDemo ? (
            <span className={styles.sourceNote}>
              Restaurant de démonstration protégé contre l’archivage.
            </span>
          ) : null}
        </div>

        {statusFeedback ? (
          <p
            className={statusFeedback.tone === "error" ? styles.errorText : styles.qrStatus}
            role="status"
          >
            {statusFeedback.message}
          </p>
        ) : null}

        <p className={styles.sourceNote}>
          L’archivage est réversible et conserve les données rattachées.
        </p>

        <div className={styles.restaurantDeleteBlock}>
          <div>
            <h5>Suppression définitive</h5>
            <p>
              Supprime le profil restaurant dans Supabase seulement après nettoyage confirmé
              des données critiques. En cas d’erreur, la table bloquante reste affichée et
              le restaurant n’est pas marqué supprimé.
            </p>
            <ul className={styles.restaurantDeleteList}>
              <li>Restaurant, liens publics et statut dashboard</li>
              <li>Plats menu_dishes, QR et configurations menu</li>
              <li>Données owner, analytics et métadonnées 3D si les tables existent</li>
              <li>Fichiers Storage/CDN seulement si la tentative ci-dessous est cochée</li>
            </ul>
          </div>

          <label className={styles.formField}>
            <span className={styles.filterLabel}>
              Tapez {deleteConfirmationTarget} pour confirmer
            </span>
            <input
              className={styles.control}
              value={deleteConfirmation}
              onChange={(event) => setDeleteConfirmation(event.target.value)}
              placeholder={deleteConfirmationTarget}
              disabled={restaurant.isDemo || deletePending}
            />
          </label>

          <label className={styles.restaurantStorageToggle}>
            <input
              type="checkbox"
              checked={deleteStorage}
              onChange={(event) => setDeleteStorage(event.target.checked)}
              disabled={restaurant.isDemo || deletePending}
            />
            <span>
              Tenter aussi de supprimer les fichiers Storage/CDN sous les chemins du
              restaurant. Si Storage échoue, la suppression DB reste conservée et un warning
              est retourné.
            </span>
          </label>

          <div className={styles.restaurantLifecycleActions}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnDanger}`}
              disabled={isDisabled || !deleteConfirmed}
              onClick={() => void deleteRestaurant()}
            >
              {deletePending ? "Suppression..." : "Supprimer définitivement"}
            </button>
            {restaurant.isDemo ? (
              <span className={styles.sourceNote}>
                Restaurant de démonstration protégé contre la suppression.
              </span>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
