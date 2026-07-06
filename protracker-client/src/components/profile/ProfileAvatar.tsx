import { useRef, useState } from 'react';
import type { DragEvent, ChangeEvent } from 'react';
import { clsx } from 'clsx';
import { Camera, Loader2, Trash2, Upload } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { useToast } from '../../context/ToastContext';
import { useUploadProfilePicture, useRemoveProfilePicture } from '../../hooks/useProfile';

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

// Read-only avatar (photo or initials). Used in the sidebar and anywhere else the
// user's face should appear.
export function AvatarCircle({ name, src, sizeCls = 'w-10 h-10', textCls = 'text-sm' }: {
  name: string;
  src?: string | null;
  sizeCls?: string;
  textCls?: string;
}) {
  if (src) {
    return <img src={src} alt={name} className={clsx(sizeCls, 'rounded-full object-cover flex-shrink-0')} />;
  }
  return (
    <div className={clsx(sizeCls, textCls, 'rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-black flex-shrink-0')}>
      {name ? getInitials(name) : '?'}
    </div>
  );
}

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024;

// The big editable avatar on the profile hero: hover camera overlay, click-to-pick,
// drag & drop, preview-before-save, and remove.
export function EditableAvatar({ name, src }: { name: string; src?: string | null }) {
  const { addToast } = useToast();
  const upload = useUploadProfilePicture();
  const remove = useRemoveProfilePicture();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pending, setPending] = useState<{ file: File; previewUrl: string } | null>(null);

  const pick = (file: File | undefined | null) => {
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      addToast('Use a JPEG, PNG, or WebP image', 'error');
      return;
    }
    if (file.size > MAX_BYTES) {
      addToast('Image is too large — maximum size is 5MB', 'error');
      return;
    }
    setPending({ file, previewUrl: URL.createObjectURL(file) });
  };

  const closePreview = () => {
    if (pending) URL.revokeObjectURL(pending.previewUrl);
    setPending(null);
  };

  const save = async () => {
    if (!pending) return;
    try {
      await upload.mutateAsync(pending.file);
      addToast('Profile photo updated', 'success');
      closePreview();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Upload failed', 'error');
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    pick(e.dataTransfer.files?.[0]);
  };

  const onInput = (e: ChangeEvent<HTMLInputElement>) => {
    pick(e.target.files?.[0]);
    e.target.value = ''; // allow re-picking the same file
  };

  return (
    <>
      <div
        role="button"
        aria-label="Change profile photo"
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={clsx(
          'relative w-[120px] h-[120px] rounded-full cursor-pointer group flex-shrink-0 ring-4 transition-all',
          dragOver ? 'ring-indigo-400 scale-105' : 'ring-white dark:ring-gray-900',
        )}
      >
        {src ? (
          <img src={src} alt={name} className="w-full h-full rounded-full object-cover" />
        ) : (
          <div className="w-full h-full rounded-full bg-indigo-600/20 border-2 border-indigo-500/30 flex items-center justify-center text-indigo-400 text-4xl font-black">
            {name ? getInitials(name) : '?'}
          </div>
        )}
        {/* Hover overlay */}
        <div className={clsx(
          'absolute inset-0 rounded-full bg-black/50 flex flex-col items-center justify-center gap-1 transition-opacity',
          dragOver ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
        )}>
          <Camera size={20} className="text-white" />
          <span className="text-[10px] font-semibold text-white">{dragOver ? 'Drop photo' : 'Change photo'}</span>
        </div>
        <input ref={inputRef} type="file" accept={ACCEPTED.join(',')} onChange={onInput} className="hidden" />
      </div>

      {/* Remove link (only when a photo exists) */}
      {src && (
        <button
          onClick={() => remove.mutateAsync().then(() => addToast('Photo removed', 'success')).catch(() => addToast('Could not remove photo', 'error'))}
          className="flex items-center gap-1 text-[11px] font-medium text-gray-400 hover:text-red-400 transition-colors cursor-pointer mt-2"
        >
          <Trash2 size={11} /> Remove photo
        </button>
      )}

      {/* Preview before saving */}
      <Modal isOpen={!!pending} onClose={closePreview} title="New profile photo" size="sm">
        {pending && (
          <div className="flex flex-col items-center gap-4 py-2">
            <img src={pending.previewUrl} alt="Preview" className="w-40 h-40 rounded-full object-cover ring-4 ring-indigo-500/30" />
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              Your photo will be cropped to a square and shown across ProTracker.
            </p>
            <div className="flex gap-2 w-full">
              <button
                onClick={closePreview}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={upload.isPending}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-bold transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                {upload.isPending ? <><Loader2 size={14} className="animate-spin" /> Uploading…</> : <><Upload size={14} /> Save Photo</>}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
