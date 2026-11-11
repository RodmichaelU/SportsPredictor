// Every internal URL, in one place. The static site uses path segments
// (/predictions/nfl/) rather than query strings (?sport=nfl), since each
// page is pre-built as its own file. Trailing slashes match next.config's
// trailingSlash, so each path maps to a directory's index.html on static hosts.

export const predictionsPath = (sport: string) => `/predictions/${sport}/`;
export const resultsPath = (sport: string) => `/results/${sport}/`;
export const standingsPath = (sport: string) => `/standings/${sport}/`;
export const teamsPath = (sport: string) => `/teams/${sport}/`;
export const modelPath = (sport: string) => `/model/${sport}/`;
export const gamePath = (sport: string, gameId: string) => `/games/${sport}/${gameId}/`;
// Team pages are keyed by the exporter's URL slug (lib/api.ts getTeamSlugs).
export const teamPath = (sport: string, slug: string) => `/teams/${sport}/${slug}/`;
export const parlaysPath = (sport?: string | null) => (sport ? `/parlays/${sport}/` : "/parlays/");

// The section tabs shown under the league nav, in order.
export const SECTIONS = ["predictions", "results", "standings", "teams", "model"] as const;
export type Section = (typeof SECTIONS)[number];

// "/results/nfl/" -> { section: "results", sport: "nfl" }; also understands
// game and team pages, so the nav can highlight the right league anywhere.
export function parsePath(pathname: string): { section: string | null; sport: string | null } {
  const [section, sport] = pathname.split("/").filter(Boolean);
  return { section: section ?? null, sport: sport ?? null };
}
