// Browser port of src/parlay.py's rate_parlay (and american_odds), so the
// static site can grade a user-built parlay without a server. Python is the
// reference: tests/test_parlay_js_parity.py runs this file under Node against
// the Python implementation on the same slips and fails on any difference.
// Plain JS (with parlayRating.d.ts for types) so that test can import it
// with no build step.

export const MAX_EDGE = 0.15;
export const MIN_RATED_LEGS = 2;
export const MAX_RATED_LEGS = 12;
const FAIR_BAND = 0.01;
const SCORE_SCALE = 0.35;
const OVERPRICED_PENALTY = 6;
const SUSPECT_PENALTY = 4;
const GRADES = [
  [80, "A"],
  [65, "B"],
  [50, "C"],
  [35, "D"],
  [0, "F"],
];

// Python's round(): halves go to the even neighbour (round(2.5) == 2), unlike
// Math.round. Matters at exact .5 boundaries for score and odds parity.
function pyRound(x) {
  const floor = Math.floor(x);
  const diff = x - floor;
  if (Math.abs(diff - 0.5) < 1e-9) return floor % 2 === 0 ? floor : floor + 1;
  return Math.round(x);
}

export function americanOdds(decimalOdds) {
  if (decimalOdds >= 2) return pyRound((decimalOdds - 1) * 100);
  return -pyRound(100 / (decimalOdds - 1));
}

export function legVerdict(leg) {
  if (Math.abs(leg.edge) > MAX_EDGE) return "suspect";
  if (leg.edge >= FAIR_BAND) return "value";
  if (leg.edge <= -FAIR_BAND) return "overpriced";
  return "fair";
}

const prod = (xs) => xs.reduce((a, b) => a * b, 1);

export function rateParlay(legs) {
  const keys = legs.map((l) => `${l.sport}:${l.game_id}`);
  if (new Set(keys).size !== keys.length) {
    throw new Error("A parlay can't include both sides, or the same game twice.");
  }
  if (legs.length < MIN_RATED_LEGS || legs.length > MAX_RATED_LEGS) {
    throw new Error(`Pick between ${MIN_RATED_LEGS} and ${MAX_RATED_LEGS} legs.`);
  }

  const rated = legs.map((leg) => {
    const verdict = legVerdict(leg);
    const trusted = verdict === "suspect" ? leg.market_probability : leg.model_probability;
    return { ...leg, verdict, trusted_probability: trusted };
  });

  const hit = prod(rated.map((l) => l.trusted_probability));
  const payout = prod(rated.map((l) => l.decimal_odds));
  const marketHit = prod(rated.map((l) => l.market_probability));
  const expectedReturn = hit * payout - 1;
  const counts = { value: 0, fair: 0, overpriced: 0, suspect: 0 };
  for (const l of rated) counts[l.verdict] += 1;

  let score = 50 + 45 * Math.tanh(Math.log(1 + expectedReturn) / SCORE_SCALE);
  score -= OVERPRICED_PENALTY * counts.overpriced + SUSPECT_PENALTY * counts.suspect;
  score = Math.max(0, Math.min(100, pyRound(score)));
  const grade = GRADES.find(([floor]) => score >= floor)[1];

  // First minimum wins, like Python's min().
  let weakest = rated[0];
  for (const l of rated) {
    if (l.trusted_probability - l.market_probability < weakest.trusted_probability - weakest.market_probability) weakest = l;
  }

  let summary;
  if (expectedReturn >= 0.15 && !counts.overpriced) {
    summary = "Strong parlay: every leg is priced at or below what the model thinks it's worth.";
  } else if (expectedReturn >= 0) {
    summary = "Decent parlay: the model expects it to pay back a little more than it costs.";
  } else if (counts.overpriced) {
    summary =
      `The market prices ${counts.overpriced} of your ${rated.length} legs higher than the model does, ` +
      "so the model expects this to lose money.";
  } else {
    summary = "The model expects this to pay back less than it costs.";
  }

  return {
    score,
    grade,
    summary,
    legs: rated,
    hit_probability: hit,
    market_hit_probability: marketHit,
    decimal_odds: payout,
    american_odds: americanOdds(payout),
    expected_return: expectedReturn,
    counts,
    weakest_leg:
      weakest.trusted_probability >= weakest.market_probability
        ? null
        : {
            team: weakest.team,
            verdict: weakest.verdict,
            model_probability: weakest.model_probability,
            market_probability: weakest.market_probability,
          },
  };
}
