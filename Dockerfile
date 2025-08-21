FROM node:20-trixie-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

RUN npm run build

FROM node:20-trixie-slim AS production

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

RUN mkdir -p /storage/backups/logs /storage/backups/prerestore

EXPOSE 3000

ENTRYPOINT ["/usr/bin/tini", "--"]

CMD ["npm", "run", "start", "--", "--hostname", "0.0.0.0"]
