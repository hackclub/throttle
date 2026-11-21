# Throttle: self-contained Next.js server for Coolify, Orchard or any Docker host.

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# The build needs devDependencies (Tailwind, TypeScript). Hosts like Orchard
# pass app variables such as NODE_ENV=production into the build, which would
# otherwise make npm skip them.
RUN npm ci --include=dev

FROM node:24-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* values are baked in at build time; pass them as build args.
ARG NEXT_PUBLIC_LAUNCHED
ENV NEXT_PUBLIC_LAUNCHED=$NEXT_PUBLIC_LAUNCHED \
    BUILD_STANDALONE=true \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:24-alpine AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    MIGRATE_ON_START=true
RUN addgroup -S app && adduser -S app -G app
COPY --from=build /app/public ./public
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
# Migrations run from here on boot (see src/instrumentation.ts).
COPY --from=build /app/drizzle ./drizzle
USER app
EXPOSE 3000
CMD ["node", "server.js"]
