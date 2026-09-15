// Deterministic color + initials per team, so every team reads consistently
// across the app without needing real logo assets (licensing, asset
// management) for ~270 college football teams plus NFL/NBA/NHL down the line.
const PALETTE = [
  "bg-rose-500", "bg-orange-500", "bg-amber-500", "bg-lime-600",
  "bg-emerald-500", "bg-teal-500", "bg-cyan-600", "bg-blue-500",
  "bg-violet-500", "bg-fuchsia-500", "bg-pink-500", "bg-indigo-500",
];

function hashString(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash << 5) - hash + s.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function initials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

const SIZES = {
  sm: "h-6 w-6 text-[10px]",
  md: "h-9 w-9 text-xs",
  lg: "h-12 w-12 text-sm",
};

export default function TeamBadge({ team, size = "md" }: { team: string; size?: keyof typeof SIZES }) {
  const color = PALETTE[hashString(team) % PALETTE.length];
  return (
    <span
      className={`inline-flex ${SIZES[size]} shrink-0 items-center justify-center rounded-full ${color} font-bold text-white`}
    >
      {initials(team)}
    </span>
  );
}
