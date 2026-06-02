import Link from "next/link";
import styles from "@/components/owner/OwnerCockpit.module.css";
import { Owner3dCdnWorkflowPanel } from "@/components/owner/Owner3dCdnWorkflowPanel";
import { Owner3dJobsPanel } from "@/components/owner/Owner3dJobsPanel";
import { Owner3dLifecyclePanel } from "@/components/owner/Owner3dLifecyclePanel";
import { Owner3dOptimizeGlbWorkflowPanel } from "@/components/owner/Owner3dOptimizeGlbWorkflowPanel";
import { Owner3dSourceUploadPanel } from "@/components/owner/Owner3dSourceUploadPanel";
import { Badge, EmptyState, Panel } from "@/components/owner/OwnerUi";
import {
  owner3dPipelineSourceLabel,
  type Owner3dPipelineAsset,
  type Owner3dPipelineOverview
} from "@/lib/owner/threeDArPipeline";

type Owner3dArPipelineProps = {
  overview: Owner3dPipelineOverview;
  selectedAsset?: Owner3dPipelineAsset | null;
  versions?: Owner3dPipelineAsset[];
};

export function Owner3dArPipelineCenter({
  overview,
  selectedAsset,
  versions = []
}: Owner3dArPipelineProps) {
  const detailAsset = selectedAsset ?? overview.assets[0] ?? null;
  const initialUploadIdentity = detailAsset
    ? {
        restaurantSlug: detailAsset.restaurantSlug,
        menuSlug: detailAsset.menuSlug,
        dishSlug: detailAsset.dishSlug,
        version: detailAsset.version
      }
    : null;

  return (
    <>
      <section className={styles.pipelineOverviewGrid} aria-label="3D/AR pipeline status">
        {overview.cards.map((card) => (
          <article
            key={card.id}
            className={`${styles.pipelineOverviewCard} ${
              card.id === "needs_review" ? styles.pipelineOverviewCardPrimary : ""
            }`}
          >
            <span className={styles.statTileLabel}>{card.label}</span>
            <strong className={styles.pipelineOverviewValue}>{card.value}</strong>
          </article>
        ))}
      </section>

      <Owner3dSourceUploadPanel initialIdentity={initialUploadIdentity} />

      <Owner3dOptimizeGlbWorkflowPanel identity={initialUploadIdentity} />

      <Owner3dJobsPanel />

      <Panel
        title="Pipeline jobs / assets"
        action={<span className={styles.sourceTag}>{overview.note}</span>}
      >
        {overview.assets.length === 0 ? (
          <EmptyState>
            Aucun asset 3D/AR détecté. Commencez par une source validée hors Git.
          </EmptyState>
        ) : (
          <Owner3dArAssetWorklist assets={overview.assets} />
        )}
      </Panel>

      {detailAsset ? (
        <Owner3dArAssetDetail asset={detailAsset} versions={versions} />
      ) : null}
    </>
  );
}

export function Owner3dArAssetWorklist({
  assets
}: {
  assets: Owner3dPipelineAsset[];
}) {
  return (
    <>
      <div className={`${styles.tableWrap} ${styles.showDesktop}`}>
        <table className={styles.dataTable}>
          <thead>
            <tr>
              <th>Restaurant</th>
              <th>Menu</th>
              <th>Dish</th>
              <th>Version</th>
              <th>Status</th>
              <th>Selected candidate</th>
              <th>Last run</th>
              <th>Next action</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((asset) => (
              <tr key={asset.id}>
                <td>
                  <div className={styles.cellMain}>{asset.restaurantName}</div>
                  <div className={styles.cellSub}>{asset.restaurantSlug}</div>
                </td>
                <td>
                  <div className={styles.cellMain}>{asset.menuName}</div>
                  <div className={styles.cellSub}>{asset.menuSlug}</div>
                </td>
                <td>
                  <Link className={styles.inlineLink} href={asset.versionHref} prefetch={false}>
                    {asset.dishName}
                  </Link>
                  <div className={styles.cellSub}>{asset.dishSlug}</div>
                </td>
                <td>{asset.version}</td>
                <td>
                  <Badge tone={asset.statusTone}>{asset.statusLabel}</Badge>
                </td>
                <td>{asset.selectedCandidate}</td>
                <td className={styles.cellSub}>{asset.lastRun}</td>
                <td>
                  <span className={styles.pipelineNextAction}>{asset.nextAction}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={`${styles.pipelineMobileList} ${styles.showMobile}`}>
        {assets.map((asset) => (
          <article key={asset.id} className={styles.moduleCard}>
            <div className={styles.pipelineCardHeader}>
              <div>
                <p className={styles.moduleCardTitle}>{asset.dishName}</p>
                <span className={styles.moduleCardMeta}>
                  {asset.restaurantName} · {asset.menuSlug} · {asset.version}
                </span>
              </div>
              <Badge tone={asset.statusTone}>{asset.statusLabel}</Badge>
            </div>
            <p className={styles.cellSub}>Candidate : {asset.selectedCandidate}</p>
            <Link className={styles.btn} href={asset.versionHref} prefetch={false}>
              Ouvrir le détail
            </Link>
          </article>
        ))}
      </div>
    </>
  );
}

export function Owner3dArAssetDetail({
  asset,
  versions = []
}: {
  asset: Owner3dPipelineAsset;
  versions?: Owner3dPipelineAsset[];
}) {
  return (
    <Panel
      title={`Asset detail · ${asset.dishName}`}
      action={
        <div className={styles.pillRow}>
          <Badge tone={asset.statusTone}>{asset.statusLabel}</Badge>
          <span className={styles.sourceTag}>{owner3dPipelineSourceLabel(asset.source)}</span>
        </div>
      }
    >
      <div className={styles.pipelineDetailHeader}>
        <div>
          <p className={styles.moduleCardTitle}>{asset.restaurantName}</p>
          <p className={styles.cellSub}>
            {asset.restaurantSlug} / {asset.menuSlug} / {asset.dishSlug} / {asset.version}
          </p>
        </div>
        <div className={styles.pipelineRouteLinks}>
          <Link className={styles.btn} href={asset.reviewHref} prefetch={false}>
            Review visual
          </Link>
          <Link className={styles.btn} href={asset.detailHref} prefetch={false}>
            Dish route
          </Link>
          <Link className={styles.btnPrimary + " " + styles.btn} href={asset.versionHref} prefetch={false}>
            Version route
          </Link>
        </div>
      </div>

      {versions.length > 1 ? (
        <div className={styles.pipelineVersionStrip} aria-label="Versions disponibles">
          {versions.map((version) => (
            <Link
              key={version.id}
              className={`${styles.badge} ${
                version.version === asset.version ? styles.badgeReady : ""
              }`}
              href={version.versionHref}
              prefetch={false}
            >
              {version.version}
            </Link>
          ))}
        </div>
      ) : null}

      <div className={styles.pipelineDetailGrid}>
        {asset.sections.map((section) => (
          <section key={section.title} className={styles.pipelineDetailSection}>
            <div className={styles.pipelineSectionTitleRow}>
              <h4 className={styles.drawerSectionTitle}>{section.title}</h4>
              <Badge tone={section.tone}>{section.status}</Badge>
            </div>
            <dl className={styles.pipelineDefinitionList}>
              {section.rows.map((row) => (
                <div key={`${section.title}-${row.label}`}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                  {row.detail ? <p>{row.detail}</p> : null}
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      <Owner3dCdnWorkflowPanel cdn={asset.cdn} />

      <Owner3dLifecyclePanel asset={asset} versions={versions} />

      <section className={styles.pipelineActionsPanel} aria-label="Actions 3D/AR">
        <div className={styles.pipelineSectionTitleRow}>
          <h4 className={styles.drawerSectionTitle}>Actions visibles mais safe</h4>
          <span className={styles.sourceTag}>Aucune commande n&apos;est exécutée par ce dashboard.</span>
        </div>
        <div className={styles.pipelineActionGrid}>
          {asset.actions.map((action) => (
            <details key={action.id} className={styles.pipelineActionItem}>
              <summary>
                <span className={styles.pipelineActionSummary}>
                  <span>{action.label}</span>
                  <small>
                    {action.destructive ? "Commande terminal · confirmation" : "Commande terminal"}
                  </small>
                </span>
              </summary>
              <p className={styles.cellSub}>{action.disabledReason}</p>
              {action.confirmationCopy ? (
                <p className={styles.qrWarning}>{action.confirmationCopy}</p>
              ) : null}
              <code className={styles.pipelineCommand}>{action.command}</code>
            </details>
          ))}
        </div>
      </section>
    </Panel>
  );
}
