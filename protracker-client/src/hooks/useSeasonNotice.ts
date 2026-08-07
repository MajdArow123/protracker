import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../context/useToast';
import { useAuth } from '../context/useAuth';
import type { SeasonResolutionNotice } from '../types';

// Phase 10 S5: renders the two season-resolution notices the backend has attached to
// create/update responses since S3/S3+. Ruling 1 allows deliberate overlaps, so the
// Ambiguous wording states what happened and offers the destination WITHOUT presuming
// a mistake to fix. Both are non-blocking — the record always saved.
export function useSeasonNoticeToast() {
  const { addToast } = useToast();
  const { t } = useTranslation();
  const { user } = useAuth();
  const isCoach = user?.role === 'Coach' || user?.role === 'Admin';

  return useCallback(
    (response: { seasonNotice?: SeasonResolutionNotice | null } | null | undefined) => {
      const notice = response?.seasonNotice;
      if (!notice) return;
      if (notice.code === 'AmbiguousSeason') {
        addToast(
          t(
            'seasons.noticeAmbiguous',
            "Saved — but the date falls inside {{num}} overlapping seasons, so it wasn't assigned to one.",
            { num: notice.candidateSeasonIds.length },
          ),
          'warning',
          // The Seasons page is coach navigation — only offer the link to coaches.
          isCoach ? { linkTo: '/seasons', linkLabel: t('nav.seasons', 'Seasons') } : undefined,
        );
      } else if (notice.code === 'SeasonUnstamped') {
        addToast(
          t(
            'seasons.noticeUnstamped',
            'Saved — the new date is outside all seasons, so this record no longer counts toward any season.',
          ),
          'info',
        );
      }
    },
    [addToast, t, isCoach],
  );
}
