"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MenuQrCode } from "@/components/owner/MenuQrCode";
import styles from "@/components/owner/OwnerCockpit.module.css";
import {
  buildOwnerQrTarget,
  buildPublicMenuPath,
  slugifyRestaurantSlug,
  type OwnerQrTargetKind
} from "@/lib/owner/menuUrlCore";
import type { Locale } from "@/lib/i18n";
import type { OwnerRestaurant, OwnerRestaurantStatus } from "@/lib/owner/types";

type StepId = "profile" | "menu" | "dishes" | "media" | "qr" | "review";

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
  photoReady: boolean;
  immersiveCandidate: boolean;
};

type MenuLanguage = Locale;

type MediaQuality = {
  photos: boolean;
  copy: boolean;
  immersiveBrief: boolean;
};

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
    sub: "Identite, slug, contact et notes."
  },
  {
    id: "menu",
    title: "Menu",
    sub: "Sections principales de la carte."
  },
  {
    id: "dishes",
    title: "Plats",
    sub: "Premiers plats, prix, photo et 3D."
  },
  {
    id: "media",
    title: "Medias / qualite",
    sub: "Photos, copy premium et candidats 3D."
  },
  {
    id: "qr",
    title: "QR",
    sub: "Cible, preview et test mobile."
  },
  {
    id: "review",
    title: "Revue finale",
    sub: "Readiness et creation du profil."
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
    detail: "Langue principale du menu public."
  },
  {
    value: "en",
    label: "English",
    detail: "Version anglaise pour clients internationaux."
  }
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

function formatMenuLanguages(languages: MenuLanguage[]): string {
  return menuLanguageOptions
    .filter((option) => languages.includes(option.value))
    .map((option) => option.label)
    .join(", ");
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

export function RestaurantCreateForm({ siteOrigin }: RestaurantCreateFormProps) {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
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
  const [dishName, setDishName] = useState("");
  const [dishSection, setDishSection] = useState("");
  const [dishPrice, setDishPrice] = useState("42");
  const [mediaQuality, setMediaQuality] = useState<MediaQuality>({
    photos: false,
    copy: false,
    immersiveBrief: false
  });
  const [qrTargetKind, setQrTargetKind] = useState<OwnerQrTargetKind>("menu");
  const [qrGenerated, setQrGenerated] = useState(false);
  const [qrTested, setQrTested] = useState(false);
  const [state, setState] = useState<SubmitState>({
    status: "idle",
    message: ""
  });
  const [error, setError] = useState("");

  const effectiveSlug = slug || slugifyRestaurantSlug(name);
  const menuPath = buildPublicMenuPath(effectiveSlug || name);
  const menuUrl = useMemo(() => absoluteUrl(siteOrigin, menuPath), [menuPath, siteOrigin]);
  const qrTarget = useMemo(
    () =>
      buildOwnerQrTarget({
        targetKind: qrTargetKind,
        restaurantId: effectiveSlug || "nouveau-restaurant",
        restaurantName: name || "Nouveau restaurant",
        restaurantSlug: effectiveSlug || "nouveau-restaurant"
      }),
    [effectiveSlug, name, qrTargetKind]
  );
  const qrUrl = useMemo(
    () => absoluteUrl(siteOrigin, qrTarget.targetPath),
    [qrTarget.targetPath, siteOrigin]
  );
  const currentStep = steps[stepIndex];
  const readiness = calculateReadiness({
    name,
    slug: effectiveSlug,
    sections,
    dishes,
    qrGenerated,
    qrTested
  });
  const photoCount = dishes.filter((dish) => dish.photoReady).length;
  const immersiveCount = dishes.filter((dish) => dish.immersiveCandidate).length;

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

  function addDish() {
    const normalizedName = dishName.trim();
    if (!normalizedName) {
      setError("Ajoutez un nom de plat.");
      return;
    }
    const selectedSection = dishSection || sections[0]?.name || "";
    if (!selectedSection) {
      setError("Ajoutez une section avant les plats.");
      return;
    }

    setDishes((items) => [
      ...items,
      {
        id: draftId("dish"),
        name: normalizedName,
        section: selectedSection,
        price: Number(dishPrice) || 0,
        photoReady: false,
        immersiveCandidate: false
      }
    ]);
    setDishName("");
    setDishPrice("42");
    setError("");
  }

  function removeDish(id: string) {
    setDishes((items) => items.filter((dish) => dish.id !== id));
  }

  function toggleDish(id: string, key: "photoReady" | "immersiveCandidate") {
    setDishes((items) =>
      items.map((dish) => (dish.id === id ? { ...dish, [key]: !dish[key] } : dish))
    );
  }

  function applyMediaShortcut(key: keyof MediaQuality) {
    setMediaQuality((current) => ({ ...current, [key]: !current[key] }));

    if (key === "photos") {
      setDishes((items) =>
        items.map((dish, index) =>
          index < Math.max(1, Math.ceil(items.length * 0.75))
            ? { ...dish, photoReady: true }
            : dish
        )
      );
    }
    if (key === "immersiveBrief") {
      setDishes((items) =>
        items.map((dish, index) =>
          index === 0 ? { ...dish, immersiveCandidate: true } : dish
        )
      );
    }
  }

  function validateCurrentStep() {
    setError("");
    if (currentStep.id === "profile") {
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
    if (currentStep.id === "menu" && sections.length === 0) {
      setError("Ajoutez au moins une section de menu.");
      return false;
    }
    if (currentStep.id === "menu" && menuLanguages.length === 0) {
      setError("Choisissez au moins une langue de menu.");
      return false;
    }
    if (currentStep.id === "dishes" && dishes.length === 0) {
      setError("Ajoutez au moins un plat.");
      return false;
    }
    return true;
  }

  function goNext() {
    if (!validateCurrentStep()) return;
    setStepIndex((index) => Math.min(index + 1, steps.length - 1));
  }

  function goPrevious() {
    setError("");
    setStepIndex((index) => Math.max(index - 1, 0));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (currentStep.id !== "review") {
      goNext();
      return;
    }

    setError("");
    setState({
      status: "validating",
      message: "Validation du profil restaurant..."
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
      message: "Creation du restaurant dans Supabase..."
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
          notes
        })
      });
      const result = (await response.json()) as {
        ok?: boolean;
        error?: string;
        persisted?: boolean;
        dataSource?: "supabase";
        restaurant?: OwnerRestaurant;
      };

      if (!response.ok || !result.ok || !result.restaurant) {
        throw new Error(result.error ?? "Creation impossible.");
      }

      if (!result.persisted || result.dataSource !== "supabase") {
        setState({
          status: "fallback",
          message:
            "Supabase n'a pas confirme la persistance. Aucun succes production n'est affiche."
        });
        return;
      }

      setState({
        status: "success",
        message: "Restaurant persiste. Ouverture du dashboard dedie...",
        restaurant: result.restaurant,
        persisted: true,
        dataSource: "supabase"
      });
      router.refresh();
      router.push(result.restaurant.dashboardHref);
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
              onClick={() => setStepIndex(index)}
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
            <span className={`${styles.badge} ${styles.badgeWarn}`}>
              Etape {stepIndex + 1}/{steps.length}
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
            dishName={dishName}
            dishSection={dishSection || sections[0]?.name || ""}
            dishPrice={dishPrice}
            onDishNameChange={setDishName}
            onDishSectionChange={setDishSection}
            onDishPriceChange={setDishPrice}
            onAddDish={addDish}
            onRemoveDish={removeDish}
            onToggleDish={toggleDish}
          />
        ) : null}

        {currentStep.id === "media" ? (
          <MediaStep
            dishCount={dishes.length}
            photoCount={photoCount}
            immersiveCount={immersiveCount}
            readiness={readiness}
            mediaQuality={mediaQuality}
            onToggle={applyMediaShortcut}
          />
        ) : null}

        {currentStep.id === "qr" ? (
          <QrStep
            name={name || "Nouveau restaurant"}
            qrTargetKind={qrTargetKind}
            qrUrl={qrUrl}
            qrGenerated={qrGenerated}
            qrTested={qrTested}
            onTargetChange={setQrTargetKind}
            onGenerate={() => setQrGenerated(true)}
            onTest={() => {
              setQrGenerated(true);
              setQrTested(true);
            }}
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
            photoCount={photoCount}
            immersiveCount={immersiveCount}
            qrGenerated={qrGenerated}
            qrTested={qrTested}
            menuUrl={menuUrl}
          />
        ) : null}

        <div className={styles.creationFooter}>
          <div>
            <p className={styles.sourceNote}>
              Profil restaurant persistant si Supabase confirme son identifiant.
              Menu, plats, medias et QR ci-dessus sont un brouillon local de setup.
            </p>
            {error ? <p className={styles.errorText}>{error}</p> : null}
            {state.status === "error" || state.status === "fallback" ? (
              <p className={styles.errorText} role="status">
                {state.message}
              </p>
            ) : state.status === "validating" || state.status === "creating" || state.status === "success" ? (
              <p className={styles.sourceNote} role="status">
                {state.message}
              </p>
            ) : null}
          </div>
          <div className={styles.creationFooterActions}>
            <Link className={styles.btn} href="/owner/restaurants" prefetch={false}>
              Annuler
            </Link>
            <button
              type="button"
              className={styles.btn}
              disabled={stepIndex === 0}
              onClick={goPrevious}
            >
              Retour
            </button>
            {currentStep.id === "review" ? (
              <button
                type="submit"
                className={`${styles.btnPrimary} ${styles.btn}`}
                disabled={state.status === "creating" || state.status === "validating"}
              >
                Creer restaurant
              </button>
            ) : (
              <button
                type="button"
                className={`${styles.btnPrimary} ${styles.btn}`}
                onClick={goNext}
              >
                Continuer
              </button>
            )}
          </div>
        </div>
      </section>
    </form>
  );
}

function calculateReadiness(args: {
  name: string;
  slug: string;
  sections: DraftSection[];
  dishes: DraftDish[];
  qrGenerated: boolean;
  qrTested: boolean;
}) {
  const dishCount = args.dishes.length;
  const photoCount = args.dishes.filter((dish) => dish.photoReady).length;
  const immersiveCount = args.dishes.filter((dish) => dish.immersiveCandidate).length;
  let score = 0;
  score += args.name.trim() && args.slug ? 15 : 0;
  score += args.sections.length > 0 ? 15 : 0;
  score += dishCount > 0 ? 25 : 0;
  score += dishCount > 0 ? Math.round((photoCount / dishCount) * 20) : 0;
  score += args.qrGenerated ? 15 : 0;
  score += args.qrTested ? 5 : 0;
  score += immersiveCount > 0 ? 5 : 0;
  return Math.min(100, score);
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
  onStatusChange: (value: OwnerRestaurantStatus) => void;
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
            Cette etape est la seule persistee a la creation du restaurant.
          </p>
        </div>
      </div>
      <div className={styles.panelBody}>
        <div className={styles.formGrid}>
          <Field label="Nom restaurant" required value={name} onChange={onNameChange} />
          <Field label="Slug public" required value={slug} onChange={onSlugChange} hint="Utilise pour /menu/[restaurant]." />
          <Field label="Ville / emplacement" value={location} onChange={onLocationChange} />
          <Field label="Cuisine" value={cuisineType} onChange={onCuisineTypeChange} />
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
            placeholder="https://g.page/r/..."
            hint="Optionnel. Utilisez un lien g.page/.../review ou search.google.com/local/writereview."
          />
        </div>

        <label className={styles.formField}>
          <span className={styles.filterLabel}>Notes internes</span>
          <textarea
            className={styles.textarea}
            value={notes}
            onChange={(event) => onNotesChange(event.target.value)}
            placeholder="Priorite : menu clair, photos fortes, QR pret pour test en salle."
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
            Sections locales pour preparer le setup. Elles ne sont pas
            sauvegardees comme menu persistant.
          </p>
        </div>
      </div>
      <div className={styles.panelBody}>
        <section className={styles.menuLanguagePanel} aria-labelledby="menu-language-title">
          <div>
            <h4 id="menu-language-title">Langues du menu</h4>
            <p>
              Choisissez les langues a preparer pour la carte client. Le francais reste la
              base par defaut; l&apos;anglais ajoute une version bilingue au setup.
            </p>
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
          <p className={styles.sourceNote}>
            Langues selectionnees : {formatMenuLanguages(menuLanguages)}.
          </p>
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
  dishName,
  dishSection,
  dishPrice,
  onDishNameChange,
  onDishSectionChange,
  onDishPriceChange,
  onAddDish,
  onRemoveDish,
  onToggleDish
}: {
  sections: DraftSection[];
  dishes: DraftDish[];
  dishName: string;
  dishSection: string;
  dishPrice: string;
  onDishNameChange: (value: string) => void;
  onDishSectionChange: (value: string) => void;
  onDishPriceChange: (value: string) => void;
  onAddDish: () => void;
  onRemoveDish: (id: string) => void;
  onToggleDish: (id: string, key: "photoReady" | "immersiveCandidate") => void;
}) {
  return (
    <article className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <h3 className={styles.panelTitle}>3. Plats</h3>
          <p className={styles.cellSub}>
            Ces plats alimentent la review locale. Aucune ligne menu_dishes
            ne se cree ici.
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
        </div>
        <div className={styles.submitRow}>
          <button type="button" className={`${styles.btnPrimary} ${styles.btn}`} onClick={onAddDish}>
            Ajouter plat
          </button>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>Plat</th>
                <th>Section</th>
                <th>Prix</th>
                <th>Photo</th>
                <th>3D</th>
                <th aria-label="Retirer" />
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
                    <td className={styles.cellMain}>{dish.name}</td>
                    <td className={styles.cellSub}>{dish.section}</td>
                    <td>{formatPrice(dish.price)}</td>
                    <td>
                      <button
                        type="button"
                        className={`${styles.badge} ${dish.photoReady ? styles.badgeReady : styles.badgeWarn}`}
                        onClick={() => onToggleDish(dish.id, "photoReady")}
                      >
                        {dish.photoReady ? "Prete" : "Manquante"}
                      </button>
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`${styles.badge} ${dish.immersiveCandidate ? styles.badgeReady : styles.badgeWarn}`}
                        onClick={() => onToggleDish(dish.id, "immersiveCandidate")}
                      >
                        {dish.immersiveCandidate ? "Oui" : "Non"}
                      </button>
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`${styles.btnDanger} ${styles.btnSmall} ${styles.btn}`}
                        onClick={() => onRemoveDish(dish.id)}
                      >
                        Retirer
                      </button>
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

function MediaStep({
  dishCount,
  photoCount,
  immersiveCount,
  readiness,
  mediaQuality,
  onToggle
}: {
  dishCount: number;
  photoCount: number;
  immersiveCount: number;
  readiness: number;
  mediaQuality: MediaQuality;
  onToggle: (key: keyof MediaQuality) => void;
}) {
  return (
    <article className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <h3 className={styles.panelTitle}>4. Medias / qualite</h3>
          <p className={styles.cellSub}>
            Controle local pour savoir les elements a completer dans les
            modules persistants.
          </p>
        </div>
      </div>
      <div className={styles.panelBody}>
        <div className={styles.commandKpiGrid}>
          <article>
            <span>Photos</span>
            <strong>
              {photoCount}/{dishCount}
            </strong>
            <small>Base visuelle de la carte.</small>
          </article>
          <article>
            <span>Descriptions</span>
            <strong>{mediaQuality.copy ? "OK" : "A faire"}</strong>
            <small>Copy premium et allergenes.</small>
          </article>
          <article>
            <span>3D candidats</span>
            <strong>{immersiveCount}</strong>
            <small>Selectif, pas decoratif.</small>
          </article>
          <article>
            <span>Readiness</span>
            <strong>{readiness}%</strong>
            <small>Estimation avant creation.</small>
          </article>
        </div>

        <div className={styles.toggleCardGrid}>
          <ToggleCard
            active={mediaQuality.photos}
            title="Photos menu"
            body="Marquer une premiere couverture photo comme prete."
            onClick={() => onToggle("photos")}
          />
          <ToggleCard
            active={mediaQuality.copy}
            title="Copy premium"
            body="Descriptions, allergenes et notes de service a revoir."
            onClick={() => onToggle("copy")}
          />
          <ToggleCard
            active={mediaQuality.immersiveBrief}
            title="Candidats 3D"
            body="Choisir seulement les plats signatures."
            onClick={() => onToggle("immersiveBrief")}
          />
        </div>
      </div>
    </article>
  );
}

function QrStep({
  name,
  qrTargetKind,
  qrUrl,
  qrGenerated,
  qrTested,
  onTargetChange,
  onGenerate,
  onTest
}: {
  name: string;
  qrTargetKind: OwnerQrTargetKind;
  qrUrl: string;
  qrGenerated: boolean;
  qrTested: boolean;
  onTargetChange: (kind: OwnerQrTargetKind) => void;
  onGenerate: () => void;
  onTest: () => void;
}) {
  return (
    <article className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <h3 className={styles.panelTitle}>5. QR</h3>
          <p className={styles.cellSub}>
            QR preview local. Le QR securise persistant se genere dans le module QR apres creation.
          </p>
        </div>
      </div>
      <div className={styles.panelBody}>
        <div className={styles.qrPreviewGrid}>
          {qrGenerated ? (
            <MenuQrCode menuUrl={qrUrl} restaurantName={name} />
          ) : (
            <div className={styles.emptyState}>Cliquez sur Generer QR preview pour afficher le QR local.</div>
          )}

          <div className={styles.qrDraftControls}>
            <label className={styles.formField}>
              <span className={styles.filterLabel}>Cible QR</span>
              <select
                className={styles.control}
                value={qrTargetKind}
                onChange={(event) => onTargetChange(event.target.value as OwnerQrTargetKind)}
              >
                <option value="menu">Menu client public</option>
                <option value="admin">Dashboard owner protege</option>
              </select>
            </label>
            <div className={styles.urlPreview}>
              <p className={styles.metricLabel}>URL cible</p>
              <p className={`${styles.bodyText} ${styles.breakText}`}>{qrUrl}</p>
            </div>
            <div className={styles.submitRow}>
              <button type="button" className={`${styles.btnPrimary} ${styles.btn}`} onClick={onGenerate}>
                Generer QR preview
              </button>
              <button type="button" className={styles.btn} onClick={onTest}>
                Marquer teste mobile
              </button>
            </div>
            <p className={styles.sourceNote}>
              Etat : {qrGenerated ? "QR preview genere" : "QR preview non genere"} -{" "}
              {qrTested ? "test mobile marque OK" : "test mobile a faire"}.
            </p>
          </div>
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
  photoCount,
  immersiveCount,
  qrGenerated,
  qrTested,
  menuUrl
}: {
  readiness: number;
  name: string;
  location: string;
  cuisineType: string;
  googleReviewUrl: string;
  menuLanguages: MenuLanguage[];
  sections: DraftSection[];
  dishes: DraftDish[];
  photoCount: number;
  immersiveCount: number;
  qrGenerated: boolean;
  qrTested: boolean;
  menuUrl: string;
}) {
  const summary =
    readiness >= 80
      ? "Le restaurant peut etre cree comme compte presque pret."
      : readiness >= 60
        ? "Le restaurant peut etre cree, mais il restera des actions de setup."
        : "Le restaurant sera cree en setup. Les actions prioritaires seront visibles dans son dashboard.";
  const checks = [
    ["Profil", Boolean(name), `${name || "Nom a completer"} - ${location || "Lieu a preciser"}`],
    [
      "Avis Google",
      true,
      googleReviewUrl.trim() ? "Lien Google Reviews pret" : "Aucun lien Google Reviews"
    ],
    ["Langues", menuLanguages.length > 0, formatMenuLanguages(menuLanguages)],
    ["Sections", sections.length > 0, `${sections.length} section(s)`],
    ["Plats", dishes.length > 0, `${dishes.length} plat(s)`],
    ["Photos", photoCount > 0, `${photoCount}/${dishes.length} prete(s)`],
    ["QR", qrGenerated, qrTested ? "QR genere et teste" : "QR genere, test mobile a faire"],
    ["3D/AR", immersiveCount > 0, `${immersiveCount} candidat(s)`]
  ] as const;

  return (
    <article className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <h3 className={styles.panelTitle}>6. Revue finale</h3>
          <p className={styles.cellSub}>{summary}</p>
        </div>
        <span className={`${styles.badge} ${readiness >= 80 ? styles.badgeReady : styles.badgeWarn}`}>
          {readiness}% readiness
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
            <span>Menu draft</span>
            <strong>{dishes.length}</strong>
            <small>
              {sections.length} section(s) - {formatMenuLanguages(menuLanguages)}
            </small>
          </article>
          <article>
            <span>QR</span>
            <strong>{qrGenerated ? "Pret" : "Non"}</strong>
            <small>{qrTested ? "Test mobile OK" : "Test mobile a faire"}</small>
          </article>
          <article>
            <span>Avis Google</span>
            <strong>{googleReviewUrl.trim() ? "Pret" : "Optionnel"}</strong>
            <small>
              {googleReviewUrl.trim()
                ? "Lien client ajoute au profil"
                : "Aucun lien ajoute"}
            </small>
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
            En cliquant sur Creer restaurant, seul le profil restaurant est
            envoye vers API existante. Les plats et medias restent a creer dans
            les modules de production quand leurs APIs seront disponibles.
          </p>
        </div>
      </div>
    </article>
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

function ToggleCard({
  active,
  title,
  body,
  onClick
}: {
  active: boolean;
  title: string;
  body: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`${styles.toggleCard} ${active ? styles.toggleCardActive : ""}`}
      onClick={onClick}
      aria-pressed={active}
    >
      <strong>{title}</strong>
      <span>{body}</span>
    </button>
  );
}
