# Feature: Quotations

## Creation

- Role: **SALES_USER**
- `POST /api/quotations` with `enquiryId`, `validUntil`, and priced items
- Customer copied from enquiry
- Status starts as **DRAFT**
- Number: `QUO-######`

## Quotation items

Each line stores:

| Field | Meaning |
| --- | --- |
| productId | Catalog product |
| quantity | Positive integer |
| unitPrice | Selling price |
| discountPercent | 0–100 |
| gstPercent | ≥ 0 |
| lineAmount | **Server-computed** |

Duplicate products on one quotation are rejected.

## Backend calculation

For each line (`Prisma.Decimal`, half-up to 2 places):

```
baseAmount     = quantity × unitPrice
discountAmount = baseAmount × discountPercent / 100
taxableAmount  = baseAmount − discountAmount
gstAmount      = taxableAmount × gstPercent / 100
lineAmount     = round(taxableAmount + gstAmount, 2)

grandTotal     = sum(lineAmount) rounded to 2 places
```

Frontend may show a preview; **stored totals come only from the server**.

## Status workflow

| Transition | Who |
| --- | --- |
| DRAFT → SENT | ADMIN |
| SENT → ACCEPTED | ADMIN |
| SENT → REJECTED | ADMIN |

ACCEPTED and REJECTED are terminal for status updates.

## Validation

- Enquiry must exist
- Items ≥ 1, positive qty, non-negative prices
- Discount 0–100; GST ≥ 0
- No duplicate products

## Conversion hook

Only **ACCEPTED** quotations can be converted to a sales order (`POST /api/quotations/:id/convert`) by SALES_USER.

See [../architecture/WORKFLOW.md](../architecture/WORKFLOW.md), [SALES_ORDERS.md](./SALES_ORDERS.md).
