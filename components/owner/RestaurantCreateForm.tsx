"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "@/components/owner/OwnerCockpit.module.css";
import {
  buildPublicMenuPath,
  slugifyRestaurantSlug
} from "@/lib/owner/menuUrlCore";
import {
  PUBLIC_MENU_CURRENCIES,
  PUBLIC_MENU_LOCALE_OPTIONS,
  normalizePublicMenuCurrency,
  normalizePublicMenuLocale,
  publicMenuSettingsToLegacyMenuLanguages,
  type PublicMenuCurrency,
  type PublicMenuLocale,
  type PublicMenuPriceDisplayMode,
  type PublicMenuSettings,
  type PublicMenuStyle,
  type PublicMenuThemeMode
} from "@/lib/menu/publicMenuSettings";
import {
  formatPriceCentsForMenu,
  normalizeDisplayPriceMode,
  parsePriceToCents,
  type DisplayPriceMode
} from "@/lib/owner/price";
import {
  buildAccessibleMenuPalette,
  MENU_STYLE_PRESETS,
  normalizeHexColor,
  normalizeMenuAppearanceSelection,
  type MenuAppearanceSelection
} from "@/lib/menu/menuAppearance";
import type {
  CreateRestaurantDishPhotoStatus,
  OwnerRestaurant,
  OwnerRestaurantStatus
} from "@/lib/owner/types";
import {
  ALLERGEN_REGISTRY,
  allergenLabel,
  getAllergenStatus,
  legacyAllergensFromDeclarations,
  normalizeAllergenData,
  type AllergenStatus,
  type DishAllergenDeclaration
} from "@/lib/menu/allergens";
import { OwnerMenuLivePreview } from "./OwnerMenuLivePreview";
import type { DraftDish, DraftSection } from "./restaurantCreatePreviewTypes";

type StepId = "profile" | "menu" | "dishes" | "appearance" | "review";

type MenuAppearancePalette = {
  background: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  accent2: string;
  accent3: string;
  border: string;
  success: string;
  warning: string;
  danger: string;
};

type MenuLanguage = PublicMenuLocale;
type MenuCurrency = PublicMenuCurrency;

type SubmitState =
  | { status: "idle"; message: "" }
  | { status: "validating"; message: string }
  | { status: "creating"; message: string }
  | {
      status: "success";
      message: string;
      restaurant: OwnerRestaurant;
      persisted: true;
      dataSource: "supabase";
      restaurantPersisted: true;
      sectionsPersisted: boolean;
      dishesPersisted: boolean;
      uiConfigPersisted: true;
      menuAppearancePersisted: true;
      uniqueDesignPersisted: boolean;
      uniqueDesignId?: string;
      uniqueDesignStatus?: string;
      publicMenuStyle: PublicMenuStyle;
      persistedDishCount: number;
      mediaBasePath: string;
      mediaBasePathPersisted: boolean;
      qrCodesHref: string;
      warnings: string[];
    }
  | { status: "fallback"; message: string }
  | { status: "error"; message: string };

type RestaurantCreateFormProps = {
  siteOrigin: string;
};

const steps: Array<{ id: StepId; title: string; sub: string }> = [
  {
    id: "profile",
    title: "Profil",
    sub: "Identite, slug, contact."
  },
  {
    id: "menu",
    title: "Structure menu",
    sub: "Langues et sections de la carte."
  },
  {
    id: "dishes",
    title: "Plats",
    sub: "Descriptions, prix, photos."
  },
  {
    id: "appearance",
    title: "Style du menu",
    sub: "Palette, templates et aperçu client."
  },
  {
    id: "review",
    title: "Revue finale",
    sub: "Persistance et actions."
  }
];

const statusOptions: Array<{ value: OwnerRestaurantStatus; label: string }> = [
  { value: "setup_needed", label: "A configurer" },
  { value: "active", label: "Actif" },
  { value: "demo", label: "Presentation" }
];

const menuLanguageOptions: Array<{
  value: MenuLanguage;
  label: string;
  detail: string;
}> = PUBLIC_MENU_LOCALE_OPTIONS.map((option) => ({
  value: option.value,
  label: option.label,
  detail: option.value
}));

const preferredCurrencyDetails: Record<string, string> = {
  CAD: "Devise de base recommandee au Canada.",
  USD: "Conversion client en dollar americain.",
  EUR: "Conversion client en euro."
};

const currencyOptions: Array<{
  value: MenuCurrency;
  label: string;
  detail: string;
}> = PUBLIC_MENU_CURRENCIES.map((currency) => ({
  value: currency,
  label: currency,
  detail: preferredCurrencyDetails[currency] ?? "Devise disponible pour le menu public."
}));

const themeModeOptions: Array<{
  value: PublicMenuThemeMode;
  label: string;
}> = [
  { value: "dark", label: "Dark premium" },
  { value: "light", label: "Light" }
];

const publicMenuStyleOptions: Array<{
  value: PublicMenuStyle;
  label: string;
  badge?: string;
  detail: string;
  secondary?: string;
}> = [
  {
    value: "trouvable",
    label: "Style Trouvable",
    detail: "Experience immersive avec controles langue, devise, theme et fiches plats premium."
  },
  {
    value: "maison-elyse",
    label: "Style Maison Elyse",
    detail: "Carte QR plus editoriale, accueil fort et navigation visuelle classique."
  },
  {
    value: "unique",
    label: "Nouveau UI unique",
    badge: "SUR MESURE",
    detail:
      "Cree une nouvelle identite de design reservee a ce restaurant. Le UI sera developpe et publie separement, sans affecter les autres menus.",
    secondary:
      "Le restaurant sera cree avec un fallback professionnel pendant la construction du design."
  }
];

const badgeOptions = [
  "Maison",
  "Signature",
  "Populaire",
  "Recommande",
  "Nouveau",
  "Vegetarien",
  "Sans gluten"
];

const photoStatusOptions: Array<{
  value: CreateRestaurantDishPhotoStatus;
  label: string;
}> = [
  { value: "ready", label: "Photo prete" },
  { value: "planned", label: "A ajouter dans medias" },
  { value: "missing", label: "Sans photo" }
];

const allergenStatusOptions: Array<{ value: AllergenStatus; label: string }> = [
  { value: "unknown", label: "À confirmer" },
  { value: "contains", label: "Contient" },
  { value: "may_contain", label: "Peut contenir" },
  { value: "confirmed_free", label: "Déclaré sans" }
];

function emptyAllergenDeclarations(): DishAllergenDeclaration[] {
  return ALLERGEN_REGISTRY.map(({ id }) => ({
    allergenId: id,
    status: "unknown"
  }));
}

function absoluteUrl(siteOrigin: string, path: string): string {
  try {
    return new URL(path, siteOrigin).toString();
  } catch {
    return path;
  }
}

function draftId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatPrice(
  value: string,
  displayPriceMode: DisplayPriceMode,
  currency: MenuCurrency = "CAD"
): string {
  const parsed = parsePriceToCents(value);
  if (!parsed.ok) return value;
  return formatPriceCentsForMenu(parsed.cents, currency, { displayPriceMode });
}

function splitList(value: string): string[] {
  const seen = new Set<string>();
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => {
      if (!item) return false;
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 16);
}

function formatList(items: string[]): string {
  return items.length > 0 ? items.join(", ") : "A completer";
}

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

function getMenuLanguageLabel(language: MenuLanguage): string {
  const option = menuLanguageOptions.find((item) => item.value === language);
  if (option) return option.label;
  try {
    return (
      new Intl.DisplayNames(["fr-CA"], { type: "language" }).of(language) ??
      language
    );
  } catch {
    return language;
  }
}

function formatMenuLanguages(languages: MenuLanguage[]): string {
  return languages.length > 0
    ? languages.map(getMenuLanguageLabel).join(", ")
    : "Aucune langue";
}

function normalizeLanguageInput(value: string): MenuLanguage | null {
  const raw = value.trim();
  if (!raw) return null;
  const normalized = normalizePublicMenuLocale(raw, "");
  return normalized ? normalized : null;
}

function getCurrencyDetail(currency: MenuCurrency): string {
  return preferredCurrencyDetails[currency] ?? "Devise disponible pour le menu public.";
}

function formatCurrencyOption(currency: MenuCurrency): string {
  try {
    const name = new Intl.DisplayNames(["fr-CA"], { type: "currency" }).of(currency);
    return name ? `${currency} - ${name}` : currency;
  } catch {
    return currency;
  }
}

function formatCurrencies(currencies: MenuCurrency[]): string {
  return currencies.length > 0 ? currencies.join(", ") : "Aucune devise";
}

function getPublicMenuStyleLabel(style: PublicMenuStyle): string {
  return publicMenuStyleOptions.find((option) => option.value === style)?.label ?? style;
}

function normalizeCurrencyInput(value: string): MenuCurrency | null {
  const raw = value.trim();
  if (!raw) return null;
  const normalized = normalizePublicMenuCurrency(raw, "");
  return normalized ? normalized : null;
}

function isValidTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("fr-CA", { timeZone: value }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

function formatPhotoStatus(status: CreateRestaurantDishPhotoStatus): string {
  return photoStatusOptions.find((option) => option.value === status)?.label ?? "A ajouter";
}

function isValidGoogleReviewUrl(value: string): boolean {
  if (!value.trim()) return true;

  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
      return false;
    }
    if (parsed.hostname.toLowerCase() === "search.google.com") {
      return (
        parsed.pathname === "/local/writereview" &&
        Boolean(parsed.searchParams.get("placeid")?.trim())
      );
    }
    if (parsed.hostname.toLowerCase() === "g.page") {
      return parsed.pathname
        .split("/")
        .filter(Boolean)
        .some((segment) => segment.toLowerCase() === "review");
    }
  } catch {
    return false;
  }

  return false;
}

function isValidMediaUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (trimmed.includes("\\")) return false;
  if (trimmed.startsWith("/") && !trimmed.startsWith("//") && !trimmed.includes("\\")) {
    return true;
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

function getSectionsWithoutDish(sections: DraftSection[], dishes: DraftDish[]): string[] {
  const dishSections = new Set(
    dishes.map((dish) => dish.section.trim().toLowerCase()).filter(Boolean)
  );

  return sections
    .filter((section) => !dishSections.has(section.name.trim().toLowerCase()))
    .map((section) => section.name);
}

function calculateReadiness({
  name,
  slug,
  sections,
  dishes
}: {
  name: string;
  slug: string;
  sections: DraftSection[];
  dishes: DraftDish[];
}): number {
  const checks = [
    Boolean(name.trim()),
    Boolean(slug.trim()),
    sections.length > 0,
    dishes.length > 0,
    sections.length > 0 && getSectionsWithoutDish(sections, dishes).length === 0,
    dishes.every((dish) => dish.description.trim() && parsePriceToCents(dish.price).ok),
    dishes.some((dish) => dish.photoStatus === "ready" || dish.imageUrl.trim())
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export function RestaurantCreateForm({ siteOrigin }: RestaurantCreateFormProps) {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [maxUnlockedStep, setMaxUnlockedStep] = useState(0);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [location, setLocation] = useState("");
  const [cuisineType, setCuisineType] = useState("");
  const [status, setStatus] = useState<OwnerRestaurantStatus>("setup_needed");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [googleReviewUrl, setGoogleReviewUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [sections, setSections] = useState<DraftSection[]>([]);
  const [sectionName, setSectionName] = useState("");
  const [sectionDescription, setSectionDescription] = useState("");
  const [menuLanguages, setMenuLanguages] = useState<MenuLanguage[]>(["fr-CA"]);
  const [defaultMenuLanguage, setDefaultMenuLanguage] =
    useState<MenuLanguage>("fr-CA");
  const [supportedCurrencies, setSupportedCurrencies] = useState<MenuCurrency[]>(["CAD"]);
  const [baseCurrency, setBaseCurrency] = useState<MenuCurrency>("CAD");
  const [defaultCurrency, setDefaultCurrency] = useState<MenuCurrency>("CAD");
  const [publicMenuStyle, setPublicMenuStyle] =
    useState<PublicMenuStyle>("trouvable");
  const defaultAppearancePreset = MENU_STYLE_PRESETS[0];
  const [appearancePresetId, setAppearancePresetId] = useState(defaultAppearancePreset.id);
  const [primaryColor, setPrimaryColor] = useState(defaultAppearancePreset.primaryColor);
  const [secondaryColor, setSecondaryColor] = useState(defaultAppearancePreset.secondaryColor);
  const [restaurantTimezone, setRestaurantTimezone] =
    useState("America/Toronto");
  const [defaultThemeMode, setDefaultThemeMode] =
    useState<PublicMenuThemeMode>("dark");
  const [allowLanguageSelector, setAllowLanguageSelector] = useState(true);
  const [allowCurrencySelector, setAllowCurrencySelector] = useState(true);
  const [allowThemeToggle, setAllowThemeToggle] = useState(true);
  const [taxIncluded, setTaxIncluded] = useState(true);
  const [priceDisplayMode, setPriceDisplayMode] =
    useState<PublicMenuPriceDisplayMode>("auto");
  const [dishes, setDishes] = useState<DraftDish[]>([]);
  const [editingDishId, setEditingDishId] = useState("");
  const [dishName, setDishName] = useState("");
  const [dishSection, setDishSection] = useState("");
  const [dishPrice, setDishPrice] = useState("28");
  const [dishDisplayPriceMode, setDishDisplayPriceMode] =
    useState<DisplayPriceMode>("auto");
  const [dishDescription, setDishDescription] = useState("");
  const [dishImageUrl, setDishImageUrl] = useState("");
  const [dishIngredients, setDishIngredients] = useState("");
  const [dishOptions, setDishOptions] = useState("");
  const [dishCustomAllergens, setDishCustomAllergens] = useState("");
  const [dishAllergenDeclarations, setDishAllergenDeclarations] = useState<
    DishAllergenDeclaration[]
  >(emptyAllergenDeclarations);
  const [dishTags, setDishTags] = useState<string[]>([]);
  const [dishChefNote, setDishChefNote] = useState("");
  const [dishAvailable, setDishAvailable] = useState(true);
  const [dishPhotoStatus, setDishPhotoStatus] =
    useState<CreateRestaurantDishPhotoStatus>("planned");
  const [state, setState] = useState<SubmitState>({
    status: "idle",
    message: ""
  });
  const [error, setError] = useState("");

  const effectiveSlug = slug || slugifyRestaurantSlug(name);
  const menuPath = buildPublicMenuPath(effectiveSlug || name);
  const menuUrl = useMemo(() => absoluteUrl(siteOrigin, menuPath), [menuPath, siteOrigin]);
  const currentStep = steps[stepIndex];
  const readiness = calculateReadiness({
    name,
    slug: effectiveSlug,
    sections,
    dishes
  });
  const photoReadyCount = dishes.filter(
    (dish) => dish.photoStatus === "ready" || dish.imageUrl.trim()
  ).length;
  const mediaBasePathPreview = "restaurants/{id-supabase}/photos/";
  const publicMenuSettings = useMemo<PublicMenuSettings>(
    () => ({
      defaultLocale: defaultMenuLanguage,
      supportedLocales: menuLanguages,
      baseCurrency,
      defaultCurrency,
      supportedCurrencies,
      publicMenuStyle,
      timezone: restaurantTimezone.trim() || "America/Toronto",
      defaultThemeMode,
      allowThemeToggle,
      allowCurrencySelector,
      allowLanguageSelector,
      taxIncluded,
      priceDisplayMode
    }),
    [
      allowCurrencySelector,
      allowLanguageSelector,
      allowThemeToggle,
      baseCurrency,
      defaultCurrency,
      defaultMenuLanguage,
      defaultThemeMode,
      menuLanguages,
      priceDisplayMode,
      publicMenuStyle,
      restaurantTimezone,
      supportedCurrencies,
      taxIncluded
    ]
  );
  const menuAppearance = useMemo<MenuAppearanceSelection>(
    () =>
      normalizeMenuAppearanceSelection({
        template: publicMenuStyle,
        presetId: appearancePresetId,
        primaryColor,
        secondaryColor,
        themeMode: defaultThemeMode
      }),
    [appearancePresetId, defaultThemeMode, primaryColor, publicMenuStyle, secondaryColor]
  );
  const appearancePalette = useMemo(
    () => buildAccessibleMenuPalette(menuAppearance),
    [menuAppearance]
  );

  function updateName(value: string) {
    setName(value);
    if (!slugTouched) {
      setSlug(slugifyRestaurantSlug(value));
    }
  }

  function applyAppearancePreset(presetId: string) {
    const preset = MENU_STYLE_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;
    setAppearancePresetId(preset.id);
    setPrimaryColor(preset.primaryColor);
    setSecondaryColor(preset.secondaryColor);
    setDefaultThemeMode(preset.themeMode);
  }

  function resetAppearanceToTemplate() {
    const preset =
      publicMenuStyle === "trouvable"
        ? MENU_STYLE_PRESETS[0]
        : publicMenuStyle === "unique"
          ? MENU_STYLE_PRESETS.find((item) => item.id === "noir-champagne") ??
            MENU_STYLE_PRESETS[0]
          : MENU_STYLE_PRESETS.find((item) => item.id === "olive-beige") ??
            MENU_STYLE_PRESETS[0];
    applyAppearancePreset(preset.id);
  }

  function updateSlug(value: string) {
    setSlugTouched(true);
    setSlug(slugifyRestaurantSlug(value));
  }

  function addSection() {
    const normalizedName = sectionName.trim();
    if (!normalizedName) {
      setError("Ajoutez un nom de section.");
      return;
    }
    if (sections.some((section) => section.name.toLowerCase() === normalizedName.toLowerCase())) {
      setError("Cette section existe deja.");
      return;
    }

    const next = {
      id: draftId("section"),
      name: normalizedName,
      description: sectionDescription.trim()
    };
    setSections((items) => [...items, next]);
    setDishSection((current) => current || next.name);
    setSectionName("");
    setSectionDescription("");
    setError("");
  }

  function removeSection(id: string) {
    const removed = sections.find((section) => section.id === id);
    const nextSections = sections.filter((section) => section.id !== id);
    setSections(nextSections);
    if (removed) {
      const fallbackSection = nextSections[0]?.name ?? "";
      setDishes((items) =>
        items.map((dish) =>
          dish.section === removed.name ? { ...dish, section: fallbackSection } : dish
        )
      );
      if (dishSection === removed.name) setDishSection(fallbackSection);
    }
  }

  function toggleMenuLanguage(language: MenuLanguage) {
    setMenuLanguages((current) => {
      if (current.includes(language)) {
        if (current.length === 1) {
          setError("Gardez au moins une langue pour le menu.");
          return current;
        }
        setError("");
        const next = current.filter((item) => item !== language);
        if (defaultMenuLanguage === language) {
          setDefaultMenuLanguage(next[0] ?? "fr-CA");
        }
        return next;
      }

      setError("");
      return [...current, language].sort((a, b) =>
        compareByOptionOrder(a, b, menuLanguageOptions)
      );
    });
  }

  function toggleSupportedCurrency(currency: MenuCurrency) {
    setSupportedCurrencies((current) => {
      if (current.includes(currency)) {
        if (current.length === 1) {
          setError("Gardez au moins une devise pour le menu.");
          return current;
        }
        const next = current.filter((item) => item !== currency);
        if (baseCurrency === currency) setBaseCurrency(next[0] ?? "CAD");
        if (defaultCurrency === currency) setDefaultCurrency(next[0] ?? "CAD");
        setError("");
        return next;
      }

      setError("");
      return [...current, currency].sort(
        (a, b) => compareByOptionOrder(a, b, currencyOptions)
      );
    });
  }

  function updateBaseCurrency(currency: MenuCurrency) {
    if (!supportedCurrencies.includes(currency)) return;
    setBaseCurrency(currency);
  }

  function updateDefaultCurrency(currency: MenuCurrency) {
    if (!supportedCurrencies.includes(currency)) return;
    setDefaultCurrency(currency);
  }

  function updateAllergenStatus(allergenId: string, status: AllergenStatus) {
    setDishAllergenDeclarations((current) =>
      current.map((item) =>
        item.allergenId === allergenId
          ? { ...item, status }
          : item
      )
    );
  }

  function toggleTag(value: string) {
    setDishTags((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value]
    );
  }

  function resetDishDraft() {
    setEditingDishId("");
    setDishName("");
    setDishSection(sections[0]?.name ?? "");
    setDishPrice("28");
    setDishDisplayPriceMode("auto");
    setDishDescription("");
    setDishImageUrl("");
    setDishIngredients("");
    setDishOptions("");
    setDishCustomAllergens("");
    setDishAllergenDeclarations(emptyAllergenDeclarations());
    setDishTags([]);
    setDishChefNote("");
    setDishAvailable(true);
    setDishPhotoStatus("planned");
  }

  function startEditDish(dish: DraftDish) {
    setEditingDishId(dish.id);
    setDishName(dish.name);
    setDishSection(dish.section);
    setDishPrice(dish.price);
    setDishDisplayPriceMode(dish.displayPriceMode);
    setDishDescription(dish.description);
    setDishImageUrl(dish.imageUrl);
    setDishIngredients(dish.ingredients.join(", "));
    setDishOptions(dish.options.join(", "));
    setDishCustomAllergens((dish.customAllergens ?? []).join(", "));
    const normalizedAllergens = normalizeAllergenData(
      dish.allergenDeclarations,
      dish.allergens
    );
    setDishAllergenDeclarations(
      ALLERGEN_REGISTRY.map(({ id }) => ({
        allergenId: id,
        status: getAllergenStatus(normalizedAllergens, id)
      }))
    );
    setDishTags(dish.tags);
    setDishChefNote(dish.chefNote);
    setDishAvailable(dish.available);
    setDishPhotoStatus(dish.photoStatus);
    setError("");
  }

  function addDish() {
    const normalizedName = dishName.trim();
    const selectedSection = dishSection || sections[0]?.name || "";
    const price = parsePriceToCents(dishPrice);
    const description = dishDescription.trim();
    const imageUrl = dishImageUrl.trim();

    if (!normalizedName) {
      setError("Ajoutez un nom de plat.");
      return;
    }
    if (!selectedSection) {
      setError("Ajoutez une section avant les plats.");
      return;
    }
    if (!price.ok) {
      setError(price.error);
      return;
    }
    if (!description) {
      setError("Description courte requise pour chaque plat.");
      return;
    }
    if (!isValidMediaUrl(imageUrl)) {
      setError("URL photo invalide. Utilisez une URL https ou un chemin interne.");
      return;
    }

    const nextDish: DraftDish = {
      id: editingDishId || draftId("dish"),
      name: normalizedName,
      section: selectedSection,
      price: price.originalInput,
      displayPriceMode: normalizeDisplayPriceMode(
        dishDisplayPriceMode,
        price.originalInput
      ),
      description,
      imageUrl,
      ingredients: splitList(dishIngredients),
      allergens: legacyAllergensFromDeclarations(dishAllergenDeclarations),
      customAllergens: splitList(dishCustomAllergens),
      allergenDeclarations: dishAllergenDeclarations,
      tags: dishTags,
      options: splitList(dishOptions),
      chefNote: dishChefNote.trim(),
      available: dishAvailable,
      photoStatus: imageUrl && dishPhotoStatus === "planned" ? "ready" : dishPhotoStatus
    };

    setDishes((items) =>
      editingDishId
        ? items.map((dish) => (dish.id === editingDishId ? nextDish : dish))
        : [...items, nextDish]
    );
    resetDishDraft();
    setError("");
  }

  function removeDish(id: string) {
    setDishes((items) => items.filter((dish) => dish.id !== id));
    if (editingDishId === id) resetDishDraft();
  }

  function validateStep(stepId: StepId) {
    setError("");
    if (stepId === "profile") {
      if (!name.trim()) {
        setError("Le nom restaurant est requis.");
        return false;
      }
      if (!effectiveSlug || effectiveSlug.length < 2) {
        setError("Le slug public doit contenir au moins 2 caracteres.");
        return false;
      }
      if (!contactEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
        setError("Email contact invalide.");
        return false;
      }
      if (!isValidGoogleReviewUrl(googleReviewUrl)) {
        setError("Lien Google Reviews invalide.");
        return false;
      }
    }
    if (stepId === "menu") {
      if (menuLanguages.length === 0) {
        setError("Choisissez au moins une langue de menu.");
        return false;
      }
      if (!menuLanguages.includes(defaultMenuLanguage)) {
        setError("La langue par defaut doit etre activee.");
        return false;
      }
      if (supportedCurrencies.length === 0) {
        setError("Choisissez au moins une devise.");
        return false;
      }
      if (!supportedCurrencies.includes(baseCurrency)) {
        setError("La devise de base doit etre activee.");
        return false;
      }
      if (!supportedCurrencies.includes(defaultCurrency)) {
        setError("La devise par defaut doit etre activee.");
        return false;
      }
      if (!isValidTimezone(restaurantTimezone)) {
        setError("Timezone restaurant invalide.");
        return false;
      }
      if (sections.length === 0) {
        setError("Ajoutez au moins une section de menu.");
        return false;
      }
    }
    if (stepId === "dishes") {
      if (dishes.length === 0) {
        setError("Ajoutez au moins un plat.");
        return false;
      }
      if (
        dishes.some(
          (dish) =>
            !dish.description.trim() || !parsePriceToCents(dish.price).ok || !dish.section
        )
      ) {
        setError("Chaque plat doit garder une section, un prix et une description courte.");
        return false;
      }
    }
    return true;
  }

  function goNext() {
    if (!validateStep(currentStep.id)) return;
    const nextIndex = Math.min(stepIndex + 1, steps.length - 1);
    setMaxUnlockedStep((index) => Math.max(index, nextIndex));
    setStepIndex(nextIndex);
  }

  function goPrevious() {
    setError("");
    setStepIndex((index) => Math.max(index - 1, 0));
  }

  function goToStep(index: number) {
    if (index <= maxUnlockedStep) {
      setError("");
      setStepIndex(index);
      return;
    }
    setError("Validez l'etape active avant de continuer.");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (currentStep.id !== "review") {
      goNext();
      return;
    }

    for (const step of steps) {
      if (!validateStep(step.id)) return;
    }

    setError("");
    setState({
      status: "validating",
      message: "Validation du restaurant..."
    });

    const normalizedSlug = slugifyRestaurantSlug(effectiveSlug || name);
    if (!normalizedSlug || normalizedSlug.length < 2) {
      setState({
        status: "error",
        message: "Slug public invalide. Ajustez le nom ou le slug."
      });
      return;
    }

    setState({
      status: "creating",
      message: "Creation dans Supabase..."
    });

    try {
      const response = await fetch("/api/restaurants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug: normalizedSlug,
          location,
          cuisineType,
          status,
          contactName,
          contactEmail,
          contactPhone,
          googleReviewUrl,
          notes,
          menuLanguages: publicMenuSettingsToLegacyMenuLanguages(publicMenuSettings),
          publicMenuSettings,
          menuAppearance,
          sections: sections.map((section, index) => ({
            name: section.name,
            description: section.description,
            order: index + 1
          })),
          dishes: dishes.map((dish) => ({
            name: dish.name,
            section: dish.section,
            price: dish.price,
            displayPriceMode: dish.displayPriceMode,
            description: dish.description,
            imageUrl: dish.imageUrl,
            ingredients: dish.ingredients,
            allergens: dish.allergens,
            customAllergens: dish.customAllergens,
            allergenDeclarations: dish.allergenDeclarations,
            tags: dish.tags,
            options: dish.options,
            chefNote: dish.chefNote,
            available: dish.available,
            photoStatus: dish.photoStatus
          }))
        })
      });
      const result = (await response.json()) as {
        ok?: boolean;
        error?: string;
        persisted?: boolean;
        dataSource?: "supabase";
        restaurantPersisted?: boolean;
        sectionsPersisted?: boolean;
        dishesPersisted?: boolean;
        uiConfigPersisted?: boolean;
        menuAppearancePersisted?: boolean;
        uniqueDesignPersisted?: boolean;
        uniqueDesignId?: string;
        uniqueDesignStatus?: string;
        persistedDishCount?: number;
        mediaBasePath?: string;
        mediaBasePathPersisted?: boolean;
        qrCodesHref?: string;
        warnings?: string[];
        restaurant?: OwnerRestaurant;
      };

      if (!response.ok || !result.ok || !result.restaurant) {
        throw new Error(result.error ?? "Creation impossible.");
      }

      const selectedStyle = publicMenuStyle;
      const uniqueDesignOk =
        selectedStyle !== "unique" ||
        (result.uniqueDesignPersisted === true &&
          typeof result.uniqueDesignId === "string" &&
          result.uniqueDesignId.length > 0);

      if (
        !result.persisted ||
        result.dataSource !== "supabase" ||
        !result.restaurantPersisted ||
        result.uiConfigPersisted !== true ||
        result.menuAppearancePersisted !== true ||
        !uniqueDesignOk
      ) {
        setState({
          status: "fallback",
          message:
            "Supabase n'a pas confirme la persistance. Aucun succes production n'est affiche."
        });
        return;
      }

      setState({
        status: "success",
        message:
          selectedStyle === "unique"
            ? "Restaurant cree — UI unique a construire."
            : "Restaurant cree dans Supabase.",
        restaurant: result.restaurant,
        persisted: true,
        dataSource: "supabase",
        restaurantPersisted: true,
        sectionsPersisted: Boolean(result.sectionsPersisted),
        dishesPersisted: Boolean(result.dishesPersisted),
        uiConfigPersisted: true,
        menuAppearancePersisted: true,
        uniqueDesignPersisted: selectedStyle === "unique" ? true : Boolean(result.uniqueDesignPersisted ?? true),
        ...(result.uniqueDesignId
          ? {
              uniqueDesignId: result.uniqueDesignId,
              uniqueDesignStatus: result.uniqueDesignStatus
            }
          : {}),
        publicMenuStyle: selectedStyle,
        persistedDishCount: result.persistedDishCount ?? 0,
        mediaBasePath: result.mediaBasePath ?? `restaurants/${result.restaurant.id}/photos/`,
        mediaBasePathPersisted: Boolean(result.mediaBasePathPersisted),
        qrCodesHref:
          result.qrCodesHref ?? `${result.restaurant.dashboardHref}/qr`,
        warnings: result.warnings ?? []
      });
      router.refresh();
    } catch (submissionError) {
      setState({
        status: "error",
        message:
          submissionError instanceof Error
            ? submissionError.message
            : "Le restaurant n'a pas pu etre cree."
      });
    }
  }

  if (state.status === "success") {
    return (
      <CreationSuccess
        state={state}
        menuUrl={state.restaurant.publicMenuUrl || menuUrl}
      />
    );
  }

  return (
    <form className={styles.createWizard} onSubmit={handleSubmit} noValidate>
      <aside className={styles.stepRail} aria-label="Etapes creation restaurant">
        {steps.map((step, index) => {
          const done = index < stepIndex;
          return (
            <button
              key={step.id}
              type="button"
              className={`${styles.stepCard} ${
                index === stepIndex ? styles.stepCardActive : ""
              } ${done ? styles.stepCardDone : ""}`}
              disabled={index > maxUnlockedStep}
              onClick={() => goToStep(index)}
            >
              <span className={styles.stepNumber}>{done ? "OK" : index + 1}</span>
              <span>
                <strong>{step.title}</strong>
                <small>{step.sub}</small>
              </span>
            </button>
          );
        })}
      </aside>

      <section className={styles.creationStage}>
        <div className={`${styles.panel} ${styles.highlightPanel}`}>
          <div className={styles.panelHeader}>
            <div>
              <h3 className={styles.panelTitle}>{currentStep.title}</h3>
              <p className={styles.cellSub}>{currentStep.sub}</p>
            </div>
            <span className={`${styles.badge} ${readiness >= 80 ? styles.badgeReady : styles.badgeWarn}`}>
              {readiness}% pret
            </span>
          </div>
          <div className={styles.panelBody}>
            <div className={styles.wizardProgress} aria-hidden="true">
              <span style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }} />
            </div>
          </div>
        </div>

        {currentStep.id === "profile" ? (
          <ProfileStep
            name={name}
            slug={effectiveSlug}
            location={location}
            cuisineType={cuisineType}
            status={status}
            contactName={contactName}
            contactEmail={contactEmail}
            contactPhone={contactPhone}
            googleReviewUrl={googleReviewUrl}
            notes={notes}
            menuUrl={menuUrl}
            onNameChange={updateName}
            onSlugChange={updateSlug}
            onLocationChange={setLocation}
            onCuisineTypeChange={setCuisineType}
            onStatusChange={setStatus}
            onContactNameChange={setContactName}
            onContactEmailChange={setContactEmail}
            onContactPhoneChange={setContactPhone}
            onGoogleReviewUrlChange={setGoogleReviewUrl}
            onNotesChange={setNotes}
          />
        ) : null}

        {currentStep.id === "menu" ? (
          <MenuStep
            restaurantName={name}
            menuLanguages={menuLanguages}
            defaultMenuLanguage={defaultMenuLanguage}
            supportedCurrencies={supportedCurrencies}
            baseCurrency={baseCurrency}
            defaultCurrency={defaultCurrency}
            publicMenuStyle={publicMenuStyle}
            appearancePresetId={appearancePresetId}
            primaryColor={primaryColor}
            secondaryColor={secondaryColor}
            appearancePalette={appearancePalette.palette}
            appearanceWarnings={appearancePalette.warnings}
            restaurantTimezone={restaurantTimezone}
            defaultThemeMode={defaultThemeMode}
            allowLanguageSelector={allowLanguageSelector}
            allowCurrencySelector={allowCurrencySelector}
            allowThemeToggle={allowThemeToggle}
            taxIncluded={taxIncluded}
            priceDisplayMode={priceDisplayMode}
            sections={sections}
            sectionName={sectionName}
            sectionDescription={sectionDescription}
            onToggleLanguage={toggleMenuLanguage}
            onDefaultMenuLanguageChange={setDefaultMenuLanguage}
            onToggleCurrency={toggleSupportedCurrency}
            onBaseCurrencyChange={updateBaseCurrency}
            onDefaultCurrencyChange={updateDefaultCurrency}
            onPublicMenuStyleChange={setPublicMenuStyle}
            onAppearancePresetChange={applyAppearancePreset}
            onPrimaryColorChange={setPrimaryColor}
            onSecondaryColorChange={setSecondaryColor}
            onResetAppearance={resetAppearanceToTemplate}
            onRestaurantTimezoneChange={setRestaurantTimezone}
            onDefaultThemeModeChange={setDefaultThemeMode}
            onAllowLanguageSelectorChange={setAllowLanguageSelector}
            onAllowCurrencySelectorChange={setAllowCurrencySelector}
            onAllowThemeToggleChange={setAllowThemeToggle}
            onTaxIncludedChange={setTaxIncluded}
            onPriceDisplayModeChange={setPriceDisplayMode}
            onSectionNameChange={setSectionName}
            onSectionDescriptionChange={setSectionDescription}
            onAddSection={addSection}
            onRemoveSection={removeSection}
            showAppearance={false}
          />
        ) : null}

        {currentStep.id === "dishes" ? (
          <DishesStep
            sections={sections}
            dishes={dishes}
            baseCurrency={baseCurrency}
            editingDishId={editingDishId}
            dishName={dishName}
            dishSection={dishSection || sections[0]?.name || ""}
            dishPrice={dishPrice}
            dishDisplayPriceMode={dishDisplayPriceMode}
            dishDescription={dishDescription}
            dishImageUrl={dishImageUrl}
            dishIngredients={dishIngredients}
            dishOptions={dishOptions}
            dishCustomAllergens={dishCustomAllergens}
            dishAllergenDeclarations={dishAllergenDeclarations}
            dishTags={dishTags}
            dishChefNote={dishChefNote}
            dishAvailable={dishAvailable}
            dishPhotoStatus={dishPhotoStatus}
            onDishNameChange={setDishName}
            onDishSectionChange={setDishSection}
            onDishPriceChange={setDishPrice}
            onDishDisplayPriceModeChange={setDishDisplayPriceMode}
            onDishDescriptionChange={setDishDescription}
            onDishImageUrlChange={setDishImageUrl}
            onDishIngredientsChange={setDishIngredients}
            onDishOptionsChange={setDishOptions}
            onDishCustomAllergensChange={setDishCustomAllergens}
            onAllergenStatusChange={updateAllergenStatus}
            onToggleTag={toggleTag}
            onDishChefNoteChange={setDishChefNote}
            onDishAvailableChange={setDishAvailable}
            onDishPhotoStatusChange={setDishPhotoStatus}
            onAddDish={addDish}
            onCancelEdit={resetDishDraft}
            onRemoveDish={removeDish}
            onEditDish={startEditDish}
          />
        ) : null}

        {currentStep.id === "appearance" ? (
          <MenuAppearanceStep
            restaurantName={name}
            slug={effectiveSlug}
            publicMenuSettings={publicMenuSettings}
            appearance={menuAppearance}
            publicMenuStyle={publicMenuStyle}
            appearancePresetId={appearancePresetId}
            primaryColor={primaryColor}
            secondaryColor={secondaryColor}
            appearancePalette={appearancePalette.palette}
            appearanceWarnings={appearancePalette.warnings}
            defaultThemeMode={defaultThemeMode}
            sections={sections}
            dishes={dishes}
            onPublicMenuStyleChange={setPublicMenuStyle}
            onAppearancePresetChange={applyAppearancePreset}
            onPrimaryColorChange={setPrimaryColor}
            onSecondaryColorChange={setSecondaryColor}
            onResetAppearance={resetAppearanceToTemplate}
            onDefaultThemeModeChange={setDefaultThemeMode}
          />
        ) : null}

        {currentStep.id === "review" ? (
          <ReviewStep
            readiness={readiness}
            name={name}
            location={location}
            cuisineType={cuisineType}
            googleReviewUrl={googleReviewUrl}
            menuLanguages={menuLanguages}
            publicMenuSettings={publicMenuSettings}
            sections={sections}
            dishes={dishes}
            photoReadyCount={photoReadyCount}
            menuUrl={menuUrl}
            mediaBasePathPreview={mediaBasePathPreview}
          />
        ) : null}

        <div className={styles.creationFooter}>
          <div>
            <p className={styles.sourceNote}>
              Le restaurant, les sections et les plats sont envoyes a Supabase.
              Le resultat final confirme ce qui a ete persiste.
            </p>
            {error ? (
              <p className={styles.errorText} role="alert">
                {error}
              </p>
            ) : null}
            {state.status === "error" || state.status === "fallback" ? (
              <p className={styles.errorText} role="status">
                {state.message}
              </p>
            ) : state.status === "validating" || state.status === "creating" ? (
              <p className={styles.sourceNote} role="status">
                {state.message}
              </p>
            ) : null}
          </div>
          <div className={styles.creationFooterActions}>
            <button
              type="button"
              className={styles.btn}
              onClick={goPrevious}
              disabled={stepIndex === 0 || state.status === "creating"}
            >
              Retour
            </button>
            <button
              type="submit"
              className={`${styles.btnPrimary} ${styles.btn}`}
              disabled={state.status === "creating" || state.status === "validating"}
            >
              {currentStep.id === "review" ? "Creer restaurant" : "Continuer"}
            </button>
          </div>
        </div>
      </section>
    </form>
  );
}

function ProfileStep({
  name,
  slug,
  location,
  cuisineType,
  status,
  contactName,
  contactEmail,
  contactPhone,
  googleReviewUrl,
  notes,
  menuUrl,
  onNameChange,
  onSlugChange,
  onLocationChange,
  onCuisineTypeChange,
  onStatusChange,
  onContactNameChange,
  onContactEmailChange,
  onContactPhoneChange,
  onGoogleReviewUrlChange,
  onNotesChange
}: {
  name: string;
  slug: string;
  location: string;
  cuisineType: string;
  status: OwnerRestaurantStatus;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  googleReviewUrl: string;
  notes: string;
  menuUrl: string;
  onNameChange: (value: string) => void;
  onSlugChange: (value: string) => void;
  onLocationChange: (value: string) => void;
  onCuisineTypeChange: (value: string) => void;
  onStatusChange: (status: OwnerRestaurantStatus) => void;
  onContactNameChange: (value: string) => void;
  onContactEmailChange: (value: string) => void;
  onContactPhoneChange: (value: string) => void;
  onGoogleReviewUrlChange: (value: string) => void;
  onNotesChange: (value: string) => void;
}) {
  return (
    <article className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <h3 className={styles.panelTitle}>1. Profil restaurant</h3>
          <p className={styles.cellSub}>
            L&apos;identite qui alimente le menu public, le dashboard owner et les actions QR.
          </p>
        </div>
      </div>
      <div className={styles.panelBody}>
        <div className={styles.formGrid}>
          <Field label="Nom restaurant" required value={name} onChange={onNameChange} placeholder="Le Comptoir d'ete" />
          <Field label="Slug public" required value={slug} onChange={onSlugChange} placeholder="le-comptoir-d-ete" />
          <Field label="Adresse ou ville" value={location} onChange={onLocationChange} placeholder="Montreal" />
          <Field label="Type de cuisine" value={cuisineType} onChange={onCuisineTypeChange} placeholder="Cuisine de saison" />
          <label className={styles.formField}>
            <span className={styles.filterLabel}>Statut initial</span>
            <select
              className={styles.control}
              value={status}
              onChange={(event) => onStatusChange(event.target.value as OwnerRestaurantStatus)}
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <Field label="Contact principal" value={contactName} onChange={onContactNameChange} />
          <Field label="Email contact" required type="email" value={contactEmail} onChange={onContactEmailChange} />
          <Field label="Telephone optionnel" type="tel" value={contactPhone} onChange={onContactPhoneChange} />
          <Field
            label="Lien Google Reviews"
            type="url"
            value={googleReviewUrl}
            onChange={onGoogleReviewUrlChange}
            placeholder="https://g.page/r/.../review"
            hint="Optionnel. g.page/.../review ou search.google.com/local/writereview."
          />
        </div>

        <label className={styles.formField}>
          <span className={styles.filterLabel}>Notes internes</span>
          <textarea
            className={styles.textarea}
            value={notes}
            onChange={(event) => onNotesChange(event.target.value)}
            placeholder="Priorite service, contexte salle, ouverture, ton de la carte."
          />
        </label>

        <div className={styles.urlPreview}>
          <p className={styles.metricLabel}>Menu public preview</p>
          <p className={`${styles.bodyText} ${styles.breakText}`}>{menuUrl}</p>
        </div>
      </div>
    </article>
  );
}

function MenuStep({
  restaurantName,
  menuLanguages,
  defaultMenuLanguage,
  supportedCurrencies,
  baseCurrency,
  defaultCurrency,
  publicMenuStyle,
  appearancePresetId,
  primaryColor,
  secondaryColor,
  appearancePalette,
  appearanceWarnings,
  restaurantTimezone,
  defaultThemeMode,
  allowLanguageSelector,
  allowCurrencySelector,
  allowThemeToggle,
  taxIncluded,
  priceDisplayMode,
  sections,
  sectionName,
  sectionDescription,
  onToggleLanguage,
  onDefaultMenuLanguageChange,
  onToggleCurrency,
  onBaseCurrencyChange,
  onDefaultCurrencyChange,
  onPublicMenuStyleChange,
  onAppearancePresetChange,
  onPrimaryColorChange,
  onSecondaryColorChange,
  onResetAppearance,
  onRestaurantTimezoneChange,
  onDefaultThemeModeChange,
  onAllowLanguageSelectorChange,
  onAllowCurrencySelectorChange,
  onAllowThemeToggleChange,
  onTaxIncludedChange,
  onPriceDisplayModeChange,
  onSectionNameChange,
  onSectionDescriptionChange,
  onAddSection,
  onRemoveSection,
  showAppearance
}: {
  restaurantName: string;
  menuLanguages: MenuLanguage[];
  defaultMenuLanguage: MenuLanguage;
  supportedCurrencies: MenuCurrency[];
  baseCurrency: MenuCurrency;
  defaultCurrency: MenuCurrency;
  publicMenuStyle: PublicMenuStyle;
  appearancePresetId: string;
  primaryColor: string;
  secondaryColor: string;
  appearancePalette: {
    background: string;
    surface: string;
    text: string;
    muted: string;
    accent: string;
    accent2: string;
    accent3: string;
    border: string;
    success: string;
    warning: string;
    danger: string;
  };
  appearanceWarnings: string[];
  restaurantTimezone: string;
  defaultThemeMode: PublicMenuThemeMode;
  allowLanguageSelector: boolean;
  allowCurrencySelector: boolean;
  allowThemeToggle: boolean;
  taxIncluded: boolean;
  priceDisplayMode: PublicMenuPriceDisplayMode;
  sections: DraftSection[];
  sectionName: string;
  sectionDescription: string;
  onToggleLanguage: (language: MenuLanguage) => void;
  onDefaultMenuLanguageChange: (language: MenuLanguage) => void;
  onToggleCurrency: (currency: MenuCurrency) => void;
  onBaseCurrencyChange: (currency: MenuCurrency) => void;
  onDefaultCurrencyChange: (currency: MenuCurrency) => void;
  onPublicMenuStyleChange: (style: PublicMenuStyle) => void;
  onAppearancePresetChange: (presetId: string) => void;
  onPrimaryColorChange: (value: string) => void;
  onSecondaryColorChange: (value: string) => void;
  onResetAppearance: () => void;
  onRestaurantTimezoneChange: (timezone: string) => void;
  onDefaultThemeModeChange: (theme: PublicMenuThemeMode) => void;
  onAllowLanguageSelectorChange: (value: boolean) => void;
  onAllowCurrencySelectorChange: (value: boolean) => void;
  onAllowThemeToggleChange: (value: boolean) => void;
  onTaxIncludedChange: (value: boolean) => void;
  onPriceDisplayModeChange: (mode: PublicMenuPriceDisplayMode) => void;
  onSectionNameChange: (value: string) => void;
  onSectionDescriptionChange: (value: string) => void;
  onAddSection: () => void;
  onRemoveSection: (id: string) => void;
  showAppearance: boolean;
}) {
  const [customLanguage, setCustomLanguage] = useState("");
  const [customCurrency, setCustomCurrency] = useState("");
  const availableLanguageOptions = menuLanguageOptions.filter(
    (option) => !menuLanguages.includes(option.value)
  );
  const availableCurrencyOptions = currencyOptions.filter(
    (option) => !supportedCurrencies.includes(option.value)
  );
  const hasMultipleCurrencies = supportedCurrencies.length > 1;

  function addLanguage(value: string) {
    const language = normalizeLanguageInput(value);
    if (!language || menuLanguages.includes(language)) return;
    onToggleLanguage(language);
  }

  function addCustomLanguage() {
    addLanguage(customLanguage);
    setCustomLanguage("");
  }

  function addCurrency(value: string) {
    const currency = normalizeCurrencyInput(value);
    if (!currency || supportedCurrencies.includes(currency)) return;
    onToggleCurrency(currency);
  }

  function addCustomCurrency() {
    addCurrency(customCurrency);
    setCustomCurrency("");
  }

  return (
    <article className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <h3 className={styles.panelTitle}>2. Structure menu</h3>
          <p className={styles.cellSub}>
            Les sections deviennent les categories des plats persistants.
          </p>
        </div>
      </div>
      <div className={styles.panelBody}>
        <section className={styles.menuLanguagePanel} aria-labelledby="menu-language-title">
          <div>
            <h4 id="menu-language-title">Langues du menu</h4>
            <p>{formatMenuLanguages(menuLanguages)}</p>
          </div>
          <div className={styles.formGrid}>
            <label className={styles.formField}>
              <span className={styles.filterLabel}>Ajouter une langue</span>
              <select
                className={styles.control}
                value=""
                aria-label="Ajouter une langue au menu"
                onChange={(event) => addLanguage(event.target.value)}
              >
                <option value="">Choisir une langue...</option>
                {availableLanguageOptions.map((option) => (
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
                value={customLanguage}
                placeholder="ex: ja-JP, ar, es-MX"
                aria-label="Ajouter un code langue personnalise"
                onChange={(event) => setCustomLanguage(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addCustomLanguage();
                  }
                }}
              />
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSmall}`}
                onClick={addCustomLanguage}
              >
                Ajouter
              </button>
            </label>
          </div>
          <div className={styles.inlineDraftList} aria-label="Langues selectionnees">
            {menuLanguages.map((language) => (
              <article key={language} className={styles.draftChip}>
                <strong>{getMenuLanguageLabel(language)}</strong>
                <small>{language}</small>
                <button
                  type="button"
                  disabled={menuLanguages.length === 1}
                  onClick={() => onToggleLanguage(language)}
                >
                  Retirer
                </button>
              </article>
            ))}
          </div>
        </section>

        {showAppearance ? (
        <section className={styles.menuLanguagePanel} aria-labelledby="menu-public-style-title">
          <div>
            <h4 id="menu-public-style-title">Expérience et apparence du menu public</h4>
            <p>
              Le choix est enregistré avec ce restaurant et appliqué au menu QR public
              et aux fiches plats après publication.
            </p>
          </div>

          <div className={styles.toggleCardGrid} role="group" aria-label="Template du menu public">
            {publicMenuStyleOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`${styles.toggleCard} ${
                  publicMenuStyle === option.value ? styles.toggleCardActive : ""
                }`}
                aria-pressed={publicMenuStyle === option.value}
                onClick={() => onPublicMenuStyleChange(option.value)}
              >
                <strong>
                  {option.label}
                  {option.badge ? (
                    <span className={`${styles.badge} ${styles.badgeWarn}`} style={{ marginLeft: 8 }}>
                      {option.badge}
                    </span>
                  ) : null}
                  {publicMenuStyle === option.value ? (
                    <span className={styles.badge} style={{ marginLeft: 8 }}>
                      Sélectionné
                    </span>
                  ) : null}
                </strong>
                <span>{option.detail}</span>
                {option.secondary ? <span>{option.secondary}</span> : null}
              </button>
            ))}
          </div>

          {publicMenuStyle === "unique" ? (
            <section
              className={styles.menuLanguagePanel}
              aria-labelledby="menu-unique-design-info-title"
              role="status"
            >
              <div>
                <h4 id="menu-unique-design-info-title">Design unique à construire</h4>
                <p>
                  Une nouvelle identité de design sera créée pour ce restaurant. Aucun template
                  partagé ne lui sera associé.
                </p>
              </div>
              <ul className={styles.sourceNote}>
                <li>identifiant unique généré après création</li>
                <li>développement séparé</li>
                <li>publication séparée</li>
                <li>aucun impact sur les autres restaurants</li>
              </ul>
            </section>
          ) : null}

          <div
            className={styles.urlPreview}
            aria-label="Aperçu non publié de l'apparence du menu"
            style={{
              backgroundColor: appearancePalette.background,
              color: appearancePalette.text,
              borderColor: appearancePalette.border
            }}
          >
            <p className={styles.metricLabel} style={{ color: appearancePalette.muted }}>
              Aperçu non publié · {publicMenuStyle === "trouvable" ? "Immersif" : "Éditorial"}
            </p>
            <p className={styles.bodyText} style={{ color: appearancePalette.text }}>
              <strong>{restaurantName.trim() || "Votre restaurant"}</strong>
            </p>
            <p className={styles.sourceNote} style={{ color: appearancePalette.muted }}>
              Un aperçu de la hiérarchie, des contrastes et des accents choisis.
            </p>
            <div className={styles.choiceRow} aria-hidden="true">
              <span
                className={styles.choiceButton}
                style={{
                  backgroundColor: appearancePalette.accent,
                  borderColor: appearancePalette.accent,
                  color: appearancePalette.background
                }}
              >
                Carte
              </span>
              <span
                className={styles.choiceButton}
                style={{
                  backgroundColor: appearancePalette.surface,
                  borderColor: appearancePalette.border,
                  color: appearancePalette.text
                }}
              >
                Signature
              </span>
              <span
                className={styles.choiceButton}
                style={{
                  backgroundColor: appearancePalette.accent2,
                  borderColor: appearancePalette.accent2,
                  color: appearancePalette.background
                }}
              >
                28 CAD
              </span>
            </div>
          </div>

          <div>
            <h4 id="menu-appearance-presets-title">Palette premium</h4>
            <p>Choisissez un preset, puis ajustez librement les deux couleurs principales.</p>
          </div>
          <div
            className={styles.toggleCardGrid}
            role="group"
            aria-labelledby="menu-appearance-presets-title"
          >
            {MENU_STYLE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`${styles.toggleCard} ${
                  appearancePresetId === preset.id ? styles.toggleCardActive : ""
                }`}
                aria-pressed={appearancePresetId === preset.id}
                onClick={() => onAppearancePresetChange(preset.id)}
              >
                <span
                  aria-hidden="true"
                  style={{
                    display: "inline-flex",
                    width: 56,
                    height: 18,
                    borderRadius: 999,
                    background: `linear-gradient(90deg, ${preset.primaryColor} 0 50%, ${preset.secondaryColor} 50% 100%)`,
                    border: "1px solid rgba(255,255,255,.18)"
                  }}
                />
                <strong>{preset.label}</strong>
                <span>{preset.description}</span>
              </button>
            ))}
          </div>

          <div className={styles.formGrid}>
            <label className={styles.formField}>
              <span className={styles.filterLabel}>Couleur principale</span>
              <div className={styles.inlineControlGroup}>
                <input
                  type="color"
                  value={normalizeHexColor(primaryColor, appearancePalette.accent)}
                  aria-label="Sélecteur de couleur principale"
                  onChange={(event) => onPrimaryColorChange(event.target.value)}
                />
                <input
                  className={styles.control}
                  value={primaryColor}
                  inputMode="text"
                  maxLength={7}
                  aria-label="Code hexadécimal de la couleur principale"
                  onChange={(event) => onPrimaryColorChange(event.target.value)}
                />
              </div>
            </label>
            <label className={styles.formField}>
              <span className={styles.filterLabel}>Couleur secondaire</span>
              <div className={styles.inlineControlGroup}>
                <input
                  type="color"
                  value={normalizeHexColor(secondaryColor, appearancePalette.accent2)}
                  aria-label="Sélecteur de couleur secondaire"
                  onChange={(event) => onSecondaryColorChange(event.target.value)}
                />
                <input
                  className={styles.control}
                  value={secondaryColor}
                  inputMode="text"
                  maxLength={7}
                  aria-label="Code hexadécimal de la couleur secondaire"
                  onChange={(event) => onSecondaryColorChange(event.target.value)}
                />
              </div>
            </label>
          </div>

          <div className={styles.formGrid}>
            <label className={styles.formField}>
              <span className={styles.filterLabel}>Fond par défaut</span>
              <select
                className={styles.control}
                value={defaultThemeMode}
                onChange={(event) => onDefaultThemeModeChange(event.target.value as PublicMenuThemeMode)}
              >
                {themeModeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <div className={styles.formField}>
              <span className={styles.filterLabel}>Palette calculée</span>
              <span className={styles.sourceNote}>
                Fond {appearancePalette.background} · texte {appearancePalette.text}
              </span>
              <button type="button" className={`${styles.btn} ${styles.btnSmall}`} onClick={onResetAppearance}>
                Réinitialiser le preset du template
              </button>
            </div>
          </div>
          {appearanceWarnings.length > 0 ? (
            <p className={styles.sourceNote} role="status">
              {appearanceWarnings.join(" ")}
            </p>
          ) : null}
        </section>
        ) : null}

        <section className={styles.menuLanguagePanel} aria-labelledby="menu-settings-title">
          <div>
            <h4 id="menu-settings-title">Langues, devises et experience client</h4>
            <p>
              Les prix saisis dans l&apos;etape Plats sont dans la devise de base:
              {" "}
              {baseCurrency}. Les conversions client restent calculees depuis
              cette source.
            </p>
          </div>

          <div className={styles.formGrid}>
            <label className={styles.formField}>
              <span className={styles.filterLabel}>Langue par defaut</span>
              <select
                className={styles.control}
                value={defaultMenuLanguage}
                onChange={(event) =>
                  onDefaultMenuLanguageChange(event.target.value as MenuLanguage)
                }
              >
                {menuLanguages.map((language) => (
                  <option key={language} value={language}>
                    {getMenuLanguageLabel(language)}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.formField}>
              <span className={styles.filterLabel}>Timezone restaurant</span>
              <input
                className={styles.control}
                value={restaurantTimezone}
                placeholder="America/Toronto"
                onChange={(event) => onRestaurantTimezoneChange(event.target.value)}
              />
            </label>
          </div>

          <div className={styles.formGrid}>
            <label className={styles.formField}>
              <span className={styles.filterLabel}>Ajouter une devise</span>
              <select
                className={styles.control}
                value=""
                aria-label="Ajouter une devise au menu"
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
                placeholder="ex: GBP, JPY, CHF"
                maxLength={3}
                aria-label="Ajouter un code devise personnalise"
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
                onClick={addCustomCurrency}
              >
                Ajouter
              </button>
            </label>
          </div>

          <div className={styles.inlineDraftList} aria-label="Devises selectionnees">
            {supportedCurrencies.map((currency) => (
              <article key={currency} className={styles.draftChip}>
                <strong>{currency}</strong>
                <small>{getCurrencyDetail(currency)}</small>
                <button
                  type="button"
                  disabled={supportedCurrencies.length === 1}
                  onClick={() => onToggleCurrency(currency)}
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
                value={baseCurrency}
                aria-describedby="base-currency-help"
                onChange={(event) =>
                  onBaseCurrencyChange(event.target.value as MenuCurrency)
                }
              >
                {supportedCurrencies.map((currency) => (
                  <option key={currency} value={currency}>
                    {formatCurrencyOption(currency)}
                  </option>
                ))}
              </select>
              <small id="base-currency-help" className={styles.fieldHelp}>
                Source officielle: les prix ajoutes a l&apos;etape Plats sont
                en {baseCurrency}.
              </small>
            </label>
            {hasMultipleCurrencies ? (
              <label className={styles.formField}>
                <span className={styles.filterLabel}>Devise affichee au client</span>
                <select
                  className={styles.control}
                  value={defaultCurrency}
                  aria-describedby="default-currency-help"
                  onChange={(event) =>
                    onDefaultCurrencyChange(event.target.value as MenuCurrency)
                  }
                >
                  {supportedCurrencies.map((currency) => (
                    <option key={currency} value={currency}>
                      {formatCurrencyOption(currency)}
                    </option>
                  ))}
                </select>
                <small id="default-currency-help" className={styles.fieldHelp}>
                  Devise ouverte par defaut sur le menu public. Le client peut
                  changer si le selecteur devise est autorise.
                </small>
              </label>
            ) : (
              <div className={styles.lockedSetting}>
                <span className={styles.filterLabel}>Devise affichee au client</span>
                <strong>{formatCurrencyOption(defaultCurrency)}</strong>
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
                value={defaultThemeMode}
                onChange={(event) =>
                  onDefaultThemeModeChange(event.target.value as PublicMenuThemeMode)
                }
              >
                {themeModeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.formField}>
              <span className={styles.filterLabel}>Affichage prix par defaut</span>
              <select
                className={styles.control}
                value={priceDisplayMode}
                onChange={(event) =>
                  onPriceDisplayModeChange(event.target.value as PublicMenuPriceDisplayMode)
                }
              >
                <option value="auto">Auto</option>
                <option value="integer">Sans cents</option>
                <option value="decimal">Avec cents</option>
              </select>
            </label>
          </div>

          <div className={styles.toggleCardGrid}>
            <label className={styles.toggleLine}>
              <input
                type="checkbox"
                checked={allowLanguageSelector}
                onChange={(event) => onAllowLanguageSelectorChange(event.target.checked)}
              />
              <span>Autoriser le changement de langue</span>
            </label>
            <label className={styles.toggleLine}>
              <input
                type="checkbox"
                checked={allowCurrencySelector}
                onChange={(event) => onAllowCurrencySelectorChange(event.target.checked)}
              />
              <span>Autoriser le changement de devise</span>
            </label>
            <label className={styles.toggleLine}>
              <input
                type="checkbox"
                checked={allowThemeToggle}
                onChange={(event) => onAllowThemeToggleChange(event.target.checked)}
              />
              <span>Autoriser dark/light cote client</span>
            </label>
            <label className={styles.toggleLine}>
              <input
                type="checkbox"
                checked={taxIncluded}
                onChange={(event) => onTaxIncludedChange(event.target.checked)}
              />
              <span>Taxes incluses dans les prix affiches</span>
            </label>
          </div>
        </section>

        <div className={styles.formGrid}>
          <Field label="Nom section" value={sectionName} onChange={onSectionNameChange} placeholder="Entrees" />
          <Field label="Description" value={sectionDescription} onChange={onSectionDescriptionChange} placeholder="Ouvertures de saison" />
        </div>
        <div className={styles.submitRow}>
          <button type="button" className={`${styles.btnPrimary} ${styles.btn}`} onClick={onAddSection}>
            Ajouter section
          </button>
        </div>

        <div className={styles.inlineDraftList}>
          {sections.length === 0 ? (
            <div className={styles.emptyState}>Aucune section ajoutee.</div>
          ) : (
            sections.map((section) => (
              <span key={section.id} className={styles.draftChip}>
                <strong>{section.name}</strong>
                <small>{section.description || "Section menu"}</small>
                <button type="button" onClick={() => onRemoveSection(section.id)}>
                  Retirer
                </button>
              </span>
            ))
          )}
        </div>
      </div>
    </article>
  );
}

function MenuAppearanceStep({
  restaurantName,
  slug,
  publicMenuSettings,
  appearance,
  publicMenuStyle,
  appearancePresetId,
  primaryColor,
  secondaryColor,
  appearancePalette,
  appearanceWarnings,
  defaultThemeMode,
  sections,
  dishes,
  onPublicMenuStyleChange,
  onAppearancePresetChange,
  onPrimaryColorChange,
  onSecondaryColorChange,
  onResetAppearance,
  onDefaultThemeModeChange
}: {
  restaurantName: string;
  slug: string;
  publicMenuSettings: PublicMenuSettings;
  appearance: MenuAppearanceSelection;
  publicMenuStyle: PublicMenuStyle;
  appearancePresetId: string;
  primaryColor: string;
  secondaryColor: string;
  appearancePalette: MenuAppearancePalette;
  appearanceWarnings: string[];
  defaultThemeMode: PublicMenuThemeMode;
  sections: DraftSection[];
  dishes: DraftDish[];
  onPublicMenuStyleChange: (style: PublicMenuStyle) => void;
  onAppearancePresetChange: (presetId: string) => void;
  onPrimaryColorChange: (value: string) => void;
  onSecondaryColorChange: (value: string) => void;
  onResetAppearance: () => void;
  onDefaultThemeModeChange: (mode: PublicMenuThemeMode) => void;
}) {
  return (
    <article className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <h3 className={styles.panelTitle}>4. Style du menu</h3>
          <p className={styles.cellSub}>
            Choisissez l&apos;identité visuelle après avoir construit le contenu de votre carte.
          </p>
        </div>
      </div>
      <div className={styles.panelBody}>
        <div className={styles.menuAppearanceLayout}>
          <div className={styles.menuAppearanceControls}>
            <section className={styles.menuLanguagePanel} aria-labelledby="menu-public-style-title">
              <div>
                <h4 id="menu-public-style-title">Expérience et apparence du menu public</h4>
                <p>
                  Le choix est enregistré avec ce restaurant et appliqué au menu QR public et aux fiches plats.
                </p>
              </div>
              <div className={styles.toggleCardGrid} role="group" aria-label="Template du menu public">
                {publicMenuStyleOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`${styles.toggleCard} ${
                      publicMenuStyle === option.value ? styles.toggleCardActive : ""
                    }`}
                    aria-pressed={publicMenuStyle === option.value}
                    onClick={() => onPublicMenuStyleChange(option.value)}
                  >
                    <strong>
                      {option.label}
                      {option.badge ? (
                        <span className={`${styles.badge} ${styles.badgeWarn}`} style={{ marginLeft: 8 }}>
                          {option.badge}
                        </span>
                      ) : null}
                      {publicMenuStyle === option.value ? (
                        <span className={styles.badge} style={{ marginLeft: 8 }}>
                          Sélectionné
                        </span>
                      ) : null}
                    </strong>
                    <span>{option.detail}</span>
                    {option.secondary ? <span>{option.secondary}</span> : null}
                  </button>
                ))}
              </div>
              {publicMenuStyle === "unique" ? (
                <section
                  className={styles.menuLanguagePanel}
                  aria-labelledby="menu-unique-design-info-title-appearance"
                  role="status"
                >
                  <div>
                    <h4 id="menu-unique-design-info-title-appearance">Design unique à construire</h4>
                    <p>
                      Une nouvelle identité de design sera créée pour ce restaurant. Aucun template
                      partagé ne lui sera associé.
                    </p>
                  </div>
                  <ul className={styles.sourceNote}>
                    <li>identifiant unique généré après création</li>
                    <li>développement séparé</li>
                    <li>publication séparée</li>
                    <li>aucun impact sur les autres restaurants</li>
                  </ul>
                </section>
              ) : null}
            </section>

            <section className={styles.menuLanguagePanel} aria-labelledby="menu-appearance-presets-title">
              <div>
                <h4 id="menu-appearance-presets-title">
                  {publicMenuStyle === "unique"
                    ? "Identité visuelle de secours"
                    : "Palette premium"}
                </h4>
                <p>
                  {publicMenuStyle === "unique"
                    ? "Ces couleurs servent au fallback public avant le développement du UI final."
                    : "Choisissez un preset, puis ajustez librement les deux couleurs principales."}
                </p>
              </div>
              <div
                className={styles.toggleCardGrid}
                role="group"
                aria-labelledby="menu-appearance-presets-title"
              >
                {MENU_STYLE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={`${styles.toggleCard} ${
                      appearancePresetId === preset.id ? styles.toggleCardActive : ""
                    }`}
                    aria-pressed={appearancePresetId === preset.id}
                    onClick={() => onAppearancePresetChange(preset.id)}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        display: "inline-flex",
                        width: 56,
                        height: 18,
                        borderRadius: 999,
                        background: `linear-gradient(90deg, ${preset.primaryColor} 0 50%, ${preset.secondaryColor} 50% 100%)`,
                        border: "1px solid rgba(255,255,255,.18)"
                      }}
                    />
                    <strong>{preset.label}</strong>
                    <span>{preset.description}</span>
                  </button>
                ))}
              </div>

              <div className={styles.formGrid}>
                <label className={styles.formField}>
                  <span className={styles.filterLabel}>Couleur principale</span>
                  <div className={styles.inlineControlGroup}>
                    <input
                      type="color"
                      value={normalizeHexColor(primaryColor, appearancePalette.accent)}
                      aria-label="Sélecteur de couleur principale"
                      onChange={(event) => onPrimaryColorChange(event.target.value)}
                    />
                    <input
                      className={styles.control}
                      value={primaryColor}
                      inputMode="text"
                      maxLength={7}
                      aria-label="Code hexadécimal de la couleur principale"
                      onChange={(event) => onPrimaryColorChange(event.target.value)}
                    />
                  </div>
                </label>
                <label className={styles.formField}>
                  <span className={styles.filterLabel}>Couleur secondaire</span>
                  <div className={styles.inlineControlGroup}>
                    <input
                      type="color"
                      value={normalizeHexColor(secondaryColor, appearancePalette.accent2)}
                      aria-label="Sélecteur de couleur secondaire"
                      onChange={(event) => onSecondaryColorChange(event.target.value)}
                    />
                    <input
                      className={styles.control}
                      value={secondaryColor}
                      inputMode="text"
                      maxLength={7}
                      aria-label="Code hexadécimal de la couleur secondaire"
                      onChange={(event) => onSecondaryColorChange(event.target.value)}
                    />
                  </div>
                </label>
              </div>

              <div className={styles.formGrid}>
                <label className={styles.formField}>
                  <span className={styles.filterLabel}>Fond par défaut</span>
                  <select
                    className={styles.control}
                    value={defaultThemeMode}
                    onChange={(event) => onDefaultThemeModeChange(event.target.value as PublicMenuThemeMode)}
                  >
                    {themeModeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className={styles.formField}>
                  <span className={styles.filterLabel}>Palette calculée</span>
                  <span className={styles.sourceNote}>
                    Fond {appearancePalette.background} · texte {appearancePalette.text}
                  </span>
                  <button type="button" className={`${styles.btn} ${styles.btnSmall}`} onClick={onResetAppearance}>
                    Réinitialiser le preset du template
                  </button>
                </div>
              </div>
              {appearanceWarnings.length > 0 ? (
                <p className={styles.sourceNote} role="status">
                  {appearanceWarnings.join(" ")}
                </p>
              ) : null}
            </section>
          </div>

          <div className={styles.menuAppearancePreview}>
            <div className={styles.menuAppearancePreviewHeader}>
              <div>
                <span className={styles.metricLabel}>Aperçu client</span>
                <p className={styles.cellSub}>Votre menu sur téléphone</p>
              </div>
              <span className={`${styles.badge} ${publicMenuStyle === "unique" ? styles.badgeWarn : ""}`}>
                {publicMenuStyle === "trouvable"
                  ? "Immersif"
                  : publicMenuStyle === "maison-elyse"
                    ? "Éditorial"
                    : "APERÇU DE SECOURS"}
              </span>
            </div>
            <div
              className={styles.menuPhoneFrame}
              style={{ borderColor: appearancePalette.border, position: "relative" }}
              aria-label={`Aperçu mobile du menu de ${restaurantName.trim() || "Votre restaurant"}`}
            >
              {publicMenuStyle === "unique" ? (
                <span
                  className={`${styles.badge} ${styles.badgeWarn}`}
                  style={{ position: "absolute", top: 18, right: 18, zIndex: 3 }}
                >
                  APERÇU DE SECOURS
                </span>
              ) : null}
              <div className={styles.menuPhoneNotch} aria-hidden="true" />
              <div className={styles.menuPhoneTopbar} style={{ color: appearancePalette.muted }}>
                <span>09:41</span>
                <span aria-hidden="true">•••</span>
              </div>
              <div
                className={styles.menuPhoneScreen}
                data-phone-mockup-scroll
                style={{ backgroundColor: appearancePalette.background, color: appearancePalette.text }}
              >
                <OwnerMenuLivePreview
                  restaurantName={restaurantName}
                  slug={slug}
                  publicMenuSettings={publicMenuSettings}
                  appearance={appearance}
                  sections={sections}
                  dishes={dishes}
                />
              </div>
            </div>
            <p className={styles.sourceNote}>
              Aperçu instantané : il suit le template et la palette sélectionnés avant publication.
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}

function DishesStep({
  sections,
  dishes,
  baseCurrency,
  editingDishId,
  dishName,
  dishSection,
  dishPrice,
  dishDisplayPriceMode,
  dishDescription,
  dishImageUrl,
  dishIngredients,
  dishOptions,
  dishCustomAllergens,
  dishAllergenDeclarations,
  dishTags,
  dishChefNote,
  dishAvailable,
  dishPhotoStatus,
  onDishNameChange,
  onDishSectionChange,
  onDishPriceChange,
  onDishDisplayPriceModeChange,
  onDishDescriptionChange,
  onDishImageUrlChange,
  onDishIngredientsChange,
  onDishOptionsChange,
  onDishCustomAllergensChange,
  onAllergenStatusChange,
  onToggleTag,
  onDishChefNoteChange,
  onDishAvailableChange,
  onDishPhotoStatusChange,
  onAddDish,
  onCancelEdit,
  onRemoveDish,
  onEditDish
}: {
  sections: DraftSection[];
  dishes: DraftDish[];
  baseCurrency: MenuCurrency;
  editingDishId: string;
  dishName: string;
  dishSection: string;
  dishPrice: string;
  dishDisplayPriceMode: DisplayPriceMode;
  dishDescription: string;
  dishImageUrl: string;
  dishIngredients: string;
  dishOptions: string;
  dishCustomAllergens: string;
  dishAllergenDeclarations: DishAllergenDeclaration[];
  dishTags: string[];
  dishChefNote: string;
  dishAvailable: boolean;
  dishPhotoStatus: CreateRestaurantDishPhotoStatus;
  onDishNameChange: (value: string) => void;
  onDishSectionChange: (value: string) => void;
  onDishPriceChange: (value: string) => void;
  onDishDisplayPriceModeChange: (value: DisplayPriceMode) => void;
  onDishDescriptionChange: (value: string) => void;
  onDishImageUrlChange: (value: string) => void;
  onDishIngredientsChange: (value: string) => void;
  onDishOptionsChange: (value: string) => void;
  onDishCustomAllergensChange: (value: string) => void;
  onAllergenStatusChange: (allergenId: string, status: AllergenStatus) => void;
  onToggleTag: (value: string) => void;
  onDishChefNoteChange: (value: string) => void;
  onDishAvailableChange: (value: boolean) => void;
  onDishPhotoStatusChange: (value: CreateRestaurantDishPhotoStatus) => void;
  onAddDish: () => void;
  onCancelEdit: () => void;
  onRemoveDish: (id: string) => void;
  onEditDish: (dish: DraftDish) => void;
}) {
  return (
    <article className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <h3 className={styles.panelTitle}>3. Plats</h3>
          <p className={styles.cellSub}>
            Les champs ci-dessous correspondent aux colonnes utiles du menu public.
          </p>
        </div>
      </div>
      <div className={styles.panelBody}>
        <div className={styles.formGrid}>
          <Field label="Nom plat" value={dishName} onChange={onDishNameChange} placeholder="Bar de ligne, fenouil confit" />
          <label className={styles.formField}>
            <span className={styles.filterLabel}>Section</span>
            <select
              className={styles.control}
              value={dishSection}
              onChange={(event) => onDishSectionChange(event.target.value)}
            >
              {sections.map((section) => (
                <option key={section.id} value={section.name}>
                  {section.name}
                </option>
              ))}
            </select>
          </label>
          <Field
            label={`Prix (${baseCurrency})`}
            type="text"
            inputMode="decimal"
            value={dishPrice}
            onChange={onDishPriceChange}
            placeholder="14,99"
          />
          <label className={styles.formField}>
            <span className={styles.filterLabel}>Affichage prix</span>
            <select
              className={styles.control}
              value={dishDisplayPriceMode}
              onChange={(event) =>
                onDishDisplayPriceModeChange(event.target.value as DisplayPriceMode)
              }
            >
              <option value="auto">Auto</option>
              <option value="integer">Sans cents</option>
              <option value="decimal">Avec cents</option>
            </select>
          </label>
          <Field
            label="URL photo"
            type="text"
            value={dishImageUrl}
            onChange={onDishImageUrlChange}
            placeholder="/restaurants/.../photos/plat.jpg"
          />
        </div>

        <label className={styles.formField}>
          <span className={styles.filterLabel}>Description courte</span>
          <textarea
            className={styles.textarea}
            value={dishDescription}
            onChange={(event) => onDishDescriptionChange(event.target.value)}
            placeholder="Fenouil confit, beurre blanc citronne, herbes fraiches."
          />
        </label>

        <div className={styles.formGrid}>
          <Field
            label="Ingredients principaux"
            value={dishIngredients}
            onChange={onDishIngredientsChange}
            placeholder="bar, fenouil, citron"
          />
          <Field
            label="Options, extras / accompagnements"
            value={dishOptions}
            onChange={onDishOptionsChange}
            placeholder="Sans lactose sur demande, salade verte"
          />
          <Field
            label="Autres allergènes"
            value={dishCustomAllergens}
            onChange={onDishCustomAllergensChange}
            placeholder="Céleri, lupin, allergène fournisseur"
          />
          <Field
            label="Note du chef"
            value={dishChefNote}
            onChange={onDishChefNoteChange}
            placeholder="Servir bien chaud."
          />
          <label className={styles.formField}>
            <span className={styles.filterLabel}>Statut photo</span>
            <select
              className={styles.control}
              value={dishPhotoStatus}
              onChange={(event) =>
                onDishPhotoStatusChange(event.target.value as CreateRestaurantDishPhotoStatus)
              }
            >
              {photoStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <fieldset className={styles.formField}>
          <legend>Déclarations allergènes</legend>
          <p className={styles.cellSub}>
            Chaque allergène doit avoir un statut explicite. Les statuts « À confirmer »
            ne permettent jamais de passer un filtre sans allergène.
          </p>
          <p className={styles.cellSub}>
            Ne sélectionnez « Déclaré sans » qu’après vérification de la recette, des sauces,
            des fonds, des garnitures et des risques de contamination croisée.
          </p>
          <div className={styles.formGrid}>
            {ALLERGEN_REGISTRY.map(({ id }) => {
              const declaration = dishAllergenDeclarations.find(
                (item) => item.allergenId === id
              );
              return (
                <label key={id} className={styles.formField}>
                  <span>{allergenLabel(id, "fr")}</span>
                  <select
                    className={styles.control}
                    value={declaration?.status ?? "unknown"}
                    onChange={(event) =>
                      onAllergenStatusChange(id, event.target.value as AllergenStatus)
                    }
                  >
                    {allergenStatusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              );
            })}
          </div>
        </fieldset>
        <ChoiceGroup
          title="Badges"
          options={badgeOptions}
          selected={dishTags}
          onToggle={onToggleTag}
        />

        <label className={styles.toggleLine}>
          <input
            type="checkbox"
            checked={dishAvailable}
            onChange={(event) => onDishAvailableChange(event.target.checked)}
          />
          <span>Disponibilite</span>
        </label>

        <div className={styles.submitRow}>
          <button type="button" className={`${styles.btnPrimary} ${styles.btn}`} onClick={onAddDish}>
            {editingDishId ? "Mettre a jour le plat" : "Ajouter plat"}
          </button>
          {editingDishId ? (
            <button type="button" className={styles.btn} onClick={onCancelEdit}>
              Annuler
            </button>
          ) : null}
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>Plat</th>
                <th>Section</th>
                <th>Prix</th>
                <th>Photo</th>
                <th>Details</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {dishes.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className={styles.emptyState}>Aucun plat ajoute.</div>
                  </td>
                </tr>
              ) : (
                dishes.map((dish) => (
                  <tr key={dish.id}>
                    <td>
                      <strong className={styles.cellMain}>{dish.name}</strong>
                      <small className={styles.cellSub}>{dish.description}</small>
                    </td>
                    <td className={styles.cellSub}>{dish.section}</td>
                    <td>{formatPrice(dish.price, dish.displayPriceMode, baseCurrency)}</td>
                    <td>
                      <span className={`${styles.badge} ${dish.photoStatus === "ready" || dish.imageUrl ? styles.badgeReady : styles.badgeWarn}`}>
                        {formatPhotoStatus(dish.photoStatus)}
                      </span>
                    </td>
                    <td className={styles.cellSub}>
                      {formatList([...dish.tags, ...dish.allergens].slice(0, 4))}
                    </td>
                    <td>
                      <div className={styles.tableActions}>
                        <button
                          type="button"
                          className={`${styles.btnSmall} ${styles.btn}`}
                          onClick={() => onEditDish(dish)}
                        >
                          Modifier
                        </button>
                        <button
                          type="button"
                          className={`${styles.btnDanger} ${styles.btnSmall} ${styles.btn}`}
                          onClick={() => onRemoveDish(dish.id)}
                        >
                          Retirer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </article>
  );
}

function ReviewStep({
  readiness,
  name,
  location,
  cuisineType,
  googleReviewUrl,
  menuLanguages,
  publicMenuSettings,
  sections,
  dishes,
  photoReadyCount,
  menuUrl,
  mediaBasePathPreview
}: {
  readiness: number;
  name: string;
  location: string;
  cuisineType: string;
  googleReviewUrl: string;
  menuLanguages: MenuLanguage[];
  publicMenuSettings: PublicMenuSettings;
  sections: DraftSection[];
  dishes: DraftDish[];
  photoReadyCount: number;
  menuUrl: string;
  mediaBasePathPreview: string;
}) {
  const sectionsWithoutDish = getSectionsWithoutDish(sections, dishes);
  const checks = [
    ["Profil", Boolean(name), `${name || "Nom a completer"} - ${location || "Lieu a preciser"}`],
    ["Langues", menuLanguages.length > 0, formatMenuLanguages(menuLanguages)],
    [
      "Devises",
      publicMenuSettings.supportedCurrencies.length > 0,
      `${formatCurrencies(publicMenuSettings.supportedCurrencies)} - base ${publicMenuSettings.baseCurrency}`
    ],
    [
      "Style menu",
      true,
      getPublicMenuStyleLabel(publicMenuSettings.publicMenuStyle)
    ],
    [
      "Experience",
      true,
      `${getMenuLanguageLabel(publicMenuSettings.defaultLocale)} - ${publicMenuSettings.defaultCurrency} - ${publicMenuSettings.defaultThemeMode}`
    ],
    [
      "Sections",
      sections.length > 0 && sectionsWithoutDish.length === 0,
      sectionsWithoutDish.length > 0
        ? `Sans plat : ${sectionsWithoutDish.join(", ")}`
        : `${sections.length} section(s)`
    ],
    ["Plats", dishes.length > 0, `${dishes.length} plat(s)`],
    ["Photos", photoReadyCount > 0, `${photoReadyCount}/${dishes.length} prete(s) ou liee(s)`],
    [
      "Avis Google",
      true,
      googleReviewUrl.trim() ? "Lien Google Reviews pret" : "Aucun lien Google Reviews"
    ]
  ] as const;

  return (
    <article className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <h3 className={styles.panelTitle}>4. Revue finale</h3>
          <p className={styles.cellSub}>
            {readiness >= 80
              ? "La base menu est solide pour creation."
              : "La creation reste possible, avec quelques actions apres persistance."}
          </p>
        </div>
        <span className={`${styles.badge} ${readiness >= 80 ? styles.badgeReady : styles.badgeWarn}`}>
          {readiness}% pret
        </span>
      </div>
      <div className={styles.panelBody}>
        <div className={styles.commandKpiGrid}>
          <article>
            <span>Restaurant</span>
            <strong>{name || "Nouveau"}</strong>
            <small>
              {location || "Lieu a preciser"} - {cuisineType || "Cuisine a preciser"}
            </small>
          </article>
          <article>
            <span>Menu</span>
            <strong>{dishes.length}</strong>
            <small>
              {sections.length} section(s) - {getPublicMenuStyleLabel(publicMenuSettings.publicMenuStyle)} - {publicMenuSettings.defaultCurrency}
            </small>
          </article>
          <article>
            <span>Photos</span>
            <strong>{photoReadyCount}</strong>
            <small>Dossier media prevu : {mediaBasePathPreview}</small>
          </article>
          <article>
            <span>Avis Google</span>
            <strong>{googleReviewUrl.trim() ? "Pret" : "Optionnel"}</strong>
            <small>{googleReviewUrl.trim() ? "Lien client ajoute au profil" : "Aucun lien ajoute"}</small>
          </article>
        </div>

        <div className={styles.checklist}>
          {checks.map(([label, ok, detail]) => (
            <div key={label} className={styles.checkItem}>
              <span>
                <strong>{label}</strong>
                <small>{detail}</small>
              </span>
              <span className={`${styles.badge} ${ok ? styles.badgeReady : styles.badgeWarn}`}>
                {ok ? "OK" : "A traiter"}
              </span>
            </div>
          ))}
        </div>

        <div className={styles.urlPreview}>
          <p className={styles.metricLabel}>Menu public apres creation</p>
          <p className={`${styles.bodyText} ${styles.breakText}`}>{menuUrl}</p>
          <p className={styles.sourceNote}>
            Apres creation, utilisez le module QR pour generer le QR menu public.
          </p>
        </div>
      </div>
    </article>
  );
}

function CreationSuccess({
  state,
  menuUrl
}: {
  state: Extract<SubmitState, { status: "success" }>;
  menuUrl: string;
}) {
  const isUnique = state.publicMenuStyle === "unique";
  const uniqueUiHref = `/owner/restaurants/${encodeURIComponent(state.restaurant.id)}/unique-ui`;

  return (
    <section className={styles.creationStage}>
      <article className={`${styles.panel} ${styles.highlightPanel}`}>
        <div className={styles.panelHeader}>
          <div>
            <span className={`${styles.badge} ${styles.badgeReady}`}>
              {isUnique ? "Restaurant créé — UI unique à construire" : "Restaurant cree"}
            </span>
            <h3 className={styles.panelTitle}>{state.restaurant.name}</h3>
            <p className={styles.cellSub}>{state.message}</p>
          </div>
        </div>
        <div className={styles.panelBody}>
          <div className={styles.commandKpiGrid}>
            <article>
              <span>Restaurant</span>
              <strong>{state.restaurantPersisted ? "Persiste" : "A verifier"}</strong>
              <small>{state.restaurant.id}</small>
            </article>
            <article>
              <span>Sections</span>
              <strong>{state.sectionsPersisted ? "Sections confirmees" : "Sections non confirmees"}</strong>
              <small>Categories du menu</small>
            </article>
            <article>
              <span>Plats</span>
              <strong>{state.dishesPersisted ? "Plats sauvegardes" : "Plats non sauvegardes"}</strong>
              <small>{state.persistedDishCount} ligne(s) menu_dishes</small>
            </article>
            <article>
              <span>Medias</span>
              <strong>{state.mediaBasePathPersisted ? "Chemin media reference" : "Chemin media prevu"}</strong>
              <small>{state.mediaBasePath}</small>
            </article>
            <article>
              <span>{isUnique ? "Type de UI" : "Design UI"}</span>
              <strong>
                {isUnique
                  ? "Unique"
                  : state.uiConfigPersisted
                    ? "Configuration persistee"
                    : "A verifier"}
              </strong>
              <small>
                {isUnique
                  ? `Statut : À construire${state.uniqueDesignId ? ` · ${state.uniqueDesignId}` : ""}`
                  : "Draft menu_ui_configs"}
              </small>
            </article>
            <article>
              <span>Palette</span>
              <strong>{state.menuAppearancePersisted ? "Palette appliquee" : "A verifier"}</strong>
              <small>
                {isUnique ? "Identité visuelle de secours" : "Template, couleurs et mode"}
              </small>
            </article>
          </div>

          {isUnique ? (
            <div className={styles.checklist}>
              <div className={styles.checkItem}>
                <span>
                  <strong>Design unique créé</strong>
                  <small>Identité serveur pending — aucun template partagé associé.</small>
                </span>
                <span className={`${styles.badge} ${styles.badgeWarn}`}>À construire</span>
              </div>
            </div>
          ) : null}

          {state.warnings.length > 0 ? (
            <div className={styles.checklist}>
              {state.warnings.map((warning) => (
                <div key={warning} className={styles.checkItem}>
                  <span>
                    <strong>A verifier</strong>
                    <small>{warning}</small>
                  </span>
                  <span className={`${styles.badge} ${styles.badgeWarn}`}>Note</span>
                </div>
              ))}
            </div>
          ) : null}

          <div className={styles.urlPreview}>
            <p className={styles.metricLabel}>Menu public</p>
            <p className={`${styles.bodyText} ${styles.breakText}`}>{menuUrl}</p>
          </div>

          <div className={styles.creationFooterActions}>
            <Link className={`${styles.btnPrimary} ${styles.btn}`} href={state.restaurant.dashboardHref}>
              Ouvrir le restaurant
            </Link>
            <Link className={styles.btn} href={menuUrl} target="_blank" rel="noreferrer">
              Voir le fallback public
            </Link>
            {isUnique ? (
              <Link className={styles.btn} href={uniqueUiHref}>
                Créer le UI unique
              </Link>
            ) : (
              <Link className={styles.btn} href={state.qrCodesHref}>
                Generer le QR menu
              </Link>
            )}
          </div>
        </div>
      </article>
    </section>
  );
}

function ChoiceGroup({
  title,
  options,
  selected,
  onToggle
}: {
  title: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <fieldset className={styles.choiceGroup}>
      <legend>{title}</legend>
      <div className={styles.choiceRow}>
        {options.map((option) => {
          const active = selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              className={`${styles.choiceButton} ${active ? styles.choiceButtonActive : ""}`}
              aria-pressed={active}
              onClick={() => onToggle(option)}
            >
              {option}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  inputMode,
  required = false,
  hint,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  inputMode?: "text" | "decimal" | "numeric" | "tel" | "search" | "email" | "url";
  required?: boolean;
  hint?: string;
  placeholder?: string;
}) {
  return (
    <label className={styles.formField}>
      <span className={styles.filterLabel}>{label}</span>
      <input
        className={styles.control}
        type={type}
        inputMode={inputMode}
        required={required}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint ? <span className={styles.sourceNote}>{hint}</span> : null}
    </label>
  );
}
