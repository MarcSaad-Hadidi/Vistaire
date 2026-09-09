import { AdminPanel } from "@/components/admin/system/AdminPresentationPrimitives";
import type { AdminMoreQualityModel } from "@/lib/admin/more/contracts";
import styles from "./AdminMoreQuality.module.css";

export function RestaurantProfileCard({ model }: { model: AdminMoreQualityModel }) {
  const p = model.profile;
  const labels = model.locale === "fr"
    ? { location: "Lieu", cuisine: "Cuisine", phone: "Téléphone", email: "Contact", menu: "Menu public" }
    : { location: "Location", cuisine: "Cuisine", phone: "Phone", email: "Contact", menu: "Public menu" };
  const rows = [
    p.location && [labels.location, p.location],
    p.cuisineType && [labels.cuisine, p.cuisineType],
    p.contactPhone && [labels.phone, p.contactPhone],
    p.contactEmail && [labels.email, p.contactEmail],
    p.publicMenuPath && [labels.menu, p.publicMenuPath]
  ].filter(Boolean) as string[][];
  return (
    <AdminPanel title={model.copy.profileTitle} className={styles.profileCard}>
      <div className={styles.profileIdentity}><span aria-hidden="true">V</span><div><strong>{p.name}</strong>{p.cuisineType ? <p>{p.cuisineType}</p> : null}</div></div>
      <dl className={styles.profileList}>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    </AdminPanel>
  );
}
