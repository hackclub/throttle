// Shared between the submit actions and the client forms. Kept out of
// actions.ts because a "use server" file may only export async functions.
import type { DesignSubmissionData } from "@/lib/db/schema";

export type FieldErrors = Partial<Record<string, string>>;

export type SubmitState = {
  error?: string;
  fieldErrors?: FieldErrors;
};

export type PledgeKey = keyof DesignSubmissionData["pledges"];

export const PLEDGES: { key: PledgeKey; text: string }[] = [
  {
    key: "lipo",
    text: "I charge and store LiPo batteries in a fireproof bag and never leave them charging unattended.",
  },
  {
    key: "props",
    text: "I take props off when working on the aircraft with power connected, and keep hands and faces clear of the prop arc.",
  },
  {
    key: "airspace",
    text: "I follow my local rules for flying, including registration, height limits and no-fly zones.",
  },
  {
    key: "people",
    text: "I won't fly over people, roads or airports.",
  },
];

export const MIN_WEIGHT_GRAMS = 1;
export const MAX_WEIGHT_GRAMS = 25_000;
export const MAX_SPEC_CHARS = 200;
export const MAX_NOTES_CHARS = 2_000;
export const MIN_LEARNED_CHARS = 100;
export const MAX_LEARNED_CHARS = 5_000;
