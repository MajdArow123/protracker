import { useRef } from 'react';
import type { ChangeEvent } from 'react';
import { Camera, Shield } from 'lucide-react';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../context/useToast';
import { useUploadTeamPhoto } from '../../hooks/useProfile';

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024;

// Team photo in the team-detail hero. Coaches can click it to upload/replace.
export function TeamPhotoBadge({ teamId, teamName, photoUrl, isCoach }: {
  teamId: number;
  teamName: string;
  photoUrl?: string | null;
  isCoach: boolean;
}) {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const upload = useUploadTeamPhoto(teamId);
  const inputRef = useRef<HTMLInputElement>(null);

  const onInput = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) { addToast(t('teams.photoInvalidType', 'Use a JPEG, PNG, or WebP image'), 'error'); return; }
    if (file.size > MAX_BYTES) { addToast(t('teams.photoTooLarge', 'Image is too large — maximum size is 5MB'), 'error'); return; }
    try {
      await upload.mutateAsync(file);
      addToast(t('teams.photoUpdated', 'Team photo updated'), 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : t('teams.uploadFailed', 'Upload failed'), 'error');
    }
  };

  return (
    <div
      role={isCoach ? 'button' : undefined}
      aria-label={isCoach ? t('teams.changeTeamPhoto', 'Change team photo') : undefined}
      onClick={() => isCoach && inputRef.current?.click()}
      className={clsx(
        'relative w-16 h-16 lg:w-20 lg:h-20 rounded-2xl overflow-hidden flex-shrink-0 border-2 border-white/30 bg-white/10 group',
        isCoach && 'cursor-pointer',
      )}
    >
      {photoUrl ? (
        <img src={photoUrl} alt={teamName} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Shield size={28} className="text-white/60" />
        </div>
      )}
      {isCoach && (
        <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <Camera size={16} className="text-white" />
          <span className="text-[9px] font-semibold text-white mt-0.5">{photoUrl ? t('teams.change', 'Change') : t('teams.addPhoto', 'Add photo')}</span>
        </div>
      )}
      {isCoach && <input ref={inputRef} type="file" accept={ACCEPTED.join(',')} onChange={onInput} className="hidden" />}
    </div>
  );
}
