import type { Metadata } from "next";
import Link from "next/link";
import { getParlays, getSports, getTeamLogos } from "@/lib/api";
import PageBand from "@/components/PageBand";
import ParlayBuilder from "@/components/ParlayBuilder";
import ParlayTierCard from "@/components/ParlayTierCard";
import SectionHeader from "@/components/SectionHeader";
import Reveal from "@/components/Reveal";

export const metadata: Metadata = {
  title: "Parlay Picker",
  description: "Model-built parlays at three risk tiers, priced by the live prediction market.",
};

const HOW_IT_WORKS = [
  {
    title: "Priced by the market",
    body: "Each leg's payout comes from Kalshi's real-money price. The model only decides which legs are worth taking.",
  },
  {
    title: "Only underpriced legs",
    body: "Legs are ones the model rates above the market's price, and gaps over 15 points are skipped as likely data problems. If none qualify, the tier is marked \"No value found\".",
  },
  {
    title: "One dial per tier",
    body: "Low risk favors the chance of cashing; high risk favors payout and will back an underdog the market is selling short.",
  },
];

export default async function ParlaysPage(props: PageProps<"/parlays">) {
  const searchParams = await props.searchParams;
  const sports = await getSports();
  const liveSports = sports.filter((s) => s.status === "live");
  const selected = typeof searchParams.sport === "string" && liveSports.some((s) => s.id === searchParams.sport)
    ? searchParams.sport
    : null;

  const [parlays, logoMaps] = await Promise.all([
    getParlays(selected ? [selected] : undefined),
    Promise.all(liveSports.map((s) => getTeamLogos(s.id))),
  ]);
  const logos = Object.fromEntries(liveSports.map((s, i) => [s.id, logoMaps[i]]));
  const snapshotLeg = parlays?.tiers.flatMap((t) => t.legs).find((leg) => leg.market_source === "snapshot");

  return (
    <div className="flex flex-col gap-12 sm:gap-16">
      <PageBand
        eyebrow={selected ? sports.find((s) => s.id === selected)?.name : "All leagues"}
        title="Parlay Picker"
        description={
          <>
            Three parlays built from this week&apos;s predictions, from a safe two-leg combo to a long shot.
            Legs are games where the model thinks the market is underpricing the pick; when a slate has none,
            a tier shows the model&apos;s likeliest picks instead and says so.
          </>
        }
      >
        <nav className="flex flex-wrap gap-2">
          {[{ id: null, name: "All leagues" }, ...liveSports].map((s) => {
            const active = selected === s.id;
            return (
              <Link
                key={s.id ?? "all"}
                href={s.id ? `/parlays?sport=${s.id}` : "/parlays"}
                className={`eyebrow rounded-full px-4 py-2 text-xs transition-colors ${
                  active ? "bg-brand-600 text-white" : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                {s.name}
              </Link>
            );
          })}
        </nav>
      </PageBand>

      {!parlays ? (
        <p className="text-sm text-neutral-500">The Parlay Picker needs the live API (market prices aren&apos;t mocked).</p>
      ) : (
        <>
          <Reveal className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {parlays.tiers.map((tier) => (
              <ParlayTierCard key={tier.tier} tier={tier} />
            ))}
          </Reveal>

          <p className="-mt-6 text-xs leading-relaxed text-neutral-500 sm:-mt-10">
            Built from {parlays.priced_games} games with a market price in the next 7 days. Hit chances treat each game as
            independent and use the model&apos;s own probabilities, which can be overconfident.
            {snapshotLeg?.market_captured_at && (
              <>
                {" "}
                Kalshi&apos;s live feed is unreachable right now, so prices are the latest saved snapshot from{" "}
                {new Date(snapshotLeg.market_captured_at).toLocaleString(undefined, {
                  weekday: "short",
                  hour: "numeric",
                  minute: "2-digit",
                })}
                .
              </>
            )}{" "}
            For research and entertainment, not betting advice.
          </p>

          {parlays.candidates.length > 0 && (
            <section id="build">
              <SectionHeader title="Build your own" eyebrow="Pick any games, get a grade" />
              <p className="-mt-2 mb-6 max-w-2xl text-sm text-neutral-500">
                Tap a team in each game you want. The grade weighs how likely your parlay is to hit against
                what it pays, using the model&apos;s numbers and the market&apos;s prices, and flags any leg the
                market is charging too much for.
              </p>
              <ParlayBuilder candidates={parlays.candidates} logos={logos} />
            </section>
          )}

          <Reveal as="section">
            <SectionHeader title="How the picks are chosen" href="/model" linkLabel="About the model" />
            <ol className="grid grid-cols-1 gap-10 sm:grid-cols-3">
              {HOW_IT_WORKS.map((step, i) => (
                <li key={step.title} className="flex flex-col gap-2">
                  <span className="display text-5xl text-brand-600 dark:text-brand-500">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="display text-2xl">{step.title}</h3>
                  <p className="text-[15px] leading-relaxed text-neutral-600 dark:text-neutral-400">{step.body}</p>
                </li>
              ))}
            </ol>
          </Reveal>
        </>
      )}
    </div>
  );
}
