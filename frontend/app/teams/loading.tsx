export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="h-7 w-32 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
        <div className="h-4 w-full max-w-xl animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 md:grid-cols-4">
        {Array.from({ length: 24 }).map((_, i) => (
          <div key={i} className="h-8 animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-800" />
        ))}
      </div>
    </div>
  );
}
