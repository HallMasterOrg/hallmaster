FROM node:24.13.0-alpine3.23 AS build

ENV CI=true

WORKDIR /app

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

COPY package.json \
    pnpm-lock.yaml \
    pnpm-workspace.yaml \
    ./

# Install packages for Prisma
COPY packages/prisma-client/package.json \
    packages/prisma-client/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install \
        --filter=@hallmaster/prisma-client \
        --prefer-offline \
        --frozen-lockfile

# Install packages for the backend
COPY packages/backend/package.json packages/backend/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install \
        --filter=@hallmaster/backend \
        --prefer-offline \
        --frozen-lockfile

# Build Prisma types
COPY packages/backend/prisma/ packages/backend/prisma/
COPY packages/backend/prisma.config.ts packages/backend/
RUN pnpm --filter=@hallmaster/backend prisma:generate

# Build NestJS application
COPY packages/backend/tsconfig.build.json \
    packages/backend/tsconfig.json \
    packages/backend/nest-cli.json \
    packages/backend/
COPY packages/backend/src/ packages/backend/src/
RUN pnpm --filter=@hallmaster/backend build

# Cleanup the application
RUN rm -rf packages/backend/src \
    packages/backend/tsconfig.json \
    packages/backend/tsconfig.build.json \
    packages/backend/nest-cli.json

# Create the application package
RUN pnpm deploy --filter=@hallmaster/backend --prod --legacy /prod-app

FROM node:24.13.0-alpine3.23 AS db-migrator

COPY --from=build /app /app

WORKDIR /app

CMD ["pnpm", "--filter=@hallmaster/backend", "prisma:deploy"]

FROM node:24.13.0-alpine3.23 AS server

COPY --from=build /prod-app /app

WORKDIR /app

ENV NODE_ENV=production

EXPOSE 3000

ENTRYPOINT [ "npm", "run", "start:prod" ]
