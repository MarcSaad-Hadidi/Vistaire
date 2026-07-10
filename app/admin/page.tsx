import { AdminRestaurantDashboard } from "@/components/admin/AdminRestaurantDashboard";
import styles from "@/components/vistaire-preview/VistaireRestaurateurDashboardPreview.module.css";
import { requireAdminRestaurantAccess } from "@/lib/admin/access";
import { loadAdminDashboardData } from "@/lib/admin/dashboardData";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const access = await requireAdminRestaurantAccess("dashboard:read");
  if (!access.ok) {
    return (
      <main className={styles.page}>
        <section aria-labelledby="admin-access-title" className={styles.hero}>
          <div className={`${styles.previewFrame} ${styles.adminFrame}`}>
            <section className={`${styles.card} ${styles.adminFullPanel}`}>
              <div className={styles.adminPanelHeader}>
                <h1 id="admin-access-title">Accès dashboard restaurant requis</h1>
                <p>Scannez le QR admin interne de votre restaurant.</p>
                <form action="/admin/access" method="post">
                  <label
                    style={{ display: "grid", gap: 8, margin: "20px 0 12px" }}
                  >
                    <span>Code ou lien QR admin</span>
                    <input
                      autoComplete="off"
                      maxLength={2048}
                      name="qrAccess"
                      required
                      style={{
                        border: "1px solid rgba(232, 207, 155, 0.4)",
                        borderRadius: 12,
                        background: "rgba(13, 8, 5, 0.7)",
                        color: "#fff7ea",
                        padding: "12px 14px"
                      }}
                    />
                  </label>
                  <button className={styles.primaryButton} type="submit">
                    Accéder au dashboard
                  </button>
                </form>
                {process.env.NODE_ENV !== "production" ? (
                  <form action="/admin/preview" method="post">
                    <button className={styles.primaryButton} type="submit">
                      Ouvrir la prévisualisation locale
                    </button>
                  </form>
                ) : null}
              </div>
            </section>
          </div>
        </section>
      </main>
    );
  }

  const result = await loadAdminDashboardData(access.restaurantId);
  if (!result.ok) {
    return (
      <main className={styles.page}>
        <section aria-labelledby="admin-unavailable-title" className={styles.hero}>
          <div className={`${styles.previewFrame} ${styles.adminFrame}`}>
            <section className={`${styles.card} ${styles.adminFullPanel}`}>
              <div className={styles.adminPanelHeader}>
                <p className={styles.badge}>Dashboard restaurant</p>
                <h1 id="admin-unavailable-title">Dashboard indisponible</h1>
                <p>
                  Le restaurant lié à cette session n’est pas disponible. Aucun plat
                  ne peut être modifié.
                </p>
              </div>
            </section>
          </div>
        </section>
      </main>
    );
  }
  return <AdminRestaurantDashboard data={result.data} />;
}
