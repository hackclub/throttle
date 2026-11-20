import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { sessions, users, type User } from "@/lib/db/schema";
import { randomToken, sha256Hex } from "./crypto";

export const SESSION_COOKIE = "throttle_session";
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

/** Must run in a Server Action or Route Handler (it sets a cookie). */
export async function createSession(userId: string): Promise<void> {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_MS);
  const db = await getDb();

  await db.insert(sessions).values({ id: sha256Hex(token), userId, expiresAt });
  // Opportunistic cleanup so the table doesn't grow forever.
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

/**
 * Reads the session cookie, so any component calling this must sit inside a
 * <Suspense> boundary. Deduplicated per request.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  // The DB drivers read the clock internally, which runtime prefetching
  // rejects; opt this lookup into request time.
  await connection();

  const db = await getDb();
  const [row] = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      // DB clock, not `new Date()`: render-time Date is disallowed under prefetching.
      and(eq(sessions.id, sha256Hex(token)), gt(sessions.expiresAt, sql`now()`)),
    )
    .limit(1);

  return row?.user ?? null;
});

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  return user;
}

export function isReviewer(user: Pick<User, "role">): boolean {
  return user.role === "reviewer" || user.role === "admin";
}

// 404 rather than a sign-in prompt so the review area isn't advertised.
export async function requireReviewer(): Promise<User> {
  const user = await getCurrentUser();
  if (!user || !isReviewer(user)) notFound();
  return user;
}

/** Admin-only actions (role changes). Same 404 as requireReviewer. */
export async function requireAdmin(): Promise<User> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") notFound();
  return user;
}

/** Must run in a Server Action or Route Handler (it deletes a cookie). */
export async function signOut(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    const db = await getDb();
    await db.delete(sessions).where(eq(sessions.id, sha256Hex(token)));
  }
  store.delete(SESSION_COOKIE);
}
