import type { CSSProperties } from 'react';
import { clsx } from 'clsx';

// All skeletons use the shimmer `.skeleton` class (defined in index.css): a gray-200
// (light) / gray-800 (dark) block with a highlight band sweeping left→right.

export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div className={clsx('skeleton rounded-lg', className)} style={style} />;
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={clsx('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={clsx('h-3 rounded', i === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  );
}

export function SkeletonAvatar({ size = 40 }: { size?: number }) {
  return <Skeleton className="rounded-full flex-shrink-0" style={{ width: size, height: size }} />;
}

export function SkeletonStat() {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
      <Skeleton className="h-10 w-10 rounded-xl mb-3" />
      <Skeleton className="h-3 w-24 rounded mb-2" />
      <Skeleton className="h-7 w-16 rounded" />
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 flex items-center gap-3">
      <Skeleton className="h-11 w-11 rounded-xl flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-1/2 rounded" />
        <Skeleton className="h-3 w-1/3 rounded" />
      </div>
      <Skeleton className="h-6 w-14 rounded-full" />
    </div>
  );
}

export function SkeletonChart({ height = 260 }: { height?: number }) {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
      <Skeleton className="h-4 w-40 rounded mb-4" />
      <Skeleton className="w-full rounded-xl" style={{ height }} />
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
      <div className="flex gap-4 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        {Array.from({ length: cols }).map((_, i) => <Skeleton key={i} className="h-3 flex-1 rounded" />)}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 px-4 py-3.5 border-b border-gray-50 dark:border-gray-800/50 last:border-0">
          {Array.from({ length: cols }).map((_, c) => <Skeleton key={c} className="h-3 flex-1 rounded" />)}
        </div>
      ))}
    </div>
  );
}

// ── Composite page skeletons ─────────────────────────────────────────────────

export function StatGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => <SkeletonStat key={i} />)}
    </div>
  );
}

export function CardListSkeleton({ count = 6, cols = 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' }: { count?: number; cols?: string }) {
  return (
    <div className={clsx('grid gap-3', cols)}>
      {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  );
}

// Report placeholder: stat grid + a wide chart + two half-width charts.
export function ReportSkeleton() {
  return (
    <div className="flex-1 p-4 lg:p-6 space-y-6">
      <Skeleton className="h-28 w-full rounded-2xl" />
      <StatGridSkeleton count={4} />
      <SkeletonChart height={280} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SkeletonChart height={240} />
        <SkeletonChart height={240} />
      </div>
    </div>
  );
}

// Detail placeholder: hero band + sticky-tab bar + content cards.
export function DetailSkeleton() {
  return (
    <div className="flex-1">
      <Skeleton className="h-40 w-full rounded-none" />
      <div className="p-4 lg:p-6 space-y-6">
        <div className="flex gap-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-20 rounded-lg" />)}
        </div>
        <StatGridSkeleton count={4} />
        <SkeletonChart height={220} />
      </div>
    </div>
  );
}

// Full dashboard placeholder: hero + stat grid + a chart panel.
export function DashboardSkeleton() {
  return (
    <div className="flex-1 p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-52 rounded-xl" />
          <Skeleton className="h-3 w-32 rounded" />
        </div>
        <Skeleton className="h-10 w-32 rounded-xl hidden sm:block" />
      </div>
      <StatGridSkeleton count={4} />
      <SkeletonChart height={220} />
    </div>
  );
}
