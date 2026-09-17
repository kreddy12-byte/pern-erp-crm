# Feature: Inventory

## Product inventory

Each `Product` has at most one `Inventory` row (`productId` unique). Catalog and stock are seeded (six industrial products in `server/prisma/seed.ts`). There is **no** public API to create/update inventory quantities; changes happen through confirm and dispatch.

## Quantities

| Field | Stored? | Meaning |
| --- | --- | --- |
| physicalQuantity | Yes | On-hand stock |
| reservedQuantity | Yes | Held for confirmed orders |
| availableQuantity | **No** | `physical − reserved` (API-derived) |

DB CHECKs: physical ≥ 0, reserved ≥ 0, reserved ≤ physical.

## Reservation rules

Triggered by **Admin** sales-order confirmation:

```
reservedQuantity := reservedQuantity + orderLineQty
```

only if `(physicalQuantity - reservedQuantity) >= orderLineQty`.

Physical does not change on reservation.

## Insufficient stock

If any line cannot reserve:

- Confirmation fails with `400`
- Transaction rolls back
- Sales order remains **PENDING**
- No partial reservation across lines

## Concurrency

Serializable transaction + conditional UPDATE. Concurrent confirms competing for the same available units: only a safe outcome is accepted (one success / one failure, or serialization conflict `409`). Tests assert reserved never exceeds physical and that two competing 20-unit orders against 30 available leave reserved = 90 when physical = 100 and prior reserved = 70.

## API

`GET /api/inventory` — both roles; returns product + physical, reserved, available.

## Seed example (`BRG-6205-ZZ`)

| Physical | Reserved | Available |
| --- | --- | --- |
| 500 | 40 | 460 |

(Actual live DB may differ after demos/tests that mutate stock.)

See [DISPATCH.md](./DISPATCH.md), [../architecture/WORKFLOW.md](../architecture/WORKFLOW.md).
