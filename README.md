# Clean E-yAy Cockpit

Frontend-only cockpit/dashboard for Clean E-yAy.

This repository intentionally does not contain the backend. It reads data from the existing Clean E-yAy API over HTTP.

## Local Development

```bash
pnpm install
pnpm dev
```

Set the backend URL in `.env.local`:

```bash
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:9000
```

Layer 1 is the default route. The legacy detail dashboard is Layer 2:

```txt
http://localhost:3000/
http://localhost:3000/dashboard
```

## Contract Boundary

`contracts/openapi.yaml` is copied in as the frontend/backend contract snapshot. When the backend contract changes, update this file and regenerate or update the generated types under `types/generated`.

```bash
pnpm codegen
pnpm typecheck
```

## GitHub Backup Discipline

Use GitHub as the clean backup for reviewed frontend work. Local changes should be pushed after at least two clean checks or manual review steps, for example:

```bash
pnpm typecheck
pnpm build
```

Backend changes stay in the original Clean E-yAy repository unless a contract update is intentionally copied into `contracts/openapi.yaml`.
