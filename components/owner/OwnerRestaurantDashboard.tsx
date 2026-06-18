"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MenuQrCode } from "@/components/owner/MenuQrCode";
import styles from "@/components/owner/OwnerCockpit.module.css";
import { Badge, type BadgeTone } from "@/components/owner/OwnerUi";
import type { OwnerReadinessItem, OwnerRestaurant } from "@/lib/owner/types";

type OwnerRestaurantDashboardProps = {
  restaurant: OwnerRestaurant;
};

type TabId =
  | "overview"
  | "menu"
  | "dishes"
  | "media"
  | "qr"
  | "immersive"
  | "signals"
  | "settings";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "overview", label: "Vue d'ensemble" },
  { id: "menu", label: "Menu" },
  { id: "dishes", label: "Plats" },
  { id: "media", label: "Medias" },
  { id: "qr", label: "QR" },
  { id: "immersive", label: "3D / AR" },
  { id: "signals", label: "Signaux" },
  { id: "settings", label: "Settings" }
];

function readinessTone(item: OwnerReadinessItem): BadgeTone {
  if (item.status === "ready" || item.status === "demo") return "ready";
  if (item.status === "needs_setup") return "warn";
  return "danger";
}

function qrTone(status: OwnerRestaurant["qrStatus"]): BadgeTone {
  if (status === "ready") return "ready";
  if (status === "generable") return "warn";
  return "danger";
}

function statusTone(restaurant: OwnerRestaurant): BadgeTone {
  if (restaurant.status === "active" || restaurant.status === "demo") return "ready";
  if (restaurant.status === "setup_needed") return "warn";
  return "muted";
}

function nextActionTab(restaurant: OwnerRestaurant): TabId {
  if (restaurant.dishCount === 0) return "dishes";
  if (restaurant.incompleteDishCount > 0) return "media";
  if (restaurant.qrStatus !== "ready") return "qr";
  if (restaurant.immersiveDishCount === 0) return "immersive";
  return "overview";
}

function readinessSummary(restaurant: OwnerRestaurant): string {
  if (restaurant.readinessScore >= 80) {
    return "Le restaurant est proche d'une mise en service propre. Gardez les tests QR et la preview client dans la boucle.";
  }
  if (restaurant.readinessScore >= 50) {
    return "Le compte est utilisable en setup, mais les modules ci-dessous indiquent encore les actions prioritaires.";
  }
  return "Le restaurant doit rester en onboarding. Commencez par le menu, les plats et les photos avant de publier.";
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("fr-CA").format(value);
}

export function OwnerRestaurantDashboard({
  restaurant
}: OwnerRestaurantDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [copyStatus, setCopyStatus] = useState("");
  const primaryActionTab = useMemo(() => nextActionTab(restaurant), [restaurant]);

  async function copyMenuUrl() {
    try {
      await navigator.clipboard.writeText(restaurant.menuUrl);
      setCopyStatus("URL menu copiee.");
    } catch {
      setCopyStatus("Copie indisponible dans ce navigateur.");
    }
  }

  const menuReady = restaurant.dishCount > 0;
  const photosReady = menuReady && restaurant.incompleteDishCount === 0;
  const hasImmersive = restaurant.immersiveDishCount > 0;

  return (
    <div className={styles.restaurantDashboard}>
      <article className={styles.restaurantCommandHeader}>
        <div>
          <Link className={styles.backLink} href="/owner/restaurants" prefetch={false}>
            Tous les restaurants
          </Link>
          <h2>{restaurant.name}</h2>
          <p>
            {restaurant.location} · {restaurant.cuisineType} · {restaurant.slug}
          </p>
          <div className={styles.pillRow}>
            <Badge tone={statusTone(restaurant)}>{restaurant.statusLabel}</Badge>
            <Badge tone={restaurant.readinessScore >= 80 ? "ready" : "warn"}>
              Readiness {restaurant.readinessScore}%
            </Badge>
            <Badge tone={qrTone(restaurant.qrStatus)}>{restaurant.qrStatusLabel}</Badge>
          </div>
        </div>
        <div className={styles.restaurantHeaderActions}>
          <a className={`${styles.btnPrimary} ${styles.btn}`} href={restaurant.clientMenuHref}>
            Preview client
          </a>
          <button type="button" className={styles.btn} onClick={copyMenuUrl}>
            Copier URL menu
          </button>
          <button
            type="button"
            className={styles.btn}
            onClick={() => setActiveTab("qr")}
          >
            Tester / generer QR
          </button>
        </div>
      </article>

      {copyStatus ? (
        <p className={styles.qrStatus} role="status">
          {copyStatus}
        </p>
      ) : null}

      <nav className={styles.restaurantTabs} aria-label="Modules restaurant">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            aria-pressed={activeTab === tab.id}
            className={activeTab === tab.id ? styles.restaurantTabActive : ""}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === "overview" ? (
        <section className={styles.restaurantTabPanel}>
          <div className={styles.restaurantOverviewGrid}>
            <article className={styles.nextActionPanel}>
              <span className={styles.metricLabel}>Prochaine action</span>
              <strong>{restaurant.nextAction}</strong>
              <p>{readinessSummary(restaurant)}</p>
              <button
                type="button"
                className={`${styles.btnPrimary} ${styles.btn}`}
                onClick={() => setActiveTab(primaryActionTab)}
              >
                Ouvrir le module
              </button>
            </article>

            <article className={styles.panel}>
              <div className={styles.panelHeader}>
                <h3 className={styles.panelTitle}>Readiness restaurant</h3>
              </div>
              <div className={styles.panelBody}>
                <div className={styles.checklist}>
                  {restaurant.readinessItems.map((item) => (
                    <div key={item.id} className={styles.checkItem}>
                      <span>
                        <strong>{item.label}</strong>
                        <small>{item.detail}</small>
                      </span>
                      <Badge tone={readinessTone(item)}>
                        {item.status === "ready" || item.status === "demo"
                          ? "OK"
                          : "A traiter"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </article>
          </div>

          <section className={styles.commandKpiGrid} aria-label="KPI restaurant">
            <article>
              <span>Plats</span>
              <strong>{formatCount(restaurant.dishCount)}</strong>
              <small>{menuReady ? "Menu detecte" : "Aucun plat detecte"}</small>
            </article>
            <article>
              <span>Photos</span>
              <strong>
                {restaurant.photoDishCount}/{restaurant.dishCount || 0}
              </strong>
              <small>{photosReady ? "Couverture complete" : "Photos a completer"}</small>
            </article>
            <article>
              <span>QR</span>
              <strong>{restaurant.qrStatus === "ready" ? "Pret" : "Action"}</strong>
              <small>{restaurant.qrStatusLabel}</small>
            </article>
            <article>
              <span>3D / AR</span>
              <strong>{formatCount(restaurant.immersiveDishCount)}</strong>
              <small>{hasImmersive ? "Assets detectes" : "Plat signature a choisir"}</small>
            </article>
            <article>
              <span>Ouvertures</span>
              <strong>{formatCount(restaurant.openingsToday)}</strong>
              <small>Ce jour si disponible</small>
            </article>
            <article>
              <span>Interactions</span>
              <strong>{formatCount(restaurant.interactionsToday)}</strong>
              <small>Plats, 3D, CTA</small>
            </article>
          </section>

          <div className={styles.restaurantOverviewGrid}>
            <ActionTable restaurant={restaurant} setActiveTab={setActiveTab} />
            <ClientPreview restaurant={restaurant} />
          </div>
        </section>
      ) : null}

      {activeTab === "menu" ? <MenuPanel restaurant={restaurant} /> : null}
      {activeTab === "dishes" ? <DishesPanel restaurant={restaurant} /> : null}
      {activeTab === "media" ? <MediaPanel restaurant={restaurant} /> : null}
      {activeTab === "qr" ? <QrPanel restaurant={restaurant} /> : null}
      {activeTab === "immersive" ? <ImmersivePanel restaurant={restaurant} /> : null}
      {activeTab === "signals" ? <SignalsPanel restaurant={restaurant} /> : null}
      {activeTab === "settings" ? <SettingsPanel restaurant={restaurant} /> : null}
    </div>
  );
}

function ActionTable({
  restaurant,
  setActiveTab
}: {
  restaurant: OwnerRestaurant;
  setActiveTab: (tab: TabId) => void;
}) {
  const actions: Array<{ title: string; impact: string; tab: TabId; tone: BadgeTone }> = [];

  if (restaurant.dishCount === 0) {
    actions.push({
      title: "Ajouter les plats du menu",
      impact: "Base produit",
      tab: "dishes",
      tone: "danger"
    });
  }
  if (restaurant.incompleteDishCount > 0) {
    actions.push({
      title: `Ajouter ${restaurant.incompleteDishCount} photo(s) manquante(s)`,
      impact: "Perception premium",
      tab: "media",
      tone: "danger"
    });
  }
  if (restaurant.qrStatus !== "ready") {
    actions.push({
      title: restaurant.qrStatus === "generable" ? "Generer QR menu" : "Preparer lien menu",
      impact: "Mise en test table",
      tab: "qr",
      tone: "warn"
    });
  }
  if (restaurant.immersiveDishCount === 0 && restaurant.dishCount > 0) {
    actions.push({
      title: "Choisir un plat signature 3D",
      impact: "Differenciation premium",
      tab: "immersive",
      tone: "warn"
    });
  }
  if (actions.length === 0) {
    actions.push({
      title: "Ouvrir preview client",
      impact: "Validation commerciale",
      tab: "overview",
      tone: "ready"
    });
  }

  return (
    <article className={styles.panel}>
      <div className={styles.panelHeader}>
        <h3 className={styles.panelTitle}>Actions propres a ce restaurant</h3>
      </div>
      <div className={styles.panelBody}>
        <div className={styles.tableWrap}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>Action</th>
                <th>Impact</th>
                <th>Priorite</th>
                <th aria-label="Ouvrir" />
              </tr>
            </thead>
            <tbody>
              {actions.map((action) => (
                <tr key={action.title}>
                  <td className={styles.cellMain}>{action.title}</td>
                  <td className={styles.cellSub}>{action.impact}</td>
                  <td>
                    <Badge tone={action.tone}>
                      {action.tone === "danger" ? "Haute" : action.tone === "warn" ? "Moyenne" : "OK"}
                    </Badge>
                  </td>
                  <td>
                    <button
                      type="button"
                      className={styles.btnSmall + " " + styles.btn}
                      onClick={() => setActiveTab(action.tab)}
                    >
                      Ouvrir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </article>
  );
}

function ClientPreview({ restaurant }: { restaurant: OwnerRestaurant }) {
  return (
    <article className={styles.clientPreviewPanel}>
      <div className={styles.clientPreviewPhone}>
        <div className={styles.clientPreviewScreen}>
          <div className={styles.clientPreviewHero}>
            <span>Vistaire menu</span>
            <strong>{restaurant.name}</strong>
            <small>{restaurant.cuisineType}</small>
          </div>
          <div className={styles.clientPreviewList}>
            <p>
              <strong>Carte</strong>
              <span>{restaurant.dishCount || "Aucun"} plat(s) detecte(s)</span>
            </p>
            <p>
              <strong>Photos</strong>
              <span>
                {restaurant.photoDishCount}/{restaurant.dishCount || 0} pretes
              </span>
            </p>
            <p>
              <strong>Experience</strong>
              <span>{restaurant.immersiveDishCount} plat(s) 3D / AR</span>
            </p>
          </div>
        </div>
      </div>
      <p className={styles.sourceNote}>
        Preview legere sans chargement media lourd. Ouvrez la preview client pour
        voir le rendu complet.
      </p>
    </article>
  );
}

function MenuPanel({ restaurant }: { restaurant: OwnerRestaurant }) {
  return (
    <section className={styles.restaurantTabPanel}>
      <article className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h3 className={styles.panelTitle}>Menu</h3>
            <p className={styles.cellSub}>
              Statut derive des plats relies au restaurant. Aucune table menus
              dediee ne reste exposee dans ce cockpit.
            </p>
          </div>
          <Link className={styles.btn} href="/owner/menus" prefetch={false}>
            Vue globale menus
          </Link>
        </div>
        <div className={styles.panelBody}>
          <div className={styles.commandKpiGrid}>
            <article>
              <span>Structure</span>
              <strong>{restaurant.dishCount > 0 ? "Detectee" : "Vide"}</strong>
              <small>{restaurant.dishCount} plat(s)</small>
            </article>
            <article>
              <span>Menu public</span>
              <strong>{restaurant.menuUrlSource === "column" ? "Configure" : "Preview"}</strong>
              <small className={styles.breakText}>{restaurant.publicMenuPath}</small>
            </article>
          </div>
          <p className={styles.sourceNote}>
            Pour cette phase, le dashboard contextualise les donnees existantes.
            Ajout/edition persistante des sections menu non disponible ici.
          </p>
        </div>
      </article>
    </section>
  );
}

function DishesPanel({ restaurant }: { restaurant: OwnerRestaurant }) {
  return (
    <section className={styles.restaurantTabPanel}>
      <article className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h3 className={styles.panelTitle}>Plats</h3>
            <p className={styles.cellSub}>
              Controle qualite par restaurant. Les plats sont lus depuis
              menu_dishes quand disponible.
            </p>
          </div>
          <Link className={styles.btn} href="/owner/plats" prefetch={false}>
            Vue globale plats
          </Link>
        </div>
        <div className={styles.panelBody}>
          <div className={styles.checklist}>
            <div className={styles.checkItem}>
              <span>
                <strong>Premiers plats</strong>
                <small>{restaurant.dishCount} plat(s) detecte(s).</small>
              </span>
              <Badge tone={restaurant.dishCount > 0 ? "ready" : "danger"}>
                {restaurant.dishCount > 0 ? "OK" : "A ajouter"}
              </Badge>
            </div>
            <div className={styles.checkItem}>
              <span>
                <strong>Photos</strong>
                <small>
                  {restaurant.photoDishCount}/{restaurant.dishCount || 0} plats avec photo.
                </small>
              </span>
              <Badge tone={restaurant.incompleteDishCount === 0 && restaurant.dishCount > 0 ? "ready" : "warn"}>
                {restaurant.incompleteDishCount} manquante(s)
              </Badge>
            </div>
          </div>
          <p className={styles.sourceNote}>
            Edition persistante des plats non exposee par API owner dans cette
            version. Utilisez ce module comme lecture de readiness.
          </p>
        </div>
      </article>
    </section>
  );
}

function MediaPanel({ restaurant }: { restaurant: OwnerRestaurant }) {
  return (
    <section className={styles.restaurantTabPanel}>
      <article className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h3 className={styles.panelTitle}>Medias / qualite</h3>
            <p className={styles.cellSub}>
              Diagnostic photos et copy premium. Aucun upload public ne part de
              ce dashboard.
            </p>
          </div>
          <Link className={styles.btn} href="/owner/medias" prefetch={false}>
            Vue globale medias
          </Link>
        </div>
        <div className={styles.panelBody}>
          <div className={styles.commandKpiGrid}>
            <article>
              <span>Photos</span>
              <strong>
                {restaurant.photoDishCount}/{restaurant.dishCount || 0}
              </strong>
              <small>Couverture menu</small>
            </article>
            <article>
              <span>Manques</span>
              <strong>{restaurant.incompleteDishCount}</strong>
              <small>Plats a completer</small>
            </article>
            <article>
              <span>Copy</span>
              <strong>Revue</strong>
              <small>Descriptions et notes internes</small>
            </article>
          </div>
          <p className={styles.sourceNote}>
            Diagnostic en lecture seule. Les uploads et sources medias restent
            geres par les workflows existants.
          </p>
        </div>
      </article>
    </section>
  );
}

function QrPanel({ restaurant }: { restaurant: OwnerRestaurant }) {
  return (
    <section className={styles.restaurantTabPanel}>
      <article className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h3 className={styles.panelTitle}>QR restaurant</h3>
            <p className={styles.cellSub}>
              Preview du menu public. Pour creer un QR securise persiste, ouvrez
              le module QR.
            </p>
          </div>
          <Link className={styles.btnPrimary + " " + styles.btn} href="/owner/qr-codes" prefetch={false}>
            Generer QR persiste
          </Link>
        </div>
        <div className={styles.panelBody}>
          <MenuQrCode
            menuUrl={restaurant.qrTargetUrl}
            restaurantName={restaurant.name}
          />
          <p className={styles.sourceNote}>
            Statut actuel : {restaurant.qrStatusLabel}. Sans table qr_codes
            configuree, les QR de test peuvent rester non persistants.
          </p>
        </div>
      </article>
    </section>
  );
}

function ImmersivePanel({ restaurant }: { restaurant: OwnerRestaurant }) {
  return (
    <section className={styles.restaurantTabPanel}>
      <article className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h3 className={styles.panelTitle}>3D / AR</h3>
            <p className={styles.cellSub}>
              Choisir les plats signatures et suivre le pipeline. Ce module ne
              charge aucun GLB/USDZ.
            </p>
          </div>
          <Link className={styles.btn} href="/owner/3d-ar" prefetch={false}>
            Pipeline 3D / AR
          </Link>
        </div>
        <div className={styles.panelBody}>
          <div className={styles.commandKpiGrid}>
            <article>
              <span>Assets detectes</span>
              <strong>{restaurant.immersiveDishCount}</strong>
              <small>{restaurant.dishCount} plat(s) dans le menu</small>
            </article>
            <article>
              <span>Etat</span>
              <strong>{restaurant.immersiveDishCount > 0 ? "En place" : "A choisir"}</strong>
              <small>3D selective, pas decorative</small>
            </article>
          </div>
        </div>
      </article>
    </section>
  );
}

function SignalsPanel({ restaurant }: { restaurant: OwnerRestaurant }) {
  return (
    <section className={styles.restaurantTabPanel}>
      <article className={styles.panel}>
        <div className={styles.panelHeader}>
          <h3 className={styles.panelTitle}>Signaux</h3>
        </div>
        <div className={styles.panelBody}>
          <div className={styles.commandKpiGrid}>
            <article>
              <span>Ouvertures menu</span>
              <strong>{formatCount(restaurant.openingsToday)}</strong>
              <small>Ce jour si analytics disponibles</small>
            </article>
            <article>
              <span>Interactions</span>
              <strong>{formatCount(restaurant.interactionsToday)}</strong>
              <small>Plats, CTA, 3D/AR</small>
            </article>
          </div>
          <p className={styles.sourceNote}>
            Les signaux restent anonymes et dependent des tables analytics
            disponibles. Zero signal ne veut pas dire zero client si le tracking
            reste non configure.
          </p>
        </div>
      </article>
    </section>
  );
}

function SettingsPanel({ restaurant }: { restaurant: OwnerRestaurant }) {
  return (
    <section className={styles.restaurantTabPanel}>
      <article className={styles.panel}>
        <div className={styles.panelHeader}>
          <h3 className={styles.panelTitle}>Settings restaurant</h3>
        </div>
        <div className={styles.panelBody}>
          <dl className={styles.definitionList}>
            <div>
              <dt>ID</dt>
              <dd>{restaurant.id}</dd>
            </div>
            <div>
              <dt>Slug</dt>
              <dd>{restaurant.slug}</dd>
            </div>
            <div>
              <dt>Contact</dt>
              <dd>{restaurant.contactName || "A preciser"}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{restaurant.contactEmail || "A preciser"}</dd>
            </div>
            <div>
              <dt>Notes</dt>
              <dd>{restaurant.notes || "Aucune note interne."}</dd>
            </div>
          </dl>
          <p className={styles.sourceNote}>
            Edition de profil non exposee dans cette phase. La creation du
            restaurant est persistante quand Supabase confirme son identifiant.
          </p>
        </div>
      </article>
    </section>
  );
}
