"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { MenuQrCode } from "@/components/owner/MenuQrCode";
import styles from "@/components/owner/OwnerCockpit.module.css";
import { buildPublicMenuPath, slugifyRestaurantSlug } from "@/lib/owner/menuUrlCore";
import type { OwnerRestaurant } from "@/lib/owner/types";

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

const statusOptions = [
  { value: "setup_needed", label: "A configurer" },
  { value: "demo", label: "Presentation" },
  { value: "active", label: "Actif" }
];

function absoluteMenuUrl(siteOrigin: string, path: string): string {
  try {
    return new URL(path, siteOrigin).toString();
  } catch {
    return path;
  }
}

export function RestaurantCreateForm({ siteOrigin }: RestaurantCreateFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [location, setLocation] = useState("");
  const [cuisineType, setCuisineType] = useState("");
  const [status, setStatus] = useState("setup_needed");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [state, setState] = useState<SubmitState>({
    status: "idle",
    message: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const effectiveSlug = slug || slugifyRestaurantSlug(name);
  const previewMenuPath = buildPublicMenuPath(effectiveSlug || name);
  const previewMenuUrl = useMemo(
    () => absoluteMenuUrl(siteOrigin, previewMenuPath),
    [previewMenuPath, siteOrigin]
  );
  const slugMessage = effectiveSlug
    ? `Slug public normalise : ${effectiveSlug}`
    : "Le slug public sera genere depuis le nom.";

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setState({
      status: "validating",
      message: "Validation du slug et du contact..."
    });

    const normalizedSlug = slugifyRestaurantSlug(effectiveSlug || name);
    if (!normalizedSlug || normalizedSlug.length < 2) {
      setIsSubmitting(false);
      setState({
        status: "error",
        message: "Slug public invalide. Ajustez le nom ou le slug."
      });
      return;
    }

    setState({
      status: "creating",
      message: "Creation dans Supabase en cours..."
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
        message:
          "Restaurant persiste dans Supabase. Liens et prochaine etape prets.",
        restaurant: result.restaurant,
        persisted: true,
        dataSource: "supabase"
      });
      router.refresh();
    } catch (error) {
      setState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Le restaurant n'a pas pu etre cree."
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const buttonLabel =
    state.status === "validating"
      ? "Verification..."
      : state.status === "creating"
        ? "Creation Supabase..."
        : "Creer le restaurant";

  return (
    <div className={styles.createGrid}>
      <form onSubmit={handleSubmit} className={styles.formPanel}>
        <div className={styles.formGrid}>
          <Field
            label="Nom du restaurant"
            name="name"
            required
            value={name}
            onChange={updateName}
          />
          <Field
            label="Slug public"
            name="slug"
            required
            value={effectiveSlug}
            onChange={updateSlug}
            hint={slugMessage}
          />
          <Field
            label="Ville / emplacement"
            name="location"
            required
            value={location}
            onChange={setLocation}
          />
          <Field
            label="Type de cuisine"
            name="cuisineType"
            required
            value={cuisineType}
            onChange={setCuisineType}
          />
          <label className={styles.formField}>
            <span className={styles.filterLabel}>Statut</span>
            <select
              name="status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className={styles.control}
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <Field
            label="Contact principal"
            name="contactName"
            required
            value={contactName}
            onChange={setContactName}
          />
          <Field
            label="Email contact"
            name="contactEmail"
            type="email"
            required
            value={contactEmail}
            onChange={setContactEmail}
          />
          <Field
            label="Telephone optionnel"
            name="contactPhone"
            type="tel"
            value={contactPhone}
            onChange={setContactPhone}
          />
        </div>

        <label className={styles.formField}>
          <span className={styles.filterLabel}>Notes internes optionnelles</span>
          <textarea
            name="notes"
            rows={4}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className={styles.textarea}
          />
        </label>

        <div className={styles.urlPreview}>
          <p className={styles.metricLabel}>Menu public preview</p>
          <p className={`${styles.bodyText} ${styles.breakText}`}>{previewMenuUrl}</p>
          <p className={styles.sourceNote}>
            Lien derive du domaine configure du site. Aucun localhost hardcode.
          </p>
        </div>

        <div className={styles.submitRow}>
          <button
            type="submit"
            disabled={isSubmitting}
            className={styles.submitButton}
          >
            {buttonLabel}
          </button>
          {state.status === "error" ? (
            <p role="status" className={styles.errorText}>
              {state.message}
            </p>
          ) : state.status === "validating" || state.status === "creating" ? (
            <p role="status" className={styles.sourceNote}>
              {state.message}
            </p>
          ) : null}
        </div>
      </form>

      <aside className={styles.asidePanel}>
        {state.status === "success" ? (
          <SuccessPanel state={state} />
        ) : state.status === "fallback" ? (
          <FallbackPanel message={state.message} />
        ) : (
          <PreviewPanel
            name={name || "Nouveau restaurant"}
            slug={effectiveSlug || "slug-menu"}
            menuUrl={previewMenuUrl}
          />
        )}
      </aside>
    </div>
  );
}

function PreviewPanel({
  name,
  slug,
  menuUrl
}: {
  name: string;
  slug: string;
  menuUrl: string;
}) {
  return (
    <div>
      <p className={styles.badge}>Avant creation</p>
      <h3 className={styles.panelTitle}>{name}</h3>
      <dl className={styles.definitionList}>
        <div>
          <dt>Slug</dt>
          <dd>{slug}</dd>
        </div>
        <div>
          <dt>Menu public</dt>
          <dd>{menuUrl}</dd>
        </div>
      </dl>
      <p className={styles.bodyText}>
        Apres creation, Vistaire affichera l&apos;id Supabase, les liens utiles et la
        prochaine etape de setup.
      </p>
    </div>
  );
}

function FallbackPanel({ message }: { message: string }) {
  return (
    <div>
      <p className={`${styles.badge} ${styles.badgeWarn}`}>Non persiste</p>
      <h3 className={styles.panelTitle}>Creation non confirmee</h3>
      <p className={styles.bodyText}>{message}</p>
      <p className={styles.sourceNote}>
        Le restaurant doit etre cree dans Supabase avant d&apos;etre annonce comme
        disponible en production.
      </p>
    </div>
  );
}

function SuccessPanel({
  state
}: {
  state: Extract<SubmitState, { status: "success" }>;
}) {
  const restaurant = state.restaurant;

  return (
    <div>
      <p className={`${styles.badge} ${styles.badgeReady}`}>Persiste Supabase</p>
      <h3 className={styles.panelTitle}>{restaurant.name}</h3>
      <p className={styles.bodyText}>{state.message}</p>

      <dl className={styles.definitionList}>
        <div>
          <dt>ID Supabase</dt>
          <dd>{restaurant.id}</dd>
        </div>
        <div>
          <dt>Slug</dt>
          <dd>{restaurant.slug}</dd>
        </div>
        <div>
          <dt>Source</dt>
          <dd>{state.dataSource}</dd>
        </div>
        <div>
          <dt>Menu public</dt>
          <dd>{restaurant.menuUrl}</dd>
        </div>
        <div>
          <dt>Apercu restaurateur</dt>
          <dd>{restaurant.dashboardHref}</dd>
        </div>
        <div>
          <dt>Setup</dt>
          <dd>{restaurant.nextAction}</dd>
        </div>
      </dl>

      <MenuQrCode
        menuUrl={restaurant.qrTargetUrl}
        restaurantName={restaurant.name}
        className={styles.successQr}
      />
      <p className={styles.sourceNote}>
        QR preview du menu public. Pour un QR securise et persiste, utilisez le
        module QR.
      </p>

      <div className={styles.nextSteps}>
        <p className={styles.metricLabel}>Prochaines etapes</p>
        <div className={styles.pillRow}>
          <a
            className={styles.btn}
            href={restaurant.menuUrl}
            target="_blank"
            rel="noreferrer"
          >
            Tester le menu
          </a>
          <Link className={styles.btn} href="/owner/plats" prefetch={false}>
            Gerer les plats
          </Link>
          <Link className={styles.btn} href="/owner/qr-codes" prefetch={false}>
            Generer QR
          </Link>
          <Link className={styles.btn} href="/owner/restaurants" prefetch={false}>
            Ouvrir restaurant
          </Link>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  value,
  onChange,
  type = "text",
  required = false,
  hint
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  hint?: string;
}) {
  return (
    <label className={styles.formField}>
      <span className={styles.filterLabel}>{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={styles.control}
      />
      {hint ? <span className={styles.sourceNote}>{hint}</span> : null}
    </label>
  );
}
