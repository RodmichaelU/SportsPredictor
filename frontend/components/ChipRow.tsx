// A row of pill links (league filters, jump links). On phones it stays one
// line and scrolls sideways edge to edge, like the score ticker, instead of
// wrapping a straggler onto a second line; from sm up it wraps normally.
// Children should be shrink-0 / whitespace-nowrap (chipClass does both).
export default function ChipRow({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <nav
      className={`no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 ${className}`}
    >
      {children}
    </nav>
  );
}

export function chipClass(active: boolean) {
  return `eyebrow shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-xs transition duration-150 active:scale-[0.97] ${
    active ? "bg-brand-600 text-white hover:bg-brand-500" : "bg-white/10 text-white hover:bg-white/20"
  }`;
}
