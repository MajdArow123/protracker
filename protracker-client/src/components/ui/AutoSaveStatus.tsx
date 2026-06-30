import { Check, Loader2, AlertCircle } from 'lucide-react';
import type { AutoSaveStatus as Status } from '../../hooks/useAutoSave';

export function AutoSaveStatus({ status }: { status: Status }) {
  if (status === 'idle') return null;

  return (
    <span className="flex items-center gap-1.5 text-xs">
      {status === 'saving' && (
        <><Loader2 size={12} className="animate-spin text-indigo-400" /><span className="text-gray-400">Saving…</span></>
      )}
      {status === 'saved' && (
        <><Check size={12} className="text-green-500" /><span className="text-green-500">Saved</span></>
      )}
      {status === 'error' && (
        <><AlertCircle size={12} className="text-red-400" /><span className="text-red-400">Error saving</span></>
      )}
    </span>
  );
}
