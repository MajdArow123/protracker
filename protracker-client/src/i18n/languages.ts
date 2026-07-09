// Supported languages. English is the default + fallback. Arabic & Hebrew are RTL.
export interface LanguageDef {
  code: string;
  label: string;   // native name
  flag: string;    // emoji flag
  dir: 'ltr' | 'rtl';
  font?: string;   // optional CSS font-family applied when active
}

export const LANGUAGES: LanguageDef[] = [
  { code: 'en', label: 'English', flag: '🇬🇧', dir: 'ltr' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦', dir: 'rtl', font: "'Noto Sans Arabic', sans-serif" },
  { code: 'he', label: 'עברית', flag: '🇮🇱', dir: 'rtl', font: "'Noto Sans Hebrew', sans-serif" },
  { code: 'fr', label: 'Français', flag: '🇫🇷', dir: 'ltr' },
  { code: 'es', label: 'Español', flag: '🇪🇸', dir: 'ltr' },
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
