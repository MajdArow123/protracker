// Phase 10 ruling: "today" sent to the API is the USER'S LOCAL calendar date, built
// from the browser's local calendar fields. NEVER use toISOString() for this — it
// converts to UTC, which shifts every evening user west of UTC onto tomorrow's date
// (the exact bug the ?date= parameter exists to fix).
export function localDateString(d: Date = new Date()): string {
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}
