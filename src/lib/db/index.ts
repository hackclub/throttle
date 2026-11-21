import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

// Shared surface of the postgres-js and pglite drivers.
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

// Kept on globalThis so dev hot reloads (and warm serverless instances) reuse
// one connection pool instead of opening a new one per request.
const g = globalThis as unknown as { __throttleDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  g.__throttleDb ??= connect().catch((err) => {
    g.__throttleDb = undefined;
    throw err;
  });
  return g.__throttleDb;
}

async function connect(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) return connectPostgres(url);

  // The local fallback stores data on disk. On Vercel that fails outright, and
  // on Coolify/Orchard containers it would silently vanish on every redeploy.
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_LOCAL_DB !== "true") {
    throw new Error(
      "DATABASE_URL is not set. Point it at a Postgres database (Neon, Coolify, Orchard, Supabase…) and redeploy.",
    );
  }
  return connectLocal();
}

/** Any standard Postgres: Neon, Supabase, or one running on Coolify/Orchard. */
async function connectPostgres(url: string): Promise<Db> {
  const { default: postgres } = await import("postgres");
  const { drizzle } = await import("drizzle-orm/postgres-js");

  const client = postgres(url, {
    // Serverless functions get one connection each; long-running servers pool.
    max: Number(process.env.DB_POOL_MAX) || (process.env.VERCEL ? 1 : 10),
    // Works behind transaction-mode poolers (Neon pooled URLs, PgBouncer, Supavisor).
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 10,
    onnotice: () => {},
  });
  return drizzle({ client, schema }) as unknown as Db;
}

async function connectLocal(): Promise<Db> {
  const path = await import("node:path");
  const { mkdir } = await import("node:fs/promises");
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");

  const dataDir = path.join(process.cwd(), ".data", "pglite");
  await mkdir(dataDir, { recursive: true });

  const db = drizzle({ client: new PGlite(dataDir), schema });
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  return db as unknown as Db;
}

export { schema };
