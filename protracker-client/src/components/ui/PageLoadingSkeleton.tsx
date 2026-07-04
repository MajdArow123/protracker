// Fallback shown while a lazily-loaded route chunk is being fetched.
// Three shimmer placeholder cards inside the standard page padding.
export function PageLoadingSkeleton() {
  return (
    <div className="flex-1 p-4 lg:p-6 space-y-6">
      <div className="skeleton h-9 w-56 rounded-xl" />
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5"
          >
            <div className="skeleton h-10 w-10 rounded-xl mb-4" />
            <div className="skeleton h-3 w-24 rounded mb-2" />
            <div className="skeleton h-8 w-20 rounded" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-3">
        <div className="skeleton h-4 w-40 rounded" />
        <div className="skeleton h-48 w-full rounded-xl" />
      </div>
    </div>
  );
}
