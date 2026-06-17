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

The Layer 1 cockpit route is available at:

```txt
http://localhost:3000/cockpit
```

## Contract Boundary

`contracts/openapi.yaml` is copied in as the frontend/backend contract snapshot. When the backend contract changes, update this file and regenerate or update the generated types under `types/generated`.

```bash
pnpm codegen
pnpm typecheck
```
