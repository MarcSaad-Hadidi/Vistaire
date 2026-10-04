"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { PublicMenu, PublicMenuContextQuery } from "@/lib/menu/publicMenuCore";
import {
  TROUVABLE_CURRENCY_STORAGE_KEY,
  TROUVABLE_LOCALE_STORAGE_KEY,
  TROUVABLE_THEME_STORAGE_KEY,
  getTrouvableTextDirection,
  normalizeTrouvableCurrency,
  normalizeTrouvableReadyLocaleForSettings,
  normalizeTrouvableTheme,
  resolveTrouvableCopy,
  type TrouvableCurrency,
  type TrouvableLocale,
  type TrouvableTheme
} from "./trouvableMenuControls";

export function useTrouvablePreferences(
  menu: PublicMenu,
  query?: PublicMenuContextQuery,
  displayMode: "public" | "phone-preview" | "comparison-preview" = "public"
) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [selectedLocale, setSelectedLocale] = useState<TrouvableLocale>(() =>
    normalizeTrouvableReadyLocaleForSettings(
      query?.lang,
      menu.settings,
      menu.localizedUiCopy
    )
  );
  const [selectedCurrency, setSelectedCurrency] =
    useState<TrouvableCurrency>(() =>
      normalizeTrouvableCurrency(undefined, menu.settings)
    );
  const [selectedTheme, setSelectedTheme] = useState<TrouvableTheme>(() =>
    normalizeTrouvableTheme(undefined, menu.settings)
  );
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);

  const { copy, resolution: copyResolution } = resolveTrouvableCopy(
    selectedLocale,
    menu.localizedUiCopy
  );
  const textDirection = getTrouvableTextDirection(selectedLocale);
  useTrouvableDocumentLanguage(selectedLocale, textDirection, displayMode === "public");
  const localizedQuery = useMemo<PublicMenuContextQuery>(
    () => ({ ...(query ?? {}), lang: selectedLocale }),
    [query, selectedLocale]
  );

  const replaceLocaleInUrl = useCallback(
    (nextLocale: TrouvableLocale) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("lang", nextLocale);
      const queryString = params.toString();
      const nextPath = queryString ? `${pathname}?${queryString}` : pathname;
      router.replace(nextPath, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  useEffect(() => {
    const animationFrameId = window.requestAnimationFrame(() => {
      const queryLocale = query?.lang?.toString().trim()
        ? normalizeTrouvableReadyLocaleForSettings(
            query.lang,
            menu.settings,
            menu.localizedUiCopy
          )
        : null;
      const defaultLocale = normalizeTrouvableReadyLocaleForSettings(
        undefined,
        menu.settings,
        menu.localizedUiCopy
      );
      if (displayMode !== "public") {
        setSelectedLocale(queryLocale ?? defaultLocale);
        setSelectedCurrency(normalizeTrouvableCurrency(undefined, menu.settings));
        setSelectedTheme(normalizeTrouvableTheme(undefined, menu.settings));
        setPreferencesLoaded(true);
        return;
      }
      const storedLocale = window.localStorage.getItem(TROUVABLE_LOCALE_STORAGE_KEY);
      const storedCurrency = window.localStorage.getItem(
        TROUVABLE_CURRENCY_STORAGE_KEY
      );
      const storedTheme = window.localStorage.getItem(TROUVABLE_THEME_STORAGE_KEY);
      const activeServerLocale = normalizeTrouvableReadyLocaleForSettings(
        menu.activeLocale,
        menu.settings,
        menu.localizedUiCopy
      );
      const normalizedStoredLocale = storedLocale
        ? normalizeTrouvableReadyLocaleForSettings(
            storedLocale,
            menu.settings,
            menu.localizedUiCopy
          )
        : null;

      if (
        !queryLocale &&
        normalizedStoredLocale &&
        normalizedStoredLocale !== defaultLocale &&
        normalizedStoredLocale !== activeServerLocale
      ) {
        replaceLocaleInUrl(normalizedStoredLocale);
        return;
      }

      setSelectedLocale(
        queryLocale ??
          normalizedStoredLocale ??
          defaultLocale
      );
      setSelectedCurrency(normalizeTrouvableCurrency(storedCurrency, menu.settings));
      setSelectedTheme(normalizeTrouvableTheme(storedTheme, menu.settings));
      if (queryLocale) {
        window.localStorage.setItem(TROUVABLE_LOCALE_STORAGE_KEY, queryLocale);
      }
      setPreferencesLoaded(true);
    });

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [
    displayMode,
    menu.activeLocale,
    menu.localizedUiCopy,
    menu.settings,
    query?.lang,
    replaceLocaleInUrl
  ]);

  useEffect(() => {
    if (displayMode !== "public" || !preferencesLoaded) return;
    window.localStorage.setItem(TROUVABLE_LOCALE_STORAGE_KEY, selectedLocale);
    window.localStorage.setItem(TROUVABLE_CURRENCY_STORAGE_KEY, selectedCurrency);
    window.localStorage.setItem(TROUVABLE_THEME_STORAGE_KEY, selectedTheme);
  }, [displayMode, preferencesLoaded, selectedCurrency, selectedLocale, selectedTheme]);

  return {
    selectedLocale,
    setSelectedLocale,
    selectedCurrency,
    setSelectedCurrency,
    selectedTheme,
    setSelectedTheme,
    replaceLocaleInUrl,
    localizedQuery,
    copy,
    copyResolution,
    textDirection
  };
}

function useTrouvableDocumentLanguage(
  locale: string,
  direction: "ltr" | "rtl",
  enabled = true
) {
  useEffect(() => {
    if (!enabled) return;
    const root = document.documentElement;
    const previousLang = root.lang;
    const previousDir = root.getAttribute("dir");

    root.lang = locale;
    root.setAttribute("dir", direction);

    return () => {
      root.lang = previousLang;
      if (previousDir === null) {
        root.removeAttribute("dir");
      } else {
        root.setAttribute("dir", previousDir);
      }
    };
  }, [direction, enabled, locale]);
}
