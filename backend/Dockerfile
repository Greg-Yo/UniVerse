# ============================================================================
# Dockerfile multi-stage pour l'API NestJS
# ============================================================================

# ---- Stage 1 : build ----
FROM node:22-alpine AS builder
WORKDIR /app

# Dependances necessaires a la compilation de argon2 (module natif)
RUN apk add --no-cache python3 make g++

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npx prisma generate
RUN npm run build

# ---- Stage 2 : dependances de production ----
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npx prisma generate

# ---- Stage 3 : image finale ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Utilisateur non-root
RUN addgroup -S nodejs && adduser -S nestjs -G nodejs

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY package*.json ./

USER nestjs
EXPOSE 3000

# Applique les migrations puis demarre l'API.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
