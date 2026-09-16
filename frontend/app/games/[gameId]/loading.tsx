export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-4 w-24 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
      <div className="h-32 animate-pulse rounded-xl bg-neutral-200 dark:bg-neutral-800" />
      <div className="h-32 animate-pulse rounded-xl bg-neutral-200 dark:bg-neutral-800" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-neutral-200 dark:bg-neutral-800" />
        ))}
      </div>
    </div>
  );
}
