import { pickConfidence } from "./format";
import { Result } from "./types";

// The mirror image of lib/valueBets.ts's "best value" ranking, applied
// after the fact instead of before kickoff: games the model was most
// confidently wrong about. Ranking by confidence (not margin or anything
// else) is what actually captures "upset" -- a 51% pick that loses isn't
// surprising, a 95% pick that loses is.
export interface Upset {
  result: Result;
  confidence: number; // the model's confidence in its (wrong) predicted winner, 0-1
}

export function rankByUpset(results: Result[]): Upset[] {
  return results
    .filter((r) => !r.hit)
    .map((r) => ({ result: r, confidence: pickConfidence(r) }))
    .sort((a, b) => b.confidence - a.confidence);
}
