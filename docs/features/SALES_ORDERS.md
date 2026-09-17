# Feature: Sales Orders

## Conversion from accepted quotation

- Role: **SALES_USER**
- Endpoint: `POST /api/quotations/:id/convert`
- Prerequisites: quotation status **ACCEPTED**, has items, no existing sales order
- Creates sales order with:
  - `orderNumber` `SO-######`
  - `status` **PENDING**
  - Same customer and product lines (qty, unitPrice, lineAmount)
  - `totalAmount` = quotation `grandTotal`
  - `orderDate` = now
- Runs in a **Serializable** transaction
- **Does not** change inventory

## Duplicate prevention

- Service rejects if quotation already has a sales order
- Database: `SalesOrder.quotationId` **unique**

## Order status

| Status | Meaning in this app |
| --- | --- |
| PENDING | Created; awaiting Admin confirm |
| CONFIRMED | Inventory reserved |
| DISPATCHED | Shipped |
| CANCELLED | Present in enum; **no cancel API implemented** |

## Inventory reservation (confirmation)

- Role: **ADMIN**
- `POST /api/sales-orders/:id/confirm`
- Only **PENDING** orders
- For each line, increases `reservedQuantity` if available ≥ qty
- Physical unchanged
- Atomic: all lines succeed or none

## Transaction handling

Confirm uses Serializable isolation + conditional `UPDATE` so concurrent confirms cannot push reserved above physical. Prisma serialization failures map to `409` with a retry message.

## Permissions

| Action | ADMIN | SALES_USER |
| --- | --- | --- |
| List / get | Yes | Yes |
| Convert quotation | No | Yes |
| Confirm | Yes | No |
| Dispatch | Yes | No |

See [INVENTORY.md](./INVENTORY.md), [DISPATCH.md](./DISPATCH.md).
