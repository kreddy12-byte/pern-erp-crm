# Security

Documents security controls **as implemented** in this repository. No secret values are included.

## Authentication

### Password accounts

- Passwords hashed with **bcryptjs** (12 salt rounds) via `server/src/utils/password.ts`
- Login compares hash; responses never include `passwordHash`
- Google-only users have `passwordHash = null` and cannot use password login

### JWT

- Issued on login, register, and successful Google auth
- Claims: `sub` (user id), `email`, `role`
- Signed with server `JWT_SECRET`; expiry from `JWT_EXPIRES_IN` (default `8h`)
- Client sends `Authorization: Bearer <token>`
- `authenticate` middleware verifies signature/expiry and loads user from DB

### Register

- Public `POST /api/auth/register`
- Always creates **SALES_USER** (client cannot pass ADMIN)
- Password strength enforced (length, upper/lower, digit, special)
- Duplicate email → `409`

### Google OAuth (implemented)

- Authorization code flow via `google-auth-library`
- Server verifies ID token audience and email verification
- New Google users → `SALES_USER`, no password
- Existing email → link `googleId`, **preserve existing role** (including ADMIN)
- Requires `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`
- State parameter HMAC-signed with `JWT_SECRET` (10-minute TTL)
- Access tokens from Google are not persisted

## Authorization (RBAC)

| Role | Enforced capabilities |
| --- | --- |
| SALES_USER | Create customers/enquiries/quotations; convert quotations; read most resources |
| ADMIN | Update quotation status; confirm sales orders; dispatch; read all |

Middleware: `requireRole(...)` → `403` if role not allowed, `401` if unauthenticated.

Frontend hides Admin buttons for Sales users; **API enforcement is mandatory**.

## Protected APIs

All business endpoints under `/api/customers`, `/api/enquiries`, `/api/quotations`, `/api/sales-orders`, `/api/inventory`, `/api/dispatches`, `/api/products` require authentication (router-level `authenticate`).

Public:

- `GET /api/health`
- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /api/auth/google`
- `GET /api/auth/google/callback`

## Frontend route protection

- `ProtectedRoute` waits for `isBootstrapping` (token + `/api/auth/me`) before redirecting to `/login`
- Token stored in `localStorage` key `pern_erp_access_token`
- Logout clears storage and auth state
- **Note:** localStorage JWT is vulnerable to XSS; acceptable for this assignment’s architecture, not a hardened cookie session design

## Validation

Zod validators on write payloads reduce injection of malformed data. Inventory mutations use parameterized Prisma/`$executeRaw` with bound values.

## Error handling

Clients receive `{ success: false, message }` without stack traces, password hashes, or environment secrets.

## Secrets & environment

| Secret / config | Where |
| --- | --- |
| `JWT_SECRET` | Server only |
| `DATABASE_URL` | Server only |
| Google client secret | Server only |
| `VITE_API_URL` | Client (public API base URL only) |

`.env` is gitignored. Examples use placeholders. Never commit real credentials.

## Database access controls

Application-level only (no row-level security policies in migrations):

- Role checks before mutating quotations/orders/dispatch
- Conditional SQL prevents reserved > physical
- Unique constraints prevent duplicate SO/dispatch

## Login request path (summary)

```
Client POST /api/auth/login
  → validate body
  → find user by email
  → bcrypt.compare
  → sign JWT
  → return { token, user }
Client stores token
Client GET /api/... with Bearer token
  → authenticate
  → requireRole (if any)
  → handler
```

Related: [../features/AUTHENTICATION.md](../features/AUTHENTICATION.md), [../api/API_DOCUMENTATION.md](../api/API_DOCUMENTATION.md).
