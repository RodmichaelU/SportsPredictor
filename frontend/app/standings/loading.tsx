export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="h-7 w-40 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
        <div className="h-4 w-full max-w-xl animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-64 animate-pulse rounded-xl bg-neutral-200 dark:bg-neutral-800" />
        ))}
      </div>
    </div>
  );
}
