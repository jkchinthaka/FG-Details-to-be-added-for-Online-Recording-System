/**
 * Escape a cell for CSV / spreadsheet-compatible export.
 * Prefixes values that begin with =, +, -, or @ so spreadsheet apps
 * do not treat them as formulas (CSV injection).
 */
export function escapeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return '""';
  }
  let text = String(value);
  if (/^[=+\-@]/.test(text)) {
    text = `'${text}`;
  }
  text = text.replace(/"/g, '""');
  return `"${text}"`;
}

export function toCsvRow(cells: Array<string | number | null | undefined>): string {
  return cells.map(escapeCsvCell).join(",");
}

export function toCsvDocument(
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>,
): string {
  return [toCsvRow(headers), ...rows.map((row) => toCsvRow(row))].join("\r\n");
}
