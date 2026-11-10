// The dark, full-bleed title band that opens every section page -- the
// broadcast "lower third" treatment instead of a plain heading on the page
// background. `aside` sits opposite the title (headline stats, filters);
// `children` render as a full-width strip along the band's bottom edge.
export default function PageBand({
  eyebrow,
  title,
  description,
  aside,
  children,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  aside?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section className="bleed relative -mt-8 overflow-hidden bg-ink-950 text-white">
      <div aria-hidden className="broadcast-bg pointer-events-none absolute inset-0 opacity-70" />
      <div className="bleed-inner relative flex flex-wrap items-center justify-between gap-x-10 gap-y-8 py-8 sm:py-12">
        <div className="max-w-xl">
          {eyebrow && <div className="eyebrow mb-2 text-brand-400">{eyebrow}</div>}
          <h1 className="display text-5xl sm:text-6xl">{title}</h1>
          {description && <div className="mt-3 text-sm leading-relaxed text-neutral-300">{description}</div>}
        </div>
        {aside}
      </div>
      {children && <div className="bleed-inner relative pb-8">{children}</div>}
    </section>
  );
}

// A headline number for a band's aside: big condensed figure over a label.
export function BandStat({ value, label, accent = false }: { value: React.ReactNode; label: string; accent?: boolean }) {
  return (
    <div>
      <div className={`display text-5xl tabular-nums ${accent ? "text-brand-500" : ""}`}>{value}</div>
      <div className="eyebrow mt-1 text-[11px] text-neutral-400">{label}</div>
    </div>
  );
}
