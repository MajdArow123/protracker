import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { Globe, Check } from 'lucide-react';
import { LANGUAGES, languageDef } from '../../i18n/languages';

// Globe dropdown to switch language. Works before login (landing/login) and inside the app.
// `variant="dark"` styles it for dark surfaces (landing/public pages).
export function LanguageSwitcher({ variant = 'app' }: { variant?: 'app' | 'dark' }) {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = languageDef(i18n.language || 'en');

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const pick = (code: string) => {
    // Persist + apply immediately; i18next's languageChanged handler flips dir/lang/font.
    i18n.changeLanguage(code);
    setOpen(false);
  };

  const dark = variant === 'dark';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Change language"
        className={clsx(
          'flex items-center gap-1.5 rounded-xl transition-colors cursor-pointer',
          dark
            ? 'px-2.5 py-2 text-gray-300 hover:text-white hover:bg-white/10'
            : 'px-2.5 py-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
        )}
      >
        <Globe size={18} />
        <span className="text-xs font-bold tracking-wide">{current.short}</span>
      </button>

      {open && (
        <div className={clsx(
          'absolute end-0 mt-2 w-44 rounded-xl border shadow-xl z-50 overflow-hidden',
          dark ? 'bg-gray-900 border-gray-700' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700'
        )}>
          {LANGUAGES.map(l => {
            const active = current.code === l.code;
            return (
              <button
                key={l.code}
                onClick={() => pick(l.code)}
                // Uniform, start-aligned rows showing the short code; the native
                // name stays available to assistive tech.
                aria-label={l.label}
                className={clsx(
                  'w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm transition-colors cursor-pointer',
                  active
                    ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-semibold'
                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
                )}
              >
                <span className="flex-1 text-start font-semibold tracking-wide">{l.short}</span>
                {active && <Check size={15} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
