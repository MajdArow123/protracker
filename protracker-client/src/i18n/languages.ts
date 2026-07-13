// Supported languages. English is the default + fallback. Arabic & Hebrew are RTL.
// Deliberately flag-free: flags denote countries, not languages (🇸🇦 for every Arabic
// speaker / 🇬🇧 vs 🇺🇸 are the classic misfires) — the switcher shows `short` codes.
export interface LanguageDef {
  code: string;
  label: string;   // native name (kept as the accessible label)
  short: string;   // abbreviated code shown in the switcher (EN/AR/…)
  dir: 'ltr' | 'rtl';
  font?: string;   // optional CSS font-family applied when active
}

export const LANGUAGES: LanguageDef[] = [
  { code: 'en', label: 'English', short: 'EN', dir: 'ltr' },
  { code: 'ar', label: 'العربية', short: 'AR', dir: 'rtl', font: "'Noto Sans Arabic', sans-serif" },
  { code: 'he', label: 'עברית', short: 'HE', dir: 'rtl', font: "'Noto Sans Hebrew', sans-serif" },
  { code: 'fr', label: 'Français', short: 'FR', dir: 'ltr' },
  { code: 'es', label: 'Español', short: 'ES', dir: 'ltr' },
];

export const RTL_LANGS = new Set(LANGUAGES.filter(l => l.dir === 'rtl').map(l => l.code));

export function isRtl(code: string): boolean {
  return RTL_LANGS.has(code.split('-')[0]);
}

export function languageDef(code: string): LanguageDef {
  const base = code.split('-')[0];
  return LANGUAGES.find(l => l.code === base) ?? LANGUAGES[0];
}

// Applies dir + lang + rtl class + font to <html>/<body>. Called on init and on change.
export function applyLanguageToDocument(code: string) {
  const def = languageDef(code);
  const html = document.documentElement;
  html.setAttribute('lang', def.code);
  html.setAttribute('dir', def.dir);
  html.classList.toggle('rtl', def.dir === 'rtl');
  // Font family (Arabic/Hebrew scripts). Empty string clears the override.
  document.body.style.fontFamily = def.font ?? '';
}
