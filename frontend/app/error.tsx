"use client";

// Catches errors thrown while rendering a page (most likely: the API server
// at NEXT_PUBLIC_API_URL is unreachable) and shows something on-brand
// instead of Next's default crash screen. Must be a client component --
// that's a Next.js requirement for error boundaries, not a stylistic choice.
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold tracking-wide text-red-700 uppercase dark:bg-red-950/50 dark:text-red-400">
        Something went wrong
      </span>
      <h1 className="text-2xl font-semibold">Couldn&apos;t load this page</h1>
      <p className="max-w-md text-sm text-neutral-500">
        The prediction API might be temporarily unreachable. Try again in a moment -- if this keeps
        happening, the backend server is likely not running.
      </p>
      <button
        onClick={reset}
        className="rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
      >
        Try again
      </button>
    </div>
  );
}
