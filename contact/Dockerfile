# Multi-Stage Build fuer den Kontaktformular-Dienst
# Basis: node:22-alpine, non-root, read-only rootfs kompatibel

# Stage 1: Build
FROM node:22-alpine AS builder
WORKDIR /build

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Stage 2: Produktions-Image
FROM node:22-alpine AS production
WORKDIR /app

# Nicht als root laufen
RUN addgroup -S tabula && adduser -S tabula -G tabula

# Nur Produktionsabhaengigkeiten
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && rm -rf /tmp/*

# Kompilierten Code kopieren
COPY --from=builder /build/dist ./dist

# Benutzer wechseln
USER tabula

ENV NODE_ENV=production \
    PORT=3001 \
    HOST=0.0.0.0

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:3001/api/contact || exit 1

CMD ["node", "dist/index.js"]
