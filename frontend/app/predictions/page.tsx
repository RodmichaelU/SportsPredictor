import { getSports } from "@/lib/api";
import SportPage from "./[sport]/page";

// /predictions/ shows the default league -- the same page as /predictions/<first league>/.
export default async function Page() {
  const sports = await getSports();
  return <SportPage params={Promise.resolve({ sport: sports[0]?.id ?? "cfb" })} searchParams={Promise.resolve({})} />;
}
