"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
import {
  formatMenuPrice,
  type MenuExchangeRates
} from "@/lib/currency/formatMenuPrice";
import type { Locale } from "@/lib/i18n";
import {
  buildPublicDishPath,
  getPublicMenuCategoryGroups,
  getVisiblePublicMenuCategories,
  type PublicMenu,
  type PublicMenuCategory,
  type PublicMenuContextQuery,
  type PublicMenuDish
} from "@/lib/menu/publicMenuCore";
import { SaugeNoireBotanical } from "./SaugeNoireBotanical";
import { useSaugeNoirePhysicalPageMedia } from "./SaugeNoirePageMediaContext";
import styles from "./SaugeNoireBookMenu.module.css";

export type SaugeNoirePageCopy = {
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
  googleReview: string;
  googleReviewAria: string;
};

type SectionPageCopy = Pick<
  SaugeNoirePageCopy,
  "menu" | "swipePage" | "previous" | "next"
>;

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

export function SaugeNoireMenuPages({
  copy,
  currency,
  displayMode = "comparison-preview",
  exchangeRates,
  locale,
  localeTag,
  menu,
  query
}: {
  copy: SaugeNoirePageCopy;
  currency: string;
  displayMode?: "comparison-preview" | "phone-preview";
  exchangeRates?: MenuExchangeRates;
  locale: Locale;
  localeTag: string;
  menu: PublicMenu;
  query?: PublicMenuContextQuery;
}) {
  const groups = getPublicMenuCategoryGroups(menu.dishes);
  const categories = getVisiblePublicMenuCategories(menu.dishes);

  return (
    <div
      className={styles.comparisonPages}
      data-sauge-comparison-pages="true"
      data-display-mode={displayMode}
      data-public-menu-renderer="sauge-noire"
    >
      <CoverPage
        copy={copy}
        headingLevel={2}
        interactive={false}
        onOpen={() => undefined}
      />
      <ContentsPage
        activePage={null}
        categories={categories}
        copy={copy}
        headingLevel={2}
        interactive={false}
        onNext={() => undefined}
        onPrevious={() => undefined}
        onSelect={() => undefined}
        onSelectEnding={() => undefined}
      />
      {categories.map((category, index) => (
        <SectionPage
          category={category}
          copy={copy}
          currency={currency}
          disableNavigation
          dishes={groups.get(category.id) ?? []}
          exchangeRates={exchangeRates}
          headingLevel={2}
          key={category.id}
          locale={locale}
          localeTag={localeTag}
          menu={menu}
          onNext={() => undefined}
          onPrevious={() => undefined}
          pageNumber={index}
          query={query}
        />
      ))}
      <EndingPage
        copy={copy}
        headingLevel={2}
        interactive={false}
        onRestart={() => undefined}
        showGoogleReview={false}
      />
    </div>
  );
}

export function BrandMark() {
  return (
    <div
      className={styles.brandMark}
      aria-label="Sauge Noire"
      data-sauge-static-element="brand"
    >
      <span>S</span>
      <span>N</span>
    </div>
  );
}

function Rule() {
  return (
    <span className={styles.rule} aria-hidden="true" data-sauge-static-element="rule">
      <i />
    </span>
  );
}

export function CoverPage({
  copy,
  headingLevel = 1,
  interactive = true,
  onOpen
}: {
  copy: SaugeNoirePageCopy;
  headingLevel?: 1 | 2;
  interactive?: boolean;
  onOpen: () => void;
}) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  return (
    <section
      className={`${styles.page} ${styles.coverPage}`}
      aria-label="Sauge Noire"
      data-sauge-static-page="cover"
    >
      <button
        type="button"
        className={styles.coverTap}
        aria-label={copy.open}
        disabled={!interactive}
        onClick={interactive ? onOpen : undefined}
        data-sauge-static-element="cover-tap"
      >
        <SaugeNoireBotanical className={styles.coverBotanical} />
        <div className={styles.coverTitle} data-sauge-static-element="wordmark">
          <Heading>SAUGE<br />NOIRE</Heading>
          <p>{copy.tagline}</p>
        </div>
        <Rule />
        <p className={styles.coverMenuTitle} data-sauge-static-element="menu-title">{copy.menu}</p>
        <span className={styles.coverUnderline} aria-hidden="true" data-sauge-static-element="underline" />
        <p className={styles.coverCity} data-sauge-static-element="city">{copy.city}</p>
        <span className={styles.coverDot} aria-hidden="true" data-sauge-static-element="dot" />
        <p className={styles.coverYear} data-sauge-static-element="year">{romanYear(new Date().getFullYear())}</p>
        <span className={styles.coverOpen} data-sauge-static-element="open">{copy.open}</span>
        <Arrow />
      </button>
    </section>
  );
}

export function ContentsPage({
  categories,
  copy,
  activePage,
  headingLevel = 1,
  interactive = true,
  onSelect,
  onSelectEnding,
  onPrevious,
  onNext
}: {
  categories: PublicMenuCategory[];
  copy: SaugeNoirePageCopy;
  activePage: number | null;
  headingLevel?: 1 | 2;
  interactive?: boolean;
  onSelect: (index: number) => void;
  onSelectEnding: () => void;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  return (
    <section
      className={`${styles.page} ${styles.contentsPage}`}
      aria-label={copy.contents}
      data-sauge-static-page="contents"
    >
      <SaugeNoireBotanical className={styles.contentsBotanical} />
      <Heading data-sauge-typography-role="title">{copy.contents}</Heading>
      <Rule />
      <p className={styles.instruction} data-sauge-static-element="instruction">{copy.touchSection}</p>
      <nav className={styles.contentsList} aria-label={copy.contents}>
        {categories.map((category, index) => (
          <button
            type="button"
            key={category.id}
            className={activePage === index ? styles.contentsActive : ""}
            disabled={!interactive}
            onClick={interactive ? () => onSelect(index) : undefined}
          >
            <span>{category.label}</span>
            <b>{String(index + 1).padStart(2, "0")}</b>
          </button>
        ))}
        <button
          type="button"
          disabled={!interactive}
          onClick={interactive ? onSelectEnding : undefined}
        >
          <span>{copy.thanks}</span>
          <b>08</b>
        </button>
      </nav>
      <PageFooter
        copy={copy.swipeSection}
        interactive={interactive}
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
  headingLevel = 1,
  onPrevious,
  onNext,
  isPreview = false,
  disableNavigation = false,
  onDishLinkClick,
  onDishLinkIntent
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
  headingLevel?: 1 | 2;
  onPrevious: () => void;
  onNext: () => void;
  isPreview?: boolean;
  disableNavigation?: boolean;
  onDishLinkClick?: (
    event: MouseEvent<HTMLAnchorElement>,
    href: string,
    targetDish: PublicMenuDish
  ) => void;
  onDishLinkIntent?: (href: string, targetDish: PublicMenuDish) => void;
}) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
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
        <Heading data-sauge-typography-role="title">{category.label.toUpperCase()}</Heading>
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
          disableNavigation={disableNavigation}
          onDishLinkClick={onDishLinkClick}
          onDishLinkIntent={onDishLinkIntent}
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
            disableNavigation={disableNavigation}
            onDishLinkClick={onDishLinkClick}
            onDishLinkIntent={onDishLinkIntent}
          />
        ))}
      </div>
      <PageFooter
        copy={copy.swipePage}
        interactive={!disableNavigation}
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
  disableNavigation = false,
  onDishLinkClick,
  onDishLinkIntent
}: {
  menu: PublicMenu;
  dish: PublicMenuDish;
  locale: Locale;
  currency: string;
  copy: Pick<SaugeNoirePageCopy, "menu">;
  query: PublicMenuContextQuery;
  exchangeRates?: MenuExchangeRates;
  variant: "compact" | "editorial" | "split";
  isPreview?: boolean;
  disableNavigation?: boolean;
  onDishLinkClick?: (
    event: MouseEvent<HTMLAnchorElement>,
    href: string,
    targetDish: PublicMenuDish
  ) => void;
  onDishLinkIntent?: (href: string, targetDish: PublicMenuDish) => void;
}) {
  const href = buildPublicDishPath(menu.slug, dish.slug, query);
  const className = `${styles.featureCard} ${styles[`feature${variant[0].toUpperCase()}${variant.slice(1)}`]}`;
  const content = (
    <>
      <PhotoSlot dish={dish} large />
      <div className={styles.featureCopy}>
        <div className={styles.featureTitle}>
          <h2>{dish.name}</h2>
          {dish.has3d ? <SaugeNoire3dIndicator label={threeDLabel(locale)} /> : null}
        </div>
        {variant !== "compact" && dish.description ? <p>{dish.description}</p> : null}
        <Rule />
        <strong
          data-sauge-visible-price="true"
          data-rendered-currency={currency}
          data-sauge-typography-role="price"
        >
          {formatDishPrice(dish, currency, locale, exchangeRates)}
        </strong>
      </div>
      <span className={styles.srOnly}>{copy.menu}</span>
    </>
  );

  return disableNavigation ? (
    <span
      className={className}
      data-sauge-featured-dish="true"
      data-dish-id={dish.id}
      data-comparison-static-control="true"
    >
      {content}
    </span>
  ) : (
    <Link
      href={href}
      prefetch={false}
      className={className}
      data-sauge-featured-dish="true"
      data-dish-id={dish.id}
      tabIndex={isPreview ? -1 : undefined}
      onClick={
        isPreview
          ? (event) => event.preventDefault()
          : (event) => onDishLinkClick?.(event, href, dish)
      }
      onPointerEnter={() => onDishLinkIntent?.(href, dish)}
      onFocus={() => onDishLinkIntent?.(href, dish)}
      onPointerDown={() => onDishLinkIntent?.(href, dish)}
      onTouchStart={() => onDishLinkIntent?.(href, dish)}
    >
      {content}
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
  disableNavigation = false,
  onDishLinkClick,
  onDishLinkIntent
}: {
  menu: PublicMenu;
  dish: PublicMenuDish;
  locale: Locale;
  currency: string;
  query: PublicMenuContextQuery;
  exchangeRates?: MenuExchangeRates;
  compact: boolean;
  isPreview?: boolean;
  disableNavigation?: boolean;
  onDishLinkClick?: (
    event: MouseEvent<HTMLAnchorElement>,
    href: string,
    targetDish: PublicMenuDish
  ) => void;
  onDishLinkIntent?: (href: string, targetDish: PublicMenuDish) => void;
}) {
  const href = buildPublicDishPath(menu.slug, dish.slug, query);
  const className = `${styles.dishRow} ${compact ? styles.dishRowCompact : ""}`;
  const content = (
    <>
      <PhotoSlot dish={dish} />
      <span className={styles.dishRowName}>
        <span>{dish.name}</span>
        {dish.has3d ? <SaugeNoire3dIndicator label={threeDLabel(locale)} /> : null}
      </span>
      <span
        className={styles.dishRowPrice}
        data-sauge-visible-price="true"
        data-rendered-currency={currency}
        data-sauge-typography-role="price"
      >
        {formatDishPrice(dish, currency, locale, exchangeRates)}
      </span>
    </>
  );

  return disableNavigation ? (
    <span
      className={className}
      data-sauge-dish-row="true"
      data-dish-id={dish.id}
      data-comparison-static-control="true"
    >
      {content}
    </span>
  ) : (
    <Link
      href={href}
      prefetch={false}
      className={className}
      data-sauge-dish-row="true"
      data-dish-id={dish.id}
      tabIndex={isPreview ? -1 : undefined}
      onClick={
        isPreview
          ? (event) => event.preventDefault()
          : (event) => onDishLinkClick?.(event, href, dish)
      }
      onPointerEnter={() => onDishLinkIntent?.(href, dish)}
      onFocus={() => onDishLinkIntent?.(href, dish)}
      onPointerDown={() => onDishLinkIntent?.(href, dish)}
      onTouchStart={() => onDishLinkIntent?.(href, dish)}
    >
      {content}
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
  const isPhysicalPageMedia = useSaugeNoirePhysicalPageMedia();
  // Feature cards and rows are list surfaces; keep the detail-only display
  // derivative out of the initial menu payload. The detail route owns the
  // full-size image separately.
  const cardImageUrl = dish.thumbnailUrl || dish.imageUrl;
  return (
    <span className={`${styles.photoSlot} ${large ? styles.photoSlotLarge : ""}`} data-photo-slot={dish.slug}>
      {cardImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`${cardImageUrl}:${isPhysicalPageMedia ? "physical" : "canonical"}`}
          src={isPhysicalPageMedia ? undefined : cardImageUrl}
          data-sauge-deferred-src={
            isPhysicalPageMedia ? cardImageUrl : undefined
          }
          alt=""
          loading={isPhysicalPageMedia ? "lazy" : large ? "eager" : "lazy"}
          fetchPriority={
            isPhysicalPageMedia ? "low" : large ? "high" : "low"
          }
        />
      ) : null}
    </span>
  );
}

export function EndingPage({
  copy,
  headingLevel = 1,
  interactive = true,
  onRestart,
  showGoogleReview = true
}: {
  copy: SaugeNoirePageCopy;
  headingLevel?: 1 | 2;
  interactive?: boolean;
  onRestart: () => void;
  showGoogleReview?: boolean;
}) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  return (
    <section
      className={`${styles.page} ${styles.endingPage}`}
      aria-label={copy.thanks}
      data-sauge-static-page="ending"
    >
      <Heading>{copy.thanks.toUpperCase()}</Heading>
      <SaugeNoireBotanical className={styles.endingBotanical} />
      <div className={styles.endingWordmark} data-sauge-static-element="wordmark">SAUGE<br />NOIRE</div>
      <p data-sauge-static-element="tagline">{copy.tagline}</p>
      <Rule />
      <p className={styles.endingCity} data-sauge-static-element="city">Montréal, Québec</p>
      <span className={styles.coverDot} aria-hidden="true" data-sauge-static-element="dot" />
      {showGoogleReview ? (
        <button
          type="button"
          className={styles.googleReviewCta}
          data-testid="google-review-cta"
          aria-label={copy.googleReviewAria}
          disabled={!interactive}
        >
          <span className={styles.googleReviewBrand}>
            <span className={styles.googleReviewMark} data-testid="google-review-mark" aria-hidden="true">G</span>
            {copy.googleReview}
          </span>
          <span className={styles.googleReviewArrow} data-testid="google-review-arrow" aria-hidden="true">
            <svg viewBox="0 0 20 20" focusable="false">
              <path d="M4 16 16 4M8 4h8v8" />
            </svg>
          </span>
        </button>
      ) : null}
      <button
        type="button"
        className={styles.restartButton}
        disabled={!interactive}
        onClick={interactive ? onRestart : undefined}
        data-sauge-static-element="restart"
      >
        {copy.menu}
      </button>
      <p className={styles.endingSoon} data-sauge-static-element="message">{copy.soon}</p>
    </section>
  );
}

function PageFooter({
  copy,
  interactive = true,
  previousLabel,
  nextLabel,
  onPrevious,
  onNext
}: {
  copy: string;
  interactive?: boolean;
  previousLabel: string;
  nextLabel: string;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <footer className={styles.pageFooter} data-sauge-static-element="footer">
      <Rule />
      <p>{copy}</p>
      <div className={styles.doubleArrowControl}>
        <button
          type="button"
          className={`${styles.arrowHit} ${styles.arrowHitPrevious}`}
          disabled={!interactive}
          onClick={interactive ? onPrevious : undefined}
          aria-label={previousLabel}
          data-sauge-static-element="previous-control"
        />
        <DoubleArrow />
        <button
          type="button"
          className={`${styles.arrowHit} ${styles.arrowHitNext}`}
          disabled={!interactive}
          onClick={interactive ? onNext : undefined}
          aria-label={nextLabel}
          data-sauge-static-element="next-control"
        />
      </div>
    </footer>
  );
}

function DoubleArrow() {
  return (
    <svg className={styles.doubleArrow} viewBox="0 0 48 20" aria-hidden="true" focusable="false" data-sauge-static-element="double-arrow">
      <path d="M1 10h46M7 4l-6 6 6 6M41 4l6 6-6 6" />
    </svg>
  );
}

function Arrow() {
  return (
    <svg className={styles.arrow} viewBox="0 0 48 20" aria-hidden="true" focusable="false" data-sauge-static-element="arrow">
      <path d="M1 10h42M34 2l10 8-10 8" />
    </svg>
  );
}
