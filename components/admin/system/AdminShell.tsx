import type { ReactNode } from "react";
import { AdminMenuActions } from "../AdminMenuActions";
import { AdminNav } from "./AdminNav";
import { AdminTabs } from "./AdminPrimitives";
import styles from "./AdminSystem.module.css";
type ActiveRoute="overview"|"availability"|"insights";
export function AdminShell({restaurantName,menuPath,active,headerDetails,headerStatus,children}:{restaurantName:string;menuPath:string;active:ActiveRoute;headerDetails?:ReactNode;headerStatus?:ReactNode;children:ReactNode}) {
  const insights = active === "insights";
  return <div className={`${styles.dashboard} ${insights?styles.insightsDashboard:active==="overview"?styles.overviewDashboard:active==="availability"?styles.availabilityDashboard:""}`}>
    <header className={styles.header} {...(insights?{"data-insights-header":true}:{})}>
      <div className={styles.headerIdentity}><p className={styles.brand}>Dashboard restaurant</p><h1>{restaurantName}</h1><div className={styles.headerLower}><p className={styles.subtitle} data-admin-subtitle>{insights?"Analyses détaillées et insights avancés sur l’activité de votre menu":"Insights en temps réel sur l’activité de votre menu"}</p>{headerDetails}</div></div>
      {insights ? <AdminTabs active={active} className={styles.insightsTabs}/> : null}
      <div className={styles.headerControls}><AdminMenuActions menuPath={menuPath}/>{headerStatus}</div>
    </header>
    {!insights ? <AdminTabs active={active}/> : null}
    <main className={styles.main}>{children}</main>
    <AdminNav active={active}/>
  </div>;
}
