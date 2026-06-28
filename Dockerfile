# syntax=docker/dockerfile:1
#
# One Dockerfile, multiple stages:
#   - base     : workspace deps (compose.yml dev targets this, mounts source, runs `dev`)
#   - builder  : builds shared + designer + server
#   - dev      : base + Noto CJK fonts (the dev `server` runs here so rendering == prod)
#   - runtime  : single production image — the server serves the built designer SPA
#
# Dev:    docker compose up --build                  (http://localhost:5173)
# Deploy: docker compose -f compose.deploy.yml up --build -d

# ---- base: install workspace deps (no source) ----
FROM node:24-bookworm AS base
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/
COPY packages/designer/package.json ./packages/designer/
RUN npm ci
# Root tsconfig the per-package tsconfigs extend; needed when source is mounted (dev).
COPY tsconfig.base.json ./

# ---- builder: build everything ----
FROM base AS builder
COPY . .
# Drop stale incremental state so `tsc -b` actually emits dist/ in a clean image.
RUN find . -name '*.tsbuildinfo' -not -path '*/node_modules/*' -delete || true
RUN npm run build

# ---- dev: base + CJK fonts; compose mounts source + overrides the command ----
FROM base AS dev
RUN apt-get update && apt-get install -y --no-install-recommends \
      fonts-noto-cjk cups-client \
    && rm -rf /var/lib/apt/lists/*
EXPOSE 5173 5179

# ---- runtime: single image, server serves the designer dist; Noto CJK fonts ----
FROM node:24-bookworm-slim AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
      fonts-noto-cjk cups-client \
    && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production \
    LABELPRINT_HOST=0.0.0.0 \
    LABELPRINT_PORT=5179 \
    LABELPRINT_DATA_DIR=/data
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/
# Only the server's prod deps (links @labelprint/shared); the designer ships as static.
RUN npm -w @labelprint/server ci --omit=dev && rm -rf /root/.npm /root/.cache
COPY --link --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --link --from=builder /app/packages/server/dist ./packages/server/dist
COPY --link --from=builder /app/packages/designer/dist ./packages/designer/dist
VOLUME ["/data"]
EXPOSE 5179
CMD ["node", "packages/server/dist/index.js"]
