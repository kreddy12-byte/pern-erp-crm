# PERN ERP

Full-stack ERP application for a sales-to-dispatch workflow, built with the PERN stack.

## Project overview

PERN ERP supports industrial sales operations from customer enquiry through quotation, sales order confirmation with inventory reservation, and final dispatch.

## Business workflow

```
Customer
  → Enquiry
  → Quotation
  → Sales Order
  → Inventory Reservation
  → Dispatch
```

## Roles

| Role | Capabilities |
| --- | --- |
| **SALES_USER** | Create customers/enquiries/quotations; convert ACCEPTED quotations to sales orders; view sales orders, inventory, and dispatches |
| **ADMIN** | View all records; update quotation status; confirm sales orders (reserve stock); process dispatch |

Authorization is enforced on the **backend** with JWT + RBAC. Frontend UI restrictions are convenience only.

## Technology stack

| Layer | Stack |
| --- | --- |
| Frontend | React, TypeScript, Vite, Tailwind CSS |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL |
| ORM | Prisma |
| Auth | JWT, bcryptjs |
| Validation | Zod |
| Testing | Vitest + Supertest |

## Architecture

```
React (Vite)
  → REST API (JSON + Bearer JWT)
  → Express routes
  → Controllers
  → Services (business logic + transactions)
  → Prisma ORM
  → PostgreSQL
```

- Authentication: JWT verification middleware
- Authorization: `requireRole(...)` middleware
- Validation: Zod schemas on write endpoints
- Business logic & transactions: service layer

## Database design

Major entities:

- `User` — ADMIN / SALES_USER
- `Customer` — buying company
- `Product` + `Inventory` — catalog and stock (1:1)
- `Enquiry` + `EnquiryItem`
- `Quotation` + `QuotationItem`
- `SalesOrder` + `SalesOrderItem`
- `Dispatch` — one dispatch per sales order

Important uniqueness:

- `User.email`, `Product.productCode`, `Inventory.productId`
- Document numbers: `ENQ-`, `QUO-`, `SO-`, `DIS-`
- One quotation → at most one sales order
- One sales order → at most one dispatch

See `docs/DATABASE.md` and the ER diagram below.

## Inventory logic

```
Available = Physical Quantity − Reserved Quantity
```

Available is **never stored**.

| Event | Physical | Reserved |
| --- | --- | --- |
| Confirm sales order | unchanged | **increases** |
| Dispatch | **decreases** | **decreases** |

Reservation and dispatch run inside Prisma transactions with conditional SQL updates so concurrent operations cannot push reserved above physical.

## Security

- Passwords stored as bcrypt hashes only (Google-only accounts have no password)
- Public **Sign up** and **Google OAuth** always create `SALES_USER` — never `ADMIN`
- Google identity is verified server-side via official OAuth/ID token validation (`google-auth-library`)
- JWT signed with server `JWT_SECRET` (never exposed to Vite)
- Protected APIs require `Authorization: Bearer <token>`
- Role checks enforced server-side
- Frontend may store the access token in `localStorage` for this assignment (XSS tradeoff documented)

## API overview

| Area | Endpoints |
| --- | --- |
| Auth | `POST /api/auth/login`, `POST /api/auth/register`, `GET /api/auth/google`, `GET /api/auth/google/callback`, `GET /api/auth/me` |
| Customers | `GET/POST /api/customers` |
| Products | `GET /api/products` |
| Enquiries | `GET/POST /api/enquiries`, `GET /api/enquiries/:id` |
| Quotations | `GET/POST /api/quotations`, `GET /api/quotations/:id`, `PATCH /api/quotations/:id/status`, `POST /api/quotations/:id/convert` |
| Sales orders | `GET /api/sales-orders`, `GET /api/sales-orders/:id`, `POST /api/sales-orders/:id/confirm`, `POST /api/sales-orders/:id/dispatch` |
| Inventory | `GET /api/inventory` |
| Dispatches | `GET /api/dispatches`, `GET /api/dispatches/:id` |

Full details: `docs/API.md`

## Setup

### 1. Install dependencies

```powershell
cd C:\Fundsroom2\server
npm install

cd C:\Fundsroom2\client
npm install
```

### 2. Environment

```powershell
Copy-Item server\.env.example server\.env
Copy-Item client\.env.example client\.env
```

Configure `server/.env` (placeholders only in examples):

```
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/pern_erp?schema=public
JWT_SECRET=change-me-to-a-long-random-secret
JWT_EXPIRES_IN=8h
PORT=5000
CLIENT_URL=http://localhost:5173
NODE_ENV=development
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
```

Google Cloud Console: create a **Web application** OAuth client. Authorized JavaScript origin `http://localhost:5173`. Authorized redirect URI must match `GOOGLE_CALLBACK_URL`.

Create database if needed:

```sql
CREATE DATABASE pern_erp;
```

### 3. Migrate + seed

```powershell
cd C:\Fundsroom2\server
npx prisma migrate deploy
npx prisma generate
npx prisma db seed
```

Seed includes 6 industrial products with inventory, sample customers/enquiries, and development ADMIN + SALES_USER accounts (password hashes only). Override seed credentials with `SEED_*` env vars if desired — do not commit real secrets.

### 4. Run

```powershell
# Backend
cd C:\Fundsroom2\server
npm run dev

# Frontend
cd C:\Fundsroom2\client
npm run dev
```

- API: `http://localhost:5000`
- App: `http://localhost:5173`

### 5. Tests

```powershell
cd C:\Fundsroom2\server
npm test
```

## Project structure

```
Fundsroom2/
├── client/                 # React + Vite frontend
│   └── src/
│       ├── api/
│       ├── auth/
│       ├── pages/
│       └── App.tsx
├── server/                 # Express + Prisma API
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   └── src/
│       ├── config/
│       ├── controllers/
│       ├── middleware/
│       ├── routes/
│       ├── services/
│       ├── validators/
│       └── utils/
├── docs/
│   ├── API.md
│   ├── ARCHITECTURE.md
│   └── DATABASE.md
└── README.md
```

## Evaluation / demo flow

1. Login as **SALES_USER**
2. Create/select a customer and create an **Enquiry** (multiple products)
3. Create a **Quotation** from that enquiry
4. Login as **ADMIN** → mark quotation **SENT** → **ACCEPTED**
5. Login as **SALES_USER** → **Convert to Sales Order**
6. Login as **ADMIN** → **Confirm** sales order (inventory reserved)
7. **Dispatch** the confirmed order (vehicle + driver)
8. Verify inventory Physical/Reserved/Available and dispatch record

## ER diagram

```mermaid
erDiagram
  User {
    string id PK
    string email UK
    string passwordHash
    enum role
  }
  Customer {
    string id PK
    string companyName
  }
  Product {
    string id PK
    string productCode UK
  }
  Inventory {
    string id PK
    string productId UK
    int physicalQuantity
    int reservedQuantity
  }
  Enquiry {
    string id PK
    string enquiryNumber UK
    string customerId FK
  }
  EnquiryItem {
    string id PK
    string enquiryId FK
    string productId FK
    int quantity
  }
  Quotation {
    string id PK
    string quotationNumber UK
    string enquiryId FK
    string customerId FK
  }
  QuotationItem {
    string id PK
    string quotationId FK
    string productId FK
  }
  SalesOrder {
    string id PK
    string orderNumber UK
    string quotationId UK
    string customerId FK
  }
  SalesOrderItem {
    string id PK
    string salesOrderId FK
    string productId FK
  }
  Dispatch {
    string id PK
    string dispatchNumber UK
    string salesOrderId UK
  }

  Customer ||--o{ Enquiry : has
  Enquiry ||--o{ EnquiryItem : contains
  Product ||--o{ EnquiryItem : referenced
  Product ||--|| Inventory : stocks
  Enquiry ||--o{ Quotation : quoted_as
  Customer ||--o{ Quotation : billed_to
  Quotation ||--o{ QuotationItem : contains
  Product ||--o{ QuotationItem : referenced
  Quotation ||--o| SalesOrder : converts_to
  Customer ||--o{ SalesOrder : ordered_by
  SalesOrder ||--o{ SalesOrderItem : contains
  Product ||--o{ SalesOrderItem : referenced
  SalesOrder ||--o| Dispatch : shipped_as
```

## Documentation index

- `docs/API.md` — endpoint reference
- `docs/DATABASE.md` — schema, constraints, inventory rules
- `docs/ARCHITECTURE.md` — layers and cross-cutting concerns
