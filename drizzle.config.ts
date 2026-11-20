import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { defineConfig } from "drizzle-kit";

// drizzle-kit doesn't read Next's env files on its own.
for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) loadEnvFile(file);
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
