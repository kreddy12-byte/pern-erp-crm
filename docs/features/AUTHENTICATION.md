# Feature: Authentication

## Overview

Operators authenticate with email/password, public signup, or Google OAuth. All business APIs use the application JWT after login.

## Login

- UI: `/login`
- API: `POST /api/auth/login`
- On success: store JWT (`pern_erp_access_token`), set user in `AuthContext`, navigate to `/app`

## Signup / register

- UI: `/signup`
- API: `POST /api/auth/register`
- Fields: name, email, password, confirmPassword
- Always creates **SALES_USER**
- Returns same `{ token, user }` shape as login and auto-authenticates

## Password hashing

- bcryptjs, 12 rounds
- Hashes stored in `User.passwordHash`
- Never returned in API responses

## JWT

- Claims: `sub`, `email`, `role`
- Sent as `Authorization: Bearer …`
- Validated by `authenticate` middleware

## Session / token persistence

1. App load → if token in localStorage → `isBootstrapping = true`
2. Call `GET /api/auth/me`
3. Success → restore user; keep current protected route
4. `401` → clear token → treat as logged out
5. Network errors → keep token; show retry (do not bounce to login)

## Logout

- Clears localStorage token and React auth state
- Navigate to `/login`

## Google authentication

**Implemented.**

1. “Continue with Google” → `GET /api/auth/google`
2. Google consent → `/api/auth/google/callback`
3. Server verifies ID token; finds/links/creates user
4. Redirect → `/auth/google/callback?token=…`
5. Frontend `completeSession` → `/app`

New Google users: `SALES_USER`, `passwordHash` null. Existing users keep their role.

Requires Google Cloud OAuth web client env vars on the server. If missing, user is sent to login with `google_not_configured`.

## Role handling

| Source | Role |
| --- | --- |
| Seed / DB | ADMIN or SALES_USER as seeded |
| Public register | Always SALES_USER |
| New Google user | Always SALES_USER |
| Google link to existing | Preserves existing role |

Frontend shows role in the app shell; Admin-only actions are hidden for Sales users and blocked by the API.

See [../architecture/SECURITY.md](../architecture/SECURITY.md).
