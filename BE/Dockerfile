# Multi-stage production Dockerfile for NestJS Backend

# Stage 1: Build & Prune stage
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies
RUN npm ci

COPY . .

# Generate Prisma Client & Build NestJS app
RUN npx prisma generate && npm run build

# Prune devDependencies to keep only production dependencies
RUN npm prune --production

# Stage 2: Production runner stage
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nestjs
RUN adduser --system --uid 1001 nestjs

COPY --from=builder --chown=nestjs:nestjs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nestjs /app/dist ./dist
COPY --from=builder --chown=nestjs:nestjs /app/prisma ./prisma
COPY --from=builder --chown=nestjs:nestjs /app/package*.json ./

USER nestjs

EXPOSE 3000

CMD ["node", "dist/main.js"]
