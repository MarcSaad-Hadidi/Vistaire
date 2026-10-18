"use client";
import { useState } from "react";
import type { AdminMetricSeries, AdminMetricSeriesId } from "@/lib/admin/analyticsState";
import { InteractiveLineChart } from "../charts/InteractiveLineChart";
import styles from "./AdminOverview.module.css";
const options:[AdminMetricSeriesId,string][]=[["menuOpened","Ouvertures"],["dishOpened","Consultations"],["searches","Recherches"]];
export function AdminMetricLineChart({series,period}:{series:Record<AdminMetricSeriesId,AdminMetricSeries>;period:string}){const [active,setActive]=useState<AdminMetricSeriesId>("menuOpened"),selected=series[active],label=options.find(([id])=>id===active)?.[1]??"Activité";return <><div className={styles.metricSelector} aria-label="Métrique affichée">{options.map(([id,text])=><button type="button" key={id} aria-pressed={active===id} onClick={()=>setActive(id)}>{text}</button>)}</div><InteractiveLineChart data={selected.current.map(point=>({label:point.timestampLabel,value:point.value,series:label}))} title={label} description="Évolution quotidienne de la métrique sélectionnée" period={period} unit="interactions" summary="Valeurs exactes sur la période sélectionnée."/></>}
