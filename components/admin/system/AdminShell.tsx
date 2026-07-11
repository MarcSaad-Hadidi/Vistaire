import type { ReactNode } from "react";
import { AdminMenuActions } from "../AdminMenuActions";
import { AdminNav } from "./AdminNav";
import { AdminTabs } from "./AdminPrimitives";
import styles from "./AdminSystem.module.css";
type ActiveRoute="overview"|"availability"|"insights";
export function AdminShell({restaurantName,menuPath,active,children}:{restaurantName:string;menuPath:string;active:ActiveRoute;children:ReactNode}){return <div className={`${styles.dashboard} ${active==="insights"?styles.insightsDashboard:""}`}><header className={styles.header}><div><p className={styles.brand}>Dashboard restaurant</p><h1>{restaurantName}</h1><p className={styles.subtitle}>{active==="insights"?"Analyses détaillées et insights avancés sur l’activité de votre menu":"Insights en temps réel sur l’activité de votre menu"}</p></div><AdminMenuActions menuPath={menuPath}/></header>{active!=="insights"?<AdminTabs active={active}/>:null}<main className={styles.main}>{children}</main><AdminNav active={active}/></div>}
