# Demo Script (≈ 5 minutes)

Spoken script for a reviewer demo. Emphasize **backend business correctness**, not visual polish.

Seed reference product used in the inventory story: **`BRG-6205-ZZ`** — seeded as Physical **500**, Reserved **40**, Available **460** (live numbers may differ if the database was already used; open Inventory and read current values on screen).

---

## 0:00–0:20 — Introduction

**SCREEN ACTION:** Show Overview page after login (or the login screen briefly).

**WHAT TO SAY:**  
“This is a PERN ERP for industrial sales. The workflow is Customer Enquiry, Quotation, Sales Order with inventory reservation, then Dispatch. The important part is that rules and stock updates run in the Express service layer with Prisma transactions — not only in the UI.”

**KEY POINT:** Full workflow + transactional backend.

---

## 0:20–0:45 — Login / RBAC

**SCREEN ACTION:** Log in as **SALES_USER**. Point at role badge. Mention Admin later. Optionally show that Confirm/Dispatch controls are not available to Sales.

**WHAT TO SAY:**  
“We use JWT authentication with bcrypt password hashes. Roles are ADMIN and SALES_USER. The API enforces RBAC — Sales can create demand documents; only Admin confirms reservations and dispatches. Hiding buttons in React is convenience; the server returns 403 if a Sales user hits those endpoints.”

**KEY POINT:** JWT + server-side RBAC.

---

## 0:45–1:20 — Customer + Enquiry

**SCREEN ACTION:** Open **Enquiries**. Create or select a customer. Create an enquiry with **two products** and positive quantities. Show the generated `ENQ-######` and status NEW.

**WHAT TO SAY:**  
“Sales creates a customer and a multi-product enquiry. The backend validates the customer, products, quantities, and unique product lines, then allocates an enquiry number inside a serializable transaction so document numbers stay consistent.”

**KEY POINT:** Validation + transactional document numbering.

---

## 1:20–2:00 — Quotation

**SCREEN ACTION:** Open **Quotations**. Create a quotation from that enquiry with unit price, discount, and GST. Show **grand total from the API response**. Log in as **ADMIN** (or switch user) and move status DRAFT → SENT → ACCEPTED.

**WHAT TO SAY:**  
“Line amounts and grand total are calculated on the server — quantity times price, minus discount, plus GST. The client cannot force a fake total. Status is Admin-controlled: Draft to Sent to Accepted. Only Accepted quotations can become sales orders.”

**KEY POINT:** Server-side pricing + status machine.

---

## 2:00–2:45 — Sales Order + reservation preview

**SCREEN ACTION:** As **SALES_USER**, convert the Accepted quotation. Show PENDING sales order `SO-######`. Open **Inventory** and note Available for a product on the order (e.g. BRG if used).

**WHAT TO SAY:**  
“Conversion copies customer, products, and amounts into a Pending sales order. Inventory does not change yet. The unique quotation id prevents a second sales order from the same quotation.”

**KEY POINT:** Convert without stock change; duplicate conversion blocked.

---

## 2:45–3:30 — Admin confirm + Dispatch

**SCREEN ACTION:** As **ADMIN**, confirm the sales order. Refresh Inventory: **Physical unchanged, Reserved up, Available down**. Then Dispatch with vehicle number and driver. Show order DISPATCHED and `DIS-######`. Inventory: Physical and Reserved both down.

**WHAT TO SAY:**  
“On confirm, reserved quantity increases with a conditional update so we never reserve more than available — and it’s all-or-nothing across lines. On dispatch, we decrease physical and reserved together for the full order, create the dispatch record, and mark the order Dispatched in one transaction. Partial dispatch is not allowed.”

**KEY POINT:** Reservation then consumption; atomic; Admin-only.

**Concrete seed example (if stock still at seed levels for BRG-6205-ZZ):**  
Before confirm: 500 / 40 / 460. After reserving 3: 500 / 43 / 457. After dispatch 3: 497 / 40 / 457.

---

## 3:30–4:10 — Database / business logic

**SCREEN ACTION:** Optionally flash Prisma schema or docs ER diagram; or stay on Inventory + Sales Order detail showing links quotation → order → dispatch.

**WHAT TO SAY:**  
“PostgreSQL via Prisma holds Users, Customers, Products, Inventory, and the document chain with line items. Available stock is never stored — it’s physical minus reserved. Unique constraints enforce one sales order per quotation and one dispatch per order.”

**KEY POINT:** Relational integrity + derived availability.

---

## 4:10–4:40 — Testing / security / deployment

**SCREEN ACTION:** Mention `npm test` in server (83 Vitest/Supertest cases). Briefly mention signup/Google if asked. Mention Vercel SPA rewrite for the frontend.

**WHAT TO SAY:**  
“The backend suite covers auth, RBAC, enquiry and quotation rules, sales-order conversion, insufficient stock, concurrency on reservation, and dispatch. Secrets stay in server environment variables. The React app is a SPA; Vercel is configured to rewrite routes to index.html so refresh on /app works.”

**KEY POINT:** Automated business tests + secure config boundaries.

---

## 4:40–5:00 — Conclusion

**SCREEN ACTION:** Return to Overview.

**WHAT TO SAY:**  
“So the system demonstrates a complete sales-to-dispatch ERP path with JWT roles, server-side calculations, and transactional inventory — built as a PERN stack suitable for evaluation and demo.”

**KEY POINT:** Close on correctness of the workflow.

---

## Short answer: “What was your role in the project?”

**WHAT TO SAY:**  
“I focused on making the application evaluation-ready and operable: validating the end-to-end workflow against the business rules, supporting the automated backend test suite, documenting architecture and APIs accurately from the source, and helping with production frontend concerns such as SPA routing on Vercel and environment-based configuration — without changing the core sales domain logic.”

---

## Optional failure demos (if time)

| Demo | Action | Expected |
| --- | --- | --- |
| Unauthorized | Sales user calls confirm (or show hidden UI + mention API 403) | Forbidden |
| Bad convert | Try convert while DRAFT | Rejected |
| Bad stock | Confirm order larger than Available | Error; PENDING unchanged |

Related: [../architecture/WORKFLOW.md](../architecture/WORKFLOW.md), [../testing/TEST_DOCUMENTATION.md](../testing/TEST_DOCUMENTATION.md).
