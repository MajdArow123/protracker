// Tiny dependency-free CSV export. Rows are objects keyed by column header; column order
// follows `headers` (or the first row's keys). Values are escaped per RFC 4180 and the file
// is prefixed with a UTF-8 BOM so Excel opens accented characters correctly.

export type CsvValue = string | number | boolean | null | undefined;
export type CsvRow = Record<string, CsvValue>;

function escapeCell(value: CsvValue): string {
  if (value == null) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toCsv(rows: CsvRow[], headers?: string[]): string {
  const cols = headers ?? (rows.length ? Object.keys(rows[0]) : []);
  const headerLine = cols.map(escapeCell).join(',');
  const body = rows.map(row => cols.map(c => escapeCell(row[c])).join(',')).join('\r\n');
  return body ? `${headerLine}\r\n${body}` : headerLine;
}

// "City FC U18" → "City-FC-U18"; keeps filenames tidy and shell/URL-safe.
export function slugify(name: string): string {
  return name.trim().replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '') || 'export';
}

export function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

// Format an ISO date string as YYYY-MM-DD for spreadsheet friendliness ('' when missing).
export function csvDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Build the CSV and trigger the download in one call.
export function exportCsv(filename: string, rows: CsvRow[], headers?: string[]): void {
  downloadCsv(filename, toCsv(rows, headers));
}
