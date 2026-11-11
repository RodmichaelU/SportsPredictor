import { LegVerdict, ParlayLeg, ParlayRating } from "./types";

export const MAX_EDGE: number;
export const MIN_RATED_LEGS: number;
export const MAX_RATED_LEGS: number;
export function americanOdds(decimalOdds: number): number;
export function legVerdict(leg: Pick<ParlayLeg, "edge">): LegVerdict;
/** Throws on an invalid slip (fewer than 2 / more than 12 legs, or a repeated game). */
export function rateParlay(legs: ParlayLeg[]): ParlayRating;
