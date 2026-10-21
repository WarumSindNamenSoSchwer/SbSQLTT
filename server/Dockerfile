# Multi-Stage Build fuer minimales Produktions-Image
# Basis: node:22-alpine (nicht root)

# Stage 1: Build
FROM node:22-alpine AS builder
WORKDIR /build

# Abhaengigkeiten installieren (inkl. native addons fuer argon2 und better-sqlite3)
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Stage 2: Produktions-Image
FROM node:22-alpine AS production
WORKDIR /app

# Nicht als root laufen (K10/Sicherheit)
RUN addgroup -S tabula && adduser -S tabula -G tabula

# Nur Produktionsabhaengigkeiten (keine devDeps)
COPY package.json package-lock.json* ./
RUN apk add --no-cache python3 make g++ && \
    npm ci --omit=dev && \
    apk del python3 make g++ && \
    rm -rf /tmp/*

# Kompilierten Code und Migrationen kopieren
COPY --from=builder /build/dist ./dist
COPY migrations/ ./migrations/

# Volume fuer Datenbankdatei
VOLUME /data

# Benutzer wechseln
USER tabula

ENV NODE_ENV=production \
    DB_PATH=/data/tabula.db \
    PORT=3000 \
    HOST=0.0.0.0

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "dist/index.js"]
