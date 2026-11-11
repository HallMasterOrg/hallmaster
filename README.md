> [!WARNING]
> HallMaster is currently in development and is not ready for production use. Do not use it or at your own risk.  
> We are currently in the early stages of development.

# HallMaster

HallMaster is an open-source platform designed to centralize the orchestration and monitoring of Discord bots. It aims to provide a unified interface for managing shards, clusters, deployments, and real-time observability. You can focus on building your bot instead of fighting your infrastructure.

## What it does today

- Registers one Discord bot (its token is checked against Discord) and the container image of your bot.
- Splits the bot's shards into clusters from the dashboard. Each cluster runs as a Docker container that receives `DISCORD_BOT_TOKEN`, `TOTAL_SHARDS` and `SHARD_ID_LIST`, so your bot knows which shards to handle.
- Starts, stops and restarts one cluster or several at once.
- Shows the live status, logs, CPU and memory of each cluster, and the total for the bot.

## What it does not do

- It manages a single bot and a single user account per instance.
- It only runs containers on the machine where the backend runs (through the local Docker socket). There is no multi-machine setup yet.
- It does not build your bot: push its image to a registry first, then give HallMaster the image URL.
- It does not scale or reshard on its own: you change the cluster layout by hand.
- Changing the bot token or the image in the settings does not restart the running clusters. The new values are used the next time you apply a layout.

## Features

> [!NOTE]
> The features presented here are those planned for the future.

- **Orchestration**: Manage shards, clusters, and machines from a single dashboard. Scale dynamically based on usage with quick actions and bulk operations.
- **Monitoring**: Real-time status of your shards, clusters, and machines. Event logging, incident tracking, and alerting.
- **Statistics**: Live and historical resource usage. Bot-level analytics and retrospectives.
- **Deployment**: Rolling updates, automatic rollback on failure, and blue-green deployments to avoid downtime.
- **Development tools**: Environment management, team collaboration, debugging tools, and A/B testing.

## Architecture

HallMaster is organized as a monorepo with the following packages:

| Package | Description | Stack |
|---------|-------------|-------|
| `packages/backend` | REST API, orchestration engine, Docker management | Hono, Prisma, Zod |
| `packages/frontend` | Web dashboard | SvelteKit, Skeleton UI |

The frontend reuses the backend Zod schemas (`@hallmaster/backend/schemas`) to validate its forms and type the API responses.

The backend communicates with the Docker daemon via Unix socket to manage bot containers. An external library, [`@hallmaster/docker.js`](https://github.com/hallmasterorg/docker.js), provides the low-level Docker API bindings.

## Prerequisites

- Node 24
- pnpm 12 (the exact version is pinned in `package.json`)
- Docker

## Getting started

### 1. Clone the repository

```sh
git clone https://github.com/hallmasterorg/hallmaster.git
cd hallmaster
```

### 2. Install dependencies

```sh
pnpm install
```

### 3. Set up the database

Copy the environment templates and fill in your values:

```sh
cp packages/backend/.env.example packages/backend/.env
cp packages/frontend/.env.example packages/frontend/.env
```

Start PostgreSQL (`pnpm prisma:dev` starts a local one), then run the migrations:

```sh
cd packages/backend
pnpm prisma:deploy
```

The backend talks to Docker through `/var/run/docker.sock`. If your socket lives elsewhere (Docker Desktop on macOS for example), set `DOCKER_HOST`, e.g. `DOCKER_HOST=unix://$HOME/.docker/run/docker.sock`.

### 4. Start the development servers

Backend (the API documentation is served on `/docs`):

```sh
cd packages/backend
pnpm dev
```

Frontend:

```sh
cd packages/frontend
pnpm dev
```

### 5. Run the tests

```sh
cd packages/backend
pnpm test:unit
pnpm test:integration # requires Docker
```

## Self-hosting

A `docker-compose.yml` is provided at the root of the repository to run the full stack (PostgreSQL, backend and frontend). Fill the `secrets/*/.env.production` files from their examples first. The backend container mounts the host Docker socket to manage bot containers.

```sh
docker compose up -d
```

## Contributing

Contributions are welcome. [CONTRIBUTING.md](CONTRIBUTING.md) explains how to submit a change, what we accept and how fast we answer. Issues labeled [`good first issue`](https://github.com/hallmasterorg/hallmaster/labels/good%20first%20issue) are a good place to start.

## License

HallMaster is licensed under the [GNU AGPL v3](LICENSE). The Docker client it uses, [`@hallmaster/docker.js`](https://github.com/hallmasterorg/docker.js), is a separate package under the MIT license.
