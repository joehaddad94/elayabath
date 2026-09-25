/**
 * Plain-text spreadsheets: reading CSV and TSV, and writing CSV.
 *
 * Small enough to own rather than depend on: RFC 4180 quoting (quoted
 * fields, doubled quotes, line breaks inside quotes), a byte-order mark,
 * Windows and Unix line ends, and comma or semicolon as the separator
 * (European Excel writes semicolons).
 */

export function parseDelimited(text: string, delimiter?: string): string[][] {
  const body = text.replace(/^﻿/, "");
  const sep = delimiter ?? guessDelimiter(body);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < body.length; i++) {
    const ch = body[i]!;
    if (quoted) {
      if (ch === '"') {
        if (body[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"' && field === "") {
      quoted = true;
    } else if (ch === sep) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && body[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Blank lines carry nothing.
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** Comma unless the header line has more semicolons (or tabs) than commas. */
function guessDelimiter(text: string): string {
  const firstLine = text.slice(0, text.search(/\r?\n|$/));
  const count = (c: string) => firstLine.split(c).length - 1;
  const candidates = [",", ";", "\t"].map((c) => [c, count(c)] as const);
  return candidates.reduce((best, c) => (c[1] > best[1] ? c : best))[0];
}

/**
 * A cell that a spreadsheet would run as a formula (starting with = + - @,
 * or a tab or carriage return) is written with a leading apostrophe, which
 * spreadsheets show as text. Import strips it again, so a round trip is exact.
 */
const FORMULA_START = /^[=+\-@\t\r]/;

export function protectCell(value: string): string {
  return FORMULA_START.test(value) ? `'${value}` : value;
}

export function unprotectCell(value: string): string {
  return value.startsWith("'") && FORMULA_START.test(value.slice(1)) ? value.slice(1) : value;
}

export function csvLine(cells: string[]): string {
  return (
    cells
      .map((raw) => {
        const cell = protectCell(raw);
        return /[",\r\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
      })
      .join(",") + "\r\n"
  );
}

/** Headers compared loosely: case, spaces, punctuation and "the" ignored. */
export function normaliseHeader(header: string): string {
  return header
    .toLowerCase()
    .replace(/\bthe\b/g, "")
    .replace(/[^a-z0-9]+/g, "");
}
