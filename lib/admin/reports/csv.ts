import type { AdminReportModel } from "./contracts.ts";

export type AdminEvidenceProjection = Readonly<{
  records: Readonly<Record<string, Readonly<{ evidenceId: string }>>>;
}>;

const DANGEROUS_CSV_PREFIX = /^[=+\-@\t\r]/;

export function sanitizeCsvCell(value: string): string {
  return DANGEROUS_CSV_PREFIX.test(value) ? `'${value}` : value;
}

function csvCell(value: string): string {
  const normalized = sanitizeCsvCell(value).replace(/\r\n|\r|\n/g, " ");
  return `"${normalized.replaceAll('"', '""')}"`;
}

function assertAuthorized(evidence: AdminEvidenceProjection, evidenceIds: readonly string[]): void {
  for (const evidenceId of evidenceIds) {
    const record = evidence.records[evidenceId];
    if (!record) {
      throw new Error("Unknown or unauthorized export evidence.");
    }
  }
}

export function serializeAdminReportCsv(input: {
  locale: "fr" | "en";
  report: AdminReportModel;
  evidence: AdminEvidenceProjection;
}): Uint8Array {
  const fr = input.locale === "fr";
  const rows: string[][] = [[
    fr ? "Section" : "Section",
    fr ? "Indicateur" : "Metric",
    fr ? "Valeur" : "Value",
    fr ? "Comparaison" : "Comparison",
    fr ? "Ã‰tat" : "State",
    fr ? "Identifiants de preuve" : "Evidence identifiers"
  ]];

  for (const metric of input.report.metrics) {
    const evidenceIds = [...new Set([...metric.current.evidenceIds, ...metric.comparison.evidenceIds])];
    assertAuthorized(input.evidence, evidenceIds);
    const current = metric.current.value?.count;
    const comparison = metric.comparison.value;
    rows.push([
      fr ? "Performance" : "Performance",
      metric.label,
      current === null || current === undefined ? "" : String(current),
      comparison ? JSON.stringify({ delta: comparison.delta, changeRate: comparison.changeRate }) : "",
      metric.current.state.kind,
      evidenceIds.join("|")
    ]);
  }

  if (input.report.searches.value) {
    assertAuthorized(input.evidence, input.report.searches.evidenceIds);
    for (const search of input.report.searches.value) {
      rows.push([
        fr ? "Recherches protÃ©gÃ©es" : "Privacy-protected searches",
        search.term,
        String(search.count),
        "",
        input.report.searches.state.kind,
        input.report.searches.evidenceIds.join("|")
      ]);
    }
  }

  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(";")).join("\r\n")}\r\n`;
  return new TextEncoder().encode(csv);
}
