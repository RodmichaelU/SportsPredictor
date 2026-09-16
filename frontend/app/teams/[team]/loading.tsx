import CardGridSkeleton from "@/components/CardGridSkeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-800" />
        <div className="flex flex-col gap-2">
          <div className="h-6 w-48 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
          <div className="h-4 w-32 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
        </div>
      </div>
      <div className="h-56 animate-pulse rounded-xl bg-neutral-200 dark:bg-neutral-800" />
      <CardGridSkeleton />
    </div>
  );
}
