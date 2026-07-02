"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { PublicMenuSettings } from "@/lib/menu/publicMenuSettings";
import styles from "@/components/owner/OwnerCockpit.module.css";

type TranslationLocaleStatus = {
  locale: string;
  status: string;
  estimatedCharacters: number;
  missingEntities: number;
  staleEntities: number;
  errorEntities: number;
  error?: string;
};

type TranslationOverview = {
  ok: true;
  provider: {
    configured: boolean;
    provider: string;
    reason?: string;
  };
  defaultLocale: string;
  supportedLocales: string[];
  locales: TranslationLocaleStatus[];
};

type TranslationOverviewResult =
  | { ok: true; overview: TranslationOverview }
  | { ok: false; error: string };

type OwnerMenuTranslationPanelProps = {
  restaurantId: string;
  settings: PublicMenuSettings;
  disabled?: boolean;
};

function statusLabel(status: string) {
  if (status === "source") return "Source";
  if (status === "up_to_date") return "A jour";
  if (status === "stale") return "Modifie";
  if (status === "error") return "Erreur traduction";
  if (status === "in_progress" || status === "pending") return "Traduction en cours";
  return "Traduction manquante";
}

function formatCharacters(count: number) {
  return new Intl.NumberFormat("fr-CA").format(count);
}

function errorMessage(result: unknown, fallback: string): string {
  if (result && typeof result === "object" && "error" in result) {
    const error = (result as { error?: unknown }).error;
    return typeof error === "string" && error ? error : fallback;
  }
  return fallback;
}

export function OwnerMenuTranslationPanel({
  restaurantId,
  settings,
  disabled = false
}: OwnerMenuTranslationPanelProps) {
  const [overview, setOverview] = useState<TranslationOverview | null>(null);
  const [message, setMessage] = useState("");
  const [pendingLocale, setPendingLocale] = useState<string | null>(null);

  const endpoint = useMemo(
    () => `/api/owner/restaurants/${encodeURIComponent(restaurantId)}/menu-translations`,
    [restaurantId]
  );
  const settingsKey = `${settings.defaultLocale}:${settings.supportedLocales.join("|")}`;

  const fetchOverview = useCallback(async (): Promise<TranslationOverviewResult> => {
    const response = await fetch(endpoint, { method: "GET" });
    const result = (await response.json().catch(() => null)) as
      | TranslationOverview
      | { ok?: false; error?: string }
      | null;
    if (!response.ok || !result?.ok) {
      return {
        ok: false,
        error: errorMessage(result, "Statuts traduction indisponibles.")
      };
    }
    return { ok: true, overview: result };
  }, [endpoint]);

  const loadOverview = useCallback(async () => {
    setMessage("");
    const result = await fetchOverview();
    if (result.ok) {
      setOverview(result.overview);
    } else {
      setMessage(result.error);
    }
  }, [fetchOverview]);

  useEffect(() => {
    let cancelled = false;
    void fetchOverview().then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setOverview(result.overview);
      } else {
        setMessage(result.error);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [fetchOverview, settingsKey]);

  async function runGeneration(locale: string, dryRun: boolean) {
    setPendingLocale(locale);
    setMessage("");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale, dryRun })
      });
      const result = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            error?: string;
            estimatedCharacters?: number;
            translatedCharacters?: number;
          }
        | null;
      if (!response.ok || !result?.ok) {
        setMessage(result?.error ?? "Generation traduction impossible.");
        return;
      }
      setMessage(
        dryRun
          ? `Estimation ${locale}: ${formatCharacters(result.estimatedCharacters ?? 0)} caracteres.`
          : `Generation ${locale}: ${formatCharacters(result.translatedCharacters ?? 0)} caracteres traduits.`
      );
      await loadOverview();
    } finally {
      setPendingLocale(null);
    }
  }

  const locales: TranslationLocaleStatus[] = overview?.locales ?? settings.supportedLocales.map((locale) => ({
    locale,
    status: locale === settings.defaultLocale ? "source" : "missing",
    estimatedCharacters: 0,
    missingEntities: 0,
    staleEntities: 0,
    errorEntities: 0
  }));

  return (
    <section className={styles.menuLanguagePanel} aria-labelledby="restaurant-menu-translations-title">
      <div>
        <h4 id="restaurant-menu-translations-title">Traductions du menu</h4>
        <p>
          Les traductions sont generees cote serveur, stockees en base, puis
          reutilisees par le menu public sans appel de traduction navigateur.
        </p>
      </div>

      {overview && !overview.provider.configured ? (
        <p className={styles.errorText} role="status">
          {overview.provider.reason}
        </p>
      ) : null}

      <div className={styles.inlineDraftList} aria-label="Statuts traduction">
        {locales.map((item) => {
          const canGenerate =
            item.locale !== settings.defaultLocale &&
            item.status !== "source" &&
            !disabled &&
            pendingLocale === null;
          return (
            <article key={item.locale} className={styles.draftChip}>
              <strong>{item.locale}</strong>
              <small>
                {statusLabel(item.status)}
                {item.estimatedCharacters > 0
                  ? ` - ${formatCharacters(item.estimatedCharacters)} caracteres`
                  : ""}
              </small>
              {item.error ? <small>{item.error}</small> : null}
              {item.locale !== settings.defaultLocale ? (
                <>
                  <button
                    type="button"
                    disabled={!canGenerate}
                    onClick={() => runGeneration(item.locale, true)}
                  >
                    Estimer
                  </button>
                  <button
                    type="button"
                    disabled={!canGenerate || overview?.provider.configured === false}
                    onClick={() => runGeneration(item.locale, false)}
                  >
                    {pendingLocale === item.locale ? "Generation..." : "Generer"}
                  </button>
                </>
              ) : null}
            </article>
          );
        })}
      </div>

      {message ? (
        <p className={message.includes("impossible") ? styles.errorText : styles.qrStatus} role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
