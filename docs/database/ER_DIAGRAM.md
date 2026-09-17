# Entity-Relationship Diagram

Generated from the actual Prisma schema in `server/prisma/schema.prisma`.

## Mermaid ER diagram

```mermaid
erDiagram
  User {
    string id PK
    string email UK
    string name
    string passwordHash "nullable"
    string googleId UK "nullable"
    enum role
    datetime createdAt
    datetime updatedAt
  }

  Customer {
    string id PK
    string companyName
    string contactPerson
    string mobile
    string email
    string city
  }

  Product {
    string id PK
    string productCode UK
    string productName
    string category
    string unit
    decimal basePrice
  }

  Inventory {
    string id PK
    string productId FK_UK
    int physicalQuantity
    int reservedQuantity
  }

  Enquiry {
    string id PK
    string enquiryNumber UK
    string customerId FK
    datetime enquiryDate
    datetime requiredDate
    string notes "nullable"
    enum status
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
    datetime validUntil
    enum status
    decimal grandTotal
  }

  QuotationItem {
    string id PK
    string quotationId FK
    string productId FK
    int quantity
    decimal unitPrice
    decimal discountPercent
    decimal gstPercent
    decimal lineAmount
  }

  SalesOrder {
    string id PK
    string orderNumber UK
    string customerId FK
    string quotationId FK_UK
    datetime orderDate
    decimal totalAmount
    enum status
  }

  SalesOrderItem {
    string id PK
    string salesOrderId FK
    string productId FK
    int quantity
    decimal unitPrice
    decimal lineAmount
  }

  Dispatch {
    string id PK
    string dispatchNumber UK
    string salesOrderId FK_UK
    datetime dispatchDate
    string vehicleNumber
    string driverName
  }

  Customer ||--o{ Enquiry : places
  Enquiry ||--o{ EnquiryItem : contains
  Product ||--o{ EnquiryItem : referenced_by
  Product ||--|| Inventory : stocks
  Enquiry ||--o{ Quotation : quoted_as
  Customer ||--o{ Quotation : billed_to
  Quotation ||--o{ QuotationItem : contains
  Product ||--o{ QuotationItem : referenced_by
  Quotation ||--o| SalesOrder : converts_to
  Customer ||--o{ SalesOrder : ordered_by
  SalesOrder ||--o{ SalesOrderItem : contains
  Product ||--o{ SalesOrderItem : referenced_by
  SalesOrder ||--o| Dispatch : shipped_as
```

`User` is authentication identity only (no FK links to sales documents).

## Workflow coverage

```
Customer Enquiry → Quotation → Sales Order → Inventory Reservation → Dispatch
```

| Stage | Entities |
| --- | --- |
| Demand | `Customer`, `Enquiry`, `EnquiryItem`, `Product` |
| Pricing | `Quotation`, `QuotationItem` |
| Order | `SalesOrder`, `SalesOrderItem` |
| Stock | `Inventory` (reserved on confirm) |
| Shipment | `Dispatch` (consumes physical + reserved) |

## Important relationships (plain English)

1. **Customer → Enquiry (1:many)** — A customer may have many enquiries; each enquiry belongs to exactly one customer.
2. **Enquiry → EnquiryItem (1:many)** — An enquiry has one or more product lines; each line references one product; the same product cannot appear twice on one enquiry.
3. **Product → Inventory (1:1)** — Each product has at most one inventory row; available stock is derived, not stored.
4. **Enquiry → Quotation (1:many)** — An enquiry may produce multiple quotations; each quotation points back to one enquiry and copies the customer.
5. **Quotation → QuotationItem (1:many)** — Line pricing (unit price, discount %, GST %, computed line amount) lives on quotation items.
6. **Quotation → SalesOrder (1:0..1)** — At most one sales order per quotation (`quotationId` unique).
7. **SalesOrder → SalesOrderItem (1:many)** — Order lines copy quantities and amounts from the quotation.
8. **SalesOrder → Dispatch (1:0..1)** — At most one dispatch per sales order; quantities come from order items (full dispatch only).
9. **User** — Authenticates operators (`ADMIN` / `SALES_USER`); not a foreign key on commercial documents.

See [SCHEMA.md](./SCHEMA.md) for field-level detail.
