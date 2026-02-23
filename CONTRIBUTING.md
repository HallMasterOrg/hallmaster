# Contributing to HallMaster

Thank you for your interest in contributing to HallMaster. This document outlines the guidelines and conventions to follow when contributing to the project.

## Where to start

Want to contribute but don't know where to start? Have a look at the issues labeled with the [`good first issue`](https://github.com/hallmasterorg/hallmaster/labels/good%20first%20issue) label.

## Getting started

1. Fork the repository
2. Clone your fork and set up the project (see [README.md](README.md#getting-started))
3. Create a new branch from `main` for your changes
4. Make your changes
5. Push your branch and open a pull request

## Commit conventions

We use [Conventional Commits](https://www.conventionalcommits.org/). Every commit message must follow this format:

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

### Examples

```
feat(backend): add SSE endpoint for real-time log streaming
fix(frontend): resolve cluster status not updating on stop
docs: update README with self-hosting instructions
refactor(backend): unify buffered and streamed log methods
```

## Pull requests

- Keep pull requests focused on a single change
- Write a clear title and description
- Reference related issues when applicable (e.g. `Closes #42`)
- Make sure the project builds before submitting

## Code style

- **Backend**: ESLint + Prettier. Run `pnpm lint` and `pnpm format` before committing.
- **Frontend**: Biome. Run `pnpm lint` and `pnpm format` before committing.

## Reporting bugs

Open an issue with a clear description of the problem, steps to reproduce, and the expected behavior. Include relevant logs or screenshots if applicable.
