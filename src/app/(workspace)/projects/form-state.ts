// Shared between the server actions and the client forms. Kept out of
// actions.ts because a "use server" file may only export async functions.

export type FieldErrors = Partial<Record<string, string>>;

export type CreateProjectState = {
  error?: string;
  fieldErrors?: FieldErrors;
};

export type LogEntryState = {
  error?: string;
  fieldErrors?: FieldErrors;
  /** id of the last saved entry; the composer remounts (clears) when it changes. */
  savedId?: string;
};

export const MIN_BODY_CHARS = 50;
export const MAX_BODY_CHARS = 20_000;
export const MAX_PITCH_CHARS = 280;
export const MIN_PHOTOS = 1;
export const MAX_PHOTOS = 6;
export const MIN_ENTRY_MINUTES = 15;
export const MINUTE_STEPS = [0, 15, 30, 45] as const;
