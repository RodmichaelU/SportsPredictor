import CardGridSkeleton from "@/components/CardGridSkeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="h-7 w-64 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
        <div className="h-4 w-full max-w-2xl animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
      </div>
      <CardGridSkeleton />
    </div>
  );
}
