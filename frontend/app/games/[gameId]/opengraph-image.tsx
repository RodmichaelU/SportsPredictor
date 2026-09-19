import { ImageResponse } from "next/og";
import { getExplanation, getSports, getTeamLogos } from "@/lib/api";
import { Explanation } from "@/lib/types";

export const alt = "Game prediction";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The page itself gets its sport from a ?sport= query param, but
// opengraph-image files only ever receive route params, never the query
// string (see Next's opengraph-image docs) -- so a shared game id has to be
// resolved by trying each live sport's /explain in turn instead. Cheap: only
// cfb and nfl have real predictions right now, so this is at most two calls.
async function loadGame(gameId: string): Promise<{ sport: string; data: Explanation; logos: Record<string, string> } | null> {
  const sports = await getSports();
  for (const sport of sports.filter((s) => s.status === "live")) {
    try {
      const data = await getExplanation(sport.id, gameId);
      const logos = await getTeamLogos(sport.id);
      return { sport: sport.id, data, logos };
    } catch {
      continue;
    }
  }
  return null;
}

function TeamColumn({ name, logo, pct, highlight }: { name: string; logo?: string; pct: number; highlight: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 320 }}>
      {logo ? (
        <img
          src={logo}
          alt={name}
          width={140}
          height={140}
          style={{ borderRadius: "50%", background: "white", border: "3px solid #e5e7eb" }}
        />
      ) : (
        <div
          style={{
            width: 140,
            height: 140,
            borderRadius: "50%",
            background: "#e0e7ff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 48,
            fontWeight: 700,
            color: "#4338ca",
          }}
        >
          {name.slice(0, 2).toUpperCase()}
        </div>
      )}
      <div
        style={{
          display: "flex",
          marginTop: 20,
          fontSize: 30,
          fontWeight: highlight ? 800 : 500,
          color: highlight ? "#1e1b4b" : "#6b7280",
          textAlign: "center",
        }}
      >
        {name}
      </div>
      <div
        style={{
          display: "flex",
          marginTop: 6,
          fontSize: 44,
          fontWeight: 800,
          color: highlight ? "#4f46e5" : "#9ca3af",
        }}
      >
        {pct}%
      </div>
    </div>
  );
}

function FallbackImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg,#eef2ff,#f5f3ff)",
          fontSize: 56,
          fontWeight: 800,
          color: "#4338ca",
        }}
      >
        Sports Predictor
      </div>
    ),
    size
  );
}

export default async function Image({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params;
  const result = await loadGame(gameId);
  if (!result) return FallbackImage();

  const { data, logos } = result;
  const homePct = Math.round(data.win_probability * 100);
  const awayPct = 100 - homePct;
  const homeIsPick = data.predicted_winner === data.home_team;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(135deg,#eef2ff,#ffffff)",
          padding: "56px 64px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: "linear-gradient(135deg,#6366f1,#7c3aed)",
            }}
          />
          <div style={{ fontSize: 26, fontWeight: 700, color: "#111827" }}>Sports Predictor</div>
        </div>

        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 64 }}>
          <TeamColumn name={data.away_team} logo={logos[data.away_team]} pct={awayPct} highlight={!homeIsPick} />
          <div style={{ display: "flex", fontSize: 34, color: "#c7c9d1", fontWeight: 700 }}>@</div>
          <TeamColumn name={data.home_team} logo={logos[data.home_team]} pct={homePct} highlight={homeIsPick} />
        </div>

        <div style={{ display: "flex", justifyContent: "center" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 28px",
              borderRadius: 999,
              background: "#4f46e5",
              color: "white",
              fontSize: 26,
              fontWeight: 700,
            }}
          >
            {data.predicted_winner} favored to win
          </div>
        </div>
      </div>
    ),
    size
  );
}
