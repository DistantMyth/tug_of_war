# Tug of War

Live team-vs-team tapping battle for a college technical-club orientation.

Permanent QR target: `/join`.

This repository is a pnpm workspace:

- `apps/web` — React (Vite) participant, projector, and admin UI
- `apps/server` — Node.js / Express game server
- `packages/shared` — shared TypeScript types and constants only (no game rules)

## Prerequisites

- Node.js 20+
- pnpm 9 (`corepack enable` then `corepack prepare pnpm@9.15.9 --activate`)

## Local development

```bash
pnpm install
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.example apps/web/.env
pnpm dev
```

- Web: http://localhost:5173
- Server: http://localhost:3001
- Health: http://localhost:3001/health

Useful scripts:

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm --filter @tow/web dev
pnpm --filter @tow/server dev
```

## Current status

Phase 0 scaffold is in place (monorepo, shared types, health endpoint, placeholder routes). Game engine, Redis, sockets, and UI scenes are not implemented yet.
