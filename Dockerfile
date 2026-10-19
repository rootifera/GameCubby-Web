# Node 24 is an LTS line (25 was a short-lived "Current" release without long-term support).
FROM node:24-trixie-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

RUN npm run build

FROM node:24-trixie-slim AS production

RUN apt-get update && \
    apt-get install -y --no-install-recommends postgresql-client ca-certificates tzdata tini && \
    rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV NEXT_PUBLIC_API_BASE_URL=http://gamecubby-api:8000

ENV GC_MAINT_FILE=/storage/maintenance.json
ENV GC_BACKUPS_DIR=/storage/backups

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --only=production

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.mjs ./
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/src/web-version.json ./src/web-version.json

RUN mkdir -p /storage/backups/logs /storage/backups/prerestore \
    && mkdir -p /app/.next/cache && chown -R node:node /app/.next/cache

# Starts as root only to fix /storage ownership, then runs as a non-root user.
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000

# /api/health answers 200 even when the GameCubby API is offline, so this reports
# the web server's own liveness. Node ships fetch, so no curl is needed.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"

ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/docker-entrypoint.sh"]

CMD ["npm", "run", "start", "--", "--hostname", "0.0.0.0"]
