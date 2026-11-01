import type { CellValue, Worksheet } from "exceljs";
import type { RowInput } from "jspdf-autotable";
import { exportMetadata, safeExportText, type ExportColumn, type ExportDataset, type ExportValue, type StudioExport } from "./studioExport.ts";

// Browser-local serializers: no upload, remote fonts or additional data reads.
function isoDate(value: ExportValue): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(+date) && date.toISOString().slice(0, 10) === value ? date : null;
}

function typed(value: ExportValue, type: ExportColumn["type"]): CellValue {
  if (value == null) return "N/A";
  if (type === "number" || type === "percent") return typeof value === "number" && Number.isFinite(value) ? value : "N/A";
  if (type === "boolean") return typeof value === "boolean" ? value : "N/A";
  if (type === "date") return isoDate(value) ?? "N/A";
  return safeExportText(value);
}

function emptyMessage(dataset: ExportDataset): string {
  return dataset.status === "supported" ? "Aucune ligne" : `N/A : ${dataset.status === "insufficient" ? "preuves insuffisantes" : "données indisponibles"}${dataset.reason ? ` (${dataset.reason})` : ""}`;
}

function validateReport(report: StudioExport) {
  if (!report?.datasets?.length) throw new Error("Aucun jeu de données à exporter.");
  for (const dataset of report.datasets) if (!dataset.columns?.length || !Array.isArray(dataset.rows)) throw new Error("Jeu de données invalide.");
}

function sheetName(title: string, used: Set<string>): string {
  const base = title.replace(/[\\/*?:\[\]]/g, " ").replace(/^'+|'+$/g, "").trim().slice(0, 31) || "Données";
  let result = base;
  let index = 2;
  while (used.has(result.toLowerCase())) { const suffix = ` ${index++}`; result = base.slice(0, 31 - suffix.length) + suffix; }
  used.add(result.toLowerCase());
  return result;
}

function styleSheet(sheet: Worksheet, columns: ExportColumn[]) {
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, sheet.rowCount), column: columns.length } };
  sheet.getRow(1).height = 36;
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF171717" } };
    cell.alignment = { vertical: "middle", wrapText: true };
  });
  columns.forEach((column, index) => {
    const col = sheet.getColumn(index + 1);
    col.width = column.type === "date" ? 16 : column.type === "string" ? Math.min(42, Math.max(22, column.label.length + 2)) : Math.min(26, Math.max(17, column.label.length / 1.5));
    col.numFmt = column.type === "date" ? "yyyy-mm-dd" : column.type === "percent" ? "0.0%" : column.type === "number" ? "#,##0.########" : "General";
  });
  for (let index = 2; index <= sheet.rowCount; index++) {
    const row = sheet.getRow(index);
    let lines = 1;
    row.eachCell((cell) => {
      cell.font = { name: "Calibri", size: 11, color: { argb: "FF171717" } };
      cell.alignment = { vertical: "top", wrapText: true };
      if (index % 2 === 0) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F5F5" } };
      if (typeof cell.value === "string") lines = Math.max(lines, ...cell.value.split("\n").map((line) => Math.ceil(line.length / Math.max(10, (sheet.getColumn(cell.col).width ?? 22) - 2))));
    });
    row.height = Math.min(409, Math.max(22, lines * 15 + 7));
  }
  sheet.pageSetup = { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: "1:1" };
  sheet.headerFooter = { oddFooter: `&L${sheet.name.replaceAll("&", "&&")}&RPage &P / &N` };
}

export async function buildXlsx(report: StudioExport): Promise<Uint8Array> {
  validateReport(report);
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Vistaire";
  workbook.title = report.title;
  const created = new Date(report.generatedAt);
  if (Number.isFinite(+created)) { workbook.created = created; workbook.modified = created; }
  const used = new Set<string>();
  for (const dataset of report.datasets) {
    const sheet = workbook.addWorksheet(sheetName(dataset.title, used));
    sheet.addRow(dataset.columns.map((column) => safeExportText(column.label)));
    for (const row of dataset.rows) sheet.addRow(dataset.columns.map((column) => typed(row[column.key], column.type)));
    if (!dataset.rows.length) sheet.addRow([emptyMessage(dataset)]);
    styleSheet(sheet, dataset.columns);
  }
  const sheet = workbook.addWorksheet(sheetName("Périmètre et méthode", used));
  const columns: ExportColumn[] = [{ key: "field", label: "Champ", type: "string" }, { key: "value", label: "Valeur", type: "string" }];
  sheet.addRow(columns.map((column) => column.label));
  for (const row of exportMetadata(report)) sheet.addRow(row.map((value) => safeExportText(value ?? "N/A")));
  styleSheet(sheet, columns);
  sheet.getColumn(1).width = 32;
  sheet.getColumn(2).width = 110;
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

function printable(value: ExportValue, type: ExportColumn["type"]): string {
  if (value == null) return "N/A";
  if (type === "date") return isoDate(value) ? String(value) : "N/A";
  if (type === "boolean") return value === true ? "Oui" : value === false ? "Non" : "N/A";
  if (type === "number" || type === "percent") return typeof value === "number" && Number.isFinite(value) ? new Intl.NumberFormat("fr-CA", { maximumFractionDigits: type === "percent" ? 1 : 4, ...(type === "percent" ? { style: "percent" } : {}) }).format(value) : "N/A";
  return String(value);
}

export async function buildPdf(report: StudioExport): Promise<Uint8Array> {
  validateReport(report);
  const [{ jsPDF }, { autoTable }, { fontBase64, fontLicense }] = await Promise.all([import("jspdf"), import("jspdf-autotable"), import("./export-fonts/DejaVuSans.ts")]);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true, putOnlyUsedFonts: true });
  doc.addFileToVFS("VistaireExportSans.ttf", fontBase64);
  doc.addFont("VistaireExportSans.ttf", "VistaireExportSans", "normal");
  doc.setFont("VistaireExportSans", "normal");
  doc.setProperties({ title: report.title, author: "Vistaire", subject: `${report.synthetic ? "Données fictives de démonstration" : "Données agrégées du tableau de bord authentifié"}. Police embarquée : ${fontLicense}` });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const margin = 14;
  const header = () => {
    doc.setFont("VistaireExportSans", "normal"); doc.setTextColor(23); doc.setFontSize(9);
    // Keep a long restaurant name inside the page; its complete value is in the metadata.
    doc.text(doc.splitTextToSize(report.title, width - margin * 2)[0], margin, 10);
    doc.setDrawColor(205); doc.line(margin, 13, width - margin, 13);
  };
  header(); doc.setFontSize(19); doc.text("Rapport complet", margin, 26); doc.setFontSize(11); doc.text("Périmètre et méthode", margin, 34);
  autoTable(doc, { startY: 40, margin: { left: margin, right: margin, top: 23, bottom: 17 }, head: [["Champ", "Valeur"]], body: exportMetadata(report).map((row) => row.map((value) => String(value ?? "N/A"))), theme: "plain", styles: { font: "VistaireExportSans", fontStyle: "normal", fontSize: 10, cellPadding: 2.3, textColor: 23, overflow: "linebreak" }, headStyles: { fillColor: 23, textColor: 255, fontStyle: "normal" }, columnStyles: { 0: { cellWidth: 57 } }, alternateRowStyles: { fillColor: 246 }, didDrawPage: header });
  for (const dataset of report.datasets) {
    // Wide datasets retain every field in readable groups with a repeated row identity.
    const groups = dataset.columns.length <= 6 ? [dataset.columns] : Array.from({ length: Math.ceil((dataset.columns.length - 1) / 5) }, (_, index) => [dataset.columns[0], ...dataset.columns.slice(1 + index * 5, 6 + index * 5)]);
    for (const [index, columns] of groups.entries()) {
      doc.addPage();
      const title = `${dataset.title}${groups.length > 1 ? ` (${index + 1}/${groups.length})` : ""}`;
      const body: RowInput[] = dataset.rows.map((row) => columns.map((column) => printable(row[column.key], column.type)));
      if (!body.length) body.push([{ content: emptyMessage(dataset), colSpan: columns.length }]);
      autoTable(doc, { startY: 30, margin: { left: margin, right: margin, top: 27, bottom: 17 }, head: [columns.map((column) => column.label)], body, theme: "plain", showHead: "everyPage", rowPageBreak: "avoid", styles: { font: "VistaireExportSans", fontStyle: "normal", fontSize: 9, cellPadding: 2, textColor: 23, overflow: "linebreak", valign: "top" }, headStyles: { fillColor: 23, textColor: 255, fontStyle: "normal", fontSize: 9 }, alternateRowStyles: { fillColor: 246 }, didDrawPage: () => { header(); doc.setFontSize(12); doc.text(title, margin, 21); } });
    }
  }
  const count = doc.getNumberOfPages();
  for (let page = 1; page <= count; page++) {
    doc.setPage(page); doc.setFont("VistaireExportSans", "normal"); doc.setTextColor(75); doc.setFontSize(9);
    doc.text("Vistaire · N/A = non disponible", margin, height - 8); doc.text(`Page ${page} / ${count}`, width - margin, height - 8, { align: "right" });
  }
  return new Uint8Array(doc.output("arraybuffer"));
}
