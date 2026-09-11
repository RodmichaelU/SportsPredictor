import Link from "next/link";
import { getExplanation } from "@/lib/api";
import ProbabilityDuel from "@/components/ProbabilityDuel";
import ExplanationFactor from "@/components/ExplanationFactor";

export default async function GameExplanationPage(props: PageProps<"/games/[gameId]">) {
  const { gameId } = await props.params;
  const searchParams = await props.searchParams;
  const sport = (searchParams.sport as string) ?? "cfb";

  const data = await getExplanation(sport, gameId);
  const maxAbsContribution = Math.max(...data.groups.map((g) => Math.abs(g.contribution)), 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/predictions?sport=${sport}`}
          className="text-sm text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
        >
          ← Back to predictions
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">
          {data.away_team} @ {data.home_team}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          The model picks <span className="font-medium text-neutral-700 dark:text-neutral-300">{data.predicted_winner}</span>.
          Here&apos;s what drove that pick, broken down by factor.
        </p>
      </div>

      <div className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
        <ProbabilityDuel
          homeTeam={data.home_team}
          awayTeam={data.away_team}
          winProbability={data.win_probability}
        />
      </div>

      <div>
        <h2 className="text-lg font-semibold">Why the model picked {data.predicted_winner}</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Bar length shows how much each factor moved the prediction. Click a row for the underlying
          numbers. Some stats are correlated with each other (a team&apos;s overall rating already
          reflects its offense and defense), so they&apos;re grouped together here -- a factor&apos;s
          combined effect is more reliable than its parts taken individually.
        </p>
        <div className="mt-4 rounded-lg border border-neutral-200 px-4 dark:border-neutral-800">
          {data.groups.map((group) => (
            <ExplanationFactor
              key={group.key}
              group={group}
              homeTeam={data.home_team}
              maxAbsContribution={maxAbsContribution}
            />
          ))}
        </div>
      </div>

      <p className="text-xs text-neutral-500">Model version {data.model_version}.</p>
    </div>
  );
}
