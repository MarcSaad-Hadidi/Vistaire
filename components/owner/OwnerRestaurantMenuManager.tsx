"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import styles from "@/components/owner/OwnerCockpit.module.css";
import { Badge, EmptyState, Panel } from "@/components/owner/OwnerUi";
import type { PublicMenuCategory, PublicMenuDish } from "@/lib/menu/publicMenuCore";

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
  available: boolean;
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
  available: true
};

function priceDraftFromDish(dish: PublicMenuDish): string {
  if (!Number.isFinite(dish.priceCents) || dish.priceCents <= 0) return "";
  const cents = Math.round(dish.priceCents);
  const digits = cents % 100 === 0 ? 0 : 2;
  return (cents / 100).toFixed(digits).replace(".", ",");
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
) {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = (await response.json().catch(() => null)) as {
    ok?: boolean;
    error?: string;
  } | null;
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error || "Modification impossible.");
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
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [deletingKey, setDeletingKey] = useState("");
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

  function resetMessages() {
    setStatusMessage("");
    setErrorMessage("");
  }

  function startNewCategory() {
    resetMessages();
    setDeleteTarget(null);
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
    setDishDraft({
      ...EMPTY_DISH_DRAFT,
      categoryId: sortedCategories[0]?.id ?? ""
    });
    setActiveEditor("dish");
  }

  function startEditDish(dish: PublicMenuDish) {
    resetMessages();
    setDeleteTarget(null);
    setDishDraft({
      id: dish.id,
      name: dish.name,
      categoryId: categoryIdForDish(dish, sortedCategories),
      price: priceDraftFromDish(dish),
      description: dish.description,
      available: dish.available
    });
    setActiveEditor("dish");
  }

  function closeEditor() {
    setActiveEditor(null);
    setDeleteTarget(null);
    setCategoryDraft(EMPTY_CATEGORY_DRAFT);
    setDishDraft(EMPTY_DISH_DRAFT);
  }

  function refreshAfterSave(message: string) {
    setStatusMessage(message);
    setErrorMessage("");
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
    try {
      await submitJson(dishEndpoint, dishDraft.id ? "PATCH" : "POST", {
        id: dishDraft.id || undefined,
        name: dishDraft.name,
        categoryId: dishDraft.categoryId,
        price: dishDraft.price,
        description: dishDraft.description,
        available: dishDraft.available
      });
      refreshAfterSave(dishDraft.id ? "Plat modifie." : "Plat ajoute.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Plat impossible a enregistrer.");
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
            disabled={!canEdit}
            onClick={startNewCategory}
          >
            Ajouter section
          </button>
          <button
            className={styles.btn}
            type="button"
            disabled={!canEdit || sortedCategories.length === 0}
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
              <button className={styles.btnPrimary} type="submit" disabled={isPending}>
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
            <div className={styles.submitRow}>
              <button className={styles.btnPrimary} type="submit" disabled={isPending}>
                {dishDraft.id ? "Mettre a jour" : "Creer plat"}
              </button>
              <button className={styles.btn} type="button" onClick={closeEditor}>
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
                            disabled={!canEdit || Boolean(deletingKey)}
                            onClick={() => startEditCategory(category)}
                          >
                            Modifier
                          </button>
                          <button
                            className={`${styles.btn} ${styles.btnSmall} ${styles.btnDanger}`}
                            type="button"
                            disabled={!canEdit || Boolean(deletingKey)}
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

      <Panel title="Plats">
        {menuError ? (
          <EmptyState>{menuError}</EmptyState>
        ) : dishes.length === 0 ? (
          <EmptyState>Aucun plat charge pour ce restaurant.</EmptyState>
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
                {dishes.map((dish) => {
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
                            disabled={!canEdit || Boolean(deletingKey)}
                            onClick={() => startEditDish(dish)}
                          >
                            Modifier
                          </button>
                          <button
                            className={`${styles.btn} ${styles.btnSmall} ${styles.btnDanger}`}
                            type="button"
                            disabled={!canEdit || Boolean(deletingKey)}
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
