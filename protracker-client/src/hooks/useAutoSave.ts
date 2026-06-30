import { useEffect, useRef, useState } from 'react';

export type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Debounced auto-save hook for edit forms.
 * enabled  – only active when editing an existing record (never on create forms)
 * values   – form state; effect fires whenever this reference changes
 * saveFn   – async function that persists the current form state (no side effects like closing)
 * delay    – debounce in ms (default 800)
 *
 * Returns { status, flush } where flush() immediately cancels the debounce and saves.
 */
export function useAutoSave(
  enabled: boolean,
  values: unknown,
  saveFn: () => Promise<void>,
  delay = 800
): { status: AutoSaveStatus; flush: () => Promise<void> } {
  const [status, setStatus] = useState<AutoSaveStatus>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveFnRef = useRef(saveFn);
  const skipRef = useRef(true);
  const prevEnabledRef = useRef(enabled);

  useEffect(() => { saveFnRef.current = saveFn; });

  // When enabled transitions false→true (edit form opens), reset skip so the
  // initial form-population setValue doesn't trigger a save.
  useEffect(() => {
    if (enabled && !prevEnabledRef.current) {
      skipRef.current = true;
      setStatus('idle');
    }
    prevEnabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    if (skipRef.current) {
      skipRef.current = false;
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);

    timerRef.current = setTimeout(async () => {
      setStatus('saving');
      try {
        await saveFnRef.current();
        setStatus('saved');
        savedTimerRef.current = setTimeout(() => setStatus('idle'), 2000);
      } catch {
        setStatus('error');
      }
    }, delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [values, enabled, delay]);

  const flush = async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setStatus('saving');
    try {
      await saveFnRef.current();
      setStatus('saved');
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setStatus('idle'), 2000);
    } catch {
      setStatus('error');
    }
  };

  return { status, flush };
}
