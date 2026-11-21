FROM node:22-slim
# git is needed to clone the repos being indexed.
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates \
  && rm -rf /var/lib/apt/lists/* && corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --prod --filter @cda/api...
COPY packages/shared packages/shared
COPY apps/api apps/api
WORKDIR /app/apps/api
ENV NODE_ENV=production
USER node
EXPOSE 8787
# Migrations run inside main.ts before the server starts listening.
CMD ["node_modules/.bin/tsx", "src/main.ts"]
