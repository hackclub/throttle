// Runs once when the server starts. On long-running hosts (Coolify, Orchard,
// Docker) set MIGRATE_ON_START=true so new tables are created on deploy.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.MIGRATE_ON_START !== "true") return;

  const url = process.env.MIGRATE_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) {
    console.warn("[db] MIGRATE_ON_START is set but DATABASE_URL is empty; skipping migrations");
    return;
  }

  const { runMigrations } = await import("./lib/db/migrate");
  try {
    await runMigrations(url);
    console.log("[db] migrations up to date");
  } catch (err) {
    // Fail the boot so the deploy shows as broken instead of half-working.
    console.error("[db] migrations failed", err);
    throw err;
  }
}
