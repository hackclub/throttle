// Shared between the review actions and the decision panel. Kept out of
// actions.ts because a "use server" file may only export async functions.

export type DecideState = {
  error?: string;
  fieldErrors?: Partial<Record<"hoursOverride" | "tier" | "justification" | "feedback", string>>;
};

export const MIN_JUSTIFICATION_CHARS = 20;
export const MAX_REVIEW_TEXT_CHARS = 5_000;
export const MAX_OVERRIDE_HOURS = 500;

export const RESULTS = ["approved", "returned", "rejected"] as const;
export type ReviewResult = (typeof RESULTS)[number];
