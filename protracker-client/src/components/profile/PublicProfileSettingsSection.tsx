import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Globe, Lock, Copy, Check, ExternalLink } from 'lucide-react';
import { clsx } from 'clsx';
import { usePublicProfileSettings, useUpdatePublicProfile } from '../../hooks/usePublicProfile';
import { useToast } from '../../context/ToastContext';
import type { PublicProfileSettings } from '../../types';

type ShowKey = 'showAssessments' | 'showGoals' | 'showJournal' | 'showMatchHistory';

const TOGGLES: { key: ShowKey; label: string; hint: string }[] = [
  { key: 'showAssessments', label: 'Assessment scores', hint: 'Skills radar + latest average' },
  { key: 'showGoals', label: 'Goals', hint: 'Non-private goals only' },
  { key: 'showJournal', label: 'Journal entries', hint: 'Non-private entries only' },
  { key: 'showMatchHistory', label: 'Match history', hint: 'Recent results & ratings' },
];

export function PublicProfileSettingsSection() {
  const { data: settings, isLoading } = usePublicProfileSettings();
  const update = useUpdatePublicProfile();
  const { addToast } = useToast();
  const [copied, setCopied] = useState(false);

  if (isLoading || !settings) {
    return (
      <div className="bg-white/5 dark:bg-white/5 rounded-2xl border border-white/10 p-6">
        <div className="h-5 w-40 rounded skeleton" />
      </div>
    );
  }

  const publicUrl = `${window.location.origin}/player/${settings.slug}`;

  function patch(partial: Partial<PublicProfileSettings>) {
    if (!settings) return;
    const next = { ...settings, ...partial };
    update.mutate({
      displayName: next.displayName,
      bio: next.bio,
      isPublic: next.isPublic,
      showAssessments: next.showAssessments,
      showGoals: next.showGoals,
      showJournal: next.showJournal,
      showMatchHistory: next.showMatchHistory,
    });
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      addToast('Link copied', 'success');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      addToast('Could not copy link', 'error');
    }
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Globe size={17} className="text-indigo-500" /> Public Profile
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Share a public page of your progress with anyone — no account needed to view it.
          </p>
        </div>
        {/* Public toggle */}
        <button
          type="button"
          role="switch"
          aria-checked={settings.isPublic}
          onClick={() => patch({ isPublic: !settings.isPublic })}
          className={clsx('relative flex-shrink-0 w-12 h-7 rounded-full transition-colors cursor-pointer',
            settings.isPublic ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600')}
        >
          <span className={clsx('absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-transform', settings.isPublic && 'translate-x-5')} />
        </button>
      </div>

      {!settings.isPublic ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/40 rounded-lg px-3 py-2.5">
          <Lock size={15} /> Your profile is private. Turn it on to get a shareable link.
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          {/* URL + QR */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 min-w-0">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Public link</label>
              <div className="mt-1 flex gap-2">
                <input
                  readOnly
                  value={publicUrl}
                  onFocus={(e) => e.target.select()}
                  className="flex-1 min-w-0 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-3 py-2 text-sm text-gray-700 dark:text-gray-200"
                />
                <button onClick={copyLink} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium cursor-pointer flex-shrink-0">
                  {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <a
                href={publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 text-sm text-indigo-500 hover:underline"
              >
                <ExternalLink size={14} /> Preview my public page
              </a>
            </div>
            <div className="flex-shrink-0 bg-white p-2.5 rounded-xl border border-gray-200 self-start">
              <QRCodeSVG value={publicUrl} size={104} level="M" marginSize={0} />
            </div>
          </div>

          {/* What to show */}
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">What to show</label>
            <div className="mt-2 grid sm:grid-cols-2 gap-2">
              {TOGGLES.map(({ key, label, hint }) => (
                <label key={key} className="flex items-start gap-2.5 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700">
                  <input
                    type="checkbox"
                    checked={settings[key]}
                    onChange={(e) => patch({ [key]: e.target.checked } as Partial<PublicProfileSettings>)}
                    className="mt-0.5 w-4 h-4 rounded accent-indigo-600 cursor-pointer"
                  />
                  <span>
                    <span className="block text-sm font-medium text-gray-800 dark:text-gray-200">{label}</span>
                    <span className="block text-xs text-gray-400 dark:text-gray-500">{hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
