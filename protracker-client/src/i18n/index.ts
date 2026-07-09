import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import resourcesToBackend from 'i18next-resources-to-backend';
import { LANGUAGES, applyLanguageToDocument } from './languages';

const STORAGE_KEY = 'protracker_lang';
const supported = LANGUAGES.map(l => l.code);

i18n
  // Lazy-load each locale as its own chunk (only the active language is fetched).
  .use(resourcesToBackend((language: string) => import(`./locales/${language}.json`)))
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    supportedLngs: supported,
    nonExplicitSupportedLngs: true, // treat "en-US" as "en"
    load: 'languageOnly',
    interpolation: { escapeValue: false }, // React already escapes
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: STORAGE_KEY,
      caches: ['localStorage'],
    },
    react: { useSuspense: false }, // avoid Suspense flashes; keys render until loaded
  });

// Keep <html> dir/lang/font in sync with the active language.
applyLanguageToDocument(i18n.language || 'en');
i18n.on('languageChanged', (lng) => applyLanguageToDocument(lng));

export default i18n;
