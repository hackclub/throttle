import path from "node:path";

// Arbitrary but fixed: every Throttle server agrees on the same lock.
const MIGRATION_LOCK = 7_227_001;

/**
 * Applies pending migrations from ./drizzle. Holds a Postgres advisory lock
 * so several replicas starting together migrate one at a time. Use a direct
 * (not transaction-pooled) URL, since session locks don't survive a pooler.
 */
export async function runMigrations(url: string): Promise<void> {
  const { default: postgres } = await import("postgres");
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const { migrate } = await import("drizzle-orm/postgres-js/migrator");

  const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
  try {
    await sql`select pg_advisory_lock(${MIGRATION_LOCK})`;
    await migrate(drizzle({ client: sql }), {
      migrationsFolder: path.join(process.cwd(), "drizzle"),
    });
  } finally {
    await sql`select pg_advisory_unlock(${MIGRATION_LOCK})`.catch(() => {});
    await sql.end({ timeout: 5 });
  }
}
