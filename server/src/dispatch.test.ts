import express from "express";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { Role, SalesOrderStatus } from "@prisma/client";
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

const ADMIN_EMAIL = "admin.phase7.test@pern-erp.local";
const SALES_EMAIL = "sales.phase7.test@pern-erp.local";
const ADMIN_PASSWORD = "AdminPhase7@123456";
const SALES_PASSWORD = "SalesPhase7@123456";

async function loginAs(email: string, password: string): Promise<string> {
  const res = await request(app).post("/api/auth/login").send({ email, password });
  expect(res.status).toBe(200);
  return res.body.data.token as string;
}

async function createConfirmedOrder(opts: {
  productId: string;
  quantity: number;
  physical: number;
  reserved: number;
  suffix: string;
}) {
  const product = await prisma.product.create({
    data: {
      productCode: `P7-${opts.suffix}`,
      productName: `Phase7 Product ${opts.suffix}`,
      category: "Test",
      unit: "PCS",
      basePrice: 25,
      inventory: {
        create: {
          physicalQuantity: opts.physical,
          reservedQuantity: opts.reserved,
        },
      },
    },
  });

  const customer = await prisma.customer.create({
    data: {
      companyName: `Phase7 Cust ${opts.suffix}`,
      contactPerson: "P7",
      mobile: "9333333333",
      email: `p7.${opts.suffix}@example.com`,
      city: "Pune",
    },
  });

  const enquiry = await prisma.enquiry.create({
    data: {
      enquiryNumber: `ENQ-P7-${opts.suffix}`,
      customerId: customer.id,
      enquiryDate: new Date(),
      requiredDate: new Date(),
      status: "NEW",
      items: {
        create: [{ productId: product.id, quantity: opts.quantity }],
      },
    },
  });

  const quotation = await prisma.quotation.create({
    data: {
      quotationNumber: `QUO-P7-${opts.suffix}`,
      enquiryId: enquiry.id,
      customerId: customer.id,
      validUntil: new Date(),
      status: "ACCEPTED",
      grandTotal: opts.quantity * 25,
      items: {
        create: [
          {
            productId: product.id,
            quantity: opts.quantity,
            unitPrice: 25,
            discountPercent: 0,
            gstPercent: 0,
            lineAmount: opts.quantity * 25,
          },
        ],
      },
    },
  });

  const order = await prisma.salesOrder.create({
    data: {
      orderNumber: `SO-P7-${opts.suffix}`,
      customerId: customer.id,
      quotationId: quotation.id,
      orderDate: new Date(),
      totalAmount: opts.quantity * 25,
      status: SalesOrderStatus.CONFIRMED,
      items: {
        create: [
          {
            productId: product.id,
            quantity: opts.quantity,
            unitPrice: 25,
            lineAmount: opts.quantity * 25,
          },
        ],
      },
    },
  });

  return { product, customer, order };
}

describe("Phase 7 dispatch", () => {
  let adminToken: string;
  let salesToken: string;

  beforeAll(async () => {
    const [adminHash, salesHash] = await Promise.all([
      hashPassword(ADMIN_PASSWORD),
      hashPassword(SALES_PASSWORD),
    ]);

    await prisma.user.upsert({
      where: { email: ADMIN_EMAIL },
      update: { name: "Phase7 Admin", passwordHash: adminHash, role: Role.ADMIN },
      create: {
        name: "Phase7 Admin",
        email: ADMIN_EMAIL,
        passwordHash: adminHash,
        role: Role.ADMIN,
      },
    });

    await prisma.user.upsert({
      where: { email: SALES_EMAIL },
      update: {
        name: "Phase7 Sales",
        passwordHash: salesHash,
        role: Role.SALES_USER,
      },
      create: {
        name: "Phase7 Sales",
        email: SALES_EMAIL,
        passwordHash: salesHash,
        role: Role.SALES_USER,
      },
    });

    adminToken = await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD);
    salesToken = await loginAs(SALES_EMAIL, SALES_PASSWORD);
  });

  it("ADMIN can dispatch a CONFIRMED sales order and inventory updates correctly", async () => {
    const suffix = `ok-${Date.now()}`;
    const { product, order } = await createConfirmedOrder({
      productId: "unused",
      quantity: 20,
      physical: 100,
      reserved: 20,
      suffix,
    });

    const before = await prisma.inventory.findUnique({
      where: { productId: product.id },
    });
    expect(before?.physicalQuantity).toBe(100);
    expect(before?.reservedQuantity).toBe(20);

    const res = await request(app)
      .post(`/api/sales-orders/${order.id}/dispatch`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        dispatchDate: "2026-10-01",
        vehicleNumber: "MH12AB1234",
        driverName: "Ramesh Patil",
      });

    expect(res.status).toBe(201);
    expect(res.body.data.dispatchNumber).toMatch(/^DIS-\d{6}$/);
    expect(res.body.data.salesOrder.orderNumber).toBe(order.orderNumber);
    expect(res.body.data.salesOrder.status).toBe("DISPATCHED");
    expect(res.body.data.salesOrder.customer.companyName).toContain("Phase7 Cust");
    expect(res.body.data.salesOrder.items).toHaveLength(1);

    const so = await prisma.salesOrder.findUnique({ where: { id: order.id } });
    expect(so?.status).toBe("DISPATCHED");

    const after = await prisma.inventory.findUnique({
      where: { productId: product.id },
    });
    expect(after?.physicalQuantity).toBe(80);
    expect(after?.reservedQuantity).toBe(0);
    expect(after!.physicalQuantity - after!.reservedQuantity).toBe(80);
  });

  it("dispatch numbers are unique across creations", async () => {
    const a = await createConfirmedOrder({
      quantity: 5,
      physical: 50,
      reserved: 5,
      suffix: `ua-${Date.now()}`,
      productId: "x",
    });
    const b = await createConfirmedOrder({
      quantity: 5,
      physical: 50,
      reserved: 5,
      suffix: `ub-${Date.now() + 1}`,
      productId: "x",
    });

    const first = await request(app)
      .post(`/api/sales-orders/${a.order.id}/dispatch`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        dispatchDate: "2026-10-02",
        vehicleNumber: "MH01AA0001",
        driverName: "Driver A",
      });
    const second = await request(app)
      .post(`/api/sales-orders/${b.order.id}/dispatch`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        dispatchDate: "2026-10-02",
        vehicleNumber: "MH01AA0002",
        driverName: "Driver B",
      });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(first.body.data.dispatchNumber).not.toBe(second.body.data.dispatchNumber);
  });

  it("PENDING sales order cannot be dispatched", async () => {
    const { product, customer } = await createConfirmedOrder({
      quantity: 1,
      physical: 10,
      reserved: 1,
      suffix: `pending-base-${Date.now()}`,
      productId: "x",
    });

    // Create a separate PENDING order using another quotation
    const enquiry = await prisma.enquiry.create({
      data: {
        enquiryNumber: `ENQ-P7-PEND-${Date.now()}`,
        customerId: customer.id,
        enquiryDate: new Date(),
        requiredDate: new Date(),
        status: "NEW",
        items: { create: [{ productId: product.id, quantity: 1 }] },
      },
    });
    const quotation = await prisma.quotation.create({
      data: {
        quotationNumber: `QUO-P7-PEND-${Date.now()}`,
        enquiryId: enquiry.id,
        customerId: customer.id,
        validUntil: new Date(),
        status: "ACCEPTED",
        grandTotal: 25,
        items: {
          create: [
            {
              productId: product.id,
              quantity: 1,
              unitPrice: 25,
              discountPercent: 0,
              gstPercent: 0,
              lineAmount: 25,
            },
          ],
        },
      },
    });
    const pending = await prisma.salesOrder.create({
      data: {
        orderNumber: `SO-P7-PEND-${Date.now()}`,
        customerId: customer.id,
        quotationId: quotation.id,
        orderDate: new Date(),
        totalAmount: 25,
        status: SalesOrderStatus.PENDING,
        items: {
          create: [
            {
              productId: product.id,
              quantity: 1,
              unitPrice: 25,
              lineAmount: 25,
            },
          ],
        },
      },
    });

    const res = await request(app)
      .post(`/api/sales-orders/${pending.id}/dispatch`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        dispatchDate: "2026-10-03",
        vehicleNumber: "MH01AA0003",
        driverName: "Driver C",
      });

    expect(res.status).toBe(400);
  });

  it("CANCELLED sales order cannot be dispatched", async () => {
    const { order } = await createConfirmedOrder({
      quantity: 2,
      physical: 20,
      reserved: 2,
      suffix: `cancel-${Date.now()}`,
      productId: "x",
    });

    await prisma.salesOrder.update({
      where: { id: order.id },
      data: { status: SalesOrderStatus.CANCELLED },
    });

    const res = await request(app)
      .post(`/api/sales-orders/${order.id}/dispatch`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        dispatchDate: "2026-10-03",
        vehicleNumber: "MH01AA0004",
        driverName: "Driver D",
      });

    expect(res.status).toBe(400);
  });

  it("duplicate dispatch is rejected and inventory unchanged", async () => {
    const { product, order } = await createConfirmedOrder({
      quantity: 10,
      physical: 100,
      reserved: 10,
      suffix: `dup-${Date.now()}`,
      productId: "x",
    });

    const first = await request(app)
      .post(`/api/sales-orders/${order.id}/dispatch`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        dispatchDate: "2026-10-04",
        vehicleNumber: "MH01AA0005",
        driverName: "Driver E",
      });
    expect(first.status).toBe(201);

    const mid = await prisma.inventory.findUnique({ where: { productId: product.id } });
    const countBefore = await prisma.dispatch.count({
      where: { salesOrderId: order.id },
    });

    const second = await request(app)
      .post(`/api/sales-orders/${order.id}/dispatch`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        dispatchDate: "2026-10-05",
        vehicleNumber: "MH01AA0006",
        driverName: "Driver F",
      });

    expect(second.status).toBe(409);

    const after = await prisma.inventory.findUnique({ where: { productId: product.id } });
    expect(after?.physicalQuantity).toBe(mid?.physicalQuantity);
    expect(after?.reservedQuantity).toBe(mid?.reservedQuantity);

    const countAfter = await prisma.dispatch.count({
      where: { salesOrderId: order.id },
    });
    expect(countAfter).toBe(countBefore);
    expect(countAfter).toBe(1);
  });

  it("dispatch fails when reserved stock is insufficient (no partial update)", async () => {
    const { product, order } = await createConfirmedOrder({
      quantity: 15,
      physical: 100,
      reserved: 5, // reserved lower than ordered — invalid confirm state, but protects dispatch
      suffix: `insuf-${Date.now()}`,
      productId: "x",
    });

    const before = await prisma.inventory.findUnique({ where: { productId: product.id } });

    const res = await request(app)
      .post(`/api/sales-orders/${order.id}/dispatch`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        dispatchDate: "2026-10-06",
        vehicleNumber: "MH01AA0007",
        driverName: "Driver G",
      });

    expect(res.status).toBe(400);

    const after = await prisma.inventory.findUnique({ where: { productId: product.id } });
    expect(after?.physicalQuantity).toBe(before?.physicalQuantity);
    expect(after?.reservedQuantity).toBe(before?.reservedQuantity);

    const so = await prisma.salesOrder.findUnique({ where: { id: order.id } });
    expect(so?.status).toBe("CONFIRMED");

    const dispatchCount = await prisma.dispatch.count({
      where: { salesOrderId: order.id },
    });
    expect(dispatchCount).toBe(0);
  });

  it("validation rejects empty vehicle/driver and missing date", async () => {
    const { order } = await createConfirmedOrder({
      quantity: 1,
      physical: 10,
      reserved: 1,
      suffix: `val-${Date.now()}`,
      productId: "x",
    });

    const emptyVehicle = await request(app)
      .post(`/api/sales-orders/${order.id}/dispatch`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        dispatchDate: "2026-10-07",
        vehicleNumber: "  ",
        driverName: "Driver",
      });
    const emptyDriver = await request(app)
      .post(`/api/sales-orders/${order.id}/dispatch`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        dispatchDate: "2026-10-07",
        vehicleNumber: "MH01",
        driverName: "",
      });

    expect(emptyVehicle.status).toBe(400);
    expect(emptyDriver.status).toBe(400);
  });

  it("SALES_USER cannot dispatch; unauthenticated cannot dispatch", async () => {
    const { order } = await createConfirmedOrder({
      quantity: 1,
      physical: 10,
      reserved: 1,
      suffix: `rbac-${Date.now()}`,
      productId: "x",
    });

    const forbidden = await request(app)
      .post(`/api/sales-orders/${order.id}/dispatch`)
      .set("Authorization", `Bearer ${salesToken}`)
      .send({
        dispatchDate: "2026-10-08",
        vehicleNumber: "MH01AA0008",
        driverName: "Driver H",
      });
    expect(forbidden.status).toBe(403);

    const unauth = await request(app)
      .post(`/api/sales-orders/${order.id}/dispatch`)
      .send({
        dispatchDate: "2026-10-08",
        vehicleNumber: "MH01AA0008",
        driverName: "Driver H",
      });
    expect(unauth.status).toBe(401);
  });

  it("dispatch list/detail return relational data", async () => {
    const list = await request(app)
      .get("/api/dispatches")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body.data)).toBe(true);
    expect(list.body.data.length).toBeGreaterThan(0);

    const detail = await request(app)
      .get(`/api/dispatches/${list.body.data[0].id}`)
      .set("Authorization", `Bearer ${salesToken}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.salesOrder.items[0].product.productCode).toEqual(
      expect.any(String)
    );
  });

  it("inventory constraints remain valid after dispatch operations", async () => {
    const rows = await prisma.inventory.findMany();
    for (const row of rows) {
      expect(row.physicalQuantity).toBeGreaterThanOrEqual(0);
      expect(row.reservedQuantity).toBeGreaterThanOrEqual(0);
      expect(row.reservedQuantity).toBeLessThanOrEqual(row.physicalQuantity);
    }
  });
});
