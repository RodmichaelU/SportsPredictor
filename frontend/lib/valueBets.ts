import { Prediction } from "./types";

// A Kalshi contract on a side costs (roughly) that side's implied
// probability and pays $1 if it wins -- so if our model's probability for
// that side is right, expected value per dollar risked is
// (modelProb - marketProb) / marketProb. That reward-relative-to-risk
// framing is what actually finds value: a 5-point edge on a market-priced
// 10% longshot is a much bigger opportunity than the same 5 points on a 90%
// favorite, even though the raw probability gap looks identical.
export interface ValueBet {
  prediction: Prediction;
  team: string; // the side with the positive edge
  modelProb: number; // our model's probability for that side
  marketProb: number; // the market's implied probability (== the cost) for that side
  edgePts: number; // modelProb - marketProb, always >= 0 by construction
  roi: number; // edgePts / marketProb -- expected return per dollar risked, if the model is right
}

// ROI is a ratio, so it blows up near a market price of 0: a 1-point
// disagreement on a contract priced at 1% already reads as "+100% value"
// even though that's noise, not a real edge -- both models and markets are
// least reliable exactly at the extremes. Two guards keep the ranking
// honest: a floor under how cheap the side being backed can be (so the ROI
// denominator can't collapse toward zero), and a minimum raw edge (so a
// technically-positive but trivial disagreement can't reach the list at
// all, regardless of how it ratios out).
const MIN_MARKET_PROB = 0.05;
const MIN_EDGE_PTS = 0.03;

export function computeValueBet(p: Prediction): ValueBet | null {
  if (p.market_home_probability === null) return null;

  const homeEdge = p.win_probability - p.market_home_probability;
  const backHome = homeEdge >= 0;

  const modelProb = backHome ? p.win_probability : 1 - p.win_probability;
  const marketProb = backHome ? p.market_home_probability : 1 - p.market_home_probability;
  const team = backHome ? p.home_team : p.away_team;
  const edgePts = modelProb - marketProb;

  if (marketProb < MIN_MARKET_PROB || edgePts < MIN_EDGE_PTS) return null;

  return { prediction: p, team, modelProb, marketProb, edgePts, roi: edgePts / marketProb };
}

// Ranked by ROI (biggest expected return per dollar risked), not raw
// probability gap -- see computeValueBet for why those aren't the same
// ranking, and for the noise filters applied before ROI is even computed.
export function rankByValue(predictions: Prediction[]): ValueBet[] {
  return predictions
    .map(computeValueBet)
    .filter((v): v is ValueBet => v !== null)
    .sort((a, b) => b.roi - a.roi);
}
