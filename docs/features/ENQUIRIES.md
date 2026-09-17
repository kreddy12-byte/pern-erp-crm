# Feature: Enquiries

## Customer

- Created by **SALES_USER** via `POST /api/customers` or inline on the Enquiries page
- Fields: companyName, contactPerson, mobile, email, city
- Email stored lowercased
- Listed for both roles via `GET /api/customers`

## Enquiry

- Created by **SALES_USER** via `POST /api/enquiries`
- Linked to one customer
- Contains one or more `EnquiryItem` rows (product + quantity)
- Initial status: **NEW** (forced server-side)
- Optional notes

## Enquiry items

- Unique product per enquiry (`enquiryId` + `productId`)
- Quantity must be a positive integer
- At least one item required

## Enquiry number generation

- Format: `ENQ-` + zero-padded 6-digit sequence (`ENQ-000001`)
- Allocated inside a **Serializable** transaction by scanning existing numbers

## Validation (Zod + service)

- Valid customer id
- Valid product ids
- Positive quantities
- No duplicate product lines
- `requiredDate` ≥ `enquiryDate`

## Status

Schema enum includes `NEW`, `QUOTED`, `WON`, `LOST`.  
**Implemented behavior:** creates as `NEW` only.  
**Not implemented:** API to advance enquiry status.

## Multiple products

Supported: form and API accept multiple lines with distinct products.

## Permissions

| Action | ADMIN | SALES_USER |
| --- | --- | --- |
| List / get enquiry | Yes | Yes |
| Create customer | No | Yes |
| Create enquiry | No | Yes |

See [../api/API_DOCUMENTATION.md](../api/API_DOCUMENTATION.md), [../database/SCHEMA.md](../database/SCHEMA.md).
