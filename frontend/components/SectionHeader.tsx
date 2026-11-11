import Link from "next/link";

// Section title with a small red accent bar, optional muted note beside
// it, and an optional "See all" link on the right.
export default function SectionHeader({
  title,
  eyebrow,
  href,
  linkLabel = "See all",
  size = "md",
}: {
  title: React.ReactNode;
  eyebrow?: React.ReactNode;
  href?: string;
  linkLabel?: string;
  size?: "sm" | "md";
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      {/* The note drops under the title on phones rather than squeezing
          both into narrow side-by-side columns. */}
      <div className="flex min-w-0 items-start gap-3">
        <span
          aria-hidden
          className={`w-1 shrink-0 rounded-full bg-brand-600 ${size === "sm" ? "mt-[0.1rem] h-4" : "mt-1 h-5"}`}
        />
        <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
          <h2 className={`display ${size === "sm" ? "text-xl" : "text-3xl"}`}>{title}</h2>
          {eyebrow && <span className="text-sm text-neutral-500">{eyebrow}</span>}
        </div>
      </div>
      {href && (
        <Link href={href} className="eyebrow shrink-0 text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400">
          {linkLabel} ›
        </Link>
      )}
    </div>
  );
}

// A sidebar / bento module: white (ink in dark mode) panel. Default p-4
// padding is skipped when className brings its own (p-0, py-1, ...), since
// two conflicting padding utilities resolve by stylesheet order, not by
// which one was passed last.
export function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const padding = /(^|\s)p[xy]?-/.test(className) ? "" : "p-4";
  const inlinePadding = /(^|\s)py-/.test(className) ? "px-4" : "";
  return (
    <div className={`rounded-md border border-neutral-200 bg-white shadow-sm dark:border-white/10 dark:bg-ink-900 ${padding} ${inlinePadding} ${className}`}>
      {children}
    </div>
  );
}
