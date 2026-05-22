# ---- Dependencies ----
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---- Build ----
FROM node:20-alpine AS builder
WORKDIR /app

# git is needed at build time: `npm run build` runs the prebuild hook, which
# clones the Dimensional Alchemy game into public/games/idealer (it is not
# committed to this repo). Build requires network access to GitHub.
RUN apk add --no-cache git bash

ARG NEXT_PUBLIC_SITE_NAME
ARG NEXT_PUBLIC_SITE_TITLE
ARG NEXT_PUBLIC_SITE_DESCRIPTION
ARG NEXT_PUBLIC_GITHUB_USER
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_REDDIT_READER_URL

ENV NEXT_PUBLIC_SITE_NAME=$NEXT_PUBLIC_SITE_NAME
ENV NEXT_PUBLIC_SITE_TITLE=$NEXT_PUBLIC_SITE_TITLE
ENV NEXT_PUBLIC_SITE_DESCRIPTION=$NEXT_PUBLIC_SITE_DESCRIPTION
ENV NEXT_PUBLIC_GITHUB_USER=$NEXT_PUBLIC_GITHUB_USER
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_REDDIT_READER_URL=$NEXT_PUBLIC_REDDIT_READER_URL

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Production ----
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
