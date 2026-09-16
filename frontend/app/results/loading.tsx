import CardGridSkeleton from "@/components/CardGridSkeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="h-7 w-40 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
        <div className="h-4 w-full max-w-xl animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={`h-20 animate-pulse rounded-xl bg-neutral-200 dark:bg-neutral-800 ${i === 0 ? "col-span-2 sm:col-span-2" : ""}`}
          />
        ))}
      </div>
      <CardGridSkeleton />
    </div>
  );
}
