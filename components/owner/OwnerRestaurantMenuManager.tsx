"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import styles from "@/components/owner/OwnerCockpit.module.css";
import { Badge, EmptyState, Panel } from "@/components/owner/OwnerUi";
import type { PublicMenuCategory, PublicMenuDish } from "@/lib/menu/publicMenuCore";
import {
  ALLERGEN_REGISTRY,
  allergenLabel,
  getAllergenStatus,
  legacyAllergensFromDeclarations,
  normalizeAllergenData,
  type AllergenStatus,
  type DishAllergenDeclaration
} from "@/lib/menu/allergens";

type EditorMode = "category" | "dish" | null;
type DeleteTarget = {
  type: "category" | "dish";
  id: string;
  label: string;
} | null;

type OwnerRestaurantMenuManagerProps = {
  restaurantId: string;
  categories: PublicMenuCategory[];
  dishes: PublicMenuDish[];
  source: "supabase" | "fallback";
  menuError?: string;
  mediasHref: string;
};

type CategoryDraft = {
  id: string;
  name: string;
  description: string;
};

type DishDraft = {
  id: string;
  name: string;
  categoryId: string;
  price: string;
  description: string;
  ingredientsText: string;
  customAllergensText: string;
  allergenDeclarations: DishAllergenDeclaration[];
  tagsText: string;
  optionsText: string;
  chefNote: string;
  available: boolean;
};

type DishAssetDraft = {
  photoFile: File | null;
  glbFile: File | null;
};

type MenuMutationPayload = {
  ok?: boolean;
  error?: string;
  category?: Record<string, unknown>;
  dish?: Record<string, unknown>;
};

const EMPTY_CATEGORY_DRAFT: CategoryDraft = {
  id: "",
  name: "",
  description: ""
};

const EMPTY_DISH_DRAFT: DishDraft = {
  id: "",
  name: "",
  categoryId: "",
  price: "",
  description: "",
  ingredientsText: "",
  customAllergensText: "",
  allergenDeclarations: ALLERGEN_REGISTRY.map(({ id }) => ({
    allergenId: id,
    status: "unknown"
  })),
  tagsText: "",
  optionsText: "",
  chefNote: "",
  available: true
};

const EMPTY_DISH_ASSET_DRAFT: DishAssetDraft = {
  photoFile: null,
  glbFile: null
};

function stringOutput(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function fileLabel(file: File | null, fallback: string): string {
  if (!file) return fallback;
  const sizeMb = file.size > 0 ? ` · ${(file.size / (1024 * 1024)).toFixed(1)} MB` : "";
  return `${file.name}${sizeMb}`;
}

function priceDraftFromDish(dish: PublicMenuDish): string {
  if (!Number.isFinite(dish.priceCents) || dish.priceCents <= 0) return "";
  const cents = Math.round(dish.priceCents);
  const digits = cents % 100 === 0 ? 0 : 2;
  return (cents / 100).toFixed(digits).replace(".", ",");
}

function splitDishList(value: string): string[] {
  return value
    .split(/[,;\n]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 24);
}

const ALLERGEN_STATUS_OPTIONS: Array<{ value: AllergenStatus; label: string }> = [
  { value: "unknown", label: "À confirmer" },
  { value: "contains", label: "Contient" },
  { value: "may_contain", label: "Peut contenir" },
  { value: "confirmed_free", label: "Déclaré sans" }
];

function declarationsForDish(dish: PublicMenuDish): DishAllergenDeclaration[] {
  const normalized = normalizeAllergenData(dish.allergenDeclarations, dish.allergens);
  return ALLERGEN_REGISTRY.map(({ id }) => ({
    allergenId: id,
    status: getAllergenStatus(normalized, id)
  }));
}

function categoryIdForDish(
  dish: PublicMenuDish,
  categories: PublicMenuCategory[]
): string {
  if (dish.categoryId) return dish.categoryId;
  return categories.find((category) => category.label === dish.category)?.id ?? "";
}

async function submitJson(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  body: Record<string, unknown>
): Promise<MenuMutationPayload> {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = (await response.json().catch(() => null)) as MenuMutationPayload | null;
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error || "Modification impossible.");
  }
  return payload ?? {};
}

async function uploadDishAsset(args: {
  restaurantId: string;
  dishId: string;
  file: File;
  type: "photo" | "glb";
}) {
  const formData = new FormData();
  formData.set("file", args.file);
  const suffix = args.type === "photo" ? "photo" : "model/glb";
  const response = await fetch(
    `/api/owner/restaurants/${encodeURIComponent(args.restaurantId)}/dishes/${encodeURIComponent(args.dishId)}/${suffix}`,
    {
      method: "POST",
      body: formData
    }
  );
  const payload = (await response.json().catch(() => null)) as {
    ok?: boolean;
    error?: string;
    imageUrl?: string;
    webModel3dUrl?: string;
    arUsdzUrl?: string;
  } | null;

  if (
    !response.ok ||
    !payload?.ok ||
    (args.type === "photo" && !payload.imageUrl) ||
    (args.type === "glb" && (!payload.webModel3dUrl || !payload.arUsdzUrl))
  ) {
    throw new Error(
      payload?.error ||
        (args.type === "photo" ? "Upload photo impossible." : "Pipeline GLB vers USDZ impossible.")
    );
  }
}

export function OwnerRestaurantMenuManager({
  restaurantId,
  categories,
  dishes,
  source,
  menuError,
  mediasHref
}: OwnerRestaurantMenuManagerProps) {
  const router = useRouter();
  const [activeEditor, setActiveEditor] = useState<EditorMode>(null);
  const [categoryDraft, setCategoryDraft] = useState<CategoryDraft>(
    EMPTY_CATEGORY_DRAFT
  );
  const [dishDraft, setDishDraft] = useState<DishDraft>(EMPTY_DISH_DRAFT);
  const [dishAssetDraft, setDishAssetDraft] = useState<DishAssetDraft>(
    EMPTY_DISH_ASSET_DRAFT
  );
  const [dishSectionFilter, setDishSectionFilter] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [deletingKey, setDeletingKey] = useState("");
  const [isSavingDish, setIsSavingDish] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const canEdit = source === "supabase" && !menuError;
  const selectedCategoryName = categoryDraft.id ? "Modifier une section" : "Ajouter une section";
  const selectedDishName = dishDraft.id ? "Modifier un plat" : "Ajouter un plat";
  const categoryEndpoint = `/api/owner/restaurants/${encodeURIComponent(
    restaurantId
  )}/menu/categories`;
  const dishEndpoint = `/api/owner/restaurants/${encodeURIComponent(
    restaurantId
  )}/menu/dishes`;
  const sortedCategories = useMemo(
    () => categories.filter((category) => category.id && category.label),
    [categories]
  );
  const filteredDishes = useMemo(() => {
    if (dishSectionFilter === "all") return dishes;
    const selectedCategory = sortedCategories.find(
      (category) => category.id === dishSectionFilter
    );
    if (!selectedCategory) return dishes;

    return dishes.filter(
      (dish) =>
        dish.categoryId === selectedCategory.id ||
        dish.category === selectedCategory.label
    );
  }, [dishSectionFilter, dishes, sortedCategories]);
  const isMutating = isPending || isSavingDish || Boolean(deletingKey);

  function resetMessages() {
    setStatusMessage("");
    setErrorMessage("");
  }

  function startNewCategory() {
    resetMessages();
    setDeleteTarget(null);
    setDishAssetDraft(EMPTY_DISH_ASSET_DRAFT);
    setCategoryDraft(EMPTY_CATEGORY_DRAFT);
    setActiveEditor("category");
  }

  function startEditCategory(category: PublicMenuCategory) {
    resetMessages();
    setDeleteTarget(null);
    setCategoryDraft({
      id: category.id,
      name: category.label,
      description: category.description
    });
    setActiveEditor("category");
  }

  function startNewDish() {
    resetMessages();
    setDeleteTarget(null);
    setDishAssetDraft(EMPTY_DISH_ASSET_DRAFT);
    setDishDraft({
      ...EMPTY_DISH_DRAFT,
      categoryId: sortedCategories[0]?.id ?? ""
    });
    setActiveEditor("dish");
  }

  function startEditDish(dish: PublicMenuDish) {
    resetMessages();
    setDeleteTarget(null);
    setDishAssetDraft(EMPTY_DISH_ASSET_DRAFT);
    setDishDraft({
      id: dish.id,
      name: dish.name,
      categoryId: categoryIdForDish(dish, sortedCategories),
      price: priceDraftFromDish(dish),
      description: dish.description,
      ingredientsText: dish.ingredients.join(", "),
      customAllergensText: (dish.customAllergens ?? []).join(", "),
      allergenDeclarations: declarationsForDish(dish),
      tagsText: dish.tags.join(", "),
      optionsText: dish.options.join(", "),
      chefNote: dish.houseNote,
      available: dish.available
    });
    setActiveEditor("dish");
  }

  function closeEditor() {
    setActiveEditor(null);
    setDeleteTarget(null);
    setCategoryDraft(EMPTY_CATEGORY_DRAFT);
    setDishDraft(EMPTY_DISH_DRAFT);
    setDishAssetDraft(EMPTY_DISH_ASSET_DRAFT);
  }

  function refreshAfterSave(message: string) {
    refreshAfterMutation(message, "");
  }

  function refreshAfterMutation(message: string, error = "") {
    setStatusMessage(message);
    setErrorMessage(error);
    setDeleteTarget(null);
    closeEditor();
    startTransition(() => {
      router.refresh();
    });
  }

  function requestDeleteCategory(category: PublicMenuCategory) {
    resetMessages();
    setActiveEditor(null);
    if (category.count > 0) {
      setErrorMessage(
        "Impossible de supprimer cette section : supprimez ou deplacez ses plats avant."
      );
      setDeleteTarget(null);
      return;
    }
    setDeleteTarget({
      type: "category",
      id: category.id,
      label: category.label
    });
  }

  function requestDeleteDish(dish: PublicMenuDish) {
    resetMessages();
    setActiveEditor(null);
    setDeleteTarget({
      type: "dish",
      id: dish.id,
      label: dish.name
    });
  }

  async function deleteCategory(category: PublicMenuCategory) {
    const key = `category:${category.id}`;
    setDeletingKey(key);
    resetMessages();
    try {
      await submitJson(categoryEndpoint, "DELETE", { id: category.id });
      refreshAfterSave(`Section "${category.label}" supprimee.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Section impossible a supprimer.");
    } finally {
      setDeletingKey("");
    }
  }

  async function deleteDish(dish: PublicMenuDish) {
    const key = `dish:${dish.id}`;
    setDeletingKey(key);
    resetMessages();
    try {
      await submitJson(dishEndpoint, "DELETE", { id: dish.id });
      refreshAfterSave(`Plat "${dish.name}" supprime.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Plat impossible a supprimer.");
    } finally {
      setDeletingKey("");
    }
  }

  async function submitCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    resetMessages();
    try {
      await submitJson(categoryEndpoint, categoryDraft.id ? "PATCH" : "POST", {
        id: categoryDraft.id || undefined,
        name: categoryDraft.name,
        description: categoryDraft.description
      });
      refreshAfterSave(
        categoryDraft.id ? "Section modifiee." : "Section ajoutee."
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Section impossible a enregistrer.");
    }
  }

  async function submitDish(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    resetMessages();
    setIsSavingDish(true);
    try {
      const isNewDish = !dishDraft.id;
      const payload = await submitJson(dishEndpoint, dishDraft.id ? "PATCH" : "POST", {
        id: dishDraft.id || undefined,
        name: dishDraft.name,
        categoryId: dishDraft.categoryId,
        price: dishDraft.price,
        description: dishDraft.description,
        ingredients: splitDishList(dishDraft.ingredientsText),
        customAllergens: splitDishList(dishDraft.customAllergensText),
        allergenDeclarations: dishDraft.allergenDeclarations,
        allergens: [
          ...legacyAllergensFromDeclarations(dishDraft.allergenDeclarations),
          ...splitDishList(dishDraft.customAllergensText)
        ],
        tags: splitDishList(dishDraft.tagsText),
        options: splitDishList(dishDraft.optionsText),
        chefNote: dishDraft.chefNote.trim(),
        available: dishDraft.available
      });

      if (!isNewDish) {
        refreshAfterSave("Plat modifie.");
        return;
      }

      const dishId = stringOutput(payload.dish?.id);
      const mediaSuccess: string[] = [];
      const mediaErrors: string[] = [];
      if (!dishId && (dishAssetDraft.photoFile || dishAssetDraft.glbFile)) {
        mediaErrors.push("medias non envoyes : identifiant du plat introuvable.");
      }

      if (dishId && dishAssetDraft.photoFile) {
        try {
          await uploadDishAsset({
            restaurantId,
            dishId,
            file: dishAssetDraft.photoFile,
            type: "photo"
          });
          mediaSuccess.push("photo ajoutee");
        } catch (uploadError) {
          mediaErrors.push(
            uploadError instanceof Error ? uploadError.message : "Upload photo impossible."
          );
        }
      }

      if (dishId && dishAssetDraft.glbFile) {
        try {
          await uploadDishAsset({
            restaurantId,
            dishId,
            file: dishAssetDraft.glbFile,
            type: "glb"
          });
          mediaSuccess.push("GLB envoye");
        } catch (uploadError) {
          mediaErrors.push(
            uploadError instanceof Error
              ? uploadError.message
              : "Pipeline GLB vers USDZ impossible."
          );
        }
      }

      const mediaSuffix = mediaSuccess.length ? ` ${mediaSuccess.join(", ")}.` : "";
      refreshAfterMutation(
        `Plat ajoute.${mediaSuffix}`,
        mediaErrors.length ? `Plat cree, mais ${mediaErrors.join(" ")}` : ""
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Plat impossible a enregistrer.");
    } finally {
      setIsSavingDish(false);
    }
  }

  return (
    <>
      <Panel
        title="Actions carte"
        action={<Badge tone="muted">{source}</Badge>}
      >
        <div className={styles.restaurantActionGrid}>
          <button
            className={styles.btn}
            type="button"
            disabled={!canEdit || isMutating}
            onClick={startNewCategory}
          >
            Ajouter section
          </button>
          <button
            className={styles.btn}
            type="button"
            disabled={!canEdit || isMutating || sortedCategories.length === 0}
            onClick={startNewDish}
          >
            Ajouter plat
          </button>
          <Link className={styles.btn} href="/owner/menu-builder" prefetch={false}>
            Ajuster le design du menu
          </Link>
        </div>
        {!canEdit ? (
          <p className={styles.sheetStatus} role="status">
            Edition disponible quand les donnees Supabase sont chargees.
          </p>
        ) : null}
        {statusMessage ? (
          <p className={styles.sheetStatus} role="status" aria-live="polite">
            {statusMessage}
          </p>
        ) : null}
        {errorMessage ? (
          <p className={styles.errorText} role="alert">
            {errorMessage}
          </p>
        ) : null}
      </Panel>

      {activeEditor === "category" ? (
        <Panel title={selectedCategoryName}>
          <form className={styles.menuLanguagePanel} onSubmit={submitCategory}>
            <label className={styles.formField}>
              <span>Nom section</span>
              <input
                className={styles.control}
                value={categoryDraft.name}
                onChange={(event) =>
                  setCategoryDraft((draft) => ({
                    ...draft,
                    name: event.target.value
                  }))
                }
                maxLength={120}
                required
              />
            </label>
            <label className={styles.formField}>
              <span>Description</span>
              <textarea
                className={styles.textarea}
                value={categoryDraft.description}
                onChange={(event) =>
                  setCategoryDraft((draft) => ({
                    ...draft,
                    description: event.target.value
                  }))
                }
                maxLength={360}
              />
            </label>
            <div className={styles.submitRow}>
              <button className={styles.btnPrimary} type="submit" disabled={isMutating}>
                {categoryDraft.id ? "Mettre a jour" : "Creer section"}
              </button>
              <button className={styles.btn} type="button" onClick={closeEditor}>
                Annuler
              </button>
            </div>
          </form>
        </Panel>
      ) : null}

      {activeEditor === "dish" ? (
        <Panel title={selectedDishName}>
          <form className={styles.menuLanguagePanel} onSubmit={submitDish}>
            <div className={styles.formGrid}>
              <label className={styles.formField}>
                <span>Nom plat</span>
                <input
                  className={styles.control}
                  value={dishDraft.name}
                  onChange={(event) =>
                    setDishDraft((draft) => ({
                      ...draft,
                      name: event.target.value
                    }))
                  }
                  maxLength={140}
                  required
                />
              </label>
              <label className={styles.formField}>
                <span>Section</span>
                <select
                  className={styles.control}
                  value={dishDraft.categoryId}
                  onChange={(event) =>
                    setDishDraft((draft) => ({
                      ...draft,
                      categoryId: event.target.value
                    }))
                  }
                  required
                >
                  {sortedCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.formField}>
                <span>Prix</span>
                <input
                  className={styles.control}
                  inputMode="decimal"
                  placeholder="14,99"
                  value={dishDraft.price}
                  onChange={(event) =>
                    setDishDraft((draft) => ({
                      ...draft,
                      price: event.target.value
                    }))
                  }
                  required
                />
              </label>
              <label className={styles.formField}>
                <span>Disponibilite</span>
                <select
                  className={styles.control}
                  value={dishDraft.available ? "available" : "unavailable"}
                  onChange={(event) =>
                    setDishDraft((draft) => ({
                      ...draft,
                      available: event.target.value === "available"
                    }))
                  }
                >
                  <option value="available">Disponible</option>
                  <option value="unavailable">Indisponible</option>
                </select>
              </label>
            </div>
            <label className={styles.formField}>
              <span>Description</span>
              <textarea
                className={styles.textarea}
                value={dishDraft.description}
                onChange={(event) =>
                  setDishDraft((draft) => ({
                    ...draft,
                    description: event.target.value
                  }))
                }
                maxLength={800}
              />
            </label>
            <div className={styles.formGrid}>
              <label className={styles.formField}>
                <span>Badges / tags</span>
                <input
                  className={styles.control}
                  placeholder="Maison, Populaire, Signature, Nouveaute, Epice, Vegetarien"
                  value={dishDraft.tagsText}
                  onChange={(event) =>
                    setDishDraft((draft) => ({
                      ...draft,
                      tagsText: event.target.value
                    }))
                  }
                />
              </label>
              <label className={styles.formField}>
                <span>Ingredients principaux</span>
                <input
                  className={styles.control}
                  value={dishDraft.ingredientsText}
                  onChange={(event) =>
                    setDishDraft((draft) => ({
                      ...draft,
                      ingredientsText: event.target.value
                    }))
                  }
                />
              </label>
              <fieldset className={styles.formField}>
                <legend>Déclarations allergènes</legend>
                <p className={styles.cellSub}>
                  Sélectionnez un statut pour chaque allergène. « À confirmer »
                  reste exclu des filtres sans allergène.
                </p>
                <p className={styles.cellSub}>
                  Ne sélectionnez « Déclaré sans » qu’après vérification de la recette,
                  des sauces, des fonds, des garnitures et des risques de contamination croisée.
                </p>
                <div className={styles.formGrid}>
                  {ALLERGEN_REGISTRY.map(({ id }) => {
                    const declaration = dishDraft.allergenDeclarations.find(
                      (item) => item.allergenId === id
                    );
                    return (
                      <label key={id} className={styles.formField}>
                        <span>{allergenLabel(id, "fr")}</span>
                        <select
                          className={styles.control}
                          value={declaration?.status ?? "unknown"}
                          onChange={(event) =>
                            setDishDraft((draft) => ({
                              ...draft,
                              allergenDeclarations: draft.allergenDeclarations.map((item) =>
                                item.allergenId === id
                                  ? { ...item, status: event.target.value as AllergenStatus }
                                  : item
                              )
                            }))
                          }
                        >
                          {ALLERGEN_STATUS_OPTIONS.map((option) => (
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
              <label className={styles.formField}>
                <span>Autres allergènes</span>
                <input
                  className={styles.control}
                  value={dishDraft.customAllergensText}
                  onChange={(event) =>
                    setDishDraft((draft) => ({
                      ...draft,
                      customAllergensText: event.target.value
                    }))
                  }
                  placeholder="Céleri, lupin, allergène fournisseur"
                  maxLength={500}
                />
                <span className={styles.cellSub}>
                  Ajoutez les allergènes absents de la liste. Ils seront déclarés comme présents et restent soumis à confirmation avec l’équipe.
                </span>
              </label>
              <label className={styles.formField}>
                <span>Options, extras / accompagnements</span>
                <input
                  className={styles.control}
                  value={dishDraft.optionsText}
                  onChange={(event) =>
                    setDishDraft((draft) => ({
                      ...draft,
                      optionsText: event.target.value
                    }))
                  }
                />
              </label>
            </div>
            {dishDraft.id && dishes.find((dish) => dish.id === dishDraft.id)?.allergenReviewRequired ? (
              <p className={styles.fieldHelp} role="alert">
                Les anciennes données allergènes nécessitent une vérification avant publication.
              </p>
            ) : null}
            <label className={styles.formField}>
              <span>Note chef</span>
              <textarea
                className={styles.textarea}
                value={dishDraft.chefNote}
                onChange={(event) =>
                  setDishDraft((draft) => ({
                    ...draft,
                    chefNote: event.target.value
                  }))
                }
                maxLength={500}
              />
            </label>
            {!dishDraft.id ? (
              <div className={styles.formGrid}>
                <label className={styles.formField}>
                  <span>Photo</span>
                  <input
                    className={styles.control}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={isSavingDish}
                    onChange={(event) =>
                      setDishAssetDraft((draft) => ({
                        ...draft,
                        photoFile: event.target.files?.[0] ?? null
                      }))
                    }
                  />
                  <span className={styles.cellSub}>
                    {fileLabel(dishAssetDraft.photoFile, "Aucune photo selectionnee")}
                  </span>
                </label>
                <label className={styles.formField}>
                  <span>GLB</span>
                  <input
                    className={styles.control}
                    type="file"
                    accept=".glb,model/gltf-binary"
                    disabled={isSavingDish}
                    onChange={(event) =>
                      setDishAssetDraft((draft) => ({
                        ...draft,
                        glbFile: event.target.files?.[0] ?? null
                      }))
                    }
                  />
                  <span className={styles.cellSub}>
                    {fileLabel(dishAssetDraft.glbFile, "Aucun GLB selectionne")}
                  </span>
                </label>
              </div>
            ) : null}
            <div className={styles.submitRow}>
              <button
                className={styles.btnPrimary}
                type="submit"
                disabled={isPending || isSavingDish}
              >
                {isSavingDish
                  ? dishDraft.id
                    ? "Mise a jour..."
                    : dishAssetDraft.glbFile
                      ? "Creation + pipeline..."
                      : "Creation..."
                  : dishDraft.id
                    ? "Mettre a jour"
                    : "Creer plat"}
              </button>
              <button
                className={styles.btn}
                type="button"
                disabled={isSavingDish}
                onClick={closeEditor}
              >
                Annuler
              </button>
            </div>
          </form>
        </Panel>
      ) : null}

      <Panel title="Categories">
        {menuError ? (
          <EmptyState>{menuError}</EmptyState>
        ) : categories.length === 0 ? (
          <EmptyState>Aucune categorie visible pour ce restaurant.</EmptyState>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>Categorie</th>
                  <th>Description</th>
                  <th>Plats</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => {
                  const deleteKey = `category:${category.id}`;
                  const isConfirmingDelete =
                    deleteTarget?.type === "category" && deleteTarget.id === category.id;

                  return (
                    <tr key={category.id}>
                      <td className={styles.cellMain}>{category.label}</td>
                      <td className={styles.cellSub}>{category.description}</td>
                      <td>{category.count}</td>
                      <td>
                        <div className={styles.tableActions}>
                          <button
                            className={`${styles.btn} ${styles.btnSmall}`}
                            type="button"
                            disabled={!canEdit || isMutating}
                            onClick={() => startEditCategory(category)}
                          >
                            Modifier
                          </button>
                          <button
                            className={`${styles.btn} ${styles.btnSmall} ${styles.btnDanger}`}
                            type="button"
                            disabled={!canEdit || isMutating}
                            aria-label={`Supprimer la section ${category.label}`}
                            title={
                              category.count > 0
                                ? "Supprimez ou deplacez les plats avant de supprimer cette section."
                                : undefined
                            }
                            onClick={() => requestDeleteCategory(category)}
                          >
                            Supprimer
                          </button>
                          {isConfirmingDelete ? (
                            <div
                              className={styles.modelDeleteConfirm}
                              role="alertdialog"
                              aria-label={`Confirmer la suppression de la section ${category.label}`}
                            >
                              <strong>Supprimer la section {category.label} ?</strong>
                              <span>Cette section vide sera retiree de la carte.</span>
                              <div className={styles.tableActions}>
                                <button
                                  className={`${styles.btn} ${styles.btnSmall}`}
                                  type="button"
                                  disabled={deletingKey === deleteKey}
                                  onClick={() => setDeleteTarget(null)}
                                >
                                  Annuler
                                </button>
                                <button
                                  className={`${styles.btn} ${styles.btnSmall} ${styles.btnDanger}`}
                                  type="button"
                                  disabled={deletingKey === deleteKey}
                                  onClick={() => void deleteCategory(category)}
                                >
                                  {deletingKey === deleteKey ? "Suppression..." : "Confirmer"}
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel
        title="Plats"
        action={
          sortedCategories.length > 0 ? (
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Section</span>
              <select
                className={styles.control}
                value={dishSectionFilter}
                onChange={(event) => setDishSectionFilter(event.target.value)}
              >
                <option value="all">Toutes les sections</option>
                {sortedCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null
        }
      >
        {menuError ? (
          <EmptyState>{menuError}</EmptyState>
        ) : dishes.length === 0 ? (
          <EmptyState>Aucun plat charge pour ce restaurant.</EmptyState>
        ) : filteredDishes.length === 0 ? (
          <EmptyState>Aucun plat dans cette section.</EmptyState>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>Plat</th>
                  <th>Prix</th>
                  <th>Disponibilite</th>
                  <th>Description</th>
                  <th>Photo</th>
                  <th>Media</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredDishes.map((dish) => {
                  const deleteKey = `dish:${dish.id}`;
                  const isConfirmingDelete =
                    deleteTarget?.type === "dish" && deleteTarget.id === dish.id;

                  return (
                    <tr key={dish.id}>
                      <td>
                        <div className={styles.dishTitleCell}>
                          <strong className={styles.cellMain}>{dish.name}</strong>
                          <span className={styles.dishSectionLabel}>
                            Section : {dish.category}
                          </span>
                        </div>
                      </td>
                      <td>{dish.priceLabel || <Badge tone="warn">Prix manquant</Badge>}</td>
                      <td>
                        <Badge tone={dish.available ? "ready" : "muted"}>
                          {dish.available ? "Disponible" : "Indisponible"}
                        </Badge>
                      </td>
                      <td>
                        <Badge tone={dish.description ? "ready" : "warn"}>
                          {dish.description ? "Prete" : "A completer"}
                        </Badge>
                      </td>
                      <td>
                        <Badge tone={dish.hasPhoto ? "ready" : "warn"}>
                          {dish.hasPhoto ? "Photo prete" : dish.photoStatus}
                        </Badge>
                      </td>
                      <td>
                        <Badge tone={dish.hasImmersive ? "ready" : "muted"}>
                          {dish.hasImmersive ? "Modele pret" : "Aucun modele"}
                        </Badge>
                      </td>
                      <td>
                        <div className={styles.tableActions}>
                          <button
                            className={`${styles.btn} ${styles.btnSmall}`}
                            type="button"
                            disabled={!canEdit || isMutating}
                            onClick={() => startEditDish(dish)}
                          >
                            Modifier
                          </button>
                          <button
                            className={`${styles.btn} ${styles.btnSmall} ${styles.btnDanger}`}
                            type="button"
                            disabled={!canEdit || isMutating}
                            aria-label={`Supprimer le plat ${dish.name}`}
                            onClick={() => requestDeleteDish(dish)}
                          >
                            Supprimer
                          </button>
                          <Link
                            className={`${styles.btn} ${styles.btnSmall}`}
                            href={mediasHref}
                            prefetch={false}
                          >
                            Medias
                          </Link>
                          {isConfirmingDelete ? (
                            <div
                              className={styles.modelDeleteConfirm}
                              role="alertdialog"
                              aria-label={`Confirmer la suppression du plat ${dish.name}`}
                            >
                              <strong>Supprimer le plat {dish.name} ?</strong>
                              <span>
                                Le plat ne sera plus affiche dans le dashboard ni dans le
                                menu public.
                              </span>
                              <div className={styles.tableActions}>
                                <button
                                  className={`${styles.btn} ${styles.btnSmall}`}
                                  type="button"
                                  disabled={deletingKey === deleteKey}
                                  onClick={() => setDeleteTarget(null)}
                                >
                                  Annuler
                                </button>
                                <button
                                  className={`${styles.btn} ${styles.btnSmall} ${styles.btnDanger}`}
                                  type="button"
                                  disabled={deletingKey === deleteKey}
                                  onClick={() => void deleteDish(dish)}
                                >
                                  {deletingKey === deleteKey ? "Suppression..." : "Confirmer"}
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
