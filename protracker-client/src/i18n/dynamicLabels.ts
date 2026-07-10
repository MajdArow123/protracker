import { useTranslation } from 'react-i18next';
import { useMemo } from 'react';

// Normalises an enum-ish value ("Beach Volleyball", "In Progress") into a camelCase
// i18n key segment ("beachVolleyball", "inProgress").
function toKey(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9 ]/g, ' ').trim();
  const parts = cleaned.split(/\s+/);
  if (parts.length === 0) return value;
  return parts
    .map((p, i) => (i === 0 ? p.charAt(0).toLowerCase() + p.slice(1) : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()))
    .join('');
}

const LOCALE_MAP: Record<string, string> = { en: 'en-US', ar: 'ar', he: 'he-IL', fr: 'fr-FR', es: 'es-ES' };

/**
 * Translators for dynamic/enum content (sports, statuses, priorities, categories,
 * day & month names). Falls back to the original English value if a key is missing,
 * so nothing ever renders blank.
 */
export function useDynamicLabels() {
  const { t, i18n } = useTranslation();
  const locale = LOCALE_MAP[(i18n.language || 'en').split('-')[0]] ?? 'en-US';

  return useMemo(() => {
    const tr = (group: string, value?: string | null): string => {
      if (!value) return '';
      return t(`enums.${group}.${toKey(value)}`, value);
    };

    // Localised weekday names (0 = Sunday). "long" | "short" | "narrow".
    const dayNames = (style: 'long' | 'short' | 'narrow' = 'long'): string[] => {
      const fmt = new Intl.DateTimeFormat(locale, { weekday: style });
      // 2024-01-07 is a Sunday.
      return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2024, 0, 7 + i)));
    };

    // Localised month names (0 = January). "long" | "short" | "narrow".
    const monthNames = (style: 'long' | 'short' | 'narrow' = 'long'): string[] => {
      const fmt = new Intl.DateTimeFormat(locale, { month: style });
      return Array.from({ length: 12 }, (_, i) => fmt.format(new Date(2024, i, 1)));
    };

    return {
      sport: (v?: string | null) => tr('sport', v),
      status: (v?: string | null) => tr('status', v),
      priority: (v?: string | null) => tr('priority', v),
      category: (v?: string | null) => tr('category', v),
      difficulty: (v?: string | null) => tr('difficulty', v),
      mood: (v?: string | null) => tr('mood', v),
      sessionType: (v?: string | null) => tr('sessionType', v),
      generic: (group: string, v?: string | null) => tr(group, v),
      dayNames,
      monthNames,
      locale,
    };
  }, [t, locale]);
}
