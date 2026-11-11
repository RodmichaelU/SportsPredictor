// A league's name for tight rows: the short code on phones ("CFB"), the full
// name from sm up ("College Football"), so a nav or chip row fits on one line.
export default function LeagueName({ sport }: { sport: { id: string; name: string } }) {
  return (
    <>
      <span className="sm:hidden">{sport.id.toUpperCase()}</span>
      <span className="hidden sm:inline">{sport.name}</span>
    </>
  );
}
