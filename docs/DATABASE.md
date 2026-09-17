# Database Design

ORM: Prisma · Database: PostgreSQL

## Entities

| Model | Purpose |
| --- | --- |
| User | Authenticated operators (`ADMIN`, `SALES_USER`). Optional `passwordHash` (null for Google-only). Optional unique `googleId`. |
| Customer | Buying company / contact |
| Product | Sellable catalog item |
| Inventory | One stock row per product |
| Enquiry / EnquiryItem | Customer demand lines |
| Quotation / QuotationItem | Priced response lines |
| SalesOrder / SalesOrderItem | Commercial order lines |
| Dispatch | Shipment header for one sales order |

## Relationships

```
Customer 1──* Enquiry 1──* EnquiryItem *──1 Product
Enquiry 1──* Quotation 1──* QuotationItem *──1 Product
Quotation 1──0..1 SalesOrder 1──* SalesOrderItem *──1 Product
SalesOrder 1──0..1 Dispatch
Product 1──1 Inventory
```

## Important constraints

**Unique**

- `User.email`
- `Product.productCode`
- `Inventory.productId`
- `Enquiry.enquiryNumber`, `Quotation.quotationNumber`, `SalesOrder.orderNumber`, `Dispatch.dispatchNumber`
- `SalesOrder.quotationId` (≤1 SO per quotation)
- `Dispatch.salesOrderId` (≤1 dispatch per SO)
- Line uniqueness `(parentId, productId)` on enquiry/quotation/sales-order items

**CHECK (migration SQL)**

- Inventory: non-negative physical/reserved; `reserved ≤ physical`
- Money/qty positivity on quotation/sales-order lines; discount 0–100

## Inventory calculation

```
availableQuantity = physicalQuantity - reservedQuantity
```

Not stored as a column.

| Operation | Physical | Reserved |
| --- | --- | --- |
| Confirm SO | no change | + ordered qty |
| Dispatch | − ordered qty | − ordered qty |

## Transaction-sensitive operations

1. **Create enquiry / quotation / sales order** — parent + line items atomic; document numbers allocated under serializable transactions where used.
2. **Confirm sales order** — conditional `UPDATE Inventory … WHERE available >= qty` + status → `CONFIRMED`.
3. **Dispatch** — conditional decrease of physical & reserved + create Dispatch + status → `DISPATCHED`.

Failures roll back; no partial reservation/dispatch.
