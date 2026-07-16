import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';
import { missingReasonMeta } from '../../utils/dataSource';
import type { MissingReason } from '../../types';

interface Props {
  reason: MissingReason | string;
  /**
   * full    — icon + visible state text ("Not tracked" / "Not set" / …).
   * compact — glyph only ("—", or "?" for load failures) with the state text
   *           kept accessible (sr-only + title), for dense value cells.
   */
  variant?: 'full' | 'compact';
  className?: string;
}

// The five absence states are distinct claims (see utils/dataSource.ts) —
// this component keeps them distinct: no generic dash where it matters.
export function MissingValue({ reason, variant = 'full', className }: Props) {
  const { t } = useTranslation();
  const meta = missingReasonMeta(reason);
  const label = t(meta.labelKey, meta.fallbackLabel);

  if (variant === 'compact') {
    return (
      <span className={clsx('text-gray-400 dark:text-gray-500', className)} title={label}>
        <span aria-hidden="true">{meta.glyph}</span>
        <span className="sr-only">{label}</span>
      </span>
    );
  }

  const Icon = meta.icon;
  return (
    <span
      className={clsx('inline-flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500', className)}
      title={label}
    >
      <Icon size={12} aria-hidden="true" />
      {label}
    </span>
  );
}
