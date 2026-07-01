export type HeightUnit = 'cm' | 'ftin';
export type WeightUnit = 'kg' | 'lb';

const HEIGHT_UNIT_KEY = 'protracker_height_unit';
const WEIGHT_UNIT_KEY = 'protracker_weight_unit';

export function getStoredHeightUnit(): HeightUnit {
  return (localStorage.getItem(HEIGHT_UNIT_KEY) as HeightUnit) || 'cm';
}

export function getStoredWeightUnit(): WeightUnit {
  return (localStorage.getItem(WEIGHT_UNIT_KEY) as WeightUnit) || 'kg';
}

export function setStoredHeightUnit(unit: HeightUnit) {
  localStorage.setItem(HEIGHT_UNIT_KEY, unit);
}

export function setStoredWeightUnit(unit: WeightUnit) {
  localStorage.setItem(WEIGHT_UNIT_KEY, unit);
}

export function cmToFtIn(cm: string | number): { ft: string; inches: string } {
  const val = typeof cm === 'number' ? cm : parseFloat(cm);
  if (isNaN(val)) return { ft: '', inches: '' };
  const totalIn = val / 2.54;
  const ft = Math.floor(totalIn / 12);
  const inches = Math.round(totalIn % 12);
  return { ft: String(ft), inches: String(inches) };
}

export function ftInToCm(ft: string, inches: string): string {
  const f = parseFloat(ft) || 0;
  const i = parseFloat(inches) || 0;
  const cm = (f * 12 + i) * 2.54;
  return cm > 0 ? String(Math.round(cm)) : '';
}

export function kgToLb(kg: string | number): string {
  const val = typeof kg === 'number' ? kg : parseFloat(kg);
  if (isNaN(val)) return '';
  return String(Math.round(val * 2.205));
}

export function lbToKg(lb: string | number): string {
  const val = typeof lb === 'number' ? lb : parseFloat(lb);
  if (isNaN(val)) return '';
  return String(Math.round(val / 2.205));
}

/** Formats a height in cm according to the given unit, e.g. "180 cm" or `5'11"`. */
export function formatHeight(cm: number | null | undefined, unit: HeightUnit): string | null {
  if (cm == null) return null;
  if (unit === 'cm') return `${cm} cm`;
  const { ft, inches } = cmToFtIn(cm);
  return `${ft}'${inches}"`;
}

/** Formats a weight in kg according to the given unit, e.g. "80 kg" or "176 lb". */
export function formatWeight(kg: number | null | undefined, unit: WeightUnit): string | null {
  if (kg == null) return null;
  if (unit === 'kg') return `${kg} kg`;
  return `${kgToLb(kg)} lb`;
}
