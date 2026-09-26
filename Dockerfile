FROM node:20-alpine AS base
WORKDIR /app
COPY package.json package-lock.json* ./
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json
RUN npm ci --workspaces || npm install --workspaces

COPY . .

# Build client
RUN npm run build --workspace client

EXPOSE 5000
ENV NODE_ENV=production
CMD ["npm", "run", "start", "--workspace", "server"]
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://localhost:5000/api/health || exit 1
