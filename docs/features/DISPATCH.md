# Feature: Dispatch

## Admin-only dispatch

- Endpoint: `POST /api/sales-orders/:id/dispatch`
- Role: **ADMIN** only (`403` for SALES_USER)

## Confirmed order requirement

- Sales order must be **CONFIRMED**
- PENDING / CANCELLED / other → `400`
- Already DISPATCHED or existing Dispatch → `409`

## Dispatch record

| Field | Source |
| --- | --- |
| dispatchNumber | Generated `DIS-######` |
| salesOrderId | Unique FK to sales order |
| dispatchDate | Request body |
| vehicleNumber | Request body (required) |
| driverName | Request body (required) |

Quantities are **not** posted by the client; the service dispatches **all** `SalesOrderItem` quantities.

## Quantity validation

For each order line quantity `Q`:

```
physicalQuantity >= Q AND reservedQuantity >= Q
```

then both decrease by `Q`. Failure on any line aborts the whole transaction.

## Inventory deduction

| Field | Change |
| --- | --- |
| physicalQuantity | −Q |
| reservedQuantity | −Q |
| availableQuantity | unchanged when both decrease equally |

## Duplicate prevention

- Service checks for existing dispatch / DISPATCHED status
- DB unique on `Dispatch.salesOrderId`

## Order status update

On success: sales order status → **DISPATCHED** in the same Serializable transaction as inventory updates and Dispatch insert.

## Listing

Both roles can `GET /api/dispatches` and `GET /api/dispatches/:id` (includes related sales order / customer / products via includes).

## Not implemented

- Partial dispatch
- Multi-vehicle / multi-shipment per order
- Undoing a dispatch

See [SALES_ORDERS.md](./SALES_ORDERS.md), [INVENTORY.md](./INVENTORY.md).
