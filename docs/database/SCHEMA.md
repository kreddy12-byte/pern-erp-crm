# Database Schema

Source of truth: `server/prisma/schema.prisma`  
SQL CHECKs: `server/prisma/migrations/20260916233017_init_erp_schema/migration.sql`  
Auth extension: `server/prisma/migrations/20260917013000_auth_google_signup/migration.sql`

ORM: **Prisma** · Database: **PostgreSQL**

---

## Enums

### Role

`ADMIN` | `SALES_USER`

### EnquiryStatus

`NEW` | `QUOTED` | `WON` | `LOST`  

Default on create: `NEW`.  
**Note:** Application services currently create enquiries as `NEW` only; there is no API that updates enquiry status to `QUOTED` / `WON` / `LOST`.

### QuotationStatus

`DRAFT` | `SENT` | `ACCEPTED` | `REJECTED`  

Default: `DRAFT`.

### SalesOrderStatus

`PENDING` | `CONFIRMED` | `DISPATCHED` | `CANCELLED`  

Default: `PENDING`.  
**Note:** No service currently sets `CANCELLED`; it is checked as a block when dispatching.

---

## Model: User

| Field | Type | Required | Default | Notes |
| --- | --- | --- | --- | --- |
| id | String | PK | `cuid()` | |
| name | String | yes | — | |
| email | String | yes | — | `@unique` |
| passwordHash | String? | no | — | Null for Google-only accounts |
| googleId | String? | no | — | `@unique`; Google OpenID subject |
| role | Role | yes | — | |
| createdAt | DateTime | yes | `now()` | |
| updatedAt | DateTime | yes | `@updatedAt` | |

**Relationships:** none to domain entities (auth identity only).

---

## Model: Customer

| Field | Type | Required | Default | Notes |
| --- | --- | --- | --- | --- |
| id | String | PK | `cuid()` | |
| companyName | String | yes | — | indexed |
| contactPerson | String | yes | — | |
| mobile | String | yes | — | |
| email | String | yes | — | indexed (not unique) |
| city | String | yes | — | |
| createdAt | DateTime | yes | `now()` | |
| updatedAt | DateTime | yes | `@updatedAt` | |

**Relationships:**

- `Customer` 1 → * `Enquiry`
- `Customer` 1 → * `Quotation`
- `Customer` 1 → * `SalesOrder`

---

## Model: Product

| Field | Type | Required | Default | Notes |
| --- | --- | --- | --- | --- |
| id | String | PK | `cuid()` | |
| productCode | String | yes | — | `@unique` |
| productName | String | yes | — | indexed |
| category | String | yes | — | indexed |
| unit | String | yes | — | e.g. PCS, MTR |
| basePrice | Decimal(12,2) | yes | — | CHECK `>= 0` |
| createdAt | DateTime | yes | `now()` | |
| updatedAt | DateTime | yes | `@updatedAt` | |

**Relationships:**

- `Product` 1 → 0..1 `Inventory`
- `Product` 1 → * `EnquiryItem` / `QuotationItem` / `SalesOrderItem`

---

## Model: Inventory

| Field | Type | Required | Default | Notes |
| --- | --- | --- | --- | --- |
| id | String | PK | `cuid()` | |
| productId | String | yes | — | `@unique` FK → Product (Restrict) |
| physicalQuantity | Int | yes | — | CHECK `>= 0` |
| reservedQuantity | Int | yes | `0` | CHECK `>= 0` and `<= physicalQuantity` |
| createdAt | DateTime | yes | `now()` | |
| updatedAt | DateTime | yes | `@updatedAt` | |

### Available inventory (derived, not stored)

```
availableQuantity = physicalQuantity − reservedQuantity
```

Returned by the inventory API and sales-order serialization; **never a database column**.

---

## Model: Enquiry

| Field | Type | Required | Default | Notes |
| --- | --- | --- | --- | --- |
| id | String | PK | `cuid()` | |
| enquiryNumber | String | yes | — | `@unique`; format `ENQ-######` |
| customerId | String | yes | — | FK → Customer (Restrict); indexed |
| enquiryDate | DateTime | yes | — | indexed |
| requiredDate | DateTime | yes | — | |
| notes | String? | no | — | |
| status | EnquiryStatus | yes | `NEW` | indexed |
| createdAt / updatedAt | DateTime | yes | | |

**Relationships:**

- `Enquiry` * → 1 `Customer`
- `Enquiry` 1 → * `EnquiryItem`
- `Enquiry` 1 → * `Quotation`

---

## Model: EnquiryItem

| Field | Type | Required | Default | Notes |
| --- | --- | --- | --- | --- |
| id | String | PK | `cuid()` | |
| enquiryId | String | yes | — | FK → Enquiry (Cascade); indexed |
| productId | String | yes | — | FK → Product (Restrict); indexed |
| quantity | Int | yes | — | CHECK `> 0` |

**Unique:** `@@unique([enquiryId, productId])` — one line per product per enquiry.

---

## Model: Quotation

| Field | Type | Required | Default | Notes |
| --- | --- | --- | --- | --- |
| id | String | PK | `cuid()` | |
| quotationNumber | String | yes | — | `@unique`; `QUO-######` |
| enquiryId | String | yes | — | FK → Enquiry (Restrict); indexed |
| customerId | String | yes | — | FK → Customer (Restrict); indexed |
| validUntil | DateTime | yes | — | |
| status | QuotationStatus | yes | `DRAFT` | indexed |
| grandTotal | Decimal(14,2) | yes | — | CHECK `>= 0`; computed server-side |
| createdAt / updatedAt | DateTime | yes | | |

**Relationships:**

- `Quotation` * → 1 `Enquiry`, `Customer`
- `Quotation` 1 → * `QuotationItem`
- `Quotation` 1 → 0..1 `SalesOrder` (`SalesOrder.quotationId` unique)

---

## Model: QuotationItem

| Field | Type | Required | Default | Notes |
| --- | --- | --- | --- | --- |
| id | String | PK | `cuid()` | |
| quotationId | String | yes | — | FK → Quotation (Cascade) |
| productId | String | yes | — | FK → Product (Restrict) |
| quantity | Int | yes | — | CHECK `> 0` |
| unitPrice | Decimal(12,2) | yes | — | CHECK `>= 0` |
| discountPercent | Decimal(5,2) | yes | `0` | CHECK `0..100` |
| gstPercent | Decimal(5,2) | yes | `0` | CHECK `>= 0` |
| lineAmount | Decimal(14,2) | yes | — | CHECK `>= 0`; computed server-side |

**Unique:** `@@unique([quotationId, productId])`.

---

## Model: SalesOrder

| Field | Type | Required | Default | Notes |
| --- | --- | --- | --- | --- |
| id | String | PK | `cuid()` | |
| orderNumber | String | yes | — | `@unique`; `SO-######` |
| customerId | String | yes | — | FK → Customer (Restrict) |
| quotationId | String | yes | — | `@unique` FK → Quotation (Restrict) |
| orderDate | DateTime | yes | — | indexed |
| totalAmount | Decimal(14,2) | yes | — | CHECK `>= 0`; from quotation grandTotal |
| status | SalesOrderStatus | yes | `PENDING` | indexed |
| createdAt / updatedAt | DateTime | yes | | |

**Relationships:**

- `SalesOrder` 1 → * `SalesOrderItem`
- `SalesOrder` 1 → 0..1 `Dispatch` (`Dispatch.salesOrderId` unique)

---

## Model: SalesOrderItem

| Field | Type | Required | Default | Notes |
| --- | --- | --- | --- | --- |
| id | String | PK | `cuid()` | |
| salesOrderId | String | yes | — | FK → SalesOrder (Cascade) |
| productId | String | yes | — | FK → Product (Restrict) |
| quantity | Int | yes | — | CHECK `> 0` |
| unitPrice | Decimal(12,2) | yes | — | CHECK `>= 0` |
| lineAmount | Decimal(14,2) | yes | — | CHECK `>= 0`; copied from quotation line |

**Unique:** `@@unique([salesOrderId, productId])`.

---

## Model: Dispatch

| Field | Type | Required | Default | Notes |
| --- | --- | --- | --- | --- |
| id | String | PK | `cuid()` | |
| dispatchNumber | String | yes | — | `@unique`; `DIS-######` |
| salesOrderId | String | yes | — | `@unique` FK → SalesOrder (Restrict) |
| dispatchDate | DateTime | yes | — | indexed |
| vehicleNumber | String | yes | — | |
| driverName | String | yes | — | |
| createdAt / updatedAt | DateTime | yes | | |

Quantities are **not** stored on Dispatch; they are taken from `SalesOrderItem` at dispatch time (full order only).

---

## Relationship summary (workflow)

```
Customer 1──* Enquiry 1──* EnquiryItem *──1 Product 1──1 Inventory
Enquiry 1──* Quotation 1──* QuotationItem *──1 Product
Quotation 1──0..1 SalesOrder 1──* SalesOrderItem *──1 Product
SalesOrder 1──0..1 Dispatch
```

---

## Database integrity mechanisms (implemented)

| Mechanism | Where |
| --- | --- |
| Primary keys | All models (`cuid`) |
| Foreign keys + Restrict/Cascade | Prisma relations |
| Unique document numbers | Enquiry / Quotation / SalesOrder / Dispatch |
| One SO per quotation | `SalesOrder.quotationId` unique |
| One dispatch per SO | `Dispatch.salesOrderId` unique |
| Line uniqueness | `(parentId, productId)` on item tables |
| One inventory row per product | `Inventory.productId` unique |
| CHECK constraints | Migration SQL (non-negative stock, qty > 0, discount bounds, etc.) |
| Application transactions | Serializable Prisma transactions for create/confirm/dispatch |
| Conditional inventory UPDATEs | Prevent overselling under concurrency |

See also: [ER_DIAGRAM.md](./ER_DIAGRAM.md), [../features/INVENTORY.md](../features/INVENTORY.md).
