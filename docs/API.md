# API Documentation

Base URL (local): `http://localhost:5000`

Authentication header for protected routes:

```
Authorization: Bearer <access_token>
```

Success responses generally use:

```json
{ "success": true, "data": { } }
```

Errors:

```json
{ "success": false, "message": "..." }
```

Common status codes: `400` validation/business rule, `401` unauthenticated, `403` forbidden, `404` not found, `409` conflict.

---

## Auth

### POST `/api/auth/login`

Authentication: none

Body:

```json
{ "email": "sales@pern-erp.local", "password": "********" }
```

Response: JWT + safe user (`id`, `email`, `name`, `role`). Never returns `passwordHash`.

### POST `/api/auth/register`

Authentication: none

Body:

```json
{
  "name": "User Name",
  "email": "user@example.com",
  "password": "Password123!",
  "confirmPassword": "Password123!"
}
```

Creates a **SALES_USER** (never ADMIN). Returns the same JWT structure as login (`201`).

Common errors: `400` validation, `409` email already exists.

### GET `/api/auth/google`

Authentication: none

Starts Google OAuth (authorization code). Redirects the browser to Google.

Requires server env: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`.

### GET `/api/auth/google/callback`

Authentication: none (Google redirect)

Exchanges the code, verifies Google ID token, finds/creates local user, then redirects to:

`{CLIENT_URL}/auth/google/callback?token=<app_jwt>`

On cancel/failure redirects to `/login?error=google_cancelled|google_failed|google_not_configured`.

### GET `/api/auth/me`

Authentication: required

Returns the current user profile.

---

## Customers

### GET `/api/customers`

Auth + roles: ADMIN, SALES_USER

### POST `/api/customers`

Auth + role: **SALES_USER**

Body: `companyName`, `contactPerson`, `mobile`, `email`, `city`

---

## Products

### GET `/api/products`

Auth + roles: ADMIN, SALES_USER

Returns catalog fields including `basePrice` (string decimal).

---

## Enquiries

### GET `/api/enquiries`

Auth + roles: ADMIN, SALES_USER — newest first, includes customer + items/products

### GET `/api/enquiries/:id`

Auth + roles: ADMIN, SALES_USER

### POST `/api/enquiries`

Auth + role: **SALES_USER**

Body:

```json
{
  "customerId": "...",
  "enquiryDate": "2026-04-01",
  "requiredDate": "2026-04-15",
  "notes": "optional",
  "items": [{ "productId": "...", "quantity": 10 }]
}
```

Backend generates `enquiryNumber` (`ENQ-000001`). Status always starts `NEW`.

---

## Quotations

### GET `/api/quotations` / GET `/api/quotations/:id`

Auth + roles: ADMIN, SALES_USER

Includes customer, enquiry, items, optional linked `salesOrder`.

### POST `/api/quotations`

Auth + role: **SALES_USER**

Body: `enquiryId`, `validUntil`, `items[]` with `productId`, `quantity`, `unitPrice`, `discountPercent`, `gstPercent`

Backend calculates line amounts and `grandTotal`. Status starts `DRAFT`. Number `QUO-000001`.

### PATCH `/api/quotations/:id/status`

Auth + role: **ADMIN**

Body: `{ "status": "SENT" | "ACCEPTED" | "REJECTED" }`

Allowed: `DRAFT→SENT`, `SENT→ACCEPTED|REJECTED`

### POST `/api/quotations/:id/convert`

Auth + role: **SALES_USER**

Converts **ACCEPTED** quotation to **PENDING** sales order. Rejects duplicates (`409`).

---

## Sales Orders

### GET `/api/sales-orders` / GET `/api/sales-orders/:id`

Auth + roles: ADMIN, SALES_USER

Includes customer, quotation/enquiry, items + inventory availability, optional dispatch.

### POST `/api/sales-orders/:id/confirm`

Auth + role: **ADMIN**

Confirms **PENDING** order and reserves inventory (physical unchanged, reserved increases). Idempotent protection: already confirmed → `409`.

### POST `/api/sales-orders/:id/dispatch`

Auth + role: **ADMIN**

Body:

```json
{
  "dispatchDate": "2026-10-10",
  "vehicleNumber": "MH12AB1234",
  "driverName": "Ramesh Patil"
}
```

Only **CONFIRMED** orders. Full order quantities. Creates `DIS-######`, decreases physical + reserved, sets status **DISPATCHED**. Duplicate → `409`.

---

## Inventory

### GET `/api/inventory`

Auth + roles: ADMIN, SALES_USER

Returns `physicalQuantity`, `reservedQuantity`, and derived `availableQuantity`.

---

## Dispatches

### GET `/api/dispatches` / GET `/api/dispatches/:id`

Auth + roles: ADMIN, SALES_USER

Includes sales order, customer, products/quantities via sales order items.

---

## Health

### GET `/api/health`

Public health check.
