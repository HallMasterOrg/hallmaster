FROM node:24-alpine AS base
ENV CI=true
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable pnpm
WORKDIR /app

FROM base AS build
ENV API_URL=http://localhost:3000
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm --filter @hallmaster/frontend... install --frozen-lockfile --prefer-offline
RUN pnpm --filter @hallmaster/frontend run build

FROM base
ENV PORT=4411
ENV ORIGIN=http://localhost:${PORT}
COPY --from=build /app/packages/frontend/build /app/build
CMD ["node", "build"]
