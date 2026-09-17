# Architecture

## Layering

```
React (Vite + TypeScript)
        │  HTTPS/HTTP JSON
        │  Authorization: Bearer <JWT>
        ▼
Express routes          (/api/...)
        │
        ▼
Controllers             parse/validate request, shape response
        │
        ▼
Services                business rules, Prisma transactions
        │
        ▼
Prisma Client
        │
        ▼
PostgreSQL
```

## Cross-cutting concerns

### Authentication

- `POST /api/auth/login` verifies bcrypt password hash and issues JWT (`sub`, `email`, `role`).
- `authenticate` middleware reads `Authorization: Bearer`, verifies signature/expiry, loads user onto `req.user`.

### Authorization (RBAC)

- `requireRole(...roles)` after authentication.
- Frontend route guards are UX only; APIs enforce roles.

### Validation

- Zod schemas in `server/src/validators/*`.
- Controllers reject invalid payloads with `400` via `AppError`.

### Business logic

- Lives in `server/src/services/*` (quotation pricing, conversion, reservation, dispatch).
- Controllers stay thin.

### Transactions

- Multi-write workflows use `prisma.$transaction` (often Serializable).
- Inventory mutations use conditional SQL updates so concurrent confirmations/dispatches cannot violate `reserved ≤ physical`.

### Errors

- Central `errorHandler` returns `{ success: false, message }` without stack traces to clients.
- Operational `AppError` carries HTTP status codes.

## Frontend structure

- `api/` — authenticated `fetch` helpers
- `auth/` — AuthProvider, ProtectedRoute, token storage
- `pages/` — Login, Enquiries, Quotations, Sales Orders, Dispatches

## Configuration

- Backend: `server/.env` (never commit secrets)
- Frontend: `VITE_API_URL` only — never JWT secrets
