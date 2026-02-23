> [!WARNING]
> HallMaster is currently in development and is not ready for production use. Do not use it or at your own risk.  
> We are currently in the early stages of development.

# HallMaster

HallMaster is an open-source platform designed to centralize the orchestration and monitoring of Discord bots. It aims to provide a unified interface for managing shards, clusters, deployments, and real-time observability. You can focus on building your bot instead of fighting your infrastructure.

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
| `packages/backend` | REST API, orchestration engine, Docker management | NestJS, Prisma, Fastify |
| `packages/frontend` | Web dashboard | SvelteKit, Skeleton UI |
| `packages/prisma-client` | Shared Prisma client | Prisma |

The backend communicates with the Docker daemon via Unix socket to manage bot containers. An external library, [`@hallmaster/docker.js`](https://github.com/hallmasterorg/docker.js), provides the low-level Docker API bindings.

## Prerequisites

- Node >= 24
- pnpm >= 10
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

Copy the environment template and fill in your values:

```sh
cp packages/backend/.env.development.local.exemple packages/backend/.env.development.local
```

Start PostgreSQL (or use the provided Docker Compose):

```sh
cd packages/backend
docker compose up -d hallmaster-postgres
```

Run migrations:

```sh
pnpm prisma:deploy
```

### 4. Start the development servers

Backend:

```sh
cd packages/backend
pnpm start:dev
```

Frontend:

```sh
cd packages/frontend
pnpm dev
```

## Self-hosting

A `docker-compose.yml` is provided in `packages/backend` to run the full stack (PostgreSQL + backend) with Docker. The backend container mounts the host Docker socket to manage bot containers.

```sh
cd packages/backend
docker compose up -d
```

## Contributing

Contributions are welcome. Please use [conventional commits](https://www.conventionalcommits.org/) for your commit messages.

## License

This project is open-source. See the [LICENSE](LICENSE) file for details.
