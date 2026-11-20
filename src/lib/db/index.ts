import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

// Shared surface of the neon-http and pglite drivers. neon-http has no
// transactions, so stick to single statements (or db.batch on Neon only).
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

// Kept on globalThis so dev hot reloads reuse one PGlite instance instead of
// fighting over the data dir lock.
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
  if (url) {
    const { neon } = await import("@neondatabase/serverless");
    const { drizzle } = await import("drizzle-orm/neon-http");
    return drizzle({ client: neon(url), schema }) as unknown as Db;
  }
  return connectLocal();
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
