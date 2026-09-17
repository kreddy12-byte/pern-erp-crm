import express from "express";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import apiRouter from "./routes";
import { notFoundHandler } from "./middleware/notFound";
import { errorHandler } from "./middleware/errorHandler";
import { prisma } from "./config/prisma";
import { hashPassword } from "./utils/password";

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/api", apiRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

const app = createTestApp();

const ADMIN_EMAIL = "admin.phase6.test@pern-erp.local";
const SALES_EMAIL = "sales.phase6.test@pern-erp.local";
const ADMIN_PASSWORD = "AdminPhase6@123456";
const SALES_PASSWORD = "SalesPhase6@123456";

async function loginAs(email: string, password: string): Promise<string> {
  const res = await request(app).post("/api/auth/login").send({ email, password });
  expect(res.status).toBe(200);
  return res.body.data.token as string;
}

async function createAcceptedQuotation(opts: {
  productId: string;
  quantity: number;
  unitPrice?: number;
  suffix: string;
}) {
  const customer = await prisma.customer.create({
    data: {
      companyName: `Phase6 Cust ${opts.suffix}`,
      contactPerson: "P6",
      mobile: "9000000000",
      email: `p6.${opts.suffix}@example.com`,
      city: "Pune",
    },
  });

  const enquiry = await prisma.enquiry.create({
    data: {
      enquiryNumber: `ENQ-P6-${opts.suffix}`,
      customerId: customer.id,
      enquiryDate: new Date("2026-09-01"),
      requiredDate: new Date("2026-09-20"),
      status: "NEW",
      items: {
        create: [{ productId: opts.productId, quantity: opts.quantity }],
      },
    },
  });

  const quotation = await prisma.quotation.create({
    data: {
      quotationNumber: `QUO-P6-${opts.suffix}`,
      enquiryId: enquiry.id,
      customerId: customer.id,
      validUntil: new Date("2026-10-01"),
      status: "ACCEPTED",
      grandTotal: opts.quantity * (opts.unitPrice ?? 100),
      items: {
        create: [
          {
            productId: opts.productId,
            quantity: opts.quantity,
            unitPrice: opts.unitPrice ?? 100,
            discountPercent: 0,
            gstPercent: 0,
            lineAmount: opts.quantity * (opts.unitPrice ?? 100),
          },
        ],
      },
    },
    include: { items: true },
  });

  return { customer, enquiry, quotation };
}

describe("Phase 6 sales orders and inventory reservation", () => {
  let adminToken: string;
  let salesToken: string;
  let productAId: string;
  let productBId: string;
  let productACode: string;

  beforeAll(async () => {
    const [adminHash, salesHash] = await Promise.all([
      hashPassword(ADMIN_PASSWORD),
      hashPassword(SALES_PASSWORD),
    ]);

    await prisma.user.upsert({
      where: { email: ADMIN_EMAIL },
      update: { name: "Phase6 Admin", passwordHash: adminHash, role: Role.ADMIN },
      create: {
        name: "Phase6 Admin",
        email: ADMIN_EMAIL,
        passwordHash: adminHash,
        role: Role.ADMIN,
      },
    });

    await prisma.user.upsert({
      where: { email: SALES_EMAIL },
      update: {
        name: "Phase6 Sales",
        passwordHash: salesHash,
        role: Role.SALES_USER,
      },
      create: {
        name: "Phase6 Sales",
        email: SALES_EMAIL,
        passwordHash: salesHash,
        role: Role.SALES_USER,
      },
    });

    const products = await prisma.product.findMany({
      take: 2,
      orderBy: { productCode: "asc" },
      select: { id: true, productCode: true },
    });
    if (products.length < 2) {
      throw new Error("Phase 6 tests require at least 2 products");
    }
    productAId = products[0].id;
    productACode = products[0].productCode;
    productBId = products[1].id;

    adminToken = await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD);
    salesToken = await loginAs(SALES_EMAIL, SALES_PASSWORD);
  });

  it("accepted quotation converts to PENDING sales order with generated number", async () => {
    const { quotation, customer } = await createAcceptedQuotation({
      productId: productAId,
      quantity: 3,
      suffix: `cvt-${Date.now()}`,
    });

    const res = await request(app)
      .post(`/api/quotations/${quotation.id}/convert`)
      .set("Authorization", `Bearer ${salesToken}`);

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("PENDING");
    expect(res.body.data.orderNumber).toMatch(/^SO-\d{6}$/);
    expect(res.body.data.customer.id).toBe(customer.id);
    expect(res.body.data.quotation.id).toBe(quotation.id);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].quantity).toBe(3);
    expect(res.body.data.items[0].productId).toBe(productAId);
  });

  it("draft and rejected quotations cannot convert", async () => {
    const customer = await prisma.customer.create({
      data: {
        companyName: "No Convert Co",
        contactPerson: "X",
        mobile: "9111111111",
        email: `noconvert.${Date.now()}@example.com`,
        city: "Pune",
      },
    });
    const enquiry = await prisma.enquiry.create({
      data: {
        enquiryNumber: `ENQ-P6-NC-${Date.now()}`,
        customerId: customer.id,
        enquiryDate: new Date(),
        requiredDate: new Date(),
        status: "NEW",
        items: { create: [{ productId: productAId, quantity: 1 }] },
      },
    });

    const draft = await prisma.quotation.create({
      data: {
        quotationNumber: `QUO-P6-DRAFT-${Date.now()}`,
        enquiryId: enquiry.id,
        customerId: customer.id,
        validUntil: new Date(),
        status: "DRAFT",
        grandTotal: 10,
        items: {
          create: [
            {
              productId: productAId,
              quantity: 1,
              unitPrice: 10,
              discountPercent: 0,
              gstPercent: 0,
              lineAmount: 10,
            },
          ],
        },
      },
    });

    const rejected = await prisma.quotation.create({
      data: {
        quotationNumber: `QUO-P6-REJ-${Date.now()}`,
        enquiryId: enquiry.id,
        customerId: customer.id,
        validUntil: new Date(),
        status: "REJECTED",
        grandTotal: 10,
        items: {
          create: [
            {
              productId: productBId,
              quantity: 1,
              unitPrice: 10,
              discountPercent: 0,
              gstPercent: 0,
              lineAmount: 10,
            },
          ],
        },
      },
    });

    const draftRes = await request(app)
      .post(`/api/quotations/${draft.id}/convert`)
      .set("Authorization", `Bearer ${salesToken}`);
    const rejectedRes = await request(app)
      .post(`/api/quotations/${rejected.id}/convert`)
      .set("Authorization", `Bearer ${salesToken}`);

    expect(draftRes.status).toBe(400);
    expect(rejectedRes.status).toBe(400);
  });

  it("accepted quotation cannot create duplicate sales order", async () => {
    const { quotation } = await createAcceptedQuotation({
      productId: productAId,
      quantity: 1,
      suffix: `dup-${Date.now()}`,
    });

    const first = await request(app)
      .post(`/api/quotations/${quotation.id}/convert`)
      .set("Authorization", `Bearer ${salesToken}`);
    const second = await request(app)
      .post(`/api/quotations/${quotation.id}/convert`)
      .set("Authorization", `Bearer ${salesToken}`);

    expect(first.status).toBe(201);
    expect(second.status).toBe(409);
  });

  it("missing quotation → 404; unauthorized/unauthenticated conversion blocked", async () => {
    const missing = await request(app)
      .post("/api/quotations/missing-id/convert")
      .set("Authorization", `Bearer ${salesToken}`);
    expect(missing.status).toBe(404);

    const { quotation } = await createAcceptedQuotation({
      productId: productAId,
      quantity: 1,
      suffix: `authz-${Date.now()}`,
    });

    const forbidden = await request(app)
      .post(`/api/quotations/${quotation.id}/convert`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(forbidden.status).toBe(403);

    const unauth = await request(app).post(`/api/quotations/${quotation.id}/convert`);
    expect(unauth.status).toBe(401);
  });

  it("sales order list/detail and inventory available quantity", async () => {
    const list = await request(app)
      .get("/api/sales-orders")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body.data)).toBe(true);

    if (list.body.data.length > 0) {
      const detail = await request(app)
        .get(`/api/sales-orders/${list.body.data[0].id}`)
        .set("Authorization", `Bearer ${salesToken}`);
      expect(detail.status).toBe(200);
      expect(detail.body.data.quotation.enquiry).toBeDefined();
    }

    const inventory = await request(app)
      .get("/api/inventory")
      .set("Authorization", `Bearer ${salesToken}`);
    expect(inventory.status).toBe(200);
    expect(inventory.body.data.length).toBeGreaterThan(0);
    const row = inventory.body.data[0];
    expect(row.availableQuantity).toBe(row.physicalQuantity - row.reservedQuantity);
  });

  it("admin confirms with sufficient stock and reserves inventory", async () => {
    const product = await prisma.product.create({
      data: {
        productCode: `P6-OK-${Date.now()}`,
        productName: "Phase6 Confirm Product",
        category: "Test",
        unit: "PCS",
        basePrice: 50,
        inventory: {
          create: { physicalQuantity: 100, reservedQuantity: 30 },
        },
      },
      include: { inventory: true },
    });

    const { quotation } = await createAcceptedQuotation({
      productId: product.id,
      quantity: 60,
      suffix: `ok-${Date.now()}`,
    });

    const created = await request(app)
      .post(`/api/quotations/${quotation.id}/convert`)
      .set("Authorization", `Bearer ${salesToken}`);
    expect(created.status).toBe(201);

    const confirm = await request(app)
      .post(`/api/sales-orders/${created.body.data.id}/confirm`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(confirm.status).toBe(200);
    expect(confirm.body.data.status).toBe("CONFIRMED");

    const inventory = await prisma.inventory.findUnique({
      where: { productId: product.id },
    });
    expect(inventory?.physicalQuantity).toBe(100);
    expect(inventory?.reservedQuantity).toBe(90);
  });

  it("SALES_USER cannot confirm; unauthenticated confirm blocked", async () => {
    const { quotation } = await createAcceptedQuotation({
      productId: productAId,
      quantity: 1,
      suffix: `noconfirm-${Date.now()}`,
    });
    const created = await request(app)
      .post(`/api/quotations/${quotation.id}/convert`)
      .set("Authorization", `Bearer ${salesToken}`);

    const forbidden = await request(app)
      .post(`/api/sales-orders/${created.body.data.id}/confirm`)
      .set("Authorization", `Bearer ${salesToken}`);
    expect(forbidden.status).toBe(403);

    const unauth = await request(app).post(
      `/api/sales-orders/${created.body.data.id}/confirm`
    );
    expect(unauth.status).toBe(401);
  });

  it("insufficient stock rejects confirmation atomically and leaves PENDING", async () => {
    const product = await prisma.product.create({
      data: {
        productCode: `P6-FAIL-${Date.now()}`,
        productName: "Phase6 Fail Product",
        category: "Test",
        unit: "PCS",
        basePrice: 50,
        inventory: {
          create: { physicalQuantity: 100, reservedQuantity: 30 },
        },
      },
    });

    const { quotation } = await createAcceptedQuotation({
      productId: product.id,
      quantity: 80,
      suffix: `fail-${Date.now()}`,
    });

    const created = await request(app)
      .post(`/api/quotations/${quotation.id}/convert`)
      .set("Authorization", `Bearer ${salesToken}`);

    const before = await prisma.inventory.findUnique({
      where: { productId: product.id },
    });

    const confirm = await request(app)
      .post(`/api/sales-orders/${created.body.data.id}/confirm`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(confirm.status).toBe(400);
    expect(confirm.body.message).toMatch(/Insufficient available inventory/i);

    const order = await prisma.salesOrder.findUnique({
      where: { id: created.body.data.id },
    });
    expect(order?.status).toBe("PENDING");

    const after = await prisma.inventory.findUnique({
      where: { productId: product.id },
    });
    expect(after?.reservedQuantity).toBe(before?.reservedQuantity);
    expect(after?.physicalQuantity).toBe(before?.physicalQuantity);
  });

  it("multi-item order fails entirely if one item lacks stock", async () => {
    const good = await prisma.product.create({
      data: {
        productCode: `P6-GOOD-${Date.now()}`,
        productName: "Good Stock",
        category: "Test",
        unit: "PCS",
        basePrice: 10,
        inventory: { create: { physicalQuantity: 100, reservedQuantity: 0 } },
      },
    });
    const bad = await prisma.product.create({
      data: {
        productCode: `P6-BAD-${Date.now()}`,
        productName: "Bad Stock",
        category: "Test",
        unit: "PCS",
        basePrice: 10,
        inventory: { create: { physicalQuantity: 5, reservedQuantity: 0 } },
      },
    });

    const customer = await prisma.customer.create({
      data: {
        companyName: "Atomic Reserve Co",
        contactPerson: "A",
        mobile: "9222222222",
        email: `atomic.${Date.now()}@example.com`,
        city: "Pune",
      },
    });
    const enquiry = await prisma.enquiry.create({
      data: {
        enquiryNumber: `ENQ-P6-ATOM-${Date.now()}`,
        customerId: customer.id,
        enquiryDate: new Date(),
        requiredDate: new Date(),
        status: "NEW",
        items: {
          create: [
            { productId: good.id, quantity: 10 },
            { productId: bad.id, quantity: 10 },
          ],
        },
      },
    });
    const quotation = await prisma.quotation.create({
      data: {
        quotationNumber: `QUO-P6-ATOM-${Date.now()}`,
        enquiryId: enquiry.id,
        customerId: customer.id,
        validUntil: new Date(),
        status: "ACCEPTED",
        grandTotal: 200,
        items: {
          create: [
            {
              productId: good.id,
              quantity: 10,
              unitPrice: 10,
              discountPercent: 0,
              gstPercent: 0,
              lineAmount: 100,
            },
            {
              productId: bad.id,
              quantity: 10,
              unitPrice: 10,
              discountPercent: 0,
              gstPercent: 0,
              lineAmount: 100,
            },
          ],
        },
      },
    });

    const created = await request(app)
      .post(`/api/quotations/${quotation.id}/convert`)
      .set("Authorization", `Bearer ${salesToken}`);

    const confirm = await request(app)
      .post(`/api/sales-orders/${created.body.data.id}/confirm`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(confirm.status).toBe(400);

    const goodInv = await prisma.inventory.findUnique({ where: { productId: good.id } });
    const badInv = await prisma.inventory.findUnique({ where: { productId: bad.id } });
    expect(goodInv?.reservedQuantity).toBe(0);
    expect(badInv?.reservedQuantity).toBe(0);
  });

  it("confirmed order cannot be confirmed again and does not re-reserve", async () => {
    const product = await prisma.product.create({
      data: {
        productCode: `P6-IDEM-${Date.now()}`,
        productName: "Idempotent Product",
        category: "Test",
        unit: "PCS",
        basePrice: 20,
        inventory: { create: { physicalQuantity: 50, reservedQuantity: 0 } },
      },
    });

    const { quotation } = await createAcceptedQuotation({
      productId: product.id,
      quantity: 10,
      suffix: `idem-${Date.now()}`,
    });

    const created = await request(app)
      .post(`/api/quotations/${quotation.id}/convert`)
      .set("Authorization", `Bearer ${salesToken}`);

    const first = await request(app)
      .post(`/api/sales-orders/${created.body.data.id}/confirm`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(first.status).toBe(200);

    const mid = await prisma.inventory.findUnique({ where: { productId: product.id } });
    expect(mid?.reservedQuantity).toBe(10);

    const second = await request(app)
      .post(`/api/sales-orders/${created.body.data.id}/confirm`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(second.status).toBe(409);

    const after = await prisma.inventory.findUnique({ where: { productId: product.id } });
    expect(after?.reservedQuantity).toBe(10);
  });

  it("concurrent confirmations never reserve beyond physical quantity", async () => {
    const product = await prisma.product.create({
      data: {
        productCode: `P6-CONC-${Date.now()}`,
        productName: "Concurrency Product",
        category: "Test",
        unit: "PCS",
        basePrice: 15,
        inventory: { create: { physicalQuantity: 100, reservedQuantity: 70 } },
      },
    });

    const a = await createAcceptedQuotation({
      productId: product.id,
      quantity: 20,
      suffix: `ca-${Date.now()}`,
    });
    const b = await createAcceptedQuotation({
      productId: product.id,
      quantity: 20,
      suffix: `cb-${Date.now() + 1}`,
    });

    const orderA = await request(app)
      .post(`/api/quotations/${a.quotation.id}/convert`)
      .set("Authorization", `Bearer ${salesToken}`);
    const orderB = await request(app)
      .post(`/api/quotations/${b.quotation.id}/convert`)
      .set("Authorization", `Bearer ${salesToken}`);

    const [resA, resB] = await Promise.all([
      request(app)
        .post(`/api/sales-orders/${orderA.body.data.id}/confirm`)
        .set("Authorization", `Bearer ${adminToken}`),
      request(app)
        .post(`/api/sales-orders/${orderB.body.data.id}/confirm`)
        .set("Authorization", `Bearer ${adminToken}`),
    ]);

    const statuses = [resA.status, resB.status].sort();
    // One succeeds (200), the other fails with insufficient stock (400) or serialization conflict (409)
    expect(statuses[0]).toBeGreaterThanOrEqual(200);
    expect([200, 400, 409]).toContain(resA.status);
    expect([200, 400, 409]).toContain(resB.status);
    expect([resA.status, resB.status].filter((s) => s === 200).length).toBe(1);

    const inventory = await prisma.inventory.findUnique({
      where: { productId: product.id },
    });
    expect(inventory).toBeTruthy();
    expect(inventory!.reservedQuantity).toBeLessThanOrEqual(inventory!.physicalQuantity);
    expect(inventory!.reservedQuantity).toBe(90);
    expect(inventory!.physicalQuantity).toBe(100);
  });

  it("reserved quantity never exceeds physical after successful confirm", async () => {
    const inventoryRows = await prisma.inventory.findMany();
    for (const row of inventoryRows) {
      expect(row.reservedQuantity).toBeGreaterThanOrEqual(0);
      expect(row.physicalQuantity).toBeGreaterThanOrEqual(0);
      expect(row.reservedQuantity).toBeLessThanOrEqual(row.physicalQuantity);
    }
    expect(productACode).toEqual(expect.any(String));
  });
});
