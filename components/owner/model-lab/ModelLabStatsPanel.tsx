import styles from "@/components/owner/OwnerCockpit.module.css";
import { Badge, EmptyState } from "@/components/owner/OwnerUi";
import type { ModelLabInspectionReport } from "@/lib/owner/modelLab/inspectGlb";

export function ModelLabStatsPanel({
  title,
  report,
  compareTo
}: {
  title: string;
  report: ModelLabInspectionReport | null;
  compareTo?: ModelLabInspectionReport | null;
}) {
  if (!report) {
    return (
      <section className={styles.moduleCard} aria-label={title}>
        <p className={styles.moduleCardTitle}>{title}</p>
        <EmptyState>Aucun rapport GLB disponible.</EmptyState>
      </section>
    );
  }

  const gain = compareTo
    ? Math.round((1 - report.bytes / Math.max(compareTo.bytes, 1)) * 1000) / 10
    : null;

  return (
    <section className={styles.moduleCard} aria-label={title}>
      <div className={styles.pipelineSectionTitleRow}>
        <p className={styles.moduleCardTitle}>{title}</p>
        {gain !== null ? (
          <Badge tone={gain >= 0 ? "ready" : "warn"}>
            {gain >= 0 ? "-" : "+"}
            {Math.abs(gain)}%
          </Badge>
        ) : null}
      </div>
      <dl className={styles.sourceUploadRecord}>
        <Stat label="Poids" value={formatBytes(report.bytes)} />
        <Stat label="Triangles" value={formatNumber(report.triangles)} />
        <Stat label="Vertices" value={formatNumber(report.vertices)} />
        <Stat label="Meshes" value={formatNumber(report.meshCount)} />
        <Stat label="Primitives" value={formatNumber(report.primitives)} />
        <Stat label="Accessors" value={formatNumber(report.accessors)} />
        <Stat label="Textures" value={formatNumber(report.textures)} />
        <Stat label="Images" value={formatNumber(report.images)} />
        <Stat
          label="Max texture"
          value={report.maxTextureSize ? `${formatNumber(report.maxTextureSize)} px` : "-"}
        />
        <Stat label="Extensions" value={formatNumber(uniqueExtensions(report).length)} />
      </dl>
      <div className={styles.tableWrap}>
        <table className={styles.dataTable}>
          <tbody>
            <Row label="Extensions used" value={report.extensionsUsed.join(", ") || "none"} />
            <Row
              label="Extensions required"
              value={report.extensionsRequired.join(", ") || "none"}
            />
            <Row label="External URIs" value={report.externalUris.join(", ") || "none"} />
            <Row label="Bounds" value={boundsLabel(report)} />
            <Row
              label="SHA-256"
              value={`${report.sha256.slice(0, 10)}...${report.sha256.slice(-10)}`}
            />
          </tbody>
        </table>
      </div>
      {report.warnings.length > 0 ? (
        <ul className={styles.cellSub}>
          {report.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <th>{label}</th>
      <td className={styles.cellSub}>{value}</td>
    </tr>
  );
}

function uniqueExtensions(report: ModelLabInspectionReport): string[] {
  return [...new Set([...report.extensionsUsed, ...report.extensionsRequired])];
}

function boundsLabel(report: ModelLabInspectionReport): string {
  if (!report.bounds) return "not available";
  return report.bounds.size.map((value) => `${value.toFixed(3)}m`).join(" x ");
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("fr-CA").format(value);
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
