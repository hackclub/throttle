// Shared between the role action and the inline select. Kept out of
// actions.ts because a "use server" file may only export async functions.

export const ROLES = ["maker", "reviewer", "admin"] as const;
export type Role = (typeof ROLES)[number];

export type RoleState = { error?: string; saved?: boolean };
