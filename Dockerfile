# Stage 1: Build TypeScript application
FROM node:26-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY patches/ ./patches/

RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/
COPY submodules/nekuvio-badges/src/ ./submodules/nekuvio-badges/src/

RUN npm run build:compile



# Stage 2: Production runner
FROM node:26-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY patches/ ./patches/

RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

USER node

EXPOSE 7000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:' + (process.env.PORT || 7000) + '/manifest.json').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist/index.js"]
