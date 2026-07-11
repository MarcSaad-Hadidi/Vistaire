import Image from "next/image";
import Link from "next/link";
import type { AdminMenuDish } from "@/lib/admin/menuReadiness";
import { AdminStatusBadge } from "../system/AdminPrimitives";
import styles from "./AdminOverview.module.css";

export function AdminAvailabilityStrip({ dishes }: { dishes: AdminMenuDish[] }) {
  return <div className={styles.dishStrip}>{dishes.slice(0, 5).map((dish) => <article key={dish.id}>{dish.thumbnailUrl || dish.imageUrl ? <Image src={dish.thumbnailUrl ?? dish.imageUrl!} alt="" width={112} height={91} sizes="112px"/> : <div className={styles.photoFallback} aria-hidden="true"/>}<div><strong>{dish.name}</strong><span>{dish.category}</span><AdminStatusBadge tone={dish.available ? "available" : "unavailable"}>{dish.available ? "Disponible" : "Indisponible"}</AdminStatusBadge></div></article>)}<Link className={styles.stripLink} href="/admin/availability">Gérer les disponibilités</Link></div>;
}
