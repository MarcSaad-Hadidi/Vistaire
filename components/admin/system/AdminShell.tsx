import type { ReactNode } from "react";
import { AdminMenuActions } from "../AdminMenuActions";
import { AdminNav } from "./AdminNav";
import { AdminTabs } from "./AdminPrimitives";
import styles from "./AdminSystem.module.css";
type ActiveRoute="overview"|"availability"|"insights";
export function AdminShell({restaurantName,menuPath,active,headerDetails,headerStatus,children}:{restaurantName:string;menuPath:string;active:ActiveRoute;headerDetails?:ReactNode;headerStatus?:ReactNode;children:ReactNode}){return <div className={`${styles.dashboard} ${active==="insights"?styles.insightsDashboard:active==="overview"?styles.overviewDashboard:active==="availability"?styles.availabilityDashboard:""}`}><header className={styles.header} {...(active==="insights"?{"data-insights-header":true}:{})}><div className={styles.headerIdentity}><p className={styles.brand}>Dashboard restaurant</p><h1>{restaurantName}</h1><div className={styles.headerLower}><p className={styles.subtitle} data-admin-subtitle>{active==="insights"?"Analyses détaillées et insights avancés sur l’activité de votre menu":"Insights en temps réel sur l’activité de votre menu"}</p>{headerDetails}</div></div><div className={styles.headerControls}><AdminMenuActions menuPath={menuPath}/>{headerStatus}</div></header><AdminTabs active={active}/><main className={styles.main}>{children}</main><AdminNav active={active}/></div>}
