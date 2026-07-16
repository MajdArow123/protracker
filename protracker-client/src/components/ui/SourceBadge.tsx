import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';
import { sourceMeta } from '../../utils/dataSource';
import type { DataSource } from '../../types';

interface Props {
  source: DataSource | string;
  size?: 'xs' | 'sm';
  /** Optional richer hover text (e.g. the calculation method); the visible label stays the source name. */
  title?: string;
  className?: string;
}

// Provenance made visible: icon + text (never color-only), so a coach-entered
// guess or a calculated proxy can't read as a recorded fact. Compact pitch
// markers deliberately do NOT carry this badge — it belongs where mixed
// sources sit side by side (stat panels, the inspector).
export function SourceBadge({ source, size = 'sm', title, className }: Props) {
  const { t } = useTranslation();
  const meta = sourceMeta(source);
  const label = t(meta.labelKey, meta.fallbackLabel);
  const Icon = meta.icon;

  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full font-medium whitespace-nowrap',
        size === 'xs' ? 'gap-1 px-1.5 py-0.5 text-[10px]' : 'gap-1.5 px-2 py-0.5 text-[11px]',
        meta.badgeClass,
        className,
      )}
      title={title ?? label}
    >
      <Icon size={size === 'xs' ? 10 : 12} aria-hidden="true" />
      {label}
    </span>
  );
}
