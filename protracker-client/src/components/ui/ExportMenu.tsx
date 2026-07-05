import { useEffect, useRef, useState } from 'react';
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

export function ExportMenu({ options, label = 'Export Data', className, variant = 'default', onError }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  async function handle(idx: number) {
    if (busy != null) return;
    setBusy(idx);
    try {
      await options[idx].run();
      setDone(idx);
      setTimeout(() => setDone(null), 1200);
    } catch (e) {
      onError?.(e instanceof Error ? e.message : 'Export failed.');
    } finally {
      setBusy(null);
      setOpen(false);
    }
  }

  const trigger = variant === 'hero'
    ? 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700';

  return (
    <div ref={ref} className={clsx('relative', className)}>
      <button
        onClick={() => setOpen(o => !o)}
        className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all cursor-pointer', trigger)}
      >
        {busy != null ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
        {label}
        <ChevronDown size={13} className={clsx('transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 z-30 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl overflow-hidden">
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
        </div>
      )}
    </div>
  );
}
