FROM node:22-alpine3.22 AS build

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

FROM node:22-alpine3.22 AS server

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN pnpm install --frozen-lockfile --prod

COPY --from=build /app/dist /app/dist

ENV NODE_ENV=production

EXPOSE 3000

ENTRYPOINT [ "pnpm", "start:prod" ]
