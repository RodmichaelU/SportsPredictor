import Link from "next/link";

// Section title with the red tick and an optional "See all" link on the
// right -- the standard module header on a sports front page.
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
    <div className="mb-3 flex items-end justify-between gap-4 border-b-2 border-neutral-900 pb-2 dark:border-white/80">
      <div>
        {eyebrow && <div className="eyebrow text-[11px] text-brand-600 dark:text-brand-400">{eyebrow}</div>}
        <h2 className={`display ${size === "sm" ? "text-xl" : "text-3xl"}`}>{title}</h2>
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
