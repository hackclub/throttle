import path from "node:path";

// Arbitrary but fixed: every Throttle server agrees on the same lock.
const MIGRATION_LOCK = 7_227_001;
const LOCK_WAIT_MS = 60_000;

/**
 * Applies pending migrations from ./drizzle. Takes a Postgres advisory lock so
 * several replicas starting together migrate one at a time.
 *
 * The lock is best-effort: behind a transaction pooler a session lock can be
 * left on a pooled connection, so we never wait forever. After LOCK_WAIT_MS we
 * migrate anyway; already-applied migrations are skipped. Point
 * MIGRATE_DATABASE_URL at the direct (unpooled) host to keep the lock reliable.
 */
export async function runMigrations(url: string): Promise<void> {
  const { default: postgres } = await import("postgres");
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const { migrate } = await import("drizzle-orm/postgres-js/migrator");

  const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
  let locked = false;
  try {
    const deadline = Date.now() + LOCK_WAIT_MS;
    while (!locked) {
      const [row] = await sql<{ ok: boolean }[]>`select pg_try_advisory_lock(${MIGRATION_LOCK}) as ok`;
      locked = row?.ok === true;
      if (locked || Date.now() > deadline) break;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    if (!locked) {
      console.warn("[db] couldn't get the migration lock within 60s; migrating without it");
    }

    await migrate(drizzle({ client: sql }), {
      migrationsFolder: path.join(process.cwd(), "drizzle"),
    });
  } finally {
    if (locked) await sql`select pg_advisory_unlock(${MIGRATION_LOCK})`.catch(() => {});
    await sql.end({ timeout: 5 });
  }
}
