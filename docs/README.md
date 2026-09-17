# PERN ERP / CRM — Documentation Index

Production-ready full-stack ERP application for industrial sales operations.

## Project purpose

Support the complete commercial workflow from customer demand capture through quotation, sales order confirmation with inventory reservation, and outbound dispatch — with JWT authentication, role-based access control, and PostgreSQL-backed transactional integrity.

## Technology stack

| Layer | Technology |
| --- | --- |
| Frontend | React, TypeScript, Vite, Tailwind CSS, React Router |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL |
| ORM | Prisma |
| Auth | JWT (`jsonwebtoken`), bcryptjs, Google OAuth (`google-auth-library`) |
| Validation | Zod |
| Testing | Vitest + Supertest (backend) |

## Main modules

| Module | Responsibility |
| --- | --- |
| Authentication | Login, register, Google OAuth, JWT session restore |
| Customers | Master customer records |
| Enquiries | Multi-product customer demand |
| Quotations | Priced responses with backend discount/GST totals |
| Sales Orders | Conversion from accepted quotations; confirmation |
| Inventory | Physical / reserved / available stock |
| Dispatch | Full-order shipment and stock consumption |

## User roles

| Role | Capabilities (enforced on the API) |
| --- | --- |
| **SALES_USER** | Create customers, enquiries, quotations; convert ACCEPTED quotations; view sales orders, inventory, dispatches |
| **ADMIN** | View all records; update quotation status; confirm sales orders (reserve stock); process dispatch |

Frontend UI hides some Admin actions for Sales users; **backend RBAC is authoritative**.

## Main business workflow

```
Customer → Enquiry → Quotation → Sales Order → Inventory Reservation → Dispatch
```

1. Sales user creates customer and enquiry  
2. Sales user creates quotation (DRAFT)  
3. Admin progresses quotation: DRAFT → SENT → ACCEPTED (or REJECTED)  
4. Sales user converts ACCEPTED quotation → PENDING sales order  
5. Admin confirms → reserved quantity increases  
6. Admin dispatches → physical and reserved decrease; order DISPATCHED  

## Documentation navigation

| Document | Description |
| --- | --- |
| [database/SCHEMA.md](./database/SCHEMA.md) | Prisma models, fields, constraints |
| [database/ER_DIAGRAM.md](./database/ER_DIAGRAM.md) | Mermaid ER diagram |
| [architecture/SYSTEM_ARCHITECTURE.md](./architecture/SYSTEM_ARCHITECTURE.md) | Layered system design |
| [architecture/WORKFLOW.md](./architecture/WORKFLOW.md) | End-to-end business rules |
| [architecture/SECURITY.md](./architecture/SECURITY.md) | Auth, RBAC, secrets |
| [api/API_DOCUMENTATION.md](./api/API_DOCUMENTATION.md) | All REST endpoints |
| [features/AUTHENTICATION.md](./features/AUTHENTICATION.md) | Login, signup, Google, JWT |
| [features/ENQUIRIES.md](./features/ENQUIRIES.md) | Customers and enquiries |
| [features/QUOTATIONS.md](./features/QUOTATIONS.md) | Pricing and status |
| [features/SALES_ORDERS.md](./features/SALES_ORDERS.md) | Conversion and confirmation |
| [features/INVENTORY.md](./features/INVENTORY.md) | Stock model and reservation |
| [features/DISPATCH.md](./features/DISPATCH.md) | Shipment and consumption |
| [testing/TEST_DOCUMENTATION.md](./testing/TEST_DOCUMENTATION.md) | Backend test suite |
| [demo/DEMO_SCRIPT.md](./demo/DEMO_SCRIPT.md) | 5-minute reviewer script |

Legacy overview files also exist at the repository root (`README.md`) and historically at `docs/API.md`, `docs/ARCHITECTURE.md`, `docs/DATABASE.md`. Prefer this structured set for evaluation.

## Local development overview

1. Install dependencies in `server/` and `client/`  
2. Configure `server/.env` from `server/.env.example` (placeholders only)  
3. Configure `client/.env` with `VITE_API_URL`  
4. Run Prisma migrate + generate + seed  
5. Start API (`npm run dev` in `server`) and Vite (`npm run dev` in `client`)  
6. Run tests: `npm test` in `server`  

See root `README.md` for detailed commands.

## Production deployment overview

| Component | Implementation in repo |
| --- | --- |
| Frontend SPA routing | `client/vercel.json` rewrites all paths to `/index.html` for Vercel |
| Backend hosting | **Not implemented in-repo** (no Docker / Render / Railway configs) |
| Database | External PostgreSQL via `DATABASE_URL` |

Deploy the Vite `client` build to Vercel (or any static host that uses the SPA rewrite). Deploy the Express `server` separately to a Node host with PostgreSQL and the required environment variables.
