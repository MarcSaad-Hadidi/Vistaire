from pathlib import Path
import re

ROOT = Path.cwd()


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, text: str) -> None:
    (ROOT / path).write_text(text, encoding="utf-8")


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one exact match, found {count}: {old[:100]!r}")
    write(path, text.replace(old, new, 1))


def regex_once(path: str, pattern: str, replacement: str) -> None:
    text = read(path)
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f"{path}: expected one regex match, found {count}: {pattern[:100]!r}")
    write(path, updated)


MENU = "components/menu/MaisonElyseQrMenu.tsx"
DETAIL = "components/menu/MaisonElyseDishDetail.tsx"
CONTEXT = "lib/menu/publicMenuRenderContext.ts"
MENU_ROUTE = "app/(fr)/menu/[slug]/page.tsx"
DISH_ROUTE = "app/(fr)/menu/[slug]/dishes/[dishSlug]/page.tsx"
SAUGE = "components/menu/unique/sauge-noire/SaugeNoireBookMenu.tsx"
LOCALE_TEST = "tests/maison-elyse-locales.test.mjs"
SOURCE_TEST = "tests/maison-elyse-qr-menu-source.test.mjs"
NEW_TEST = "tests/maison-elyse-i18n-currency-rtl.test.mjs"

# ---------------- Maison menu: imports / contracts ----------------
replace_once(
    MENU,
    'import { trackPublicMenuEvent } from "@/lib/analytics/client";\n',
    'import { trackPublicMenuEvent } from "@/lib/analytics/client";\n'
    'import type { MenuExchangeRates } from "@/lib/currency/formatMenuPrice";\n',
)
replace_once(
    MENU,
    '  getMaisonElyseCategoryKind,\n'
    '  getMaisonElyseCategoryLabel,\n'
    '  getMaisonElyseLanguageOptions,\n'
    '  getMaisonElyseTextDirection,\n',
    '  getMaisonElyseCategoryEditorial,\n'
    '  getMaisonElyseCategoryKind,\n'
    '  getMaisonElyseCategoryLabel,\n'
    '  getMaisonElyseEditorialCopy,\n'
    '  getMaisonElyseLanguageOptions,\n'
    '  getMaisonElyseTextDirection,\n',
)
replace_once(
    MENU,
    'import type { MenuUiConfig } from "@/lib/menu/menuUiConfig";\n'
    'import styles from "./MaisonElyseQrMenu.module.css";\n',
    'import type { MenuUiConfig } from "@/lib/menu/menuUiConfig";\n'
    'import {\n'
    '  TROUVABLE_CURRENCY_STORAGE_KEY,\n'
    '  formatTrouvableDishPrice,\n'
    '  getTrouvableCurrencyOption,\n'
    '  getTrouvableCurrencyOptionLabel,\n'
    '  getTrouvableCurrencyOptions,\n'
    '  normalizeTrouvableCurrency,\n'
    '  type TrouvableCurrency\n'
    '} from "./trouvableMenuControls";\n'
    'import styles from "./MaisonElyseQrMenu.module.css";\n',
)
regex_once(
    MENU,
    r'const PhonePreviewDishDetailFr = dynamic\([\s\S]*?const ALLOWED_3D_CDN_ORIGINS',
    'const PhonePreviewDishDetail = dynamic(loadPhonePreviewDishDetail, {\n'
    '  ssr: false,\n'
    '  loading: () => null\n'
    '});\n\n'
    'const ALLOWED_3D_CDN_ORIGINS',
)
replace_once(
    MENU,
    'type MaisonElyseQrMenuProps = {\n  menu: PublicMenu;\n',
    'type MaisonElyseQrMenuProps = {\n  menu: PublicMenu;\n  exchangeRates?: MenuExchangeRates;\n',
)
replace_once(
    MENU,
    'type SheetId = "menu" | "filter" | "language" | null;',
    'type SheetId = "menu" | "filter" | "language" | "currency" | null;',
)

# Replace the local FR/EN-only copy pack with a typed projection of shared + Maison copy.
regex_once(
    MENU,
    r'const MENU_COPY: Record<[\s\S]*?type MaisonMenuCopy = \(typeof MENU_COPY\)\["fr"\];',
    '''type MaisonMenuCopy = {\n'
    '  activeFilterPrefix: string;\n'
    '  allMenu: string;\n'
    '  apply: string;\n'
    '  backToTop: string;\n'
    '  bottomFilter: string;\n'
    '  bottomMenu: string;\n'
    '  close: string;\n'
    '  collectionBody: string;\n'
    '  collectionKicker: string;\n'
    '  collectionTitle: string;\n'
    '  currencyDialogLabel: string;\n'
    '  currencyKicker: string;\n'
    '  currencyToggleAria: string;\n'
    '  dishDetails: string;\n'
    '  emptySelection: string;\n'
    '  filterDialogLabel: string;\n'
    '  filterFallback: string;\n'
    '  filterGroupLabel: string;\n'
    '  languageDialogLabel: string;\n'
    '  languageToggleAria: string;\n'
    '  menuDialogLabel: string;\n'
    '  menuToggleAria: string;\n'
    '  navAria: string;\n'
    '  preferences: string;\n'
    '  recommendation: string;\n'
    '  signature: string;\n'
    '  immersiveFilterLabel: string;\n'
    '  available: string;\n'
    '  reset: string;\n'
    '  resetFilters: string;\n'
    '  sections: string;\n'
    '  sheetNavigation: string;\n'
    '  unavailableBadge: string;\n'
    '};'''.replace("'\n    '", ""),
)
regex_once(
    MENU,
    r'function buildMaisonMenuCopy\([\s\S]*?\n}\n\nfunction normalizeText',
    '''function buildMaisonMenuCopy(\n'
    '  locale: PublicMenuLocale,\n'
    '  localizedUiCopy?: Record<string, unknown>\n'
    '): MaisonMenuCopy {\n'
    '  const resolved = resolveMaisonElyseCopy(locale, localizedUiCopy).copy;\n'
    '  const editorial = getMaisonElyseEditorialCopy(locale);\n'
    '  return {\n'
    '    activeFilterPrefix: resolved.activeFilterPrefix,\n'
    '    allMenu: editorial.allMenu,\n'
    '    apply: resolved.filterApply,\n'
    '    backToTop: resolved.backToTop,\n'
    '    bottomFilter: resolved.filterButton,\n'
    '    bottomMenu: editorial.bottomMenu,\n'
    '    close: resolved.close,\n'
    '    collectionBody: editorial.collectionBody,\n'
    '    collectionKicker: editorial.collectionKicker,\n'
    '    collectionTitle: editorial.collectionTitle,\n'
    '    currencyDialogLabel: resolved.currencyTitle,\n'
    '    currencyKicker: resolved.currencyKicker,\n'
    '    currencyToggleAria: resolved.currencyAria,\n'
    '    dishDetails: resolved.viewDetails,\n'
    '    emptySelection: resolved.noResultsTitle,\n'
    '    filterDialogLabel: editorial.filterDialogLabel,\n'
    '    filterFallback: resolved.filterFallback,\n'
    '    filterGroupLabel: resolved.filterGroupLabel,\n'
    '    languageDialogLabel: resolved.languageTitle,\n'
    '    languageToggleAria: resolved.languageAria,\n'
    '    menuDialogLabel: editorial.menuDialogLabel,\n'
    '    menuToggleAria: editorial.menuToggleAria,\n'
    '    navAria: editorial.navAria,\n'
    '    preferences: resolved.languageKicker,\n'
    '    recommendation: resolved.recommendation,\n'
    '    signature: resolved.signature,\n'
    '    immersiveFilterLabel: resolved.immersiveFilterLabel,\n'
    '    available: resolved.available,\n'
    '    reset: resolved.reset,\n'
    '    resetFilters: resolved.resetFilters,\n'
    '    sections: resolved.categories,\n'
    '    sheetNavigation: resolved.categories,\n'
    '    unavailableBadge: resolved.soldOut\n'
    '  };\n'
    '}\n\n'
    'function normalizeText'''.replace("'\n    '", ""),
)
replace_once(
    MENU,
    'function displayCategoryLabel(label: string, locale: PublicMenuLocale = "fr-CA"): string {\n'
    '  return getMaisonElyseCategoryLabel(label, locale);\n'
    '}\n',
    'function displayCategoryLabel(\n'
    '  category: Pick<PublicMenuCategory, "label" | "slug">,\n'
    '  locale: PublicMenuLocale = "fr-CA"\n'
    '): string {\n'
    '  return getMaisonElyseCategoryLabel(category, locale);\n'
    '}\n',
)
regex_once(
    MENU,
    r'function categoryEditorial\([\s\S]*?\n}\n\nfunction personalizeBranding',
    'function categoryEditorial(\n'
    '  category: Pick<PublicMenuCategory, "label" | "slug">,\n'
    '  locale: PublicMenuLocale = "fr-CA"\n'
    '): { kicker: string; title: string; description: string } {\n'
    '  return getMaisonElyseCategoryEditorial(category, locale);\n'
    '}\n\n'
    'function personalizeBranding',
)
replace_once(
    MENU,
    'function getStoredMenuLocale(): PublicMenuLocale | null {\n'
    '  if (typeof window === "undefined") return null;\n\n'
    '  try {\n'
    '    const storedLocale = window.localStorage.getItem(MENU_LOCALE_STORAGE_KEY);\n'
    '    return storedLocale ? normalizePublicMenuLocale(storedLocale) : null;\n'
    '  } catch {\n'
    '    return null;\n'
    '  }\n'
    '}\n',
    'function getStoredMenuLocale(): PublicMenuLocale | null {\n'
    '  if (typeof window === "undefined") return null;\n\n'
    '  try {\n'
    '    const storedLocale = window.localStorage.getItem(MENU_LOCALE_STORAGE_KEY);\n'
    '    return storedLocale ? normalizePublicMenuLocale(storedLocale) : null;\n'
    '  } catch {\n'
    '    return null;\n'
    '  }\n'
    '}\n\n'
    'function getStoredMenuCurrency(\n'
    '  settings: PublicMenu["settings"]\n'
    '): TrouvableCurrency | null {\n'
    '  if (typeof window === "undefined") return null;\n'
    '  try {\n'
    '    const stored = window.localStorage.getItem(TROUVABLE_CURRENCY_STORAGE_KEY);\n'
    '    return stored ? normalizeTrouvableCurrency(stored, settings) : null;\n'
    '  } catch {\n'
    '    return null;\n'
    '  }\n'
    '}\n',
)
replace_once(
    MENU,
    'function categoryRank(label: string): number {\n'
    '  const categoryKind = getMaisonElyseCategoryKind(label);\n'
    '  if (categoryKind === "starter") return 0;\n'
    '  if (categoryKind === "signature") return 1;\n'
    '  if (categoryKind === "dessert") return 2;\n'
    '  if (categoryKind === "cocktail" || categoryKind === "drink") return 3;\n'
    '  return 99;\n'
    '}\n\n'
    'function categorySort(a: PublicMenuCategory, b: PublicMenuCategory): number {\n'
    '  return categoryRank(a.label) - categoryRank(b.label);\n'
    '}\n',
    'function categoryRank(category: Pick<PublicMenuCategory, "label" | "slug">): number {\n'
    '  const categoryKind = getMaisonElyseCategoryKind(category);\n'
    '  if (categoryKind === "starter") return 0;\n'
    '  if (categoryKind === "signature") return 1;\n'
    '  if (categoryKind === "dessert") return 2;\n'
    '  if (categoryKind === "cocktail" || categoryKind === "drink") return 3;\n'
    '  return 99;\n'
    '}\n\n'
    'function categorySort(a: PublicMenuCategory, b: PublicMenuCategory): number {\n'
    '  return categoryRank(a) - categoryRank(b);\n'
    '}\n',
)
replace_once(
    MENU,
    'function isSignatureDish(dish: PublicMenuDish): boolean {\n'
    '  return (\n'
    '    normalizeText(dish.category).includes("signature") ||\n'
    '    dish.tags.some((tag) => normalizeText(tag).includes("signature"))\n'
    '  );\n'
    '}\n\n'
    'function isRecommendedDish(dish: PublicMenuDish): boolean {\n'
    '  return dish.tags.some((tag) => {\n'
    '    const normalized = normalizeText(tag);\n'
    '    return normalized.includes("recommande") || normalized.includes("recommended");\n'
    '  });\n'
    '}\n',
    'function isSignatureDish(dish: PublicMenuDish): boolean {\n'
    '  if (dish.isSignature) return true;\n'
    '  if (\n'
    '    getMaisonElyseCategoryKind({\n'
    '      label: dish.category,\n'
    '      slug: dish.categorySlug\n'
    '    }) === "signature"\n'
    '  ) {\n'
    '    return true;\n'
    '  }\n'
    '  return dish.tags.some((tag) => normalizeText(tag).includes("signature"));\n'
    '}\n\n'
    'function isRecommendedDish(dish: PublicMenuDish): boolean {\n'
    '  if (dish.isRecommended) return true;\n'
    '  return dish.tags.some((tag) => {\n'
    '    const normalized = normalizeText(tag);\n'
    '    return normalized.includes("recommande") || normalized.includes("recommended");\n'
    '  });\n'
    '}\n',
)
replace_once(
    MENU,
    'function dishBadges(dish: PublicMenuDish, locale: PublicMenuLocale): string[] {\n'
    '  const copy = MENU_COPY[localeLanguage(locale) === "fr" ? "fr" : "en"];\n'
    '  const badges: string[] = [];\n'
    '  if (isSignatureDish(dish)) badges.push("Signature");\n'
    '  if (isRecommendedDish(dish)) badges.push(copy.recommendedBadge);\n'
    '  if (hasReal3d(dish)) badges.push("3D");\n'
    '  if (hasRealAr(dish)) badges.push("AR");\n'
    '  if (!dish.available) badges.push(copy.unavailableBadge);\n'
    '  return badges.slice(0, 4);\n'
    '}\n',
    'function dishBadges(dish: PublicMenuDish, copy: MaisonMenuCopy): string[] {\n'
    '  const badges: string[] = [];\n'
    '  if (isSignatureDish(dish)) badges.push(copy.signature);\n'
    '  if (isRecommendedDish(dish)) badges.push(copy.recommendation);\n'
    '  if (hasReal3d(dish)) badges.push("3D");\n'
    '  if (hasRealAr(dish)) badges.push("AR");\n'
    '  if (!dish.available) badges.push(copy.unavailableBadge);\n'
    '  return Array.from(new Set(badges)).slice(0, 4);\n'
    '}\n',
)
regex_once(
    MENU,
    r'export function MaisonElyseDishCard\(\{[\s\S]*?  const content = \(',
    '''export function MaisonElyseDishCard({\n'
    '  copy,\n'
    '  currency,\n'
    '  disableNavigation = false,\n'
    '  dish,\n'
    '  exchangeRates,\n'
    '  locale,\n'
    '  menu,\n'
    '  onSelectDish,\n'
    '  query\n'
    '}: {\n'
    '  copy: MaisonMenuCopy;\n'
    '  currency: TrouvableCurrency;\n'
    '  disableNavigation?: boolean;\n'
    '  dish: PublicMenuDish;\n'
    '  exchangeRates?: MenuExchangeRates;\n'
    '  locale: PublicMenuLocale;\n'
    '  menu: PublicMenu;\n'
    '  onSelectDish?: (dish: PublicMenuDish) => void;\n'
    '  query?: PublicMenuContextQuery;\n'
    '}) {\n'
    '  const badges = dishBadges(dish, copy);\n'
    '  const textDirection = getMaisonElyseTextDirection(locale);\n'
    '  const priceLabel = formatTrouvableDishPrice(\n'
    '    dish,\n'
    '    currency,\n'
    '    locale,\n'
    '    exchangeRates\n'
    '  );\n'
    '  const href = buildPublicDishPath(menu.slug, dish.slug, query);\n'
    '  const ariaLabel = `${dish.name}. ${priceLabel || ""} ${copy.dishDetails}`;\n'
    '  const content = ('''.replace("'\n    '", ""),
)
replace_once(
    MENU,
    '        {dish.priceLabel ? (\n'
    '          <strong className={styles.dishPrice}>{dish.priceLabel}</strong>\n'
    '        ) : null}\n',
    '        {priceLabel ? (\n'
    '          <strong className={styles.dishPrice}>{priceLabel}</strong>\n'
    '        ) : null}\n',
)
replace_once(
    MENU,
    'function DishSection({\n'
    '  category,\n'
    '  descriptionDishes,\n'
    '  disableNavigation = false,\n'
    '  dishes,\n'
    '  locale,\n'
    '  menu,\n'
    '  onSelectDish,\n'
    '  query\n'
    '}: {\n'
    '  category: PublicMenuCategory;\n'
    '  descriptionDishes: PublicMenuDish[];\n'
    '  disableNavigation?: boolean;\n'
    '  dishes: PublicMenuDish[];\n'
    '  locale: PublicMenuLocale;\n'
    '  menu: PublicMenu;\n'
    '  onSelectDish?: (dish: PublicMenuDish) => void;\n'
    '  query?: PublicMenuContextQuery;\n'
    '}) {\n',
    'function DishSection({\n'
    '  category,\n'
    '  copy,\n'
    '  currency,\n'
    '  descriptionDishes,\n'
    '  disableNavigation = false,\n'
    '  dishes,\n'
    '  exchangeRates,\n'
    '  locale,\n'
    '  menu,\n'
    '  onSelectDish,\n'
    '  query\n'
    '}: {\n'
    '  category: PublicMenuCategory;\n'
    '  copy: MaisonMenuCopy;\n'
    '  currency: TrouvableCurrency;\n'
    '  descriptionDishes: PublicMenuDish[];\n'
    '  disableNavigation?: boolean;\n'
    '  dishes: PublicMenuDish[];\n'
    '  exchangeRates?: MenuExchangeRates;\n'
    '  locale: PublicMenuLocale;\n'
    '  menu: PublicMenu;\n'
    '  onSelectDish?: (dish: PublicMenuDish) => void;\n'
    '  query?: PublicMenuContextQuery;\n'
    '}) {\n',
)
replace_once(
    MENU,
    '  const editorial = personalizeBranding(\n'
    '    categoryEditorial(category.label, locale),\n'
    '    menu.name\n'
    '  );\n',
    '  const editorial = personalizeBranding(\n'
    '    categoryEditorial(category, locale),\n'
    '    menu.name\n'
    '  );\n',
)
replace_once(
    MENU,
    '          <MaisonElyseDishCard\n'
    '            disableNavigation={disableNavigation}\n'
    '            dish={dish}\n'
    '            key={dish.id}\n'
    '            locale={locale}\n'
    '            menu={menu}\n'
    '            onSelectDish={onSelectDish}\n'
    '            query={query}\n'
    '          />\n',
    '          <MaisonElyseDishCard\n'
    '            copy={copy}\n'
    '            currency={currency}\n'
    '            disableNavigation={disableNavigation}\n'
    '            dish={dish}\n'
    '            exchangeRates={exchangeRates}\n'
    '            key={dish.id}\n'
    '            locale={locale}\n'
    '            menu={menu}\n'
    '            onSelectDish={onSelectDish}\n'
    '            query={query}\n'
    '          />\n',
)
replace_once(
    MENU,
    'export function MaisonElyseQrMenu({\n'
    '  displayMode = "public",\n',
    'export function MaisonElyseQrMenu({\n'
    '  displayMode = "public",\n'
    '  exchangeRates,\n',
)
replace_once(
    MENU,
    '  const activeLocale = localeResolution.locale;\n'
    '  const activeMenu = localeResolution.menu;\n'
    '  const restaurantDisplayName = activeMenu.name.trim() || "Restaurant";\n',
    '  const activeLocale = localeResolution.locale;\n'
    '  const activeMenu = localeResolution.menu;\n'
    '  const queryCurrency = query?.currency?.toString().trim()\n'
    '    ? normalizeTrouvableCurrency(query.currency, activeMenu.settings)\n'
    '    : null;\n'
    '  const [selectedCurrency, setSelectedCurrency] = useState<TrouvableCurrency>(\n'
    '    () =>\n'
    '      queryCurrency ??\n'
    '      normalizeTrouvableCurrency(undefined, menu.settings)\n'
    '  );\n'
    '  const [shouldPersistCurrencyInLinks, setShouldPersistCurrencyInLinks] =\n'
    '    useState(() => Boolean(queryCurrency));\n'
    '  const activeCurrency = normalizeTrouvableCurrency(\n'
    '    selectedCurrency,\n'
    '    activeMenu.settings\n'
    '  );\n'
    '  const restaurantDisplayName = activeMenu.name.trim() || "Restaurant";\n',
)
replace_once(
    MENU,
    '  const languageOptions = useMemo<MaisonElyseLanguageOption[]>(\n'
    '    () =>\n'
    '      getMaisonElyseLanguageOptions(\n'
    '        activeMenu.settings,\n'
    '        activeMenu.translationLocales\n'
    '      ),\n'
    '    [activeMenu.settings, activeMenu.translationLocales]\n'
    '  );\n'
    '  const activeQuery = useMemo(\n'
    '    () =>\n'
    '      shouldPersistLocaleInLinks\n'
    '        ? {\n'
    '            ...(query ?? {}),\n'
    '            lang: activeLocale\n'
    '          }\n'
    '        : query,\n'
    '    [activeLocale, query, shouldPersistLocaleInLinks]\n'
    '  );\n',
    '  const languageOptions = useMemo<MaisonElyseLanguageOption[]>(\n'
    '    () =>\n'
    '      getMaisonElyseLanguageOptions(\n'
    '        activeMenu.settings,\n'
    '        activeMenu.translationLocales\n'
    '      ),\n'
    '    [activeMenu.settings, activeMenu.translationLocales]\n'
    '  );\n'
    '  const currencyOptions = useMemo(\n'
    '    () => getTrouvableCurrencyOptions(activeMenu.settings),\n'
    '    [activeMenu.settings]\n'
    '  );\n'
    '  const canChangeCurrency =\n'
    '    activeMenu.settings.allowCurrencySelector && currencyOptions.length > 1;\n'
    '  const activeQuery = useMemo(() => {\n'
    '    const nextQuery: PublicMenuContextQuery = { ...(query ?? {}) };\n'
    '    if (shouldPersistLocaleInLinks) nextQuery.lang = activeLocale;\n'
    '    if (shouldPersistCurrencyInLinks) nextQuery.currency = activeCurrency;\n'
    '    return nextQuery;\n'
    '  }, [\n'
    '    activeCurrency,\n'
    '    activeLocale,\n'
    '    query,\n'
    '    shouldPersistCurrencyInLinks,\n'
    '    shouldPersistLocaleInLinks\n'
    '  ]);\n',
)
# Restore stored currency only when URL has no explicit currency.
replace_once(
    MENU,
    '  useEffect(() => {\n'
    '    if (displayMode !== "public") return;\n\n'
    '    const handleHistoryNavigation = () => {\n'
    '      const rawLocale = new URL(window.location.href).searchParams.get("lang");\n'
    '      if (!rawLocale?.trim()) {\n'
    '        manualLocaleRef.current = null;\n'
    '        lastSeenQueryLocaleRef.current = null;\n'
    '        return;\n'
    '      }\n'
    '      applyExplicitLocale(normalizePublicMenuLocale(rawLocale));\n'
    '    };\n\n'
    '    window.addEventListener("popstate", handleHistoryNavigation);\n'
    '    return () => window.removeEventListener("popstate", handleHistoryNavigation);\n'
    '  }, [applyExplicitLocale, displayMode]);\n',
    '  useEffect(() => {\n'
    '    if (displayMode !== "public" || queryCurrency) return;\n'
    '    const storedCurrency = getStoredMenuCurrency(activeMenu.settings);\n'
    '    if (!storedCurrency || storedCurrency === activeCurrency) return;\n'
    '    setSelectedCurrency(storedCurrency);\n'
    '    setShouldPersistCurrencyInLinks(true);\n'
    '  }, [activeCurrency, activeMenu.settings, displayMode, queryCurrency]);\n\n'
    '  useEffect(() => {\n'
    '    if (displayMode !== "public") return;\n\n'
    '    const handleHistoryNavigation = () => {\n'
    '      const currentUrl = new URL(window.location.href);\n'
    '      const rawLocale = currentUrl.searchParams.get("lang");\n'
    '      if (!rawLocale?.trim()) {\n'
    '        manualLocaleRef.current = null;\n'
    '        lastSeenQueryLocaleRef.current = null;\n'
    '      } else {\n'
    '        applyExplicitLocale(normalizePublicMenuLocale(rawLocale));\n'
    '      }\n\n'
    '      const rawCurrency = currentUrl.searchParams.get("currency");\n'
    '      if (rawCurrency?.trim()) {\n'
    '        setSelectedCurrency(\n'
    '          normalizeTrouvableCurrency(rawCurrency, menu.settings)\n'
    '        );\n'
    '        setShouldPersistCurrencyInLinks(true);\n'
    '      } else {\n'
    '        setSelectedCurrency(\n'
    '          normalizeTrouvableCurrency(undefined, menu.settings)\n'
    '        );\n'
    '        setShouldPersistCurrencyInLinks(false);\n'
    '      }\n'
    '    };\n\n'
    '    window.addEventListener("popstate", handleHistoryNavigation);\n'
    '    return () => window.removeEventListener("popstate", handleHistoryNavigation);\n'
    '  }, [applyExplicitLocale, displayMode, menu.settings]);\n',
)
replace_once(
    MENU,
    '  function writeLocaleToUrl(nextLocale: PublicMenuLocale) {\n'
    '    if (displayMode !== "public") return;\n'
    '    const currentUrl = new URL(window.location.href);\n'
    '    currentUrl.searchParams.set("lang", nextLocale);\n'
    '    window.history.replaceState(\n'
    '      window.history.state,\n'
    '      "",\n'
    '      `${currentUrl.pathname}?${currentUrl.searchParams.toString()}${currentUrl.hash}`\n'
    '    );\n'
    '  }\n',
    '  function writeLocaleToUrl(nextLocale: PublicMenuLocale) {\n'
    '    if (displayMode !== "public") return;\n'
    '    const currentUrl = new URL(window.location.href);\n'
    '    currentUrl.searchParams.set("lang", nextLocale);\n'
    '    window.history.replaceState(\n'
    '      window.history.state,\n'
    '      "",\n'
    '      `${currentUrl.pathname}?${currentUrl.searchParams.toString()}${currentUrl.hash}`\n'
    '    );\n'
    '  }\n\n'
    '  function writeCurrencyToUrl(nextCurrency: TrouvableCurrency) {\n'
    '    if (displayMode !== "public") return;\n'
    '    const currentUrl = new URL(window.location.href);\n'
    '    currentUrl.searchParams.set("currency", nextCurrency);\n'
    '    window.history.replaceState(\n'
    '      window.history.state,\n'
    '      "",\n'
    '      `${currentUrl.pathname}?${currentUrl.searchParams.toString()}${currentUrl.hash}`\n'
    '    );\n'
    '  }\n',
)
replace_once(
    MENU,
    '  function toggleSheet(sheet: Exclude<SheetId, null>, trigger: HTMLButtonElement) {\n',
    '  function selectCurrency(nextCurrency: TrouvableCurrency) {\n'
    '    const normalized = normalizeTrouvableCurrency(\n'
    '      nextCurrency,\n'
    '      activeMenu.settings\n'
    '    );\n'
    '    setSelectedCurrency(normalized);\n'
    '    setShouldPersistCurrencyInLinks(true);\n'
    '    setActiveSheet(null);\n'
    '    if (displayMode === "public") {\n'
    '      try {\n'
    '        window.localStorage.setItem(\n'
    '          TROUVABLE_CURRENCY_STORAGE_KEY,\n'
    '          normalized\n'
    '        );\n'
    '      } catch {\n'
    '        // The in-memory selection is enough for this session.\n'
    '      }\n'
    '    }\n'
    '    writeCurrencyToUrl(normalized);\n'
    '  }\n\n'
    '  function toggleSheet(sheet: Exclude<SheetId, null>, trigger: HTMLButtonElement) {\n',
)
replace_once(
    MENU,
    '  function toggleLanguageSheet(trigger: HTMLButtonElement) {\n'
    '    if (isComparisonPreview) return;\n'
    '    toggleSheet("language", trigger);\n'
    '  }\n',
    '  function toggleLanguageSheet(trigger: HTMLButtonElement) {\n'
    '    if (isComparisonPreview) return;\n'
    '    toggleSheet("language", trigger);\n'
    '  }\n\n'
    '  function toggleCurrencySheet(trigger: HTMLButtonElement) {\n'
    '    if (isComparisonPreview || !canChangeCurrency) return;\n'
    '    toggleSheet("currency", trigger);\n'
    '  }\n',
)
replace_once(
    MENU,
    '  const phonePreviewDishSelect =\n'
    '    displayMode === "phone-preview" ? openDishInPhonePreview : undefined;\n'
    '  const PhonePreviewDishDetail =\n'
    '    localeLanguage(activeLocale) === "fr"\n'
    '      ? PhonePreviewDishDetailFr\n'
    '      : PhonePreviewDishDetailEn;\n'
    '  const currentLanguage =\n',
    '  const phonePreviewDishSelect =\n'
    '    displayMode === "phone-preview" ? openDishInPhonePreview : undefined;\n'
    '  const currentLanguage =\n',
)
replace_once(
    MENU,
    '  const prefersReducedMotion = usePrefersReducedMotion();\n'
    '  const textDirection = getMaisonElyseTextDirection(activeLocale);\n',
    '  const currentCurrency = getTrouvableCurrencyOption(activeCurrency);\n'
    '  const prefersReducedMotion = usePrefersReducedMotion();\n'
    '  const textDirection = getMaisonElyseTextDirection(activeLocale);\n',
)
replace_once(
    MENU,
    '  const activeSheetLabel =\n'
    '    renderedSheet === "language"\n'
    '      ? copy.languageDialogLabel\n'
    '      : renderedSheet === "menu"\n'
    '        ? copy.menuDialogLabel\n'
    '        : copy.filterDialogLabel;\n'
    '  const activeSheetKicker =\n'
    '    renderedSheet === "menu" ? copy.sheetNavigation : copy.preferences;\n',
    '  const activeSheetLabel =\n'
    '    renderedSheet === "language"\n'
    '      ? copy.languageDialogLabel\n'
    '      : renderedSheet === "currency"\n'
    '        ? copy.currencyDialogLabel\n'
    '        : renderedSheet === "menu"\n'
    '          ? copy.menuDialogLabel\n'
    '          : copy.filterDialogLabel;\n'
    '  const activeSheetKicker =\n'
    '    renderedSheet === "menu"\n'
    '      ? copy.sheetNavigation\n'
    '      : renderedSheet === "currency"\n'
    '        ? copy.currencyKicker\n'
    '        : copy.preferences;\n',
)
replace_once(
    MENU,
    '  function renderGoogleReviewCard() {\n',
    '  function renderCurrencyToggle(className = "") {\n'
    '    const label = getTrouvableCurrencyOptionLabel(\n'
    '      currentCurrency,\n'
    '      activeLocale\n'
    '    );\n'
    '    return (\n'
    '      <button\n'
    '        aria-controls={sheetDialogId}\n'
    '        aria-expanded={activeSheet === "currency"}\n'
    '        aria-label={`${copy.currencyToggleAria} (${label})`}\n'
    '        className={`${styles.languageToggle} ${className}`}\n'
    '        disabled={isComparisonPreview || !canChangeCurrency}\n'
    '        onClick={(event) => toggleCurrencySheet(event.currentTarget)}\n'
    '        type="button"\n'
    '      >\n'
    '        {currentCurrency.code}\n'
    '      </button>\n'
    '    );\n'
    '  }\n\n'
    '  function renderGoogleReviewCard() {\n',
)
replace_once(
    MENU,
    '          ) : renderedSheet === "language" ? (\n'
    '            <div className={styles.sheetList}>\n',
    '          ) : renderedSheet === "currency" ? (\n'
    '            <div className={styles.sheetList}>\n'
    '              {currencyOptions.map((option) => (\n'
    '                <button\n'
    '                  aria-pressed={activeCurrency === option.code}\n'
    '                  className={\n'
    '                    activeCurrency === option.code ? styles.isActive : undefined\n'
    '                  }\n'
    '                  key={option.code}\n'
    '                  onClick={() => selectCurrency(option.code)}\n'
    '                  type="button"\n'
    '                >\n'
    '                  <span dir={textDirection}>\n'
    '                    {getTrouvableCurrencyOptionLabel(option, activeLocale)}\n'
    '                  </span>\n'
    '                  <small>{option.code}</small>\n'
    '                </button>\n'
    '              ))}\n'
    '            </div>\n'
    '          ) : renderedSheet === "language" ? (\n'
    '            <div className={styles.sheetList}>\n',
)
replace_once(
    MENU,
    '        locale={activeLocale}\n'
    '        menu={activeMenu}\n'
    '        config={config}\n',
    '        locale={activeLocale}\n'
    '        menu={activeMenu}\n'
    '        config={config}\n'
    '        currency={activeCurrency}\n'
    '        exchangeRates={exchangeRates}\n',
)
replace_once(
    MENU,
    '      lang={activeLocale}\n      dir={textDirection}\n',
    '      lang={activeLocale}\n      dir="ltr"\n',
)
replace_once(
    MENU,
    '                  <div className={styles.menuTopbarActions}>\n'
    '                    {renderLanguageToggle()}\n',
    '                  <div className={styles.menuTopbarActions}>\n'
    '                    {renderCurrencyToggle()}\n'
    '                    {renderLanguageToggle()}\n',
)
replace_once(
    MENU,
    '<span>{displayCategoryLabel(category.label, activeLocale)}</span>',
    '<span dir={textDirection}>{displayCategoryLabel(category, activeLocale)}</span>',
)
# Add price/copy props to every DishSection call in the main renderer.
text = read(MENU)
old = '                        disableNavigation={isComparisonPreview}\n                        dishes='
new = (
    '                        copy={copy}\n'
    '                        currency={activeCurrency}\n'
    '                        disableNavigation={isComparisonPreview}\n'
    '                        exchangeRates={exchangeRates}\n'
    '                        dishes='
)
count = text.count(old)
if count != 2:
    raise RuntimeError(f"{MENU}: expected two DishSection render matches, found {count}")
write(MENU, text.replace(old, new))

# ---------------- Maison detail ----------------
replace_once(
    DETAIL,
    'import type {\n  DishModelViewerCopy,\n  DishModelViewerProps\n} from "@/components/dish/DishModelViewer";\n',
    'import type {\n  DishModelViewerCopy,\n  DishModelViewerProps\n} from "@/components/dish/DishModelViewer";\n'
    'import type { MenuExchangeRates } from "@/lib/currency/formatMenuPrice";\n',
)
replace_once(
    DETAIL,
    '  getMaisonElyseCategoryLabel,\n'
    '  getMaisonElyseTextDirection,\n'
    '  resolveMaisonElyseCopy\n',
    '  getMaisonElyseCategoryKind,\n'
    '  getMaisonElyseCategoryLabel,\n'
    '  getMaisonElyseEditorialCopy,\n'
    '  getMaisonElyseTextDirection,\n'
    '  resolveMaisonElyseCopy\n',
)
replace_once(
    DETAIL,
    'import { maisonElyseThemeStyle } from "@/lib/menu/maisonElyseTheme";\n'
    'import styles from "./MaisonElyseDishDetail.module.css";\n',
    'import { maisonElyseThemeStyle } from "@/lib/menu/maisonElyseTheme";\n'
    'import {\n'
    '  formatTrouvableDishPrice,\n'
    '  normalizeTrouvableCurrency,\n'
    '  type TrouvableCurrency\n'
    '} from "./trouvableMenuControls";\n'
    'import styles from "./MaisonElyseDishDetail.module.css";\n',
)
regex_once(
    DETAIL,
    r'const LazyDishModelViewerFr = dynamic<DishModelViewerProps>\([\s\S]*?type MaisonElyseDishDetailProps',
    'const LazyDishModelViewer = dynamic<DishModelViewerProps>(loadDishModelViewer, {\n'
    '  ssr: false,\n'
    '  loading: () => null\n'
    '});\n\n'
    'type MaisonElyseDishDetailProps',
)
replace_once(
    DETAIL,
    '  config?: MenuUiConfig;\n  onBackToMenu?: () => void;\n',
    '  config?: MenuUiConfig;\n'
    '  currency?: TrouvableCurrency;\n'
    '  exchangeRates?: MenuExchangeRates;\n'
    '  onBackToMenu?: () => void;\n',
)
regex_once(
    DETAIL,
    r'const DETAIL_COPY: Record<[\s\S]*?\n};\n\nfunction cleanDisplayText',
    'function cleanDisplayText',
)
regex_once(
    DETAIL,
    r'function localeLanguage\([\s\S]*?\n}\n\nfunction categoryLabel',
    'function categoryLabel',
)
replace_once(
    DETAIL,
    'function categoryLabel(category: string, locale: PublicMenuLocale): string {\n'
    '  const cleaned = cleanDisplayText(category);\n'
    '  return (\n'
    '    getMaisonElyseCategoryLabel(cleaned, locale) ||\n'
    '    DETAIL_COPY[localeLanguage(locale) === "fr" ? "fr" : "en"].noCategory\n'
    '  );\n'
    '}\n',
    'function categoryLabel(dish: PublicMenuDish, locale: PublicMenuLocale): string {\n'
    '  const category = {\n'
    '    label: cleanDisplayText(dish.category),\n'
    '    slug: dish.categorySlug\n'
    '  };\n'
    '  return (\n'
    '    getMaisonElyseCategoryLabel(category, locale) ||\n'
    '    resolveMaisonElyseCopy(locale).copy.activeCategoryAll\n'
    '  );\n'
    '}\n',
)
replace_once(
    DETAIL,
    'function dishBadges(dish: PublicMenuDish, locale: PublicMenuLocale, copy: DetailCopy): string[] {\n'
    '  const badges: string[] = [];\n'
    '  const tagText = normalizeText(dish.tags.join(" "));\n\n'
    '  if (tagText.includes("signature")) badges.push("Signature");\n'
    '  if (tagText.includes("recommande") || tagText.includes("recommended")) {\n'
    '    badges.push(copy.recommendedBadge);\n'
    '  }\n'
    '  if (hasReal3d(dish)) badges.push("3D");\n'
    '  if (hasRealAr(dish)) badges.push("AR");\n'
    '  if (!dish.available) badges.push(copy.unavailableBadge);\n\n'
    '  return Array.from(new Set(badges)).slice(0, 5);\n'
    '}\n',
    'function dishBadges(dish: PublicMenuDish, copy: DetailCopy): string[] {\n'
    '  const badges: string[] = [];\n'
    '  const tagText = normalizeText(dish.tags.join(" "));\n'
    '  const categoryKind = getMaisonElyseCategoryKind({\n'
    '    label: dish.category,\n'
    '    slug: dish.categorySlug\n'
    '  });\n\n'
    '  if (dish.isSignature || categoryKind === "signature" || tagText.includes("signature")) {\n'
    '    badges.push(copy.signatureBadge);\n'
    '  }\n'
    '  if (\n'
    '    dish.isRecommended ||\n'
    '    tagText.includes("recommande") ||\n'
    '    tagText.includes("recommended")\n'
    '  ) {\n'
    '    badges.push(copy.recommendedBadge);\n'
    '  }\n'
    '  if (hasReal3d(dish)) badges.push("3D");\n'
    '  if (hasRealAr(dish)) badges.push("AR");\n'
    '  if (!dish.available) badges.push(copy.unavailableBadge);\n\n'
    '  return Array.from(new Set(badges)).slice(0, 5);\n'
    '}\n',
)
regex_once(
    DETAIL,
    r'type DetailCopy = \(typeof DETAIL_COPY\)\["fr"\] & \{[\s\S]*?\n};\n\nfunction buildDetailCopy\([\s\S]*?\n}\n\nexport function MaisonElyseDishDetail',
    '''type DetailCopy = {\n'
    '  allergens: string;\n'
    '  ariaDetail: string;\n'
    '  badgesAria: string;\n'
    '  backToMenu: string;\n'
    '  dishImageAlt: (dishName: string) => string;\n'
    '  fallbackImage: string;\n'
    '  fallbackList: string;\n'
    '  hide3d: string;\n'
    '  hidePreview: string;\n'
    '  immersiveBody3d: string;\n'
    '  immersiveBodyAr: string;\n'
    '  immersiveKicker: string;\n'
    '  immersivePreview3d: string;\n'
    '  immersivePreviewAr: string;\n'
    '  ingredients: string;\n'
    '  noCategory: string;\n'
    '  note: string;\n'
    '  options: string;\n'
    '  openAr: string;\n'
    '  recommendedBadge: string;\n'
    '  signatureBadge: string;\n'
    '  show3d: string;\n'
    '  title3d: string;\n'
    '  titleAr: string;\n'
    '  topNavAria: string;\n'
    '  unavailableBadge: string;\n'
    '  modelViewer: Required<DishModelViewerCopy>;\n'
    '};\n\n'
    'function buildDetailCopy(\n'
    '  locale: PublicMenuLocale,\n'
    '  localizedUiCopy?: Record<string, unknown>\n'
    '): DetailCopy {\n'
    '  const resolved = resolveMaisonElyseCopy(locale, localizedUiCopy).copy;\n'
    '  const editorial = getMaisonElyseEditorialCopy(locale);\n'
    '  return {\n'
    '    allergens: resolved.allergens,\n'
    '    ariaDetail: resolved.details,\n'
    '    badgesAria: resolved.tags,\n'
    '    backToMenu: editorial.detailBackToMenu,\n'
    '    dishImageAlt: resolved.modelAlt,\n'
    '    fallbackImage: resolved.detailFallback,\n'
    '    fallbackList: resolved.detailFallback,\n'
    '    hide3d: resolved.modelViewer.close,\n'
    '    hidePreview: resolved.close,\n'
    '    immersiveBody3d: resolved.modelViewer.slowNetworkBody,\n'
    '    immersiveBodyAr: resolved.modelViewer.arHelp,\n'
    '    immersiveKicker: resolved.immersiveFilterLabel,\n'
    '    immersivePreview3d: resolved.modelViewer.slowNetworkBody,\n'
    '    immersivePreviewAr: resolved.modelViewer.arIosHandoff,\n'
    '    ingredients: resolved.ingredients,\n'
    '    noCategory: resolved.activeCategoryAll,\n'
    '    note: resolved.detailHouseNoteLabel,\n'
    '    modelViewer: {\n'
    '      loadingTitle: resolved.modelPreparing,\n'
    '      ...resolved.modelViewer,\n'
    '      modelAlt: resolved.modelAlt\n'
    '    },\n'
    '    options: resolved.options,\n'
    '    openAr: resolved.viewAr,\n'
    '    recommendedBadge: resolved.recommendation,\n'
    '    signatureBadge: resolved.signature,\n'
    '    show3d: resolved.threeD,\n'
    '    title3d: resolved.threeD,\n'
    '    titleAr: resolved.modelViewer.safariTitle,\n'
    '    topNavAria: resolved.details,\n'
    '    unavailableBadge: resolved.soldOut\n'
    '  };\n'
    '}\n\n'
    'export function MaisonElyseDishDetail'''.replace("'\n    '", ""),
)
replace_once(
    DETAIL,
    '  displayMode = "public",\n'
    '  locale = "fr-CA",\n'
    '  config,\n'
    '  onBackToMenu\n',
    '  displayMode = "public",\n'
    '  locale = "fr-CA",\n'
    '  config,\n'
    '  currency,\n'
    '  exchangeRates,\n'
    '  onBackToMenu\n',
)
replace_once(
    DETAIL,
    '  const restaurantName = cleanDisplayText(menu.name) || "Restaurant";\n'
    '  const dishName = cleanDisplayText(dish.name);\n'
    '  const dishDescription = cleanDisplayText(dish.description);\n'
    '  const displayCategory = categoryLabel(dish.category, locale);\n',
    '  const restaurantName = cleanDisplayText(menu.name) || "Restaurant";\n'
    '  const dishName = cleanDisplayText(dish.name);\n'
    '  const dishDescription = cleanDisplayText(dish.description);\n'
    '  const textDirection = getMaisonElyseTextDirection(locale);\n'
    '  const activeCurrency = normalizeTrouvableCurrency(\n'
    '    currency ?? query?.currency,\n'
    '    menu.settings\n'
    '  );\n'
    '  const priceLabel = formatTrouvableDishPrice(\n'
    '    dish,\n'
    '    activeCurrency,\n'
    '    locale,\n'
    '    exchangeRates\n'
    '  );\n'
    '  const displayCategory = categoryLabel(dish, locale);\n',
)
replace_once(DETAIL, '  const badges = dishBadges(dish, locale, copy);\n', '  const badges = dishBadges(dish, copy);\n')
regex_once(
    DETAIL,
    r'  const LazyDishModelViewer =\n    localeLanguage\(locale\) === "fr"\n      \? LazyDishModelViewerFr\n      : LazyDishModelViewerEn;\n',
    '',
)
replace_once(
    DETAIL,
    '    <main\n      dir={getMaisonElyseTextDirection(locale)}\n      lang={locale}\n',
    '    <main\n      dir="ltr"\n      lang={locale}\n      data-text-direction={textDirection}\n',
)
replace_once(
    DETAIL,
    '            <div className={styles.imageFallback}>\n'
    '              <span>{restaurantName.slice(0, 1)}</span>\n'
    '              <p>{copy.fallbackImage}</p>\n',
    '            <div className={styles.imageFallback}>\n'
    '              <span>{restaurantName.slice(0, 1)}</span>\n'
    '              <p dir={textDirection}>{copy.fallbackImage}</p>\n',
)
replace_once(
    DETAIL,
    '        <section className={styles.content} aria-label={copy.ariaDetail}>\n',
    '        <section\n'
    '          className={styles.content}\n'
    '          aria-label={copy.ariaDetail}\n'
    '          dir={textDirection}\n'
    '        >\n',
)
replace_once(
    DETAIL,
    '            {dish.priceLabel ? (\n'
    '              <p className={styles.price}>{dish.priceLabel}</p>\n'
    '            ) : null}\n',
    '            {priceLabel ? (\n'
    '              <p className={styles.price}>{priceLabel}</p>\n'
    '            ) : null}\n',
)

# ---------------- Server routing: Maison currency end-to-end ----------------
replace_once(
    CONTEXT,
    '  const exchangeRates =\n'
    '    experience.kind === "trouvable" ||\n'
    '    experience.kind === "unique-registered"\n',
    '  const exchangeRates =\n'
    '    experience.kind === "maison-elyse" ||\n'
    '    experience.kind === "trouvable" ||\n'
    '    experience.kind === "unique-registered"\n',
)
replace_once(
    MENU_ROUTE,
    '      <MaisonElyseQrMenu\n'
    '        menu={menu}\n',
    '      <MaisonElyseQrMenu\n'
    '        menu={menu}\n'
    '        exchangeRates={exchangeRates}\n',
)
replace_once(
    DISH_ROUTE,
    '  if (experience.kind === "maison-elyse") {\n'
    '    return (\n',
    '  if (experience.kind === "maison-elyse") {\n'
    '    if (!exchangeRates) notFound();\n\n'
    '    return (\n',
)
replace_once(
    DISH_ROUTE,
    '        config={config}\n      />\n',
    '        config={config}\n'
    '        exchangeRates={exchangeRates}\n'
    '      />\n',
)

# ---------------- Sauge: preserve visual chrome order in Arabic ----------------
replace_once(
    SAUGE,
    '    root.dir = copyLocale(language) === "ar" ? "rtl" : "ltr";\n',
    '    root.dir = "ltr";\n',
)
replace_once(
    SAUGE,
    '    <main\n      className={styles.book}\n',
    '    <main\n      className={styles.book}\n'
    '      dir="ltr"\n'
    '      lang={activeLocaleValue}\n'
    '      data-text-direction={copyLocale(activeLocaleValue) === "ar" ? "rtl" : "ltr"}\n',
)

# ---------------- Update legacy tests that asserted the old FR/EN-only implementation ----------------
regex_once(
    LOCALE_TEST,
    r'test\("Maison Elyse keeps its branded collection cover copy"[\s\S]*?\n}\);',
    'test("Maison Elyse keeps its branded collection cover copy in every built-in locale", async () => {\n'
    '  const source = await readFile(localizationPath, "utf8");\n\n'
    '  assert.match(source, /collectionKicker: "LA COLLECTION"/);\n'
    '  assert.match(source, /collectionKicker: "THE COLLECTION"/);\n'
    '  assert.match(source, /collectionKicker: "LA COLECCIÓN"/);\n'
    '  assert.match(source, /collectionTitle: "القائمة"/);\n'
    '  assert.match(source, /getMaisonElyseEditorialCopy/);\n'
    '});',
)
regex_once(
    LOCALE_TEST,
    r'test\("Maison Elyse detail keeps its restaurant-specific return label"[\s\S]*?\n}\);',
    'test("Maison Elyse detail keeps a restaurant-specific localized return label", async () => {\n'
    '  const [localization, detail] = await Promise.all([\n'
    '    readFile(localizationPath, "utf8"),\n'
    '    readFile("components/menu/MaisonElyseDishDetail.tsx", "utf8")\n'
    '  ]);\n\n'
    '  assert.match(localization, /detailBackToMenu: "Retour à la carte"/);\n'
    '  assert.match(localization, /detailBackToMenu: "Back to menu"/);\n'
    '  assert.match(localization, /detailBackToMenu: "Volver a la carta"/);\n'
    '  assert.match(localization, /detailBackToMenu: "العودة إلى القائمة"/);\n'
    '  assert.match(detail, /editorial\.detailBackToMenu/);\n'
    '});',
)
regex_once(
    LOCALE_TEST,
    r'test\("Maison menu root and text zones follow the resolved menu direction"[\s\S]*?\n}\);',
    'test("Maison menu chrome stays LTR while text zones keep the resolved text direction", async () => {\n'
    '  const source = await readFile(menuPath, "utf8");\n\n'
    '  assert.match(source, /data-text-direction=\\{textDirection\\}/);\n'
    '  assert.match(source, /dir="ltr"/);\n'
    '  assert.match(source, /className=\\{styles\\.dishCopy\\} dir=\\{textDirection\\}/);\n'
    '  assert.doesNotMatch(source, /lang=\\{activeLocale\\}\\s+dir=\\{textDirection\\}/);\n'
    '});',
)

# Source contract test: strings now live in central copy packs rather than duplicated components.
replace_once(
    SOURCE_TEST,
    '  const [component, css] = await Promise.all([\n'
    '    readFile(componentPath, "utf8"),\n'
    '    readFile(cssPath, "utf8")\n'
    '  ]);\n\n'
    '  assert.match(component, /useState<string>\\(ALL_CATEGORY_ID\\)/);\n'
    '  assert.match(component, /LA COLLECTION/);\n'
    '  assert.match(component, /LA CARTE/);\n',
    '  const [component, css, localization] = await Promise.all([\n'
    '    readFile(componentPath, "utf8"),\n'
    '    readFile(cssPath, "utf8"),\n'
    '    readFile("lib/menu/maisonElyseLocalization.ts", "utf8")\n'
    '  ]);\n\n'
    '  assert.match(component, /useState<string>\\(ALL_CATEGORY_ID\\)/);\n'
    '  assert.match(localization, /collectionKicker: "LA COLLECTION"/);\n'
    '  assert.match(localization, /collectionTitle: "LA CARTE"/);\n',
)
regex_once(
    SOURCE_TEST,
    r'test\("Maison Elyse QR menu keeps compact filters and Google Reviews without 3D autoload"[\s\S]*?\n}\);',
    '''test("Maison Elyse QR menu keeps compact localized filters and Google Reviews without 3D autoload", async () => {\n'
    '  const [component, sharedCopy, localization] = await Promise.all([\n'
    '    readFile(componentPath, "utf8"),\n'
    '    readFile("components/menu/trouvableMenuControls.ts", "utf8"),\n'
    '    readFile("lib/menu/maisonElyseLocalization.ts", "utf8")\n'
    '  ]);\n'
    '  const copySources = `${sharedCopy}\\n${localization}`;\n\n'
    '  for (const text of [\n'
    '    "Recommandé",\n'
    '    "Signature",\n'
    '    "3D / AR",\n'
    '    "Disponible",\n'
    '    "Réinitialiser",\n'
    '    "Appliquer"\n'
    '  ]) {\n'
    '    assert.match(copySources, new RegExp(text.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")));\n'
    '  }\n\n'
    '  assert.match(localization, /filterDialogLabel: "Filtrer la carte"/);\n'
    '  assert.match(localization, /filterDialogLabel: "Filter the menu"/);\n'
    '  assert.match(sharedCopy, /recommendation: "Recommended"/);\n'
    '  assert.match(sharedCopy, /available: "Available"/);\n'
    '  assert.match(component, /ALLERGEN_FILTERS/);\n'
    '  assert.match(component, /matchesConfirmedFree/);\n'
    '  assert.doesNotMatch(component, /AllergenWarning/);\n'
    '  assert.doesNotMatch(component, /ALLERGEN_FILTER_TERMS/);\n'
    '  assert.match(component, /GoogleReviewCard/);\n'
    '  assert.match(component, /FILTER_OPTIONS/);\n'
    '  assert.match(component, /activeSheet/);\n'
    '  assert.match(component, /getTrouvableCurrencyOptions/);\n'
    '  assert.match(component, /formatTrouvableDishPrice/);\n'
    '  assert.doesNotMatch(component, /QUICK_FILTERS/);\n'
    '  assert.doesNotMatch(component, /PREFERENCE_FILTERS/);\n'
    '  assert.doesNotMatch(component, /showDetailFilters/);\n'
    '  assert.match(component, /googleReview=\\{activeMenu\\.googleReview\\}/);\n'
    '  assert.match(component, /localizedUiCopy=\\{activeMenu\\.localizedUiCopy\\}/);\n'
    '  assert.match(component, /restaurantId=\\{activeMenu\\.restaurantId\\}/);\n'
    '  assert.match(component, /restaurantName=\\{activeMenu\\.name\\}/);\n'
    '  assert.match(component, /source=\\{activeMenu\\.source\\}/);\n'
    '  assert.doesNotMatch(component, /DishModelViewer/);\n'
    '  assert.doesNotMatch(component, /<model-viewer/);\n'
    '  assert.doesNotMatch(component, /@google\\/model-viewer/);\n'
    '  assert.doesNotMatch(component, /["\'`](?:https?:\\/\\/|\\/)[^"\'`]*\\.glb/);\n'
    '  assert.doesNotMatch(component, /["\'`](?:https?:\\/\\/|\\/)[^"\'`]*\\.usdz/);\n'
    '});'''.replace("'\n    '", ""),
)
regex_once(
    SOURCE_TEST,
    r'test\("Maison Elyse phone detail can render localized English copy"[\s\S]*?\n}\);',
    'test("Maison Elyse phone detail resolves multilingual copy through the shared and editorial packs", async () => {\n'
    '  const [component, sharedCopy, localization] = await Promise.all([\n'
    '    readFile(dishDetailPath, "utf8"),\n'
    '    readFile("components/menu/trouvableMenuControls.ts", "utf8"),\n'
    '    readFile("lib/menu/maisonElyseLocalization.ts", "utf8")\n'
    '  ]);\n\n'
    '  assert.match(component, /locale\\?: Locale/);\n'
    '  assert.match(component, /resolveMaisonElyseCopy/);\n'
    '  assert.match(component, /getMaisonElyseEditorialCopy/);\n'
    '  assert.match(localization, /detailBackToMenu: "Back to menu"/);\n'
    '  assert.match(localization, /detailBackToMenu: "Volver a la carta"/);\n'
    '  assert.match(sharedCopy, /details: "Dish details"/);\n'
    '  assert.match(sharedCopy, /threeD: "View in 3D"/);\n'
    '  assert.match(sharedCopy, /allergens: "Allergens"/);\n'
    '  assert.match(sharedCopy, /recommendation: "Recommended"/);\n'
    '  assert.match(sharedCopy, /soldOut: "Sold out"/);\n'
    '});',
)

# The new contract intentionally allows optional exchange rates in embedded previews.
replace_once(
    NEW_TEST,
    '  assert.match(source, /exchangeRates: MenuExchangeRates/);\n',
    '  assert.match(source, /exchangeRates\\?: MenuExchangeRates/);\n',
)

print("Maison Élyse patch applied successfully")
