// Mastery thresholds. These are initial heuristics chosen for the MVP — they are NOT
// scientifically validated mastery boundaries. Change them here; tests cover the boundaries.
export interface MasteryConfig {
  weakBelow: number; // accuracy < weakBelow => weak
  strongAtOrAbove: number; // accuracy >= strongAtOrAbove => strong
  minEvidence: number; // evaluated answers needed before any label is assigned
  recentWindow: number; // label uses the most recent N answers per topic, so improvement shows up
  correctThreshold: number; // partial-credit score at/above which an answer counts as correct
}

export const DEFAULT_MASTERY_CONFIG: MasteryConfig = {
  weakBelow: 0.5,
  strongAtOrAbove: 0.8,
  minEvidence: 3,
  recentWindow: 6,
  correctThreshold: 0.7,
};
