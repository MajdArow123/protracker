import type { Profile } from '../api/profileApi';

export interface CompletionItem {
  /** i18n key (under profile.completion.*) for the label; `label` is the English fallback. */
  key: string;
  label: string;
  points: number;
  done: boolean;
}

export interface ProfileCompletion {
  percent: number;
  items: CompletionItem[];
  missing: CompletionItem[];
}

// Weights per spec — coach and athlete both total 100.
export function computeProfileCompletion(
  profile: Profile,
  opts: { dietaryCount?: number } = {},
): ProfileCompletion {
  const isAthlete = profile.roles.includes('Athlete') || profile.roles.includes('SoloAthlete');
  const items: CompletionItem[] = [
    { key: 'profile.completion.photo', label: 'Add a profile photo', points: 15, done: !!profile.profilePictureUrl },
    { key: 'profile.completion.fullName', label: 'Full name', points: 10, done: !!profile.displayName?.trim() },
    { key: 'profile.completion.phone', label: 'Add your phone number', points: 10, done: !!profile.phoneNumber },
    { key: 'profile.completion.bio', label: 'Add your bio', points: 10, done: !!profile.bio },
    { key: 'profile.completion.emergency', label: 'Add emergency contact', points: 15, done: !!profile.emergencyContactName && !!profile.emergencyContactPhone },
  ];

  if (isAthlete) {
    items.push(
      { key: 'profile.completion.dob', label: 'Add your date of birth', points: 10, done: !!profile.dateOfBirth },
      { key: 'profile.completion.heightWeight', label: 'Add height & weight', points: 10, done: (profile.height ?? 0) > 0 && (profile.weight ?? 0) > 0 },
      { key: 'profile.completion.dietary', label: 'Add dietary preferences', points: 10, done: (opts.dietaryCount ?? 0) > 0 },
      { key: 'profile.completion.jersey', label: 'Add your jersey number', points: 5, done: profile.jerseyNumber != null },
      { key: 'profile.completion.position', label: 'Position set', points: 5, done: !!profile.positionName },
    );
  } else {
    items.push(
      { key: 'profile.completion.coachExperience', label: 'Describe your coaching experience', points: 15, done: !!profile.coachingExperience },
      { key: 'profile.completion.certifications', label: 'Add your certifications', points: 10, done: !!profile.certifications },
      { key: 'profile.completion.specialization', label: 'Add your specialization', points: 15, done: !!profile.specialization },
    );
  }

  const total = items.reduce((s, i) => s + i.points, 0);
  const earned = items.filter(i => i.done).reduce((s, i) => s + i.points, 0);
  const percent = Math.round((earned / total) * 100);

  return { percent, items, missing: items.filter(i => !i.done) };
}
