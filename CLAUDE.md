# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**itecify** — a collaborative, cloud-based code editor with real-time multi-user editing and in-browser code execution. Monorepo with two workspaces: `apps/web` (Next.js frontend) and `apps/server` (Express backend).

## Commands

> **Note:** `yarn` is not in PATH. Use `corepack yarn` instead. To run shadcn CLI: create `/tmp/bin/yarn` as a corepack wrapper and add `/tmp/bin` to PATH first.

### Root (run from repo root)
```bash
corepack yarn install                   # Install all workspace dependencies
corepack yarn workspace web dev         # Start web dev server (http://localhost:3000)
corepack yarn workspace server dev      # Start backend dev server
```

### Web (`apps/web`)
```bash
corepack yarn dev      # Next.js dev server
corepack yarn build    # Production build
corepack yarn lint     # ESLint
corepack yarn tsc --noEmit  # Type-check without building
```

### Server (`apps/server`)
```bash
corepack yarn dev      # tsx watch (hot-reload via src/server.ts)
corepack yarn build    # Compile TypeScript
```

### Shadcn (run from `apps/web`)
```bash
# yarn must be shimmed for shadcn CLI:
mkdir -p /tmp/bin && echo '#!/bin/bash\ncorepack yarn "$@"' > /tmp/bin/yarn && chmod +x /tmp/bin/yarn && export PATH="/tmp/bin:$PATH"
npx shadcn@latest add <component>
```

## Architecture

### Data flow
1. Users edit code in Monaco Editor — changes synced via **Yjs CRDT** over WebSocket (`y-websocket`) for conflict-free real-time collaboration.
2. Code execution requests flow from the frontend via **Socket.IO** to the server's `runnerHandler`, which uses **Dockerode** to spawn isolated Docker containers.
3. Output is streamed back to the frontend's terminal component (xterm.js).
4. Auth and persistence use **Supabase** (frontend) and **Prisma + PostgreSQL** (server).

### Frontend (`apps/web/src/`)
- `hooks/useCollab.ts` — Yjs document setup and WebSocket provider
- `hooks/useRunner.ts` — Socket.IO code execution requests
- `hooks/useAI.ts` — AI feature integration
- `components/` — Monaco-based editor, shared terminal (xterm), AI block

### Backend (`apps/server/src/`)
- `server.ts` — Express + Socket.IO entry point
- `handlers/collabHandler.ts` — Yjs WebSocket relay for collaborative editing
- `handlers/runnerHandler.ts` — Receives run requests, delegates to Docker
- `services/dockerEngine.ts` — Container lifecycle management via Dockerode
- `services/snapshotService.ts` — Persists editor/session state
- `generated/prisma/` — Auto-generated Prisma client (do not edit)

## UI Components (shadcn base-nova)

shadcn v4 is configured in `apps/web/components.json` using the `base-nova` style with `@base-ui/react` primitives (not `@radix-ui`). Components live in `src/components/ui/`. Design tokens are defined as CSS variables in `globals.css` `:root` block and mapped to Tailwind utilities via `@theme inline`. The `dark` class is hardcoded on `<html>` — no light mode.

Color token quick-reference: `bg-background` (#0f1117), `bg-card` (#1a1d27), `bg-primary`/`text-primary` (#6366f1), `text-muted-foreground` (#8b8fa8), `border-border` (#2a2d3a).

## Important Notes

### Next.js version
This project uses **Next.js 16**, which has breaking changes from earlier versions. Before writing any Next.js code, check `node_modules/next/dist/docs/` for current APIs and conventions. Do not rely on training data for Next.js patterns.

### Prisma
Run `yarn prisma generate` inside `apps/server` after modifying `prisma/schema.prisma`. The client outputs to `src/generated/prisma`.

### Environment
The server expects a `DATABASE_URL` env var (PostgreSQL connection string). Copy `.env.example` to `.env` in `apps/server` if available.
