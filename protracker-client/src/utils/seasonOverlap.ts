import type { Season } from '../types';

// Day-granular window overlap on ISO date strings (lexicographic compare is correct
// for yyyy-MM-dd). Overlapping seasons are ALLOWED (a league season and a summer
// tournament can coexist) — this exists to power the non-blocking create/edit warning,
// never to reject.
export function findOverlappingSeasons(
  seasons: Season[],
  startDate: string,
  endDate: string,
  excludeId?: number,
): Season[] {
  if (!startDate || !endDate) return [];
  return seasons.filter(s => {
    if (s.id === excludeId) return false;
    const otherStart = s.startDate.slice(0, 10);
    const otherEnd = s.endDate.slice(0, 10);
    return startDate <= otherEnd && endDate >= otherStart;
  });
}
