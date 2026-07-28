"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { Locale } from "@/lib/i18n";
import {
  formatMenuPrice,
  type MenuExchangeRates
} from "@/lib/currency/formatMenuPrice";
import {
  getVisiblePublicMenuCategories,
  getPublicMenuCategoryGroups,
  buildPublicDishPath,
  type PublicMenu,
  type PublicMenuCategory,
  type PublicMenuContextQuery,
  type PublicMenuDish
} from "@/lib/menu/publicMenuCore";
import {
  normalizePublicMenuCurrencyPreference,
  publicLocaleToLanguageTag
} from "@/lib/menu/publicMenuSettings";
import type { UniqueMenuRendererModuleProps } from "@/lib/menu/uniqueMenuRendererRegistry";
import { SaugeNoireBotanical } from "./SaugeNoireBotanical";
import {
  SaugeNoireFlipPage,
  type SaugeNoireFlipPageDensity
} from "./SaugeNoireFlipPage";
import {
  SaugeNoireDishSheet,
  SaugeNoireDishSheetCopyForLocale
} from "./SaugeNoireDishDetail";
import { SaugeNoirePageFlipExperiment } from "./SaugeNoirePageFlipExperiment";
import { SaugeNoireRoutePageFlip } from "./SaugeNoireRoutePageFlip";
import styles from "./SaugeNoireBookMenu.module.css";

type BookProps = UniqueMenuRendererModuleProps;

type BookPage =
  | { kind: "cover" }
  | { kind: "contents" }
  | { kind: "section"; category: PublicMenuCategory; dishes: PublicMenuDish[] }
  | { kind: "ending" };

type BookRouteTransition = {
  id: string;
  href: string;
  source: React.ReactNode;
  destination: React.ReactNode;
  sourceScrollTop: number;
};

type SaugeCopyLocale = "fr" | "en" | "es" | "it" | "ar";

type Copy = {
  tagline: string;
  menu: string;
  city: string;
  open: string;
  contents: string;
  touchSection: string;
  swipeSection: string;
  swipePage: string;
  previous: string;
  next: string;
  thanks: string;
  soon: string;
  backToTop: string;
  backToMenu: string;
  ingredients: string;
  allergens: string;
  options: string;
  allergenEmpty: string;
  allergenConfirm: string;
};

type SectionPageCopy = Pick<Copy, "menu" | "swipePage" | "previous" | "next">;

const COPY: Record<SaugeCopyLocale, Copy> = {
  fr: {
    tagline: "La braise, le végétal, le temps.",
    menu: "La Carte",
    city: "Montréal",
    open: "Tapotez pour ouvrir",
    contents: "Table des matières",
    touchSection: "Touchez une section pour l’ouvrir",
    swipeSection: "Balayez ou touchez une section",
    swipePage: "Balayez pour tourner la page",
    previous: "Page précédente",
    next: "Page suivante",
    thanks: "Merci et à bientôt",
    soon: "Au plaisir de vous retrouver autour d’une prochaine assiette.",
    backToTop: "Retour en haut",
    backToMenu: "Retour à la carte",
    ingredients: "Ingrédients",
    allergens: "Allergènes",
    options: "Options",
    allergenEmpty: "Aucun allergène majeur déclaré",
    allergenConfirm: "À confirmer avec l’équipe en salle"
  },
  en: {
    tagline: "Fire, botanicals, and time.",
    menu: "The Menu",
    city: "Montréal",
    open: "Tap to open",
    contents: "Table of contents",
    touchSection: "Touch a section to open it",
    swipeSection: "Swipe or touch a section",
    swipePage: "Swipe to turn the page",
    previous: "Previous page",
    next: "Next page",
    thanks: "Thank you and see you soon",
    soon: "We look forward to welcoming you around the table again.",
    backToTop: "Back to top",
    backToMenu: "Back to the menu",
    ingredients: "Ingredients",
    allergens: "Allergens",
    options: "Options",
    allergenEmpty: "No major allergens declared",
    allergenConfirm: "Please confirm with the dining room team"
  },
  es: {
    tagline: "Fuego, vegetales y tiempo.",
    menu: "El menú",
    city: "Montreal",
    open: "Toca para abrir",
    contents: "Tabla de contenidos",
    touchSection: "Toca una sección para abrirla",
    swipeSection: "Desliza o toca una sección",
    swipePage: "Desliza para pasar la página",
    previous: "Página anterior",
    next: "Página siguiente",
    thanks: "Gracias y hasta pronto",
    soon: "Esperamos recibirte de nuevo alrededor de la mesa.",
    backToTop: "Volver arriba",
    backToMenu: "Volver al menú",
    ingredients: "Ingredientes",
    allergens: "Alérgenos",
    options: "Opciones",
    allergenEmpty: "No se han declarado alérgenos principales",
    allergenConfirm: "Confirma con el equipo de sala"
  },
  it: {
    tagline: "Il fuoco, il vegetale, il tempo.",
    menu: "Il menu",
    city: "Montréal",
    open: "Tocca per aprire",
    contents: "Indice",
    touchSection: "Tocca una sezione per aprirla",
    swipeSection: "Scorri o tocca una sezione",
    swipePage: "Scorri per cambiare pagina",
    previous: "Pagina precedente",
    next: "Pagina successiva",
    thanks: "Grazie e a presto",
    soon: "Speriamo di accoglierti di nuovo intorno al tavolo.",
    backToTop: "Torna in alto",
    backToMenu: "Torna al menu",
    ingredients: "Ingredienti",
    allergens: "Allergeni",
    options: "Opzioni",
    allergenEmpty: "Nessun allergene principale dichiarato",
    allergenConfirm: "Conferma con il personale di sala"
  },
  ar: {
    tagline: "النار، والنبات، والوقت.",
    menu: "القائمة",
    city: "مونتريال",
    open: "اضغط للفتح",
    contents: "فهرس المحتويات",
    touchSection: "اضغط على قسم لفتحه",
    swipeSection: "مرّر أو اضغط على قسم",
    swipePage: "مرّر لقلب الصفحة",
    previous: "الصفحة السابقة",
    next: "الصفحة التالية",
    thanks: "شكرًا وإلى اللقاء",
    soon: "نتطلع إلى استقبالكم من جديد حول المائدة.",
    backToTop: "العودة إلى الأعلى",
    backToMenu: "العودة إلى القائمة",
    ingredients: "المكونات",
    allergens: "مسببات الحساسية",
    options: "الخيارات",
    allergenEmpty: "لم يتم الإعلان عن مسببات حساسية رئيسية",
    allergenConfirm: "يرجى التأكيد مع فريق الصالة"
  }
};

const RAIL_PINS = ["Top", "Bottom"] as const;

function romanYear(year: number): string {
  const values = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"]
  ] as const;
  let remaining = year;
  return values.reduce((result, [value, symbol]) => {
    while (remaining >= value) {
      result += symbol;
      remaining -= value;
    }
    return result;
  }, "");
}

function pageFromQuery(value: string | undefined, pageCount: number): number {
  if (!value?.startsWith("sauge-")) return 0;
  const parsed = Number(value.slice("sauge-".length));
  return Number.isInteger(parsed)
    ? Math.max(0, Math.min(pageCount - 1, parsed))
    : 0;
}

function localeLabel(locale: string): string {
  const language = locale.trim().toLowerCase().split(/[-_]/)[0];
  return language.slice(0, 2).toUpperCase() || "FR";
}

function copyLocale(locale: string): SaugeCopyLocale {
  const language = locale.trim().toLowerCase().split(/[-_]/)[0];
  if (language === "fr") return "fr";
  if (language === "es") return "es";
  if (language === "it") return "it";
  if (language === "ar") return "ar";
  return "en";
}

function formatDishPrice(
  dish: PublicMenuDish,
  currency: string,
  locale: Locale,
  exchangeRates?: MenuExchangeRates
): string {
  return formatMenuPrice({
    priceCents: dish.priceCents,
    sourceCurrency: dish.priceCurrency,
    targetCurrency: currency,
    locale,
    rates: exchangeRates?.rates,
    baseCurrency: exchangeRates?.base ?? dish.baseCurrency,
    displayPriceMode: dish.displayPriceMode,
    fallbackLabel: dish.priceLabel
  });
}

function isSignature(dish: PublicMenuDish): boolean {
  return Boolean(
    dish.isSignature ||
      dish.tags.some((tag) => tag.toLowerCase().includes("signature"))
  );
}

function buildPages(menu: PublicMenu): BookPage[] {
  const groups = getPublicMenuCategoryGroups(menu.dishes);
  const categories = getVisiblePublicMenuCategories(menu.dishes);
  return [
    { kind: "cover" },
    { kind: "contents" },
    ...categories.map((category) => ({
      kind: "section" as const,
      category,
      dishes: groups.get(category.id) ?? []
    })),
    { kind: "ending" }
  ];
}

export function SaugeNoireBookMenu({
  menu,
  query,
  locale = "fr",
  exchangeRates,
  mode
}: BookProps) {
  const router = useRouter();
  const routerRef = useRef(router);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pages = useMemo(() => buildPages(menu), [menu]);
  const activeLocale = locale;
  const activeLocaleValue = query?.lang ?? publicLocaleToLanguageTag(activeLocale);
  const copy = COPY[copyLocale(activeLocaleValue)];
  const availableLocales = menu.settings.supportedLocales;
  const availableCurrencies = menu.settings.supportedCurrencies;
  const initialCurrency = normalizePublicMenuCurrencyPreference(
    query?.currency,
    menu.settings
  );
  const [pageIndex, setPageIndex] = useState(() =>
    pageFromQuery(query?.view, pages.length)
  );
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const [routeTransition, setRouteTransition] = useState<BookRouteTransition | null>(null);
  const routeTransitionRef = useRef<BookRouteTransition | null>(null);
  const routeTransitionInFlightRef = useRef(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const currency = initialCurrency;
  const searchParamsString = searchParams.toString();
  const pageFlipEnabled =
    mode === "public" ||
    (mode === "builder-preview" && searchParams.get("pageFlipLab") === "1");

  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  useEffect(() => {
    routeTransitionRef.current = routeTransition;
    routeTransitionInFlightRef.current = routeTransition !== null;
  }, [routeTransition]);

  const goToPage = useCallback((index: number) => {
    const nextIndex = Math.max(0, Math.min(index, pages.length - 1));
    setPageIndex((current) => (current === nextIndex ? current : nextIndex));
  }, [pages.length]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" || event.key === "PageDown") {
        event.preventDefault();
        goToPage(pageIndex + 1);
      }
      if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        goToPage(pageIndex - 1);
      }
      if (event.key === "Home") {
        event.preventDefault();
        goToPage(0);
      }
      if (event.key === "End") {
        event.preventDefault();
        goToPage(pages.length - 1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goToPage, pages.length, pageIndex]);

  useEffect(() => {
    const nextView = `sauge-${pageIndex}`;
    const params = new URLSearchParams(searchParamsString);
    if (params.get("view") === nextView) return;

    params.set("view", nextView);
    const nextUrl = `${pathname}?${params.toString()}`;
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (currentUrl !== nextUrl) {
      window.history.replaceState(null, "", nextUrl);
    }
  }, [pageIndex, pathname, searchParamsString]);

  useEffect(() => {
    paperRef.current?.scrollTo({ top: 0, behavior: "auto" });
    const activeFlipPage = paperRef.current?.querySelector<HTMLElement>(
      `[data-sauge-flip-page-index="${pageIndex}"]:not([data-sauge-flip-clone])`
    );
    activeFlipPage?.scrollTo({ top: 0, behavior: "auto" });
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [pageIndex]);

  useEffect(() => {
    const paper = paperRef.current;
    const onScroll = (event?: Event) => {
      const targetScrollTop = event?.target instanceof HTMLElement ? event.target.scrollTop : 0;
      const paperScrollTop = Math.max(paper?.scrollTop ?? 0, targetScrollTop);
      setShowBackToTop(Math.max(window.scrollY, paperScrollTop) > 180);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    paper?.addEventListener("scroll", onScroll, { passive: true, capture: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      paper?.removeEventListener("scroll", onScroll, { capture: true });
    };
  }, []);

  const updatePreference = useCallback((next: { locale?: string; currency?: string }) => {
    const params = new URLSearchParams(searchParamsString);
    params.set("view", `sauge-${pageIndex}`);
    if (next.locale) params.set("lang", next.locale);
    if (next.currency) params.set("currency", next.currency);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pageIndex, pathname, router, searchParamsString]);

  const selectLocale = useCallback((nextLocale: string) => {
    updatePreference({ locale: nextLocale });
  }, [updatePreference]);

  const selectCurrency = useCallback((nextCurrency: string) => {
    updatePreference({ currency: nextCurrency });
  }, [updatePreference]);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (pageFlipEnabled) return;
    pointerStart.current = { x: event.clientX, y: event.clientY };
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (pageFlipEnabled) return;
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start) return;
    const target = event.target as HTMLElement;
    if (target.closest("a, button")) return;
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.abs(deltaX) < 44 || Math.abs(deltaX) < Math.abs(deltaY)) return;
    goToPage(pageIndex + (deltaX < 0 ? 1 : -1));
  }

  const currentPage = pages[pageIndex] ?? pages[0];

  const renderPage = useCallback(
    (
      page: BookPage,
      index: number,
      isPreview = false,
      onDishLinkClick?: (
        event: React.MouseEvent<HTMLAnchorElement>,
        href: string,
        targetDish: PublicMenuDish
      ) => void
    ) => {
    const categoryPage = page.kind === "section" ? index - 2 : null;

    return (
      <>
        <BookHeader
          locales={availableLocales}
          currencies={availableCurrencies}
          activeLocale={activeLocaleValue}
          activeCurrency={currency}
          onLocaleChange={selectLocale}
          onCurrencyChange={selectCurrency}
          showContentsLink={index > 1}
          contentsLabel={copy.contents}
          onContents={() => goToPage(1)}
          isPreview={isPreview}
        />
        {page.kind === "cover" ? <CoverPage copy={copy} onOpen={() => goToPage(1)} /> : null}
        {page.kind === "contents" ? (
          <ContentsPage
            categories={pages
              .filter((candidate): candidate is Extract<BookPage, { kind: "section" }> => candidate.kind === "section")
              .map((candidate) => candidate.category)}
            copy={copy}
            activePage={categoryPage}
            onSelect={(selectedIndex) => goToPage(selectedIndex + 2)}
            onSelectEnding={() => goToPage(pages.length - 1)}
            onPrevious={() => goToPage(0)}
            onNext={() => goToPage(2)}
          />
        ) : null}
        {page.kind === "section" ? (
          <SectionPage
            menu={menu}
            category={page.category}
            dishes={page.dishes}
            pageNumber={categoryPage ?? 0}
            locale={activeLocale}
            localeTag={activeLocaleValue}
            currency={currency}
            copy={copy}
            query={query}
            exchangeRates={exchangeRates}
            onPrevious={() => goToPage(index - 1)}
            onNext={() => goToPage(index + 1)}
            isPreview={isPreview}
            onDishLinkClick={isPreview ? undefined : onDishLinkClick}
          />
        ) : null}
        {page.kind === "ending" ? <EndingPage copy={copy} onRestart={() => goToPage(0)} /> : null}
      </>
    );
    }, [
    activeLocale,
    activeLocaleValue,
    availableCurrencies,
    availableLocales,
    copy,
    currency,
    exchangeRates,
    goToPage,
    menu,
    pages,
    query,
    selectCurrency,
      selectLocale
    ]
  );

  const handleDishLinkClick = useCallback((
    event: React.MouseEvent<HTMLAnchorElement>,
    href: string,
    targetDish: PublicMenuDish
  ) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    if (
      event.currentTarget.closest(
        '[data-sauge-route-transition-in-flight="true"]'
      )
    ) {
      event.preventDefault();
      return;
    }

    const pageFlipState = event.currentTarget
      .closest<HTMLElement>("[data-page-flip-state]")
      ?.getAttribute("data-page-flip-state");
    if (pageFlipState !== "ready") return;

    const currentPageElement = event.currentTarget.closest<HTMLElement>(
      '[data-sauge-flip-page-index]:not([data-sauge-flip-clone])'
    );
    const currentPageIndex = Number(currentPageElement?.getAttribute("data-sauge-flip-page-index"));
    const currentPage = pages[currentPageIndex];
    if (!currentPage || currentPage.kind !== "section") return;

    event.preventDefault();
    const nextTransition: BookRouteTransition = {
      id: `menu-to-detail-${currentPageIndex}-${targetDish.id}`,
      href,
      sourceScrollTop: currentPageElement?.scrollTop ?? 0,
      source: renderPage(currentPage, currentPageIndex, true),
      destination: (
        <SaugeNoireDishSheet
          menu={menu}
          query={query}
          locale={activeLocale}
          publicLocale={activeLocaleValue}
          exchangeRates={exchangeRates}
          dish={targetDish}
          copy={SaugeNoireDishSheetCopyForLocale(activeLocaleValue)}
          isPreview
        />
      )
    };
    setRouteTransition(nextTransition);
  }, [activeLocale, activeLocaleValue, exchangeRates, menu, pages, query, renderPage]);

  const handleRouteFlip = useCallback(() => {
    const transition = routeTransitionRef.current;
    if (!transition || !routeTransitionInFlightRef.current) return;
    routeTransitionInFlightRef.current = false;
    routeTransitionRef.current = null;
    routerRef.current.push(transition.href);
  }, []);

  const handleRouteFallback = useCallback(() => {
    const transition = routeTransitionRef.current;
    if (!transition || !routeTransitionInFlightRef.current) return;
    routeTransitionInFlightRef.current = false;
    routeTransitionRef.current = null;
    routerRef.current.push(transition.href);
  }, []);

  const flipPages = useMemo(
    () =>
      pages.map((page, index) => {
        const density: SaugeNoireFlipPageDensity =
          page.kind === "cover" || page.kind === "ending" ? "hard" : "soft";
        return (
          <SaugeNoireFlipPage
            key={`sauge-flip-page-${index}`}
            index={index}
            density={density}
          >
            {renderPage(page, index, false, handleDishLinkClick)}
          </SaugeNoireFlipPage>
        );
      }),
    [handleDishLinkClick, pages, renderPage]
  );

  return (
    <main
      className={styles.book}
      data-testid="sauge-noire-book"
      data-page-index={pageIndex}
      data-page-kind={currentPage.kind}
      data-page-flip-mode={pageFlipEnabled ? "animated" : "instant"}
      data-sauge-route-transition-in-flight={
        routeTransition ? "true" : undefined
      }
      style={{ "--sn-page-index": pageIndex } as CSSProperties}
    >
      <BookRail />
      <div
        className={styles.paper}
        ref={paperRef}
        onPointerDown={pageFlipEnabled ? undefined : handlePointerDown}
        onPointerUp={pageFlipEnabled ? undefined : handlePointerUp}
      >
        <div className={styles.pageViewport}>
          {pageFlipEnabled ? (
            <SaugeNoirePageFlipExperiment
              pages={flipPages}
              pageIndex={pageIndex}
              onPageFlip={goToPage}
              fallback={renderPage(currentPage, pageIndex, false, handleDishLinkClick)}
            />
          ) : (
            renderPage(currentPage, pageIndex, false, handleDishLinkClick)
          )}
          {routeTransition ? (
            <SaugeNoireRoutePageFlip
              id={routeTransition.id}
              direction="next"
              source={routeTransition.source}
              destination={routeTransition.destination}
              sourceScrollTop={routeTransition.sourceScrollTop}
              onFlip={handleRouteFlip}
              onFallback={handleRouteFallback}
            />
          ) : null}
        </div>
        {showBackToTop ? (
          <button
            type="button"
            className={styles.backToTop}
            onClick={() => {
              paperRef.current?.scrollTo({ top: 0, behavior: "smooth" });
              const activePage = paperRef.current?.querySelector<HTMLElement>(
                `[data-sauge-flip-page-index="${pageIndex}"]:not([data-sauge-flip-clone]), .${styles.pageFlipFallback}`
              );
              activePage?.scrollTo({ top: 0, behavior: "smooth" });
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            aria-label={copy.backToTop}
          >
            <span aria-hidden="true">↑</span>
            {copy.backToTop}
          </button>
        ) : null}
      </div>
    </main>
  );
}

function BookRail() {
  return (
    <aside className={styles.rail} aria-hidden="true">
      <div className={styles.railPattern} />
      {RAIL_PINS.map((position) => (
        <div className={`${styles.railFastener} ${styles[`railFastener${position}`]}`} key={position}>
          <i />
          <span />
          <i />
        </div>
      ))}
    </aside>
  );
}

function BookHeader({
  locales,
  currencies,
  activeLocale,
  activeCurrency,
  onLocaleChange,
  onCurrencyChange,
  showContentsLink,
  contentsLabel,
  onContents,
  isPreview = false
}: {
  locales: string[];
  currencies: string[];
  activeLocale: string;
  activeCurrency: string;
  onLocaleChange: (value: string) => void;
  onCurrencyChange: (value: string) => void;
  showContentsLink: boolean;
  contentsLabel: string;
  onContents: () => void;
  isPreview?: boolean;
}) {
  return (
    <header className={styles.bookHeader} aria-hidden={isPreview || undefined}>
      <BrandMark />
      {showContentsLink ? (
        <button
          type="button"
          className={styles.contentsBack}
          onClick={onContents}
          aria-label={`Retour à ${contentsLabel}`}
        >
          <span aria-hidden="true">←</span>
          <span>{contentsLabel}</span>
        </button>
      ) : null}
      <div className={styles.preferenceControls}>
        <PreferenceMenu
          ariaLabel="Langue"
          values={locales}
          active={activeLocale}
          label={localeLabel}
          onChange={onLocaleChange}
        />
        <PreferenceMenu
          ariaLabel="Devise"
          values={currencies}
          active={activeCurrency}
          label={(value) => value.toUpperCase()}
          onChange={onCurrencyChange}
        />
      </div>
    </header>
  );
}

function PreferenceMenu({
  ariaLabel,
  values,
  active,
  label,
  onChange
}: {
  ariaLabel: string;
  values: string[];
  active: string;
  label: (value: string) => string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const controlRef = useRef<HTMLDivElement>(null);
  const options = values.length > 0 ? values : [active];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!controlRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className={styles.preferenceMenu} ref={controlRef}>
      <button
        type="button"
        className={styles.preferenceTrigger}
        aria-label={`${ariaLabel}: ${label(active)}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{label(active)}</span>
        <span className={styles.preferenceChevron} aria-hidden="true" />
      </button>
      {open ? (
        <div className={styles.preferencePopover} role="menu" aria-label={ariaLabel}>
          {options.map((value) => (
            <button
              type="button"
              role="menuitemradio"
              aria-checked={active === value}
              key={value}
              className={active === value ? styles.preferenceOptionActive : styles.preferenceOption}
              onClick={() => {
                onChange(value);
                setOpen(false);
              }}
            >
              <span>{label(value)}</span>
              {active === value ? <span aria-hidden="true">•</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function BrandMark() {
  return (
    <div className={styles.brandMark} aria-label="Sauge Noire">
      <span>S</span>
      <span>N</span>
    </div>
  );
}

function Rule() {
  return <span className={styles.rule} aria-hidden="true"><i /></span>;
}

function CoverPage({ copy, onOpen }: { copy: Copy; onOpen: () => void }) {
  return (
    <section className={`${styles.page} ${styles.coverPage}`} aria-label="Sauge Noire">
      <button type="button" className={styles.coverTap} onClick={onOpen} aria-label={copy.open}>
        <SaugeNoireBotanical className={styles.coverBotanical} />
        <div className={styles.coverTitle}>
          <h1>SAUGE<br />NOIRE</h1>
          <p>{copy.tagline}</p>
        </div>
        <Rule />
        <p className={styles.coverMenuTitle}>{copy.menu}</p>
        <span className={styles.coverUnderline} aria-hidden="true" />
        <p className={styles.coverCity}>{copy.city}</p>
        <span className={styles.coverDot} aria-hidden="true" />
        <p className={styles.coverYear}>{romanYear(new Date().getFullYear())}</p>
        <span className={styles.coverOpen}>{copy.open}</span>
        <Arrow />
      </button>
    </section>
  );
}

function ContentsPage({
  categories,
  copy,
  activePage,
  onSelect,
  onSelectEnding,
  onPrevious,
  onNext
}: {
  categories: PublicMenuCategory[];
  copy: Copy;
  activePage: number | null;
  onSelect: (index: number) => void;
  onSelectEnding: () => void;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <section className={`${styles.page} ${styles.contentsPage}`} aria-label={copy.contents}>
      <SaugeNoireBotanical className={styles.contentsBotanical} />
      <h1>{copy.contents}</h1>
      <Rule />
      <p className={styles.instruction}>{copy.touchSection}</p>
      <nav className={styles.contentsList} aria-label={copy.contents}>
        {categories.map((category, index) => (
          <button
            type="button"
            key={category.id}
            className={activePage === index ? styles.contentsActive : ""}
            onClick={() => onSelect(index)}
          >
            <span>{category.label}</span>
            <b>{String(index + 1).padStart(2, "0")}</b>
          </button>
        ))}
        <button type="button" onClick={onSelectEnding}>
          <span>{copy.thanks}</span>
          <b>08</b>
        </button>
      </nav>
      <PageFooter
        copy={copy.swipeSection}
        previousLabel={copy.previous}
        nextLabel={copy.next}
        onPrevious={onPrevious}
        onNext={onNext}
      />
    </section>
  );
}

export function SectionPage({
  menu,
  category,
  dishes,
  pageNumber,
  locale,
  localeTag,
  currency,
  copy,
  query,
  exchangeRates,
  onPrevious,
  onNext,
  isPreview = false,
  onDishLinkClick
}: {
  menu: PublicMenu;
  category: PublicMenuCategory;
  dishes: PublicMenuDish[];
  pageNumber: number;
  locale: Locale;
  localeTag: string;
  currency: string;
  copy: SectionPageCopy;
  query?: PublicMenuContextQuery;
  exchangeRates?: MenuExchangeRates;
  onPrevious: () => void;
  onNext: () => void;
  isPreview?: boolean;
  onDishLinkClick?: (
    event: React.MouseEvent<HTMLAnchorElement>,
    href: string,
    targetDish: PublicMenuDish
  ) => void;
}) {
  const featured = dishes.find(isSignature) ?? dishes[0];
  const remainingDishes = featured
    ? dishes.filter((dish) => dish.id !== featured.id)
    : dishes;
  const sectionNumber = pageNumber + 1;
  const isFirstPage = sectionNumber === 1;
  const isCocktail = category.label.toLowerCase().includes("cocktail");
  const isNonAlcoholic = category.label.toLowerCase().includes("alcool") || category.label.toLowerCase().includes("alcohol");
  const isSplit = isCocktail || isNonAlcoholic;
  const isShortSection = !isSplit && dishes.length <= 4;
  const sectionQuery = { ...query, lang: localeTag, currency, view: `sauge-${pageNumber + 2}` };
  return (
    <section
      className={`${styles.page} ${styles.sectionPage} ${isSplit ? styles.splitSection : ""} ${isShortSection ? styles.shortSectionPage : ""}`}
      aria-label={category.label}
      aria-hidden={isPreview || undefined}
      data-transition-preview={isPreview ? "true" : undefined}
    >
      <div className={styles.sectionKicker}>
        <span>{String(sectionNumber).padStart(2, "0")}</span>
        <Rule />
      </div>
      <div className={styles.sectionTitleRow}>
        {sectionNumber === 2 ? <SaugeNoireBotanical variant="sideSprig" className={styles.titleBranchLeft} /> : null}
        <h1>{category.label.toUpperCase()}</h1>
        {sectionNumber === 2 ? <SaugeNoireBotanical variant="sideSprig" className={styles.titleBranchRight} /> : null}
      </div>
      {sectionNumber === 1 ? <SaugeNoireBotanical variant="sprig" className={styles.sectionBotanical} /> : null}
      {sectionNumber === 7 ? <SaugeNoireBotanical variant="sansAlcoolBranch" className={styles.sectionBotanical} /> : null}
      {featured ? (
        <DishFeatureCard
          menu={menu}
          dish={featured}
          locale={locale}
          currency={currency}
          copy={copy}
          query={sectionQuery}
          exchangeRates={exchangeRates}
          variant={isFirstPage ? "compact" : isSplit ? "split" : "editorial"}
          isPreview={isPreview}
          onDishLinkClick={onDishLinkClick}
        />
      ) : null}
      <div className={styles.dishList}>
        {remainingDishes.map((dish) => (
          <DishRow
            key={dish.id}
            menu={menu}
            dish={dish}
            locale={locale}
            currency={currency}
            query={sectionQuery}
            exchangeRates={exchangeRates}
            compact={isFirstPage}
            isPreview={isPreview}
            onDishLinkClick={onDishLinkClick}
          />
        ))}
      </div>
      <PageFooter
        copy={copy.swipePage}
        previousLabel={copy.previous}
        nextLabel={copy.next}
        onPrevious={onPrevious}
        onNext={onNext}
      />
    </section>
  );
}

function DishFeatureCard({
  menu,
  dish,
  locale,
  currency,
  copy,
  query,
  exchangeRates,
  variant,
  isPreview = false,
  onDishLinkClick
}: {
  menu: PublicMenu;
  dish: PublicMenuDish;
  locale: Locale;
  currency: string;
  copy: Pick<Copy, "menu">;
  query: PublicMenuContextQuery;
  exchangeRates?: MenuExchangeRates;
  variant: "compact" | "editorial" | "split";
  isPreview?: boolean;
  onDishLinkClick?: (
    event: React.MouseEvent<HTMLAnchorElement>,
    href: string,
    targetDish: PublicMenuDish
  ) => void;
}) {
  const href = buildPublicDishPath(menu.slug, dish.slug, query);
  return (
    <Link
      href={href}
      prefetch={false}
      className={`${styles.featureCard} ${styles[`feature${variant[0].toUpperCase()}${variant.slice(1)}`]}`}
      data-sauge-featured-dish="true"
      data-dish-id={dish.id}
      tabIndex={isPreview ? -1 : undefined}
      onClick={
        isPreview
          ? (event) => event.preventDefault()
          : (event) => onDishLinkClick?.(event, href, dish)
      }
    >
      <PhotoSlot dish={dish} large />
      <div className={styles.featureCopy}>
        <div className={styles.featureTitle}>
          <h2>{dish.name}</h2>
          {dish.has3d ? <SaugeNoire3dIndicator label={threeDLabel(locale)} /> : null}
        </div>
        {variant !== "compact" && dish.description ? <p>{dish.description}</p> : null}
        <Rule />
        <strong>{formatDishPrice(dish, currency, locale, exchangeRates)}</strong>
      </div>
      <span className={styles.srOnly}>{copy.menu}</span>
    </Link>
  );
}

function DishRow({
  menu,
  dish,
  locale,
  currency,
  query,
  exchangeRates,
  compact,
  isPreview = false,
  onDishLinkClick
}: {
  menu: PublicMenu;
  dish: PublicMenuDish;
  locale: Locale;
  currency: string;
  query: PublicMenuContextQuery;
  exchangeRates?: MenuExchangeRates;
  compact: boolean;
  isPreview?: boolean;
  onDishLinkClick?: (
    event: React.MouseEvent<HTMLAnchorElement>,
    href: string,
    targetDish: PublicMenuDish
  ) => void;
}) {
  const href = buildPublicDishPath(menu.slug, dish.slug, query);
  return (
    <Link
      href={href}
      prefetch={false}
      className={`${styles.dishRow} ${compact ? styles.dishRowCompact : ""}`}
      data-sauge-dish-row="true"
      data-dish-id={dish.id}
      tabIndex={isPreview ? -1 : undefined}
      onClick={
        isPreview
          ? (event) => event.preventDefault()
          : (event) => onDishLinkClick?.(event, href, dish)
      }
    >
      <PhotoSlot dish={dish} />
      <span className={styles.dishRowName}>
        <span>{dish.name}</span>
        {dish.has3d ? <SaugeNoire3dIndicator label={threeDLabel(locale)} /> : null}
      </span>
      <span className={styles.dishRowPrice}>{formatDishPrice(dish, currency, locale, exchangeRates)}</span>
    </Link>
  );
}

function SaugeNoire3dIndicator({ label }: { label: string }) {
  return (
    <span
      className={styles.threeDIndicator}
      data-sauge-3d-indicator="true"
      role="img"
      aria-label={label}
    >
      <svg className={styles.threeDIcon} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <path
          d="M8 1.5 2.5 4.75v6.5L8 14.5l5.5-3.25v-6.5L8 1.5Z"
          fill="none"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.1"
        />
        <path
          d="M8 1.5v13M2.5 4.75 8 8l5.5-3.25M8 8v6.5"
          fill="none"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.1"
        />
      </svg>
      <span>3D</span>
    </span>
  );
}

function threeDLabel(locale: Locale): string {
  const language = locale.trim().toLowerCase().split(/[-_]/)[0];
  if (language === "en") return "3D view available";
  if (language === "es") return "Vista 3D disponible";
  if (language === "it") return "Vista 3D disponibile";
  if (language === "ar") return "Ø¹Ø±Ø¶ 3D Ù…ØªØ§Ø­";
  return "Vue 3D disponible";
}

function PhotoSlot({ dish, large = false }: { dish: PublicMenuDish; large?: boolean }) {
  return (
    <span className={`${styles.photoSlot} ${large ? styles.photoSlotLarge : ""}`} data-photo-slot={dish.slug}>
      {dish.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={dish.imageUrl} alt="" loading="lazy" />
      ) : null}
    </span>
  );
}

function EndingPage({ copy, onRestart }: { copy: Copy; onRestart: () => void }) {
  return (
    <section className={`${styles.page} ${styles.endingPage}`} aria-label={copy.thanks}>
      <h1>{copy.thanks.toUpperCase()}</h1>
      <SaugeNoireBotanical className={styles.endingBotanical} />
      <div className={styles.endingWordmark}>SAUGE<br />NOIRE</div>
      <p>{copy.tagline}</p>
      <Rule />
      <p className={styles.endingCity}>Montréal, Québec</p>
      <span className={styles.coverDot} aria-hidden="true" />
      <button
        type="button"
        className={styles.googleReviewCta}
        data-testid="google-review-cta"
        aria-label="Exemple de bouton pour laisser un avis Google"
      >
        <span className={styles.googleReviewBrand}>
          <span className={styles.googleReviewMark} data-testid="google-review-mark" aria-hidden="true">G</span>
          Laisser un avis Google
        </span>
        <span className={styles.googleReviewArrow} data-testid="google-review-arrow" aria-hidden="true">
          <svg viewBox="0 0 20 20" focusable="false">
            <path d="M4 16 16 4M8 4h8v8" />
          </svg>
        </span>
      </button>
      <button type="button" className={styles.restartButton} onClick={onRestart}>{copy.menu}</button>
      <p className={styles.endingSoon}>{copy.soon}</p>
    </section>
  );
}

function PageFooter({
  copy,
  previousLabel,
  nextLabel,
  onPrevious,
  onNext
}: {
  copy: string;
  previousLabel: string;
  nextLabel: string;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <footer className={styles.pageFooter}>
      <Rule />
      <p>{copy}</p>
      <div className={styles.doubleArrowControl}>
        <button type="button" className={`${styles.arrowHit} ${styles.arrowHitPrevious}`} onClick={onPrevious} aria-label={previousLabel} />
        <DoubleArrow />
        <button type="button" className={`${styles.arrowHit} ${styles.arrowHitNext}`} onClick={onNext} aria-label={nextLabel} />
      </div>
    </footer>
  );
}

function DoubleArrow() {
  return (
    <svg className={styles.doubleArrow} viewBox="0 0 48 20" aria-hidden="true" focusable="false">
      <path d="M1 10h46M7 4l-6 6 6 6M41 4l6 6-6 6" />
    </svg>
  );
}

function Arrow() {
  return (
    <svg className={styles.arrow} viewBox="0 0 48 20" aria-hidden="true" focusable="false">
      <path d="M1 10h42M34 2l10 8-10 8" />
    </svg>
  );
}
