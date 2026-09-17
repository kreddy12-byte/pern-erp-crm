# Test Documentation

## Framework

| Item | Value |
| --- | --- |
| Runner | **Vitest** (`vitest run`) |
| HTTP | **Supertest** against Express app |
| Location | `server/src/*.test.ts` |
| Frontend tests | **Not implemented** |

Command:

```bash
cd server
npm test
```

## Suite size

Verified from test source (`it(` counts):

| File | Tests |
| --- | --- |
| `auth.test.ts` | 11 |
| `auth.register.test.ts` | 13 |
| `enquiries.test.ts` | 16 |
| `quotations.test.ts` | 21 |
| `salesOrders.test.ts` | 12 |
| `dispatch.test.ts` | 10 |
| **Total** | **83** |

Last documented full run in this project’s Phase 8 / auth work reported **83/83 PASS**. Re-run `npm test` locally to confirm on your machine.

---

## Coverage by area

### Authentication (`auth.test.ts`, `auth.register.test.ts`)

- Valid login; invalid password; unknown user
- Missing / invalid / expired JWT on protected routes
- `/api/auth/me` and absence of `passwordHash` in responses
- RBAC 403 vs allow for ADMIN
- Bcrypt hashes for seeded/test users
- Register success, duplicate email, invalid email, weak password, mismatch
- Public signup always SALES_USER (ignores attempted ADMIN)
- Login after signup; `/me` after signup
- Google profile create/link; OAuth start redirect; cancel/fail/success callback redirects (Google exchange mocked where needed)

### Enquiries (`enquiries.test.ts`)

- Customer create/list; authz
- Enquiry create with multiple products; number format
- Invalid customer/product/quantity; duplicate lines
- Transaction integrity; list/detail/404

### Quotations (`quotations.test.ts`)

- Create; line/grand total calculation; discount & GST
- Status transitions and invalid transitions
- RBAC; uniqueness; validation failures

### Sales orders & inventory (`salesOrders.test.ts`)

- ACCEPTED conversion; reject DRAFT/etc.
- Duplicate conversion
- Confirm reservation; insufficient stock atomic failure
- Concurrent confirmations never reserve beyond physical
- Available = physical − reserved

### Dispatch (`dispatch.test.ts`)

- Valid dispatch inventory math
- Invalid status; duplicate dispatch
- Validation; RBAC; auth; list/detail

---

## Test matrix

| Test Area | What is Tested | Expected Result |
| --- | --- | --- |
| Auth login | Correct credentials | `200` + JWT + safe user |
| Auth login | Wrong password | `401` generic message |
| Protected API | No / bad token | `401` |
| RBAC | SALES_USER hits Admin route | `403` |
| RBAC | ADMIN allowed route | `200` |
| Register | Valid payload | `201`, role `SALES_USER` |
| Register | Duplicate email | `409` |
| Register | Weak / mismatch password | `400` |
| Enquiry | Multi-product create | Persisted items + `ENQ-` number |
| Enquiry | Invalid qty / customer | `400` / `404` |
| Quotation totals | Known qty/price/discount/GST | Server lineAmount & grandTotal match formula |
| Quotation status | Illegal transition | `400` |
| SO convert | ACCEPTED | PENDING SO created |
| SO convert | DRAFT / REJECTED | Rejected (`400`) |
| SO convert | Twice | Second `409` |
| Confirm stock | Available &lt; requested | `400`; reserved unchanged; still PENDING |
| Confirm concurrency | Two orders vs limited available | One success; reserved ≤ physical |
| Dispatch | CONFIRMED + valid body | Physical & reserved decrease; DISPATCHED |
| Dispatch | Duplicate / wrong status | `409` / `400` |
| Dispatch RBAC | SALES_USER | `403` |

---

## Mandatory business tests (present in suite)

| Requirement | Covered |
| --- | --- |
| Quotation total calculation | Yes (`quotations.test.ts`) |
| Draft/rejected cannot create SO | Yes (`salesOrders.test.ts`) |
| Duplicate Sales Order prevention | Yes |
| Reservation &gt; available stock | Yes |
| Unauthorized restricted operation | Yes (auth + confirm/dispatch RBAC) |
| Concurrent oversell prevention | Yes |

## Not claimed

- Frontend unit/E2E automated tests (none in repo)
- 100% line coverage metrics (not configured/reported here)

Related: root README testing section; Vitest config `server/vitest.config.ts`.
