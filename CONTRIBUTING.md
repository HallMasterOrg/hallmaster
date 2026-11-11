# Contributing to HallMaster

Thanks for wanting to help. This page explains how to send a change, what we accept, and what happens after you open a pull request.

## Where to start

Have a look at the issues labeled [`good first issue`](https://github.com/hallmasterorg/hallmaster/labels/good%20first%20issue): they are small, and each one says where to look and how to tell it's done. Leave a comment on the issue before you start so two people don't work on the same thing.

## Getting started

1. Fork the repository
2. Clone your fork and set up the project (see [README.md](README.md#getting-started))
3. Create a new branch from `main` for your changes
4. Make your changes
5. Push your branch and open a pull request

## What we accept

**Send a pull request directly** for:

- bug fixes, with a test that fails without the fix
- new or better tests
- documentation fixes
- small improvements linked to an existing issue

**Open an issue first** for:

- new features
- changes to the API routes or to their responses (the dashboard depends on them)
- changes to the database schema
- new dependencies

We'd rather agree on the approach before you spend time on the code.

**Kept by the core team.** We will most likely decline outside pull requests on these parts, but issues are welcome:

- authentication and session handling, because a mistake there is a security hole
- database migrations, because they run on our deployed instances
- the CI and deployment workflows, because they hold our registry and server credentials

**We won't merge** a pull request whose CI fails, that mixes unrelated changes, or that changes the critical path (authentication, bot setup, cluster layout, cluster actions, monitoring) without tests.

## How we review

- Every pull request needs one approval from a maintainer, and the CI must pass.
- We aim to give a first answer within 7 days, on issues and on pull requests.
- If we turn a pull request down, we say why in the pull request.

## Commit conventions

We use [Conventional Commits](https://www.conventionalcommits.org/). Every commit message must follow this format (a git hook checks it):

```
<type>(<scope>): <description>
```

### Types

| Type | Description |
|------|-------------|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation changes |
| `style` | Code style changes (formatting, semicolons, etc.) |
| `refactor` | Code changes that neither fix a bug nor add a feature |
| `perf` | Performance improvements |
| `test` | Adding or updating tests |
| `build` | Changes to the build system or dependencies |
| `ci` | Changes to CI configuration |
| `chore` | Other changes that don't modify source or test files |

### Scope

The scope is optional and refers to the part of the project being changed. Common scopes include:

- `backend`
- `frontend`
- `prisma`
- `docker`
- `ci`

### Examples

```
feat(backend): add SSE endpoint for real-time log streaming
fix(frontend): resolve cluster status not updating on stop
docs: update README with self-hosting instructions
refactor(backend): unify buffered and streamed log methods
```

## Pull requests

- Keep pull requests focused on a single change
- Fill in the pull request template: what it does and why
- Reference related issues when applicable (e.g. `Closes #42`)
- Run the checks below before pushing; the CI runs the same ones

## Code style and checks

Both packages use [oxlint](https://oxc.rs/docs/guide/usage/linter) and [oxfmt](https://oxc.rs/docs/guide/usage/formatter). `pnpm format` fixes the formatting.

Backend (`packages/backend`):

```sh
pnpm lint
pnpm format:check
pnpm test:unit
pnpm test:integration # requires Docker
```

Frontend (`packages/frontend`):

```sh
pnpm check
pnpm lint
pnpm format:check
```

Backend tests live in `tests/unit` (one file per service) and `tests/integration` (one file per route group).

## Reporting bugs

Open an issue with a clear description of the problem, steps to reproduce, and the expected behavior. Include relevant logs or screenshots if applicable.
