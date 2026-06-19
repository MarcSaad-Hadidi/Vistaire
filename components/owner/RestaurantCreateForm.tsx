"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "@/components/owner/OwnerCockpit.module.css";
import {
  buildPublicMenuPath,
  slugifyRestaurantSlug
} from "@/lib/owner/menuUrlCore";
import type {
  CreateRestaurantDishPhotoStatus,
  CreateRestaurantMenuLanguage,
  OwnerRestaurant,
  OwnerRestaurantStatus
} from "@/lib/owner/types";

type StepId = "profile" | "menu" | "dishes" | "review";

type DraftSection = {
  id: string;
  name: string;
  description: string;
};

type DraftDish = {
  id: string;
  name: string;
  section: string;
  price: number;
  description: string;
  imageUrl: string;
  ingredients: string[];
  allergens: string[];
  tags: string[];
  options: string[];
  chefNote: string;
  available: boolean;
  photoStatus: CreateRestaurantDishPhotoStatus;
};

type MenuLanguage = CreateRestaurantMenuLanguage;

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
      persistedDishCount: number;
      mediaBasePath: string;
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
    title: "Menu",
    sub: "Langues et sections de la carte."
  },
  {
    id: "dishes",
    title: "Plats",
    sub: "Descriptions, prix, photos."
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
}> = [
  {
    value: "fr",
    label: "Francais",
    detail: "Base de la carte client."
  },
  {
    value: "en",
    label: "English",
    detail: "Version bilingue."
  }
];

const allergenOptions = [
  "Gluten",
  "Produits laitiers",
  "Oeufs",
  "Poisson",
  "Crustaces",
  "Fruits a coque",
  "Soya",
  "Aucun connu"
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

function formatPrice(value: number): string {
  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0
  }).format(value);
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

function formatMenuLanguages(languages: MenuLanguage[]): string {
  return menuLanguageOptions
    .filter((option) => languages.includes(option.value))
    .map((option) => option.label)
    .join(", ");
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
    dishes.every((dish) => dish.description.trim() && dish.price > 0),
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
  const [menuLanguages, setMenuLanguages] = useState<MenuLanguage[]>(["fr"]);
  const [dishes, setDishes] = useState<DraftDish[]>([]);
  const [editingDishId, setEditingDishId] = useState("");
  const [dishName, setDishName] = useState("");
  const [dishSection, setDishSection] = useState("");
  const [dishPrice, setDishPrice] = useState("28");
  const [dishDescription, setDishDescription] = useState("");
  const [dishImageUrl, setDishImageUrl] = useState("");
  const [dishIngredients, setDishIngredients] = useState("");
  const [dishOptions, setDishOptions] = useState("");
  const [dishAllergens, setDishAllergens] = useState<string[]>([]);
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
  const mediaBasePathPreview = `restaurants/${effectiveSlug || "nouveau-restaurant"}/photos/`;

  function updateName(value: string) {
    setName(value);
    if (!slugTouched) {
      setSlug(slugifyRestaurantSlug(value));
    }
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
        return current.filter((item) => item !== language);
      }

      setError("");
      return [...current, language].sort((a, b) => {
        const aIndex = menuLanguageOptions.findIndex((option) => option.value === a);
        const bIndex = menuLanguageOptions.findIndex((option) => option.value === b);
        return aIndex - bIndex;
      });
    });
  }

  function toggleAllergen(value: string) {
    setDishAllergens((current) => {
      if (value === "Aucun connu") return current.includes(value) ? [] : [value];
      if (current.includes(value)) return current.filter((item) => item !== value);
      return [...current.filter((item) => item !== "Aucun connu"), value];
    });
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
    setDishDescription("");
    setDishImageUrl("");
    setDishIngredients("");
    setDishOptions("");
    setDishAllergens([]);
    setDishTags([]);
    setDishChefNote("");
    setDishAvailable(true);
    setDishPhotoStatus("planned");
  }

  function startEditDish(dish: DraftDish) {
    setEditingDishId(dish.id);
    setDishName(dish.name);
    setDishSection(dish.section);
    setDishPrice(String(dish.price));
    setDishDescription(dish.description);
    setDishImageUrl(dish.imageUrl);
    setDishIngredients(dish.ingredients.join(", "));
    setDishOptions(dish.options.join(", "));
    setDishAllergens(dish.allergens);
    setDishTags(dish.tags);
    setDishChefNote(dish.chefNote);
    setDishAvailable(dish.available);
    setDishPhotoStatus(dish.photoStatus);
    setError("");
  }

  function addDish() {
    const normalizedName = dishName.trim();
    const selectedSection = dishSection || sections[0]?.name || "";
    const price = Number(dishPrice);
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
    if (!Number.isFinite(price) || price <= 0) {
      setError("Chaque plat doit avoir un prix superieur a 0.");
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
      price: Math.round(price * 100) / 100,
      description,
      imageUrl,
      ingredients: splitList(dishIngredients),
      allergens: dishAllergens,
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
      if (dishes.some((dish) => !dish.description.trim() || dish.price <= 0 || !dish.section)) {
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
          menuLanguages,
          sections: sections.map((section, index) => ({
            name: section.name,
            description: section.description,
            order: index + 1
          })),
          dishes: dishes.map((dish) => ({
            name: dish.name,
            section: dish.section,
            price: dish.price,
            description: dish.description,
            imageUrl: dish.imageUrl,
            ingredients: dish.ingredients,
            allergens: dish.allergens,
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
        persistedDishCount?: number;
        mediaBasePath?: string;
        qrCodesHref?: string;
        warnings?: string[];
        restaurant?: OwnerRestaurant;
      };

      if (!response.ok || !result.ok || !result.restaurant) {
        throw new Error(result.error ?? "Creation impossible.");
      }

      if (!result.persisted || result.dataSource !== "supabase" || !result.restaurantPersisted) {
        setState({
          status: "fallback",
          message:
            "Supabase n'a pas confirme la persistance. Aucun succes production n'est affiche."
        });
        return;
      }

      setState({
        status: "success",
        message: "Restaurant cree dans Supabase.",
        restaurant: result.restaurant,
        persisted: true,
        dataSource: "supabase",
        restaurantPersisted: true,
        sectionsPersisted: Boolean(result.sectionsPersisted),
        dishesPersisted: Boolean(result.dishesPersisted),
        persistedDishCount: result.persistedDishCount ?? 0,
        mediaBasePath: result.mediaBasePath ?? `restaurants/${result.restaurant.id}/photos/`,
        qrCodesHref:
          result.qrCodesHref ?? `/owner/qr-codes?restaurantId=${result.restaurant.id}&target=menu`,
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
    <form className={styles.createWizard} onSubmit={handleSubmit}>
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
            menuLanguages={menuLanguages}
            sections={sections}
            sectionName={sectionName}
            sectionDescription={sectionDescription}
            onToggleLanguage={toggleMenuLanguage}
            onSectionNameChange={setSectionName}
            onSectionDescriptionChange={setSectionDescription}
            onAddSection={addSection}
            onRemoveSection={removeSection}
          />
        ) : null}

        {currentStep.id === "dishes" ? (
          <DishesStep
            sections={sections}
            dishes={dishes}
            editingDishId={editingDishId}
            dishName={dishName}
            dishSection={dishSection || sections[0]?.name || ""}
            dishPrice={dishPrice}
            dishDescription={dishDescription}
            dishImageUrl={dishImageUrl}
            dishIngredients={dishIngredients}
            dishOptions={dishOptions}
            dishAllergens={dishAllergens}
            dishTags={dishTags}
            dishChefNote={dishChefNote}
            dishAvailable={dishAvailable}
            dishPhotoStatus={dishPhotoStatus}
            onDishNameChange={setDishName}
            onDishSectionChange={setDishSection}
            onDishPriceChange={setDishPrice}
            onDishDescriptionChange={setDishDescription}
            onDishImageUrlChange={setDishImageUrl}
            onDishIngredientsChange={setDishIngredients}
            onDishOptionsChange={setDishOptions}
            onToggleAllergen={toggleAllergen}
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

        {currentStep.id === "review" ? (
          <ReviewStep
            readiness={readiness}
            name={name}
            location={location}
            cuisineType={cuisineType}
            googleReviewUrl={googleReviewUrl}
            menuLanguages={menuLanguages}
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
              Les photos restent des URL ou un dossier media logique.
            </p>
            {error ? <p className={styles.errorText}>{error}</p> : null}
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
  menuLanguages,
  sections,
  sectionName,
  sectionDescription,
  onToggleLanguage,
  onSectionNameChange,
  onSectionDescriptionChange,
  onAddSection,
  onRemoveSection
}: {
  menuLanguages: MenuLanguage[];
  sections: DraftSection[];
  sectionName: string;
  sectionDescription: string;
  onToggleLanguage: (language: MenuLanguage) => void;
  onSectionNameChange: (value: string) => void;
  onSectionDescriptionChange: (value: string) => void;
  onAddSection: () => void;
  onRemoveSection: (id: string) => void;
}) {
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
          <div className={styles.menuLanguageGrid}>
            {menuLanguageOptions.map((option) => {
              const active = menuLanguages.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  className={`${styles.toggleCard} ${active ? styles.toggleCardActive : ""}`}
                  aria-pressed={active}
                  onClick={() => onToggleLanguage(option.value)}
                >
                  <strong>{option.label}</strong>
                  <span>{option.detail}</span>
                </button>
              );
            })}
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

function DishesStep({
  sections,
  dishes,
  editingDishId,
  dishName,
  dishSection,
  dishPrice,
  dishDescription,
  dishImageUrl,
  dishIngredients,
  dishOptions,
  dishAllergens,
  dishTags,
  dishChefNote,
  dishAvailable,
  dishPhotoStatus,
  onDishNameChange,
  onDishSectionChange,
  onDishPriceChange,
  onDishDescriptionChange,
  onDishImageUrlChange,
  onDishIngredientsChange,
  onDishOptionsChange,
  onToggleAllergen,
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
  editingDishId: string;
  dishName: string;
  dishSection: string;
  dishPrice: string;
  dishDescription: string;
  dishImageUrl: string;
  dishIngredients: string;
  dishOptions: string;
  dishAllergens: string[];
  dishTags: string[];
  dishChefNote: string;
  dishAvailable: boolean;
  dishPhotoStatus: CreateRestaurantDishPhotoStatus;
  onDishNameChange: (value: string) => void;
  onDishSectionChange: (value: string) => void;
  onDishPriceChange: (value: string) => void;
  onDishDescriptionChange: (value: string) => void;
  onDishImageUrlChange: (value: string) => void;
  onDishIngredientsChange: (value: string) => void;
  onDishOptionsChange: (value: string) => void;
  onToggleAllergen: (value: string) => void;
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
          <Field label="Prix" type="number" value={dishPrice} onChange={onDishPriceChange} />
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
            label="Options"
            value={dishOptions}
            onChange={onDishOptionsChange}
            placeholder="Sans lactose sur demande"
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

        <ChoiceGroup
          title="Allergenes"
          options={allergenOptions}
          selected={dishAllergens}
          onToggle={onToggleAllergen}
        />
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
                    <td>{formatPrice(dish.price)}</td>
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
  sections: DraftSection[];
  dishes: DraftDish[];
  photoReadyCount: number;
  menuUrl: string;
  mediaBasePathPreview: string;
}) {
  const checks = [
    ["Profil", Boolean(name), `${name || "Nom a completer"} - ${location || "Lieu a preciser"}`],
    ["Langues", menuLanguages.length > 0, formatMenuLanguages(menuLanguages)],
    ["Sections", sections.length > 0, `${sections.length} section(s)`],
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
              {sections.length} section(s) - {formatMenuLanguages(menuLanguages)}
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
  return (
    <section className={styles.creationStage}>
      <article className={`${styles.panel} ${styles.highlightPanel}`}>
        <div className={styles.panelHeader}>
          <div>
            <span className={`${styles.badge} ${styles.badgeReady}`}>Restaurant cree</span>
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
              <strong>{state.sectionsPersisted ? "OK" : "A verifier"}</strong>
              <small>Categories du menu</small>
            </article>
            <article>
              <span>Plats</span>
              <strong>{state.persistedDishCount}</strong>
              <small>{state.dishesPersisted ? "Lignes menu_dishes" : "Non persistees"}</small>
            </article>
            <article>
              <span>Medias</span>
              <strong>Chemin pret</strong>
              <small>{state.mediaBasePath}</small>
            </article>
          </div>

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
            <Link className={`${styles.btnPrimary} ${styles.btn}`} href={state.qrCodesHref}>
              Generer le QR menu
            </Link>
            <Link className={styles.btn} href={state.restaurant.dashboardHref}>
              Ouvrir le dashboard
            </Link>
            <Link className={styles.btn} href="/owner/medias">
              Ajouter les photos
            </Link>
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
  required = false,
  hint,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
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
        required={required}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint ? <span className={styles.sourceNote}>{hint}</span> : null}
    </label>
  );
}
