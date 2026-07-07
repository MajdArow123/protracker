import type { Profile } from '../api/profileApi';

export interface CompletionItem {
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
    { label: 'Add a profile photo', points: 15, done: !!profile.profilePictureUrl },
    { label: 'Full name', points: 10, done: !!profile.displayName?.trim() },
    { label: 'Add your phone number', points: 10, done: !!profile.phoneNumber },
    { label: 'Add your bio', points: 10, done: !!profile.bio },
    { label: 'Add emergency contact', points: 15, done: !!profile.emergencyContactName && !!profile.emergencyContactPhone },
  ];

  if (isAthlete) {
    items.push(
      { label: 'Add your date of birth', points: 10, done: !!profile.dateOfBirth },
      { label: 'Add height & weight', points: 10, done: (profile.height ?? 0) > 0 && (profile.weight ?? 0) > 0 },
      { label: 'Add dietary preferences', points: 10, done: (opts.dietaryCount ?? 0) > 0 },
      { label: 'Add your jersey number', points: 5, done: profile.jerseyNumber != null },
      { label: 'Position set', points: 5, done: !!profile.positionName },
    );
  } else {
    items.push(
      { label: 'Describe your coaching experience', points: 15, done: !!profile.coachingExperience },
      { label: 'Add your certifications', points: 10, done: !!profile.certifications },
      { label: 'Add your specialization', points: 15, done: !!profile.specialization },
    );
  }

  const total = items.reduce((s, i) => s + i.points, 0);
  const earned = items.filter(i => i.done).reduce((s, i) => s + i.points, 0);
  const percent = Math.round((earned / total) * 100);

  return { percent, items, missing: items.filter(i => !i.done) };
}
