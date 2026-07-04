// Maps a failed request to a friendly, human-readable message. Prefers a meaningful
// message from the backend; otherwise falls back to a status-based default.
interface ApiErrorLike {
  status?: number;
  message?: string;
  backendMessage?: string;
}

const STATUS_MESSAGES: Record<number, string> = {
  401: 'Your session expired. Please log in again.',
  403: "You don't have permission to do this.",
  404: 'This item no longer exists.',
  500: 'Server error. Please try again in a moment.',
};

export function friendlyErrorMessage(err: unknown): string {
  const e = err as ApiErrorLike | undefined;

  // No HTTP status → network/connection failure.
  if (!e || e.status == null) {
    // A generic "Network Error" from axios, or nothing.
    if (e?.message && e.message !== 'Network Error') return e.message;
    return 'Connection failed. Check your internet.';
  }

  // A specific backend validation/business message wins over the generic default.
  if (e.backendMessage && e.backendMessage.trim().length > 0) return e.backendMessage;

  return STATUS_MESSAGES[e.status] ?? e.message ?? 'Something went wrong. Please try again.';
}
