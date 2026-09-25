import "server-only";
import ExcelJS from "exceljs";
import { parseDelimited, unprotectCell } from "./sheets";

/** Rows past this are refused: ten times today's catalogue, with room. */
export const MAX_IMPORT_ROWS = 50_000;

/**
 * A spreadsheet as rows of text, the first row being the headers.
 *
 * Excel: the first worksheet, each cell as the text it shows (a formula's
 * result, a hyperlink's text, rich text flattened, dates as YYYY-MM-DD).
 * CSV and TSV: parsed as plain text. Either way, the apostrophe export adds
 * in front of formula-like cells is taken off again.
 */
export async function readSheet(bytes: ArrayBuffer, fileName: string): Promise<string[][]> {
  const lower = fileName.toLowerCase();
  let rows: string[][];
  if (lower.endsWith(".xlsx")) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new Error("The workbook has no sheets.");
    rows = [];
    sheet.eachRow({ includeEmpty: false }, (row) => {
      const cells: string[] = [];
      for (let c = 1; c <= row.cellCount; c++) cells.push(cellText(row.getCell(c).value));
      rows.push(cells);
    });
  } else if (lower.endsWith(".csv") || lower.endsWith(".tsv") || lower.endsWith(".txt")) {
    const text = new TextDecoder("utf-8").decode(bytes);
    rows = parseDelimited(text, lower.endsWith(".tsv") ? "\t" : undefined);
  } else {
    throw new Error("Use an Excel (.xlsx), CSV or TSV file.");
  }
  return rows.map((r) => r.map((c) => unprotectCell(c).trim())).filter((r) => r.some((c) => c !== ""));
}

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("richText" in value) return value.richText.map((r) => r.text).join("");
    if ("result" in value) return cellText((value.result ?? "") as ExcelJS.CellValue);
    if ("text" in value) return String(value.text);
    if ("error" in value) return "";
    return "";
  }
  return String(value);
}
