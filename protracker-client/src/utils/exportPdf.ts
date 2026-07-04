import type { ReactElement } from 'react';

// Renders a @react-pdf Document element to a Blob and triggers a browser download.
// @react-pdf/renderer is imported dynamically so it only loads when a user exports,
// keeping it out of the report page's initial chunk.
export async function downloadPdf(doc: ReactElement, filename: string) {
  const { pdf } = await import('@react-pdf/renderer');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blob = await pdf(doc as any).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// "Lucas Ward" → "Lucas-Ward-Report-2026-07-05.pdf"
export function reportFilename(name: string): string {
  const safe = name.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '');
  const date = new Date().toISOString().slice(0, 10);
  return `${safe}-Report-${date}.pdf`;
}
