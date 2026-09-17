# System Architecture

## High-level layering

```
Browser
  ↓
React + Vite frontend (TypeScript, Tailwind, React Router)
  ↓  HTTPS/HTTP JSON + Authorization: Bearer <JWT>
REST API  (/api/...)
  ↓
Express
  ├── Routes
  ├── Controllers
  ├── Middleware (authenticate, requireRole, errorHandler)
  ├── Validators (Zod)
  └── Services (business rules + Prisma transactions)
        ↓
      Prisma Client
        ↓
      PostgreSQL
```

## Frontend responsibilities (`client/`)

- Login, signup, Google OAuth redirect callback
- JWT storage in `localStorage` (`pern_erp_access_token`)
- Session restore via `GET /api/auth/me` on startup (`AuthContext`)
- Protected routes (`ProtectedRoute`) — wait for bootstrap before redirecting to login
- Application shell and pages: Overview, Enquiries, Quotations, Sales Orders, Inventory, Dispatches
- Role-based **UI** visibility (e.g. hide confirm/dispatch for SALES_USER)
- Call REST APIs via `fetch` helpers (`api/http.ts`, `api/authApi.ts`, `api/erpApi.ts`)

Frontend does **not**:

- Compute authoritative quotation totals (backend recalculates)
- Enforce RBAC (backend does)
- Hold JWT secrets

## Backend responsibilities (`server/`)

| Concern | Location |
| --- | --- |
| HTTP routing | `src/routes/*` |
| Request/response shaping | `src/controllers/*` |
| AuthN / AuthZ | `middleware/authenticate.ts`, `middleware/requireRole.ts` |
| Input validation | `src/validators/*` (Zod) |
| Business rules & transactions | `src/services/*` |
| Persistence | Prisma → PostgreSQL |
| Errors | `AppError` + `errorHandler` → `{ success: false, message }` |

## Authentication flow

1. **Password login:** `POST /api/auth/login` → bcrypt verify → JWT (`sub`, `email`, `role`)
2. **Register:** `POST /api/auth/register` → always `SALES_USER` → JWT
3. **Google:** Browser → `GET /api/auth/google` → Google consent → `GET /api/auth/google/callback` → verify ID token → find/create user → redirect to client with app JWT
4. **Subsequent requests:** `Authorization: Bearer <token>` → `authenticate` loads user onto `req.user`
5. **Frontend restore:** On load, if token exists, call `/api/auth/me` before treating user as logged out

## Authorization (RBAC)

`requireRole(...roles)` after authentication.

Examples:

- Create customer / enquiry / quotation / convert → `SALES_USER`
- Quotation status / confirm SO / dispatch → `ADMIN`
- Lists and details → `ADMIN` or `SALES_USER`

## Validation

Write endpoints parse bodies with Zod. Invalid input → `400` with message. Money/qty rules also enforced in services and DB CHECKs.

## Error handling

| Status | Typical meaning |
| --- | --- |
| 400 | Validation / invalid state transition / insufficient stock |
| 401 | Missing/invalid JWT or bad credentials |
| 403 | Authenticated but wrong role |
| 404 | Resource not found |
| 409 | Conflict (duplicate email/doc/SO/dispatch, serialization retry) |
| 500 | Unexpected (message generic to client) |
| 503 | Google OAuth not configured (service throw; start often redirects) |

Stack traces and secrets are not returned to clients.

## Database transactions

Critical multi-write paths use `prisma.$transaction` with **Serializable** isolation where implemented:

- Create enquiry / quotation / sales order (document numbers + lines)
- Confirm sales order (conditional inventory reservation)
- Dispatch (conditional stock decrease + dispatch row + status)

## Inventory reservation

On **Admin confirm** of a `PENDING` sales order:

- Conditional SQL: increase `reservedQuantity` only if `physical − reserved >= qty`
- Physical unchanged
- Entire confirmation rolls back if any line fails

## Dispatch processing

On **Admin dispatch** of a `CONFIRMED` sales order:

- Full order quantities only (no partial dispatch)
- Decrease physical and reserved by the same quantities
- Create `Dispatch` + set status `DISPATCHED` atomically

## Environment variables

**Server (names only):** `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `PORT`, `CLIENT_URL`, `NODE_ENV`, optional seed overrides, optional `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_CALLBACK_URL`.

**Client:** `VITE_API_URL` (API base URL). JWT secret is never shipped to Vite.

## Production deployment

| Piece | Repo support |
| --- | --- |
| Frontend SPA on Vercel | `client/vercel.json` rewrite to `index.html` |
| Backend Node API | Deploy separately; no Docker/Render/Railway configs in repo |
| PostgreSQL | External; migrate + seed as documented in root README |

Related: [WORKFLOW.md](./WORKFLOW.md), [SECURITY.md](./SECURITY.md), [../api/API_DOCUMENTATION.md](../api/API_DOCUMENTATION.md).
