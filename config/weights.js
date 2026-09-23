// Scoring knobs. Tune after seeing real output; logic reads from here.
export const weights = {
  // Final rank = baseScore * (floor + (1 - floor) * eligibilityConfidence).
  // Eligibility can't zero a job out, but it heavily reorders the list so a
  // great-fit role that won't hire in Algeria can't top it.
  eligibilityFloor: 0.4,

  // eligibilityConfidence at/above this lands a full-time remote job in Tier 1.
  tier1MinEligibility: 0.6,

  // Only spend tokens drafting outreach for a Tier 2 / Freelance row at/above
  // this final score (Tier 1 always gets a draft).
  draftScoreThreshold: 55,
};
