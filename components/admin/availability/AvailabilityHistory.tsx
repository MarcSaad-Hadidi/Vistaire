import styles from "./AdminAvailability.module.css";
export function AvailabilityHistory({ items = [] }: { items?: readonly { id: string; dishName: string; at: string; status?: string }[] }) {
  return <section className={styles.railCard}><h2>Historique récent</h2>{items.length ? <ol>{items.map((item) => <li key={item.id}><strong>{item.dishName}</strong><span>{item.status ?? "Mise à jour"} · {item.at}</span></li>)}</ol> : <p>Aucun événement auditable n’est disponible.</p>}</section>;
}
