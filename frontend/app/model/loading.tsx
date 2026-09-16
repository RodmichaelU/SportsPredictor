export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="h-7 w-72 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
        <div className="h-4 w-full max-w-2xl animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
      </div>
      <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-6 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
        ))}
      </div>
    </div>
  );
}
