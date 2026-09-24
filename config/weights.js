// Scoring knobs. Tune after seeing real output; logic reads from here.
export const weights = {
  // Final rank = baseScore * (floor + (1 - floor) * eligibilityConfidence).
  // Eligibility can't zero a job out, but it heavily reorders the list so a
  // great-fit role that won't hire in Algeria can't top it.
  eligibilityFloor: 0.4,

  // eligibilityConfidence at/above this lands a full-time remote job in Tier 1.
  tier1MinEligibility: 0.6,

  // Only spend tokens drafting outreach for a row at/above this final score.
  draftScoreThreshold: 55,

  // COST GUARDRAILS (keep these low while validating the strategy).
  // Hard cap on how many jobs get sent to the paid scoring stage per run.
  // A cheap code ranker picks the most promising this-many; the rest are skipped.
  maxScored: 15,
  // At most this many of the scored jobs get a drafted DM + letter (the pricier
  // stage). Set to 0 (or run with --no-draft) to skip drafting entirely.
  draftTopN: 5,
};
