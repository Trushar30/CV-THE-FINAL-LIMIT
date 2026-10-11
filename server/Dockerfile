# CorpVerse Backend Server Dockerfile
# Multi-stage production container

FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Install native compilation dependencies for argon2 and node-gyp
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy workspace package manifests
COPY package.json package-lock.json tsconfig.base.json ./
COPY server/package.json ./server/
COPY client/package.json ./client/

# Install all dependencies (including devDependencies needed for build)
RUN npm ci

# Copy server source code and configs
COPY server ./server

# Build production bundle
RUN npm run build -w @corpverse/server

# Prune devDependencies for production
RUN npm prune --omit=dev --workspace=@corpverse/server

# --- Production Runner Stage ---
FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Security: Create non-root user
RUN groupadd -g 1001 nodejs && \
    useradd -u 1001 -g nodejs -s /bin/sh -m appuser

# Copy production node_modules from builder
COPY --chown=appuser:nodejs --from=builder /app/node_modules ./node_modules
COPY --chown=appuser:nodejs --from=builder /app/package.json ./package.json
COPY --chown=appuser:nodejs --from=builder /app/server/package.json ./server/package.json
COPY --chown=appuser:nodejs --from=builder /app/server/dist ./server/dist

USER appuser

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "const http = require('http'); const req = http.get('http://localhost:4000/api/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1)); req.on('error', () => process.exit(1));"

CMD ["node", "server/dist/server.js"]
