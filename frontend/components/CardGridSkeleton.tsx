// Placeholder grid shown by a route's loading.tsx while server data is
// still being fetched, so the page never just goes blank on a slow
// connection. Shape roughly matches PredictionCard/ResultCard so the layout
// doesn't jump once real content swaps in.
export default function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex animate-pulse flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
        >
          <div className="h-3 w-20 rounded bg-neutral-200 dark:bg-neutral-800" />
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-neutral-200 dark:bg-neutral-800" />
            <div className="h-3 flex-1 rounded bg-neutral-200 dark:bg-neutral-800" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-neutral-200 dark:bg-neutral-800" />
            <div className="h-3 flex-1 rounded bg-neutral-200 dark:bg-neutral-800" />
          </div>
          <div className="h-2 rounded-full bg-neutral-200 dark:bg-neutral-800" />
          <div className="grid grid-cols-3 gap-2 border-t border-neutral-100 pt-3 dark:border-neutral-900">
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="h-6 rounded bg-neutral-200 dark:bg-neutral-800" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
