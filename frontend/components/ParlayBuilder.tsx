"use client";

import { useEffect, useMemo, useState } from "react";
import { getParlayRating } from "@/lib/api";
import { LegVerdict, ParlayLeg, ParlayRating } from "@/lib/types";
import { EarlyTag } from "./ParlayTierCard";

const STAKE = 10;
const MAX_LEGS = 12; // matches src/parlay.py MAX_RATED_LEGS

const GRADE_STYLE: Record<ParlayRating["grade"], string> = {
  A: "bg-emerald-600 text-white",
  B: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  C: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  D: "bg-brand-600/15 text-brand-600 dark:text-brand-400",
  F: "bg-brand-600 text-white",
};

const VERDICT_STYLE: Record<LegVerdict, { label: string; className: string }> = {
  value: { label: "Value", className: "text-emerald-600 dark:text-emerald-400" },
  fair: { label: "Fair price", className: "text-neutral-500" },
  overpriced: { label: "Overpriced", className: "text-brand-600 dark:text-brand-400" },
  suspect: { label: "Check data", className: "text-amber-600 dark:text-amber-400" },
};

type Game = { key: string; sport: string; game_id: string; game_date: string; away: ParlayLeg; home: ParlayLeg };

function gameKey(leg: { sport: string; game_id: string }) {
  return `${leg.sport}:${leg.game_id}`;
}

// Mirrors src/parlay.py american_odds, so the slip's odds update instantly
// on every tap without waiting for the rating request.
function americanFromDecimal(decimal: number): number {
  return decimal >= 2 ? Math.round((decimal - 1) * 100) : -Math.round(100 / (decimal - 1));
}

function formatAmerican(odds: number): string {
  return odds > 0 ? `+${odds.toLocaleString()}` : odds.toLocaleString();
}

function Logo({ src, team }: { src?: string; team: string }) {
  if (!src) {
    return (
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-[9px] font-bold text-neutral-600 dark:bg-white/10 dark:text-neutral-300">
        {team.slice(0, 3).toUpperCase()}
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" className="h-7 w-7 shrink-0 rounded-full bg-white object-contain ring-1 ring-neutral-200 dark:ring-white/10" />;
}

// Build-your-own parlay: tap a side in any upcoming priced game to add it to
// the slip, and the API grades the combination as it changes.
export default function ParlayBuilder({
  candidates,
  logos,
  leagueNames = {},
}: {
  candidates: ParlayLeg[];
  logos: Record<string, Record<string, string>>; // sport -> team -> logo URL
  leagueNames?: Record<string, string>; // sport id -> display name for the filter chips
}) {
  const [picks, setPicks] = useState<Record<string, boolean>>({}); // gameKey -> is_home
  const [query, setQuery] = useState("");
  const [league, setLeague] = useState<string | null>(null); // null = all leagues
  const [rating, setRating] = useState<ParlayRating | null>(null);
  const [error, setError] = useState<string | null>(null);

  const games = useMemo(() => {
    const byKey = new Map<string, Game>();
    for (const leg of candidates) {
      const key = gameKey(leg);
      const game = byKey.get(key) ?? ({ key, sport: leg.sport, game_id: leg.game_id, game_date: leg.game_date } as Game);
      if (leg.is_home) game.home = leg;
      else game.away = leg;
      byKey.set(key, game);
    }
    // A side outside the market's sane price range is dropped upstream, so
    // only list games where both sides can be picked.
    return [...byKey.values()].filter((g) => g.home && g.away);
  }, [candidates]);

  // Leagues present in this pool, in first-seen order, with game counts.
  const leagues = useMemo(() => {
    const counts = new Map<string, number>();
    for (const g of games) counts.set(g.sport, (counts.get(g.sport) ?? 0) + 1);
    return [...counts.entries()].map(([id, count]) => ({ id, count }));
  }, [games]);

  // Filters only narrow the list; picks already in the slip stay there.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return games.filter(
      (g) =>
        (!league || g.sport === league) &&
        (!q || g.home.team.toLowerCase().includes(q) || g.away.team.toLowerCase().includes(q))
    );
  }, [games, query, league]);

  const slip = useMemo(
    () =>
      games
        .filter((g) => g.key in picks)
        .map((g) => (picks[g.key] ? g.home : g.away)),
    [games, picks]
  );

  useEffect(() => {
    if (slip.length < 2) return;
    const controller = new AbortController();
    // Short debounce: rapid taps while building a slip send one request.
    const timer = setTimeout(async () => {
      setError(null);
      try {
        const result = await getParlayRating(slip, controller.signal);
        if ("error" in result) {
          setError(result.error);
          setRating(null);
        } else {
          setError(null);
          setRating(result.rating);
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError("Couldn't reach the rating service.");
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [slip]);

  function toggle(game: Game, isHome: boolean) {
    setPicks((prev) => {
      const next = { ...prev };
      if (next[game.key] === isHome) delete next[game.key];
      else if (game.key in next || Object.keys(next).length < MAX_LEGS) next[game.key] = isHome;
      return next;
    });
  }

  // Only trust a rating that matches the current slip (it may lag a tap).
  const ratingIsCurrent =
    rating !== null &&
    rating.legs.length === slip.length &&
    rating.legs.every((l) => picks[gameKey(l)] === l.is_home);
  const shown = slip.length >= 2 && ratingIsCurrent ? rating : null;
  const payout = slip.reduce((acc, leg) => acc * leg.decimal_odds, 1);

  return (
    <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[1fr_22rem]">
      {/* Game list */}
      <div>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search teams"
            className="w-full rounded-md border border-neutral-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-brand-500 sm:flex-1 dark:border-white/10 dark:bg-ink-900"
          />
          {leagues.length > 1 && (
            <div className="no-scrollbar scroll-fade flex gap-2 overflow-x-auto" role="group" aria-label="Filter by league">
              {[{ id: null as string | null, count: games.length }, ...leagues].map((l) => {
                const active = league === l.id;
                return (
                  <button
                    key={l.id ?? "all"}
                    type="button"
                    onClick={() => setLeague(l.id)}
                    aria-pressed={active}
                    className={`eyebrow shrink-0 rounded-full px-3.5 py-2 text-[11px] whitespace-nowrap transition-colors ${
                      active
                        ? "bg-brand-600 text-white"
                        : "bg-white text-neutral-600 ring-1 ring-neutral-200 hover:text-brand-600 dark:bg-ink-900 dark:text-neutral-300 dark:ring-white/10"
                    }`}
                  >
                    {l.id ? leagueNames[l.id] ?? l.id.toUpperCase() : "All"}
                    <span className={`ml-1.5 tabular-nums ${active ? "text-white/70" : "text-neutral-400"}`}>{l.count}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {visible.length === 0 ? (
          <p className="text-sm text-neutral-500">No upcoming priced games match.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {visible.map((game) => (
              <li key={game.key} className="rounded-lg bg-white p-3 shadow-sm ring-1 ring-neutral-200/70 dark:bg-ink-900 dark:ring-white/10">
                <div className="mb-2 flex items-center justify-between text-[11px] font-semibold tracking-wide text-neutral-500 uppercase">
                  <span className="flex items-center gap-2" suppressHydrationWarning>
                    {game.home.early && <EarlyTag />}
                    {new Date(game.game_date).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  </span>
                  <span>{game.sport.toUpperCase()}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[game.away, game.home].map((leg) => {
                    const selected = picks[game.key] === leg.is_home;
                    return (
                      <button
                        key={String(leg.is_home)}
                        type="button"
                        onClick={() => toggle(game, leg.is_home)}
                        aria-pressed={selected}
                        className={`flex min-w-0 items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors ${
                          selected
                            ? "bg-brand-600 text-white"
                            : "bg-neutral-50 hover:bg-neutral-100 dark:bg-white/5 dark:hover:bg-white/10"
                        }`}
                      >
                        <Logo src={logos[leg.sport]?.[leg.team]} team={leg.team} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">
                            {leg.is_home ? "" : "@ "}
                            {leg.team}
                          </span>
                          <span className={`block text-[11px] tabular-nums ${selected ? "text-white/80" : "text-neutral-500"}`}>
                            Model {Math.round(leg.model_probability * 100)}%
                          </span>
                        </span>
                        <span className="shrink-0 text-sm font-bold tabular-nums">{formatAmerican(leg.american_odds)}</span>
                      </button>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Slip + rating */}
      <aside id="slip" className="scroll-mt-24 lg:sticky lg:top-28">
        <div className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-neutral-200/70 dark:bg-ink-900 dark:ring-white/10">
          <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3 dark:border-white/5">
            <h3 className="display text-xl">Your parlay</h3>
            {slip.length > 0 && (
              <button type="button" onClick={() => setPicks({})} className="eyebrow text-[11px] text-neutral-500 hover:text-brand-600">
                Clear
              </button>
            )}
          </div>

          {slip.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-neutral-500">
              Tap a team in any game to add it. Pick at least two to get a rating.
            </p>
          ) : (
            <>
              <ul className="px-5">
                {slip.map((leg) => {
                  const rated = shown?.legs.find((l) => gameKey(l) === gameKey(leg));
                  return (
                    <li key={gameKey(leg)} className="flex items-center gap-3 border-b border-neutral-100 py-2.5 last:border-0 dark:border-white/5">
                      <Logo src={logos[leg.sport]?.[leg.team]} team={leg.team} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-semibold">{leg.team}</span>
                          {leg.early && <EarlyTag />}
                        </div>
                        <div className="truncate text-[11px] text-neutral-500">
                          {leg.is_home ? "vs" : "@"} {leg.opponent}
                          {rated && (
                            <span className={`ml-1.5 font-semibold ${VERDICT_STYLE[rated.verdict].className}`}>
                              · {VERDICT_STYLE[rated.verdict].label}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-sm font-bold tabular-nums">{formatAmerican(leg.american_odds)}</span>
                      <button
                        type="button"
                        onClick={() => setPicks((prev) => {
                          const next = { ...prev };
                          delete next[gameKey(leg)];
                          return next;
                        })}
                        aria-label={`Remove ${leg.team}`}
                        className="text-neutral-400 hover:text-brand-600"
                      >
                        ×
                      </button>
                    </li>
                  );
                })}
              </ul>

              <div className="border-t border-neutral-100 px-5 py-4 dark:border-white/5">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-neutral-500">
                    ${STAKE} pays{" "}
                    <span className="font-semibold text-neutral-900 dark:text-white">
                      ${(STAKE * payout).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </span>
                  <span className="display text-2xl tabular-nums">{slip.length >= 2 ? formatAmerican(americanFromDecimal(payout)) : "—"}</span>
                </div>

                {slip.length < 2 ? (
                  <p className="mt-3 text-sm text-neutral-500">Add one more game to get a rating.</p>
                ) : error ? (
                  <p className="mt-3 text-sm text-brand-600 dark:text-brand-400">{error}</p>
                ) : !shown ? (
                  <p className="mt-3 animate-pulse text-sm text-neutral-500">Rating…</p>
                ) : (
                  <div className="mt-4 flex flex-col gap-3">
                    <div className="flex items-center gap-4">
                      <span className={`display flex h-16 w-16 shrink-0 items-center justify-center rounded-lg text-5xl ${GRADE_STYLE[shown.grade]}`}>
                        {shown.grade}
                      </span>
                      <div>
                        <div className="text-sm font-semibold">{shown.score}/100</div>
                        <p className="text-xs leading-relaxed text-neutral-500">{shown.summary}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 rounded-md bg-neutral-50 py-2.5 text-center dark:bg-white/5">
                      <div>
                        <div className="text-sm font-bold tabular-nums">{Math.round(shown.hit_probability * 1000) / 10}%</div>
                        <div className="text-[10px] text-neutral-500">Model: hits</div>
                      </div>
                      <div>
                        <div className="text-sm font-bold tabular-nums">{Math.round(shown.market_hit_probability * 1000) / 10}%</div>
                        <div className="text-[10px] text-neutral-500">Market: hits</div>
                      </div>
                      <div>
                        <div
                          className={`text-sm font-bold tabular-nums ${
                            shown.expected_return >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-brand-600 dark:text-brand-400"
                          }`}
                        >
                          {shown.expected_return >= 0 ? "+" : ""}
                          {Math.round(shown.expected_return * 100)}%
                        </div>
                        <div className="text-[10px] text-neutral-500">Exp. return</div>
                      </div>
                    </div>
                    {shown.weakest_leg && (
                      <p className="text-xs text-neutral-500">
                        Weakest leg: <span className="font-semibold text-neutral-800 dark:text-neutral-200">{shown.weakest_leg.team}</span>{" "}
                        (model {Math.round(shown.weakest_leg.model_probability * 100)}% vs. market{" "}
                        {Math.round(shown.weakest_leg.market_probability * 100)}%). Swapping it out would raise the grade.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </aside>

      {/* Phone: a pinned bar so the slip's grade is visible while scrolling the list. */}
      {slip.length > 0 && (
        <a
          href="#slip"
          className="fixed inset-x-4 bottom-4 z-30 flex items-center justify-between rounded-full bg-ink-950 px-5 py-3 text-white shadow-2xl ring-1 ring-white/10 lg:hidden"
        >
          <span className="text-sm font-semibold">
            {slip.length} leg{slip.length === 1 ? "" : "s"}
            {shown && <span className="ml-2 rounded-sm bg-white/15 px-1.5 py-0.5 text-xs">Grade {shown.grade}</span>}
          </span>
          <span className="eyebrow text-xs text-brand-400">View slip ›</span>
        </a>
      )}
    </div>
  );
}
