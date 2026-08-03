import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Share2, Check } from 'lucide-react';
import { usePublicProfileSettings } from '../../hooks/usePublicProfile';
import { useToast } from '../../context/useToast';

// Small "Share My Progress" action for the athlete/solo dashboards. Renders nothing unless
// the athlete has made their public profile live.
export function ShareProgressButton({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { data: settings } = usePublicProfileSettings();
  const { addToast } = useToast();
  const [copied, setCopied] = useState(false);

  if (!settings?.isPublic) return null;

  const url = `${window.location.origin}/player/${settings.slug}`;

  async function share() {
    if (navigator.share) {
      try { await navigator.share({ title: t('profile.share.shareTitle', 'My ProTracker progress'), url }); return; } catch { /* cancelled */ }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      addToast(t('profile.share.linkCopied', 'Progress link copied'), 'success');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      addToast(t('profile.share.copyFailed', 'Could not copy link'), 'error');
    }
  }

  return (
    <button
      onClick={share}
      className={className ?? 'flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm font-medium cursor-pointer'}
    >
      {copied ? <Check size={15} /> : <Share2 size={15} />} {t('profile.share.shareMyProgress', 'Share My Progress')}
    </button>
  );
}
