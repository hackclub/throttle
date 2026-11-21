# Throttle

**Build anything that can fly. We fund it.** A Hack Club You Ship, We Ship program for teens 13–18.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000. Nothing else is needed locally: the database is an embedded Postgres in `.data/pglite` and uploads go to `public/uploads`.

To sign in without Hack Club Auth, open one of these while `npm run dev` is running (they 404 in production):

- http://localhost:3000/api/auth/dev?as=maker
- http://localhost:3000/api/auth/dev?as=reviewer
- http://localhost:3000/api/auth/dev?as=admin

## What's here

- `src/app/page.tsx`: landing page (sky hero, how it works, tiers, safety, FAQ)
- `src/app/(workspace)/`: Hangar, projects and flight log, submissions, docs, and the staff panel at `/admin`
- `src/lib/db/`: Drizzle schema and connection; migrations live in `drizzle/`
- `src/lib/tiers.ts`: grant and fuel maths
- `ART_NEEDED.md`: illustrations still to draw

## Database

Any Postgres works (Neon, Supabase, or a database on Coolify or Orchard). Set `DATABASE_URL` to its connection string.

- After changing `src/lib/db/schema.ts`, run `npm run db:generate` and commit the new file in `drizzle/`.
- To apply migrations by hand: `DATABASE_URL=... npm run db:migrate`.
- With `MIGRATE_ON_START=true` the server applies them itself on boot (the Dockerfile turns this on). If your `DATABASE_URL` goes through a transaction pooler, also set `MIGRATE_DATABASE_URL` to the direct connection.

## Deploying

Every host needs the same variables (see `.env.example`): `DATABASE_URL`, `APP_URL`, `HCA_CLIENT_ID`, `HCA_CLIENT_SECRET`, the five `R2_*` values, and `ADMIN_EMAILS` / `REVIEWER_EMAILS`. Register `<APP_URL>/api/auth/callback` as the redirect URI in Hack Club Auth.

### Vercel

1. Import the repo. No build settings to change.
2. Create a Postgres database (Neon works well) and set `DATABASE_URL`. Use the pooled connection string.
3. Run `npm run db:migrate` once from your machine against it, and again whenever `drizzle/` changes.

### Coolify

1. New resource → your Git repo → build pack **Dockerfile**. Port `3000`.
2. Add a **PostgreSQL** database in the same project and copy its internal URL into `DATABASE_URL`.
3. Set the other variables. Mark `NEXT_PUBLIC_LAUNCHED` as a build variable, since it's baked in at build time.
4. Deploy. Migrations run on boot.

### Orchard

1. Connect the repo and deploy it with the Dockerfile. The app listens on port `3000`.
2. Add a managed Postgres to the project and use its connection string as `DATABASE_URL`.
3. Set the other variables and deploy. Migrations run on boot.

### Any Docker host

```bash
docker build -t throttle .
docker run -p 3000:3000 --env-file .env.production throttle
```

## Waitlist storage

RSVPs go to Airtable when `AIRTABLE_API_KEY` and `AIRTABLE_BASE_ID` are set (the table needs an `Email` field), otherwise to `.data/waitlist.json` locally.

## File uploads (R2)

Journal photos and flight videos go straight from the browser to a Cloudflare R2 bucket, using a presigned URL the server hands out for five minutes. Our server never sees the file, so request size limits don't matter. If the `R2_*` variables are empty, files are saved to `public/uploads` in development; in production uploads are turned off until R2 is set up.

To set it up:

1. Create an R2 bucket.
2. Make it publicly readable, either with its r2.dev URL or a custom domain, and set `R2_PUBLIC_URL` to that URL (no trailing slash).
3. Create an R2 API token with **Object Read & Write** for that bucket. Put its access key and secret in `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`, the S3 endpoint (`https://<account>.r2.cloudflarestorage.com`) in `R2_ENDPOINT`, and the bucket name in `R2_BUCKET`.
4. Add a CORS policy to the bucket so browsers are allowed to upload:

```json
[
  {
    "AllowedOrigins": ["https://throttle.hackclub.com", "http://localhost:3000"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["content-type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Add any other origin you test from, like a preview URL. Uploads from an origin that isn't listed fail with "Couldn't reach file storage".
