# Throttle

**Build anything that can fly. We fund it.** A Hack Club You Ship, We Ship program for teens 13–18.


## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## What's here (Phase 0)

- `src/app/page.tsx`: one-screen landing page (sky, Hack Club flag, title, subheading, RSVP)
- `src/components/SkyPlane.tsx`: red biplane towing a banner on a swooping path (banner text: `BANNER_TEXT`)
- `src/components/Waitlist.tsx` + `src/app/actions.ts`: RSVP form (server action)
- `src/components/ThrottleHero.tsx`, `FlyerIcons.tsx`, `Plane.tsx`: earlier designs, not used on the page right now

## Waitlist storage

By default signups go to `.data/waitlist.json` (git-ignored). To send them to Airtable instead, copy
`.env.example` to `.env.local` and fill in `AIRTABLE_API_KEY` and `AIRTABLE_BASE_ID`. The table needs an `Email` field.

## File uploads (R2)

Journal photos and flight videos go straight from the browser to a Cloudflare R2 bucket, using a presigned URL the server hands out for five minutes. Our functions never see the file, so Vercel's request size limit doesn't matter. If the `R2_*` variables are empty (the usual local setup), files are saved to `public/uploads` instead.

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

Add any other origin you test from, like a Vercel preview URL. Uploads from an origin that isn't listed fail with "Couldn't reach file storage".
