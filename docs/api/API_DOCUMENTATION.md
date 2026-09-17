# API Documentation

Base URL (local): `http://localhost:5000`  
Mount prefix: `/api`

Success envelope (typical):

```json
{ "success": true, "data": { } }
```

Error envelope:

```json
{ "success": false, "message": "..." }
```

Protected routes require:

```http
Authorization: Bearer <jwt>
```

---

## Health

### GET `/api/health`

| | |
| --- | --- |
| Auth | None |
| Purpose | Liveness check |
| Success | `{ status, service, timestamp }` style payload from health controller |

---

## Authentication

### POST `/api/auth/login`

| | |
| --- | --- |
| Auth | None |
| Body | `{ "email": string, "password": string }` |
| Success `200` | `{ token, user: { id, email, name, role } }` |
| Errors | `400` validation; `401` invalid credentials |

### POST `/api/auth/register`

| | |
| --- | --- |
| Auth | None |
| Body | `{ "name", "email", "password", "confirmPassword" }` |
| Success `201` | Same shape as login; role always `SALES_USER` |
| Errors | `400` validation/mismatch/weak password; `409` email exists |

### GET `/api/auth/me`

| | |
| --- | --- |
| Auth | Required |
| Success `200` | `{ id, email, name, role }` |
| Errors | `401` |

### GET `/api/auth/google`

| | |
| --- | --- |
| Auth | None |
| Purpose | Start Google OAuth; redirects to Google (or client login with error if not configured) |

### GET `/api/auth/google/callback`

| | |
| --- | --- |
| Auth | None (Google redirect) |
| Query | `code`, `state`, or `error` |
| Success | Redirect to `{CLIENT_URL}/auth/google/callback?token=<app_jwt>` |
| Failure | Redirect to `/login?error=google_cancelled\|google_failed\|google_not_configured` |

---

## Customers

### GET `/api/customers`

| | |
| --- | --- |
| Auth | Required |
| Roles | ADMIN, SALES_USER |
| Success | Array of customers |

### POST `/api/customers`

| | |
| --- | --- |
| Auth | Required |
| Roles | **SALES_USER** |
| Body | `{ companyName, contactPerson, mobile, email, city }` |
| Errors | `400`, `403` |

---

## Products

### GET `/api/products`

| | |
| --- | --- |
| Auth | Required |
| Roles | ADMIN, SALES_USER |
| Success | Catalog including `basePrice` (decimal string in JSON serialization) |

---

## Enquiries

### GET `/api/enquiries`

| | |
| --- | --- |
| Auth | Required |
| Roles | ADMIN, SALES_USER |
| Success | List with customer + items/products |

### GET `/api/enquiries/:id`

| | |
| --- | --- |
| Auth | Required |
| Roles | ADMIN, SALES_USER |
| Path | `id` |
| Errors | `404` |

### POST `/api/enquiries`

| | |
| --- | --- |
| Auth | Required |
| Roles | **SALES_USER** |
| Body | `{ customerId, enquiryDate, requiredDate, notes?, items: [{ productId, quantity }] }` |
| Success | Enquiry with generated `enquiryNumber`, status `NEW` |
| Errors | `400`, `403`, `404`, `409` |

---

## Quotations

### GET `/api/quotations`

| | |
| --- | --- |
| Auth | Required |
| Roles | ADMIN, SALES_USER |

### GET `/api/quotations/:id`

| | |
| --- | --- |
| Auth | Required |
| Roles | ADMIN, SALES_USER |
| Errors | `404` |

### POST `/api/quotations`

| | |
| --- | --- |
| Auth | Required |
| Roles | **SALES_USER** |
| Body | `{ enquiryId, validUntil, items: [{ productId, quantity, unitPrice, discountPercent, gstPercent }] }` |
| Success | Quotation `DRAFT` with server-computed `lineAmount` / `grandTotal` |
| Errors | `400`, `403`, `404`, `409` |

### PATCH `/api/quotations/:id/status`

| | |
| --- | --- |
| Auth | Required |
| Roles | **ADMIN** |
| Body | `{ "status": "SENT" \| "ACCEPTED" \| "REJECTED" }` (service enforces allowed transitions) |
| Errors | `400` invalid transition; `403`; `404` |

### POST `/api/quotations/:id/convert`

| | |
| --- | --- |
| Auth | Required |
| Roles | **SALES_USER** |
| Purpose | ACCEPTED quotation → PENDING sales order |
| Errors | `400` not accepted; `409` already converted; `403`; `404` |

---

## Sales Orders

### GET `/api/sales-orders`

| | |
| --- | --- |
| Auth | Required |
| Roles | ADMIN, SALES_USER |

### GET `/api/sales-orders/:id`

| | |
| --- | --- |
| Auth | Required |
| Roles | ADMIN, SALES_USER |
| Notes | Includes items with inventory availability fields |

### POST `/api/sales-orders/:id/confirm`

| | |
| --- | --- |
| Auth | Required |
| Roles | **ADMIN** |
| Purpose | PENDING → CONFIRMED; reserve inventory |
| Errors | `400` insufficient stock / wrong status; `409` already confirmed / concurrency; `403` |

### POST `/api/sales-orders/:id/dispatch`

| | |
| --- | --- |
| Auth | Required |
| Roles | **ADMIN** |
| Body | `{ dispatchDate, vehicleNumber, driverName }` |
| Purpose | Full dispatch of CONFIRMED order |
| Errors | `400` validation/wrong status; `409` duplicate; `403` |

---

## Inventory

### GET `/api/inventory`

| | |
| --- | --- |
| Auth | Required |
| Roles | ADMIN, SALES_USER |
| Success | Rows with `physicalQuantity`, `reservedQuantity`, derived `availableQuantity`, product |

---

## Dispatches

### GET `/api/dispatches`

| | |
| --- | --- |
| Auth | Required |
| Roles | ADMIN, SALES_USER |

### GET `/api/dispatches/:id`

| | |
| --- | --- |
| Auth | Required |
| Roles | ADMIN, SALES_USER |
| Errors | `404` |

---

## Endpoints not implemented

There is **no** separate REST resource for:

- Updating enquiry status  
- Cancelling sales orders  
- Partial dispatch  
- Product/inventory write APIs (seed/admin DB only for catalog stock)  

Related: [../architecture/SECURITY.md](../architecture/SECURITY.md), [../features/AUTHENTICATION.md](../features/AUTHENTICATION.md).
