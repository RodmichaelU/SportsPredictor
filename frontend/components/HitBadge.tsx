export default function HitBadge({ hit }: { hit: boolean }) {
  return (
    <span
      className={`eyebrow inline-flex items-center rounded-sm px-2 py-0.5 text-[11px] text-white ${
        hit ? "bg-emerald-600" : "bg-neutral-500 dark:bg-neutral-600"
      }`}
    >
      {hit ? "Hit" : "Miss"}
    </span>
  );
}
