# ---- Build stage: install deps (incl. native better-sqlite3) and build both bundles.
FROM node:20-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json* ./
COPY server/package.json ./server/
COPY client/package.json ./client/
# Prefer a lockfile when present; fall back to plain install otherwise.
RUN if [ -f package-lock.json ]; then npm ci --workspaces; else npm install --workspaces; fi
COPY server ./server
COPY client ./client
COPY drizzle ./drizzle
RUN npm run build -w server && npm run build -w client

# ---- Runtime stage: only what's needed to serve.
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
COPY server/package.json ./server/
COPY client/package.json ./client/
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/client/dist ./client/dist
COPY drizzle ./drizzle
# Writable volume for the SQLite database.
VOLUME ["/app/data"]
EXPOSE 3000
CMD ["node", "server/dist/index.js"]
