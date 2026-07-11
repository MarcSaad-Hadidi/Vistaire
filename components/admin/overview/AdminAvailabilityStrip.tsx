import Link from "next/link";
import type { AdminMenuDish } from "@/lib/admin/menuReadiness";
import { AdminDishThumbnail } from "../AdminDishThumbnail";
import { AdminStatusBadge } from "../system/AdminPrimitives";
import styles from "./AdminOverview.module.css";
export function AdminAvailabilityStrip({dishes}:{dishes:AdminMenuDish[]}){return <div className={styles.dishStrip}>{dishes.map(dish=><article key={dish.id} data-overview-availability-card><AdminDishThumbnail compact name={dish.name} thumbnailUrl={dish.thumbnailUrl} imageUrl={dish.imageUrl} sizes="64px"/><div><strong>{dish.name}</strong><span>{dish.category}</span><AdminStatusBadge tone={dish.available?"available":"unavailable"}>{dish.available?"Disponible":"Indisponible"}</AdminStatusBadge></div><Link className={styles.miniToggle} href="/admin/availability" aria-label={`Gérer la disponibilité de ${dish.name}`}><i aria-hidden="true"/></Link></article>)}<Link className={styles.stripLink} href="/admin/availability">Gérer les disponibilités</Link></div>}
