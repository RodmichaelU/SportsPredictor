export default function Loading() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-4 rounded-lg border border-neutral-200 p-5 dark:border-white/10">
          <div className="h-6 w-32 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
          <div className="h-14 w-40 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
          {Array.from({ length: 3 + i }).map((_, j) => (
            <div key={j} className="h-10 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
          ))}
        </div>
      ))}
    </div>
  );
}
