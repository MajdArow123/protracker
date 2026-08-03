// ── Coach marketplace (Phase E) ──────────────────────────────────────────────
export interface CoachPublicProfileSettings {
  slug: string;
  displayName: string;
  profilePictureUrl?: string | null;
  bio?: string | null;
  sportId?: number | null;
  sportName?: string | null;
  city?: string | null;
  country?: string | null;
  yearsCoaching?: number | null;
  certifications?: string | null;
  specialization?: string | null;
  isAcceptingAthletes: boolean;
  contactEmail?: string | null;
  isPublic: boolean;
  teamCount: number;
  playerCount: number;
  averageTeamScore?: number | null;
}

export interface UpdateCoachPublicProfileInput {
  bio?: string | null;
  sportId?: number | null;
  city?: string | null;
  country?: string | null;
  yearsCoaching?: number | null;
  certifications?: string | null;
  specialization?: string | null;
  isAcceptingAthletes: boolean;
  contactEmail?: string | null;
  isPublic: boolean;
}

export interface CoachMarketplaceItem {
  slug: string;
  displayName: string;
  profilePictureUrl?: string | null;
  sportId?: number | null;
  sportName?: string | null;
  city?: string | null;
  country?: string | null;
  yearsCoaching?: number | null;
  specialization?: string | null;
  isAcceptingAthletes: boolean;
  teamCount: number;
  playerCount: number;
  averageRating?: number | null;
  reviewCount: number;
}

export interface CoachReview {
  id: number;
  reviewerName: string;
  rating: number;
  title?: string | null;
  content?: string | null;
  sportId?: number | null;
  sportName?: string | null;
  isVerified: boolean;
  coachResponse?: string | null;
  createdAt: string;
  isMine: boolean;
}

export interface CoachReviewsResponse {
  averageRating?: number | null;
  reviewCount: number;
  distribution: Record<string, number>;
  reviews: CoachReview[];
  hasReviewed: boolean;
  isOwner: boolean;
}

export interface SubmitCoachReviewInput {
  rating: number;
  title?: string | null;
  content?: string | null;
  sport?: number | null;
}

export interface ViewPoint {
  date: string;
  count: number;
}

export interface CompletenessItem {
  label: string;
  weight: number;
  done: boolean;
}

export interface CoachAnalytics {
  isPublic: boolean;
  totalViews: number;
  viewsThisWeek: number;
  viewsThisMonth: number;
  totalRequests: number;
  pendingRequests: number;
  acceptedRequests: number;
  acceptanceRate: number;
  totalReviews: number;
  averageRating?: number | null;
  profileCompleteness: number;
  viewsBySource: Record<string, number>;
  viewsTrend: ViewPoint[];
  completenessItems: CompletenessItem[];
}

export interface CoachPublicProfileView {
  slug: string;
  displayName: string;
  profilePictureUrl?: string | null;
  sportId?: number | null;
  sportName?: string | null;
  bio?: string | null;
  city?: string | null;
  country?: string | null;
  yearsCoaching?: number | null;
  certifications?: string | null;
  specialization?: string | null;
  isAcceptingAthletes: boolean;
  contactEmail?: string | null;
  teamCount: number;
  playerCount: number;
  averageTeamScore?: number | null;
  averageRating?: number | null;
  reviewCount: number;
}

export type ConnectionRequestStatus = 'Pending' | 'Accepted' | 'Declined' | 'Withdrawn';

// Coach's view of an incoming request.
export interface ConnectionRequest {
  id: number;
  coachUserId: string;
  coachName: string;
  athleteUserId: string;
  athleteName: string;
  athletePlayerId?: number | null;
  message?: string | null;
  sportId?: number | null;
  sportName?: string | null;
  status: ConnectionRequestStatus;
  coachNote?: string | null;
  resultJoinCode?: string | null;
  requestedAt: string;
  respondedAt?: string | null;
}

// Athlete's view of a request they sent.
export interface MyConnectionRequest {
  id: number;
  coachName: string;
  coachSlug?: string | null;
  message?: string | null;
  sportName?: string | null;
  status: ConnectionRequestStatus;
  resultJoinCode?: string | null;
  requestedAt: string;
  respondedAt?: string | null;
}

export interface SendConnectionRequestInput {
  message?: string | null;
  sport?: number | null;
}

export interface CoachMarketplaceQuery {
  sport?: number | null;
  city?: string;
  country?: string;
  accepting?: boolean;
  search?: string;
  minYears?: number | null;
  maxYears?: number | null;
  sort?: string;
  page?: number;
}
