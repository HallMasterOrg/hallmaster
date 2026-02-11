FROM node:24.13.0-alpine3.23 AS build

ENV CI=true

WORKDIR /app

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

COPY ./package.json ./pnpm-lock.yaml ./pnpm-workspace.yaml ./

RUN pnpm install --frozen-lock

COPY ./tsconfig.build.json ./tsconfig.json ./nest-cli.json ./

COPY ./prisma/ ./prisma/

COPY ./src/ ./src/

RUN pnpm prisma:generate

RUN pnpm build

RUN rm -rf src tsconfig.json tsconfig.build.json nest-cli.json

RUN pnpm deploy --filter=@hallmaster/backend --prod --legacy /prod-app

RUN wget https://gobinaries.com/tj/node-prune --output-document - | /bin/sh && \
    node-prune /prod-app/node_modules

FROM node:24.13.0-alpine3.23 AS server

WORKDIR /app

RUN corepack enable

COPY --from=build /prod-app .

COPY ./prisma.config.ts ./

ENV NODE_ENV=production

EXPOSE 3000

ENTRYPOINT [ "pnpm", "start:prod" ]
