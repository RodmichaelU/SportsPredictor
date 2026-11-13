import Link from "next/link";
import { getMeta, getParlays, getSports, getTeamLogos } from "@/lib/api";
import { SITE_TIME_ZONE } from "@/lib/format";
import { parlaysPath } from "@/lib/routes";
import UpdatedAt from "@/components/UpdatedAt";
import ChipRow, { chipClass } from "@/components/ChipRow";
import LeagueName from "@/components/LeagueName";
import PageBand from "@/components/PageBand";
import ParlayBuilder from "@/components/ParlayBuilder";
import ParlayTierCard from "@/components/ParlayTierCard";
import SectionHeader from "@/components/SectionHeader";
import Reveal from "@/components/Reveal";

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

// The Parlay Picker, for all leagues (selected = null, /parlays/) or one
// (/parlays/<sport>/). Shared by both routes' page.tsx.
export default async function ParlaysView({ selected }: { selected: string | null }) {
  const sports = await getSports();
  const liveSports = sports.filter((s) => s.status === "live");

  const [parlays, logoMaps, meta] = await Promise.all([
    getParlays(selected ?? undefined),
    Promise.all(liveSports.map((s) => getTeamLogos(s.id))),
    getMeta(),
  ]);
  const logos = Object.fromEntries(liveSports.map((s, i) => [s.id, logoMaps[i]]));
  const snapshotLeg = parlays?.tiers.flatMap((t) => t.legs).find((leg) => leg.market_source === "snapshot");
  const hasEarly = parlays?.candidates.some((leg) => leg.early);

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
            {meta && (
              <div className="mt-4">
                <UpdatedAt iso={meta.refreshed_at} intervalHours={meta.refresh_interval_hours} variant="pill" />
              </div>
            )}
          </>
        }
      >
        <ChipRow>
          {[{ id: null, name: "All leagues" }, ...liveSports].map((s) => (
            <Link key={s.id ?? "all"} href={parlaysPath(s.id)} className={chipClass(selected === s.id)}>
              {s.id ? <LeagueName sport={s} /> : s.name}
            </Link>
          ))}
        </ChipRow>
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
                  timeZone: SITE_TIME_ZONE,
                  weekday: "short",
                  hour: "numeric",
                  minute: "2-digit",
                })}
                .
              </>
            )}
            {hasEarly && (
              <>
                {" "}
                Legs tagged <span className="font-semibold text-sky-600 dark:text-sky-400">Early</span> are NBA games more
                than 12 hours out: predicted from today&apos;s data but not frozen yet, so injury news can still change them.
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
              <ParlayBuilder
                refreshedAt={meta?.refreshed_at}
                candidates={parlays.candidates}
                logos={logos}
                leagueNames={Object.fromEntries(liveSports.map((s) => [s.id, s.id.toUpperCase()]))}
              />
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
