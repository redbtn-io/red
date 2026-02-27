# syntax=docker/dockerfile:1

# ==========================================
# RedBtn Webapp - Multi-stage Docker Build
# ==========================================

# Base image with Node.js
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# ==========================================
# Stage 1: Install dependencies
# ==========================================
FROM base AS deps

# Copy package files and local tarballs
COPY package.json ./
COPY *.tgz ./

# Install dependencies
RUN npm install --ignore-scripts && npm rebuild

# ==========================================
# Stage 2: Build the application
# ==========================================
FROM base AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set Next.js telemetry to disabled
ENV NEXT_TELEMETRY_DISABLED=1

# Build the application
RUN npm run build

# ==========================================
# Stage 3: Production runner
# ==========================================
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy public assets
COPY --from=builder /app/public ./public

# Copy the standalone build
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Note: MCP is disabled for webapp (disableMcp: true in config)
# Tools are fetched from database where workers register them on startup
# No need to copy @redbtn/redbtn package for MCP stdio servers

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
