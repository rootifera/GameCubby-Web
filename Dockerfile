# Multi-stage build for production
FROM node:20-trixie-slim AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:20-trixie-slim AS production

RUN apt-get update && \
    apt-get install -y --no-install-recommends postgresql-client ca-certificates tzdata tini && \
    rm -rf /var/lib/apt/lists/*

# Set environment variables
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

ENV NEXT_PUBLIC_API_BASE_URL=http://gamecubby-api:8000

ENV GC_MAINT_FILE=/storage/maintenance.json
ENV GC_BACKUPS_DIR=/storage/backups

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy built application from builder stage
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.mjs ./
COPY --from=builder /app/tsconfig.json ./

# Create storage directories
RUN mkdir -p /storage/backups/logs /storage/backups/prerestore

EXPOSE 3000

ENTRYPOINT ["/usr/bin/tini", "--"]

CMD ["npm", "run", "start", "--", "--hostname", "0.0.0.0"]
