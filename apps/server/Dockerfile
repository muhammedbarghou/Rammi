# Build from the repo root: the server needs packages/rules.
FROM node:24-slim
RUN npm install -g pnpm@11.28.9
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/rules/package.json packages/rules/
COPY apps/server/package.json apps/server/
RUN pnpm install --frozen-lockfile
COPY packages/rules packages/rules
COPY apps/server apps/server
WORKDIR /app/apps/server
EXPOSE 2567
CMD ["pnpm", "start"]
