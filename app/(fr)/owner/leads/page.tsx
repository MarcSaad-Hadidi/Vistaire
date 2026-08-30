import styles from "@/components/owner/OwnerCockpit.module.css";
import { Badge, EmptyState, ModuleHeader, Panel } from "@/components/owner/OwnerUi";
import { getOwnerMenuStatusData } from "@/lib/owner/data";

export const dynamic = "force-dynamic";

export default async function OwnerLeadsPage() {
  const data = await getOwnerMenuStatusData();
  const leads = data.restaurants.filter((restaurant) => !restaurant.isDemo);

  return (
    <>
      <ModuleHeader
        title="Leads / Clients"
        description="Contacts restaurateurs issus de la création de restaurant (nom, email, téléphone, notes). Owner-only."
      />

      {leads.length === 0 ? (
        <EmptyState>
          Aucun contact restaurant pour l&apos;instant. Les contacts saisis à la
          création apparaissent ici.
        </EmptyState>
      ) : (
        <Panel title={`${leads.length} contact(s)`}>
          <div className={styles.tableWrap}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>Restaurant</th>
                  <th>Contact</th>
                  <th>Email</th>
                  <th>Téléphone</th>
                  <th>Statut</th>
                  <th>Prochaine action</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((restaurant) => (
                  <tr key={restaurant.id}>
                    <td className={styles.cellMain}>{restaurant.name}</td>
                    <td>{restaurant.contactName || "—"}</td>
                    <td className={styles.cellSub}>{restaurant.contactEmail || "—"}</td>
                    <td className={styles.cellSub}>{restaurant.contactPhone || "—"}</td>
                    <td>
                      <Badge tone={restaurant.status === "active" ? "ready" : "warn"}>
                        {restaurant.statusLabel}
                      </Badge>
                    </td>
                    <td className={styles.cellSub}>{restaurant.nextAction}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </>
  );
}
