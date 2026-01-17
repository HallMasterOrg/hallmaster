FROM node:24.13.0-alpine3.23 AS build

WORKDIR /app

RUN corepack enable

COPY ./package.json ./pnpm-lock.yaml ./pnpm-workspace.yaml ./

RUN pnpm install --frozen-lock

COPY ./nest-cli.json ./nest-cli.json

COPY src/ ./src/

COPY prisma/ ./prisma/

COPY tsconfig.build.json tsconfig.json ./

RUN pnpm prisma:generate

RUN pnpm build

FROM node:24.13.0-alpine3.23 AS server

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN pnpm install --frozen-lockfile --prod

COPY --from=build /app/dist /app/dist

ENV NODE_ENV=production

EXPOSE 3000

RUN apk add --no-cache docker-cli

ENTRYPOINT [ "pnpm", "start:prod" ]
