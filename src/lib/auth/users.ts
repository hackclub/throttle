import "server-only";
import { eq, type SQL } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users, type User } from "@/lib/db/schema";

type Role = User["role"];

export type SignInProfile = {
  email: string;
  name?: string | null;
  hcaId?: string | null;
  slackId?: string | null;
  avatarUrl?: string | null;
  /** Forces a role (dev shortcut only). Otherwise env lists decide. */
  role?: Role;
};

function emailList(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** Role granted by REVIEWER_EMAILS / ADMIN_EMAILS, or null to keep the current one. */
export function roleFromEnv(email: string): Role | null {
  const e = email.toLowerCase();
  if (emailList(process.env.ADMIN_EMAILS).has(e)) return "admin";
  if (emailList(process.env.REVIEWER_EMAILS).has(e)) return "reviewer";
  return null;
}

async function findUser(by: SQL): Promise<User | undefined> {
  const db = await getDb();
  const [user] = await db.select().from(users).where(by).limit(1);
  return user;
}

/** Called on every sign-in: matches by Hack Club id first, then by email. */
export async function upsertUser(profile: SignInProfile): Promise<User> {
  const email = profile.email.trim().toLowerCase();
  const role = profile.role ?? roleFromEnv(email);
  const db = await getDb();

  const byHca = profile.hcaId
    ? await findUser(eq(users.hcaId, profile.hcaId))
    : undefined;
  const existing = byHca ?? (await findUser(eq(users.email, email)));

  if (existing) {
    const [updated] = await db
      .update(users)
      .set({
        // Only overwrite with values the provider actually sent.
        ...(profile.name ? { name: profile.name } : {}),
        ...(profile.hcaId ? { hcaId: profile.hcaId } : {}),
        ...(profile.slackId ? { slackId: profile.slackId } : {}),
        ...(profile.avatarUrl ? { avatarUrl: profile.avatarUrl } : {}),
        ...(role ? { role } : {}),
      })
      .where(eq(users.id, existing.id))
      .returning();
    return updated;
  }

  const values = {
    email,
    name: profile.name || email.split("@")[0],
    hcaId: profile.hcaId ?? null,
    slackId: profile.slackId ?? null,
    avatarUrl: profile.avatarUrl ?? null,
    role: role ?? "maker",
  };
  // Two first-time sign-ins racing on the same email both end up with one row.
  const [created] = await db
    .insert(users)
    .values(values)
    .onConflictDoUpdate({ target: users.email, set: { email } })
    .returning();
  return created;
}
