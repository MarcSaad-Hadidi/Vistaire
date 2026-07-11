import type { ReactNode } from "react";
import { AdminLogoutButton, AdminNav } from "./AdminNav";
import { AdminTabs } from "./AdminPrimitives";
import styles from "./AdminSystem.module.css";

type ActiveRoute = "overview" | "availability" | "insights";

export function AdminShell({ restaurantName, active, children, actions }: { restaurantName: string; active: ActiveRoute; children: ReactNode; actions?: ReactNode }) {
  return <div className={styles.dashboard}><header className={styles.header}><div><p className={styles.brand}>Dashboard restaurant</p><h1>{restaurantName}</h1><p className={styles.subtitle}>{active === "insights" ? "Analyses détaillées et insights avancés sur l’activité de votre menu" : "Insights en temps réel sur l’activité de votre menu"}</p></div><div className={styles.headerActions}>{actions}<AdminLogoutButton /></div></header>{active !== "insights" ? <AdminTabs active={active} /> : null}<main className={styles.main}>{children}</main><AdminNav active={active} /></div>;
}

