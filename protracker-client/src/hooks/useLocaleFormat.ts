import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

// Maps our i18next language codes to BCP-47 locales for Intl.* APIs.
const LOCALE_MAP: Record<string, string> = {
  en: 'en-US',
  ar: 'ar',
  he: 'he-IL',
  fr: 'fr-FR',
  es: 'es-ES',
};

function resolveLocale(lng: string): string {
  const base = (lng || 'en').split('-')[0];
  return LOCALE_MAP[base] ?? 'en-US';
}

type DateInput = Date | string | number | null | undefined;

function toDate(value: DateInput): Date | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Locale-aware date/number formatting bound to the active i18next language.
 * Use everywhere dates or numbers are shown so Arabic/Hebrew/French/Spanish
 * render with their own conventions (digits, month names, separators, RTL).
 */
export function useLocaleFormat() {
  const { i18n } = useTranslation();
  const locale = resolveLocale(i18n.language);

  return useMemo(() => {
    const formatDate = (value: DateInput, opts?: Intl.DateTimeFormatOptions) => {
      const d = toDate(value);
      if (!d) return '';
      return new Intl.DateTimeFormat(locale, opts ?? { year: 'numeric', month: 'short', day: 'numeric' }).format(d);
    };

    const formatDateTime = (value: DateInput, opts?: Intl.DateTimeFormatOptions) => {
      const d = toDate(value);
      if (!d) return '';
      return new Intl.DateTimeFormat(
        locale,
        opts ?? { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' },
      ).format(d);
    };

    const formatTime = (value: DateInput, opts?: Intl.DateTimeFormatOptions) => {
      const d = toDate(value);
      if (!d) return '';
      return new Intl.DateTimeFormat(locale, opts ?? { hour: 'numeric', minute: '2-digit' }).format(d);
    };

    const formatNumber = (value: number | null | undefined, opts?: Intl.NumberFormatOptions) => {
      if (value == null || isNaN(value)) return '';
      return new Intl.NumberFormat(locale, opts).format(value);
    };

    const formatPercent = (value: number | null | undefined, fractionDigits = 0) => {
      if (value == null || isNaN(value)) return '';
      return new Intl.NumberFormat(locale, {
        style: 'percent',
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      }).format(value);
    };

    // Relative time ("2 hours ago", "in 3 days") in the active locale.
    const formatRelativeTime = (value: DateInput) => {
      const d = toDate(value);
      if (!d) return '';
      const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
      const diffMs = d.getTime() - Date.now();
      const diffSec = Math.round(diffMs / 1000);
      const abs = Math.abs(diffSec);
      if (abs < 60) return rtf.format(Math.round(diffSec), 'second');
      const diffMin = Math.round(diffSec / 60);
      if (Math.abs(diffMin) < 60) return rtf.format(diffMin, 'minute');
      const diffHr = Math.round(diffMin / 60);
      if (Math.abs(diffHr) < 24) return rtf.format(diffHr, 'hour');
      const diffDay = Math.round(diffHr / 24);
      if (Math.abs(diffDay) < 30) return rtf.format(diffDay, 'day');
      const diffMonth = Math.round(diffDay / 30);
      if (Math.abs(diffMonth) < 12) return rtf.format(diffMonth, 'month');
      return rtf.format(Math.round(diffMonth / 12), 'year');
    };

    return { locale, formatDate, formatDateTime, formatTime, formatNumber, formatPercent, formatRelativeTime };
  }, [locale]);
}
