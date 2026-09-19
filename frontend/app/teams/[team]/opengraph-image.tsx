import { ImageResponse } from "next/og";
import { getSports, getTeam, getTeamLogos } from "@/lib/api";
import { TeamDetail } from "@/lib/types";

export const alt = "Team page";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Same constraint as games/[gameId]/opengraph-image.tsx: no searchParams
// here, so the team's sport is resolved by trying each live sport's /team
// lookup in turn rather than reading it from ?sport=.
async function loadTeam(encodedTeam: string): Promise<{ data: TeamDetail; logo?: string } | null> {
  const team = decodeURIComponent(encodedTeam);
  const sports = await getSports();
  for (const sport of sports.filter((s) => s.status === "live")) {
    try {
      const data = await getTeam(sport.id, team);
      const logos = await getTeamLogos(sport.id);
      return { data, logo: logos[team] };
    } catch {
      continue;
    }
  }
  return null;
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

export default async function Image({ params }: { params: Promise<{ team: string }> }) {
  const { team: encodedTeam } = await params;
  const result = await loadTeam(encodedTeam);
  if (!result) return FallbackImage();

  const { data, logo } = result;

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

        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 56,
          }}
        >
          {logo ? (
            <img
              src={logo}
              alt={data.team}
              width={220}
              height={220}
              style={{ borderRadius: "50%", background: "white", border: "4px solid #e5e7eb" }}
            />
          ) : (
            <div
              style={{
                width: 220,
                height: 220,
                borderRadius: "50%",
                background: "#e0e7ff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 72,
                fontWeight: 700,
                color: "#4338ca",
              }}
            >
              {data.team.slice(0, 2).toUpperCase()}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 56, fontWeight: 800, color: "#1e1b4b" }}>{data.team}</div>
            <div style={{ display: "flex", marginTop: 12, fontSize: 32, color: "#4b5563" }}>
              {data.record.wins}-{data.record.losses} this season
              {data.current_elo !== null && ` · Elo ${Math.round(data.current_elo)}`}
            </div>
          </div>
        </div>
      </div>
    ),
    size
  );
}
