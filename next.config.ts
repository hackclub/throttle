import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // PGlite loads its wasm/data files from its own package dir at runtime.
  serverExternalPackages: ["@electric-sql/pglite"],
  // Docs pages read their markdown from disk at runtime.
  outputFileTracingIncludes: {
    "/docs/[[...slug]]": ["./src/content/docs/**/*"],
  },
  experimental: {
    serverActions: {
      // Files never go through actions: the browser uploads them first via
      // /api/upload (a presigned PUT to R2 in production) and actions only get URLs.
      bodySizeLimit: "2mb",
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
