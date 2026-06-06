FROM node:22.20.2-slim AS base

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps

COPY package.json package-lock.json ./
COPY prisma ./prisma

RUN npm ci \
  && npx prisma generate

FROM deps AS build

COPY tsconfig.json ./
COPY src ./src
COPY prisma.config.ts ./
COPY tests ./tests

RUN npm run build

FROM base AS runtime

ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

RUN npm prune --omit=dev

EXPOSE 8080

CMD ["npm", "start"]
