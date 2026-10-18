import type { AdminPanelEvidence } from "@/lib/admin/analyticsPresentation";
import { AdminDishThumbnail } from "../AdminDishThumbnail";
import { AdminEvidenceState } from "../system/AdminPrimitives";
import styles from "./AdminOverview.module.css";

type Ranked = { slug: string; count: number };
type Dish = { name: string; image: string | null };

export function AdminTopDishes({
  evidence,
  dishes
}: {
  evidence: AdminPanelEvidence<Ranked[]>;
  dishes: Map<string, Dish>;
}) {
  if (evidence.kind !== "supported") {
    return <AdminEvidenceState kind={evidence.kind} reason={evidence.reason} />;
  }
  const max = Math.max(...evidence.data.map((item) => item.count), 1);
  return (
    <ol className={styles.ranking} data-overview-ranking>
      {evidence.data.slice(0, 5).map((item, index) => {
        const dish = dishes.get(item.slug);
        const name = dish?.name ?? "Plat du menu";
        return (
          <li key={item.slug}>
            <span className={styles.rank}>{index + 1}</span>
            <span className={styles.rankPhoto}>
              <AdminDishThumbnail
                name={name}
                imageUrl={dish?.image}
                compact
                sizes="56px"
              />
            </span>
            <div>
              <strong title={name}>{name}</strong>
              <span>
                {item.count} consultation{item.count > 1 ? "s" : ""}
              </span>
              <i
                data-chart-animated="rank-bar"
                style={{
                  "--value": `${(item.count / max) * 100}%`
                } as React.CSSProperties}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
