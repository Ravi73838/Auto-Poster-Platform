# Multi-stage Dockerfile for standalone api
# Stage 1: Install all dependencies (including dev for building)
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Generate Prisma Client and build bundled distribution
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json tsconfig.json tsup.config.ts ./
COPY prisma ./prisma
COPY src ./src

RUN npx prisma generate
RUN npm run build

# Stage 3: Production runtime runner
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 apiapp

# Install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy Prisma schema and generate runtime client
COPY prisma ./prisma
RUN npx prisma generate

# Copy built distribution from builder
COPY --from=builder /app/dist ./dist

USER apiapp
EXPOSE 4000

ENV PORT=4000
ENV SERVICE_TYPE=api

# Dispatches to main API server or background worker based on SERVICE_TYPE
CMD ["sh", "-c", "if [ \"$SERVICE_TYPE\" = \"worker\" ]; then exec node dist/worker.js; else exec node dist/main.js; fi"]
