import Image from "next/image";
import type { AdminPanelEvidence } from "@/lib/admin/analyticsPresentation";
import { AdminEvidenceState } from "../system/AdminPrimitives";
import styles from "./AdminOverview.module.css";
type Ranked={slug:string;count:number};type Dish={name:string;image:string|null};
export function AdminTopDishes({evidence,dishes}:{evidence:AdminPanelEvidence<Ranked[]>;dishes:Map<string,Dish>}){if(evidence.kind!=="supported")return <AdminEvidenceState kind={evidence.kind} reason={evidence.reason}/>;const max=Math.max(...evidence.data.map(x=>x.count),1);return <ol className={styles.ranking}>{evidence.data.map((item,index)=>{const dish=dishes.get(item.slug);return <li key={item.slug}><span className={styles.rank}>{index+1}</span><span className={styles.rankPhoto}>{dish?.image?<Image alt={`Présentation de ${dish.name}`} src={dish.image} fill sizes="56px"/>:null}</span><div><strong title={dish?.name??item.slug}>{dish?.name??item.slug}</strong><span>{item.count} consultation{item.count>1?"s":""}</span><i style={{"--value":`${item.count/max*100}%`} as React.CSSProperties}/></div></li>})}</ol>}
