import { useTranslation } from 'react-i18next';
import { isRtl } from '../i18n/languages';

/**
 * True when the active language is right-to-left (Arabic / Hebrew).
 * Re-renders on language change (useTranslation subscribes to languageChanged),
 * so JS-driven layout (framer-motion offsets, conditional sides) stays in sync.
 */
export function useIsRtl(): boolean {
  const { i18n } = useTranslation();
  return isRtl(i18n.language || 'en');
}
