# End-to-End Business Workflow

This document describes behavior implemented in `server/src/services/*` and related validators/middleware.

## Happy path

### 1. Login

- `POST /api/auth/login` with email + password  
- Or register / Google OAuth (see [../features/AUTHENTICATION.md](../features/AUTHENTICATION.md))  
- Client stores JWT and loads protected UI  

**Rules:** Invalid credentials → `401` with generic message. Google-only users (null `passwordHash`) cannot password-login.

---

### 2. Customer creation

- Role: **SALES_USER**  
- `POST /api/customers`  
- Required: company name, contact person, mobile, email, city  

**Failure:** Wrong role → `403`. Validation fail → `400`.

---

### 3. Enquiry creation

- Role: **SALES_USER**  
- `POST /api/enquiries`  
- Validates customer exists, products exist, ≥1 item, positive quantities, no duplicate products, `requiredDate ≥ enquiryDate`  
- Status forced to **NEW**  
- Number allocated: `ENQ-######` (serializable transaction)  

**Failure:** Missing customer/product → `404`. Validation → `400`. Number conflict → `409`.

---

### 4. Quotation creation

- Role: **SALES_USER**  
- `POST /api/quotations`  
- Enquiry must exist; items priced with unitPrice, discountPercent, gstPercent  
- Backend computes each `lineAmount` and `grandTotal` (client totals ignored)  
- Status **DRAFT**; number `QUO-######`  
- Customer taken from enquiry  

---

### 5. Quotation status progression

- Role: **ADMIN**  
- `PATCH /api/quotations/:id/status`  

| From | Allowed next |
| --- | --- |
| DRAFT | SENT |
| SENT | ACCEPTED or REJECTED |
| ACCEPTED / REJECTED | none (terminal) |

**Failure:** Invalid transition → `400`. Non-admin → `403`.

---

### 6. Convert accepted quotation → Sales Order

- Role: **SALES_USER**  
- `POST /api/quotations/:id/convert`  
- Quotation must be **ACCEPTED**, have items, and not already have a sales order  
- Creates **PENDING** sales order `SO-######` with same customer, products, quantities, line amounts; `totalAmount = grandTotal`  
- **No inventory change** at conversion  

**Failure:** Not ACCEPTED → `400`. Already converted → `409` (unique `quotationId` / service check).

---

### 7–8. Inventory availability validation & reservation

- Role: **ADMIN**  
- `POST /api/sales-orders/:id/confirm`  
- For each order line, available = physical − reserved must be ≥ quantity  
- Conditional UPDATE increases **reserved** only; **physical** unchanged  
- Status → **CONFIRMED**  
- All lines in one serializable transaction (no partial reservation)  

**Example using seed defaults for `BRG-6205-ZZ`:** Physical 500, Reserved 40, Available 460. Confirming an order for 3 units → Physical 500, Reserved 43, Available 457.

---

### 9. Sales Order confirmation

Same as steps 7–8. Already CONFIRMED → `409`. Non-PENDING → `400`. Concurrent conflict (Prisma P2034) → `409` retry message.

---

### 10–11. Dispatch & inventory update

- Role: **ADMIN**  
- `POST /api/sales-orders/:id/dispatch`  
- Body: dispatchDate, vehicleNumber, driverName  
- Order must be **CONFIRMED**; no existing dispatch  
- **Full order only** — all sales order item quantities  
- Per item: physical −= qty and reserved −= qty (both must remain valid)  
- Creates `DIS-######`; status → **DISPATCHED**  

**Example:** After confirming 3 units on BRG stock above, dispatch 3 → Physical 497, Reserved 40, Available 457 (available unchanged when physical and reserved fall equally).

---

### 12. Final status

Sales order **DISPATCHED**; one Dispatch record linked; inventory reflects consumption.

---

## Failure cases (implemented)

| Scenario | Result |
| --- | --- |
| Convert DRAFT / SENT / REJECTED quotation | `400` |
| Convert ACCEPTED quotation twice | `409` |
| Confirm with insufficient available stock | `400`; order stays PENDING; reserved unchanged |
| Concurrent confirms overselling same stock | One succeeds; other `400` or `409`; reserved never exceeds physical |
| SALES_USER confirms or dispatches | `403` |
| Unauthenticated protected call | `401` |
| Dispatch PENDING / CANCELLED / already DISPATCHED | `400` / `409` as applicable |
| Dispatch missing vehicle/driver | `400` |
| Duplicate dispatch (unique salesOrderId) | `409` |
| Weak / mismatched register password | `400` |
| Duplicate register email | `409` |

## Not implemented

- Partial dispatch of a subset of lines or quantities  
- API to set enquiry status to QUOTED/WON/LOST  
- API to cancel a sales order (`CANCELLED` exists in enum only)  
- Reverse / undo dispatch  

Related: [../features/SALES_ORDERS.md](../features/SALES_ORDERS.md), [../features/INVENTORY.md](../features/INVENTORY.md), [../features/DISPATCH.md](../features/DISPATCH.md).
