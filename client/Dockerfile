# CorpVerse Frontend Client Dockerfile
# Multi-stage production container with Nginx

FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Copy workspace package manifests
COPY package.json package-lock.json tsconfig.base.json ./
COPY server/package.json ./server/
COPY client/package.json ./client/

# Install dependencies
RUN npm ci

# Copy client source code and configs
COPY client ./client

# Build client production bundle
RUN npm run build -w @corpverse/client

# --- Production Nginx Stage ---
FROM nginx:alpine AS runner

# Remove default nginx configs
RUN rm -rf /etc/nginx/conf.d/* /usr/share/nginx/html/*

# Copy custom Nginx configuration
COPY client/nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled static assets from builder stage
COPY --from=builder /app/client/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
