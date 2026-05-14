// Route-level Suspense skeleton — shown during navigation before the Server Component streams
export default function Loading() {
  return (
    <div className="space-y-12">
      {/* Hero skeleton */}
      <div className="py-16 sm:py-20 text-center space-y-5">
        <div className="h-11 w-72 sm:w-96 mx-auto rounded-xl bg-surface animate-shimmer" />
        <div className="h-5 w-80 mx-auto rounded-lg bg-surface animate-shimmer" />
        <div className="flex justify-center gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-6 w-24 rounded-full bg-surface animate-shimmer" />
          ))}
        </div>
      </div>

      {/* Stats strip skeleton */}
      <div className="grid grid-cols-3 gap-4 rounded-xl border border-monad-border p-6 bg-surface">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-8 w-20 rounded-lg bg-surface-2 animate-shimmer" />
            <div className="h-3 w-14 rounded bg-surface-2 animate-shimmer" />
          </div>
        ))}
      </div>

      {/* Market grid skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-52 rounded-xl bg-surface animate-shimmer" />
        ))}
      </div>
    </div>
  );
}
