import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Download, ChevronDown, Loader2, Check } from 'lucide-react';
import { clsx } from 'clsx';

export interface ExportOption {
  label: string;
  description?: string;
  // May be async (e.g. it fetches data before building the CSV). Errors are surfaced to onError.
  run: () => Promise<void> | void;
}

interface Props {
  options: ExportOption[];
  label?: string;
  className?: string;
  // Match the trigger to its surroundings (default = subtle gray; 'hero' = translucent on a gradient).
  variant?: 'default' | 'hero';
  onError?: (message: string) => void;
}

export function ExportMenu({ options, label, className, variant = 'default', onError }: Props) {
  const { t } = useTranslation();
  const menuLabel = label ?? t('ui.exportData', 'Export Data');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const [pos, setPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // The menu is portaled to <body> (so it escapes any overflow-hidden ancestor like the page hero);
  // position it under the trigger, right-aligned.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 8, right: window.innerWidth - r.right });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !menuRef.current?.contains(t)) setOpen(false);
    };
    const onScrollOrResize = () => setOpen(false);
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [open]);

  async function handle(idx: number) {
    if (busy != null) return;
    setBusy(idx);
    try {
      await options[idx].run();
      setDone(idx);
      setTimeout(() => setDone(null), 1200);
    } catch (e) {
      onError?.(e instanceof Error ? e.message : t('ui.exportFailed', 'Export failed.'));
    } finally {
      setBusy(null);
      setOpen(false);
    }
  }

  const trigger = variant === 'hero'
    ? 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700';

  return (
    <div className={clsx('relative', className)}>
      <button
        ref={triggerRef}
        onClick={() => setOpen(o => !o)}
        className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all cursor-pointer', trigger)}
      >
        {busy != null ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
        {menuLabel}
        <ChevronDown size={13} className={clsx('transition-transform', open && 'rotate-180')} />
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 60 }}
          className="w-64 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl overflow-hidden"
        >
          {options.map((opt, idx) => (
            <button
              key={opt.label}
              onClick={() => handle(idx)}
              disabled={busy != null}
              className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer flex items-center justify-between gap-2 disabled:opacity-60"
            >
              <span>
                <span className="block text-sm font-medium text-gray-900 dark:text-white">{opt.label}</span>
                {opt.description && <span className="block text-xs text-gray-500 dark:text-gray-400">{opt.description}</span>}
              </span>
              {busy === idx ? (
                <Loader2 size={14} className="animate-spin text-indigo-500 flex-shrink-0" />
              ) : done === idx ? (
                <Check size={14} className="text-emerald-500 flex-shrink-0" />
              ) : (
                <Download size={13} className="text-gray-400 flex-shrink-0" />
              )}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}
