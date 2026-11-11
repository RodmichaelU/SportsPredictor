// Marks a not-yet-frozen preview line (see ParlayLeg.early, Prediction.early).
export default function EarlyTag() {
  return (
    <span
      title="Early line: predicted from today's data, not frozen yet. Injury news can still change it."
      className="eyebrow shrink-0 rounded-sm bg-sky-500/15 px-1.5 py-px text-[9px] text-sky-600 dark:text-sky-400"
    >
      Early
    </span>
  );
}
