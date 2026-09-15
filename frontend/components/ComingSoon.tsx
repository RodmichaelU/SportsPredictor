import { Sport } from "@/lib/types";

// Shown on /predictions, /results, and /model for sports whose data pipeline
// and Elo ratings are built (src/sports/<id>/ingest.py) but whose model
// layer (features.py) isn't -- so there's genuinely nothing to predict with
// yet, rather than an empty list that reads like a temporary lull in games.
export default function ComingSoon({ sport }: { sport: Sport }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-14 text-center dark:border-neutral-700 dark:bg-neutral-900">
      <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold tracking-wide text-indigo-700 uppercase dark:bg-indigo-900/50 dark:text-indigo-300">
        Coming soon
      </span>
      <h2 className="text-xl font-semibold">{sport.name} predictions are on the way</h2>
      <p className="max-w-md text-sm text-neutral-600 dark:text-neutral-400">
        The free data pipeline is already pulling real {sport.name} games and results, and we&apos;ve
        tuned an Elo rating system from scratch the same way we did for college football and the NFL.
        What&apos;s left is the model layer -- turning that data into a win probability -- before picks
        show up here.
      </p>
    </div>
  );
}
