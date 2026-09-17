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

const ADMIN_EMAIL = "admin.phase4.test@pern-erp.local";
const SALES_EMAIL = "sales.phase4.test@pern-erp.local";
const ADMIN_PASSWORD = "AdminPhase4@123456";
const SALES_PASSWORD = "SalesPhase4@123456";

async function loginAs(email: string, password: string): Promise<string> {
  const res = await request(app).post("/api/auth/login").send({ email, password });
  expect(res.status).toBe(200);
  return res.body.data.token as string;
}

describe("Phase 4 customers and enquiries", () => {
  let adminToken: string;
  let salesToken: string;
  let productAId: string;
  let productBId: string;

  beforeAll(async () => {
    const [adminHash, salesHash] = await Promise.all([
      hashPassword(ADMIN_PASSWORD),
      hashPassword(SALES_PASSWORD),
    ]);

    await prisma.user.upsert({
      where: { email: ADMIN_EMAIL },
      update: {
        name: "Phase4 Admin",
        passwordHash: adminHash,
        role: Role.ADMIN,
      },
      create: {
        name: "Phase4 Admin",
        email: ADMIN_EMAIL,
        passwordHash: adminHash,
        role: Role.ADMIN,
      },
    });

    await prisma.user.upsert({
      where: { email: SALES_EMAIL },
      update: {
        name: "Phase4 Sales",
        passwordHash: salesHash,
        role: Role.SALES_USER,
      },
      create: {
        name: "Phase4 Sales",
        email: SALES_EMAIL,
        passwordHash: salesHash,
        role: Role.SALES_USER,
      },
    });

    const products = await prisma.product.findMany({
      take: 2,
      orderBy: { productCode: "asc" },
      select: { id: true },
    });

    if (products.length < 2) {
      throw new Error("Phase 4 tests require at least 2 seeded products");
    }

    productAId = products[0].id;
    productBId = products[1].id;

    adminToken = await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD);
    salesToken = await loginAs(SALES_EMAIL, SALES_PASSWORD);
  });

  it("SALES_USER can create a customer", async () => {
    const res = await request(app)
      .post("/api/customers")
      .set("Authorization", `Bearer ${salesToken}`)
      .send({
        companyName: "Phase4 Test Industries",
        contactPerson: "Test Contact",
        mobile: "9876501234",
        email: "phase4.customer@example.com",
        city: "Chennai",
      });

    expect(res.status).toBe(201);
    expect(res.body.data.companyName).toBe("Phase4 Test Industries");
    expect(res.body.data.id).toEqual(expect.any(String));
  });

  it("SALES_USER can create an enquiry", async () => {
    const customer = await prisma.customer.create({
      data: {
        companyName: "Enquiry Create Co",
        contactPerson: "Creator",
        mobile: "9000011111",
        email: "enquiry.create@example.com",
        city: "Pune",
      },
    });

    const res = await request(app)
      .post("/api/enquiries")
      .set("Authorization", `Bearer ${salesToken}`)
      .send({
        customerId: customer.id,
        enquiryDate: "2026-04-01",
        requiredDate: "2026-04-15",
        notes: "Need bearings and hose",
        items: [
          { productId: productAId, quantity: 12 },
          { productId: productBId, quantity: 4 },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("NEW");
    expect(res.body.data.enquiryNumber).toMatch(/^ENQ-\d{6}$/);
    expect(res.body.data.items).toHaveLength(2);
  });

  it("ADMIN can view enquiries", async () => {
    const res = await request(app)
      .get("/api/enquiries")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].customer).toBeDefined();
    expect(res.body.data[0].items).toBeDefined();
  });

  it("Unauthenticated user cannot create an enquiry", async () => {
    const res = await request(app).post("/api/enquiries").send({
      customerId: "x",
      enquiryDate: "2026-04-01",
      requiredDate: "2026-04-15",
      items: [{ productId: productAId, quantity: 1 }],
    });

    expect(res.status).toBe(401);
  });

  it("ADMIN cannot create a customer (restricted to SALES_USER)", async () => {
    const res = await request(app)
      .post("/api/customers")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        companyName: "Admin Should Fail",
        contactPerson: "Admin",
        mobile: "9111122222",
        email: "admin.fail@example.com",
        city: "Delhi",
      });

    expect(res.status).toBe(403);
  });

  it("Enquiry starts with NEW status and backend generates enquiry number", async () => {
    const customer = await prisma.customer.create({
      data: {
        companyName: "Status Check Co",
        contactPerson: "Status",
        mobile: "9000022222",
        email: "status.check@example.com",
        city: "Mumbai",
      },
    });

    const res = await request(app)
      .post("/api/enquiries")
      .set("Authorization", `Bearer ${salesToken}`)
      .send({
        customerId: customer.id,
        enquiryDate: "2026-05-01",
        requiredDate: "2026-05-10",
        status: "WON",
        enquiryNumber: "CLIENT-FAKE-001",
        items: [{ productId: productAId, quantity: 3 }],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("NEW");
    expect(res.body.data.enquiryNumber).not.toBe("CLIENT-FAKE-001");
    expect(res.body.data.enquiryNumber).toMatch(/^ENQ-\d{6}$/);
  });

  it("Enquiry numbers are unique across creations", async () => {
    const customer = await prisma.customer.create({
      data: {
        companyName: "Unique Number Co",
        contactPerson: "Unique",
        mobile: "9000033333",
        email: "unique.number@example.com",
        city: "Hyderabad",
      },
    });

    const first = await request(app)
      .post("/api/enquiries")
      .set("Authorization", `Bearer ${salesToken}`)
      .send({
        customerId: customer.id,
        enquiryDate: "2026-05-02",
        requiredDate: "2026-05-12",
        items: [{ productId: productAId, quantity: 1 }],
      });

    const second = await request(app)
      .post("/api/enquiries")
      .set("Authorization", `Bearer ${salesToken}`)
      .send({
        customerId: customer.id,
        enquiryDate: "2026-05-03",
        requiredDate: "2026-05-13",
        items: [{ productId: productBId, quantity: 2 }],
      });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(first.body.data.enquiryNumber).not.toBe(second.body.data.enquiryNumber);
  });

  it("Enquiry can contain multiple product items", async () => {
    const customer = await prisma.customer.create({
      data: {
        companyName: "Multi Item Co",
        contactPerson: "Multi",
        mobile: "9000044444",
        email: "multi.item@example.com",
        city: "Bengaluru",
      },
    });

    const res = await request(app)
      .post("/api/enquiries")
      .set("Authorization", `Bearer ${salesToken}`)
      .send({
        customerId: customer.id,
        enquiryDate: "2026-06-01",
        requiredDate: "2026-06-20",
        items: [
          { productId: productAId, quantity: 7 },
          { productId: productBId, quantity: 9 },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.items).toHaveLength(2);
    const ids = res.body.data.items.map((item: { productId: string }) => item.productId);
    expect(ids).toEqual(expect.arrayContaining([productAId, productBId]));
  });

  it("Invalid customer ID is rejected", async () => {
    const res = await request(app)
      .post("/api/enquiries")
      .set("Authorization", `Bearer ${salesToken}`)
      .send({
        customerId: "missing-customer-id",
        enquiryDate: "2026-06-01",
        requiredDate: "2026-06-20",
        items: [{ productId: productAId, quantity: 1 }],
      });

    expect(res.status).toBe(404);
  });

  it("Invalid product ID is rejected", async () => {
    const customer = await prisma.customer.create({
      data: {
        companyName: "Bad Product Co",
        contactPerson: "Bad",
        mobile: "9000055555",
        email: "bad.product@example.com",
        city: "Kolkata",
      },
    });

    const res = await request(app)
      .post("/api/enquiries")
      .set("Authorization", `Bearer ${salesToken}`)
      .send({
        customerId: customer.id,
        enquiryDate: "2026-06-01",
        requiredDate: "2026-06-20",
        items: [{ productId: "missing-product-id", quantity: 1 }],
      });

    expect(res.status).toBe(404);
  });

  it("Zero/negative quantity is rejected", async () => {
    const customer = await prisma.customer.create({
      data: {
        companyName: "Qty Co",
        contactPerson: "Qty",
        mobile: "9000066666",
        email: "qty.co@example.com",
        city: "Jaipur",
      },
    });

    const zero = await request(app)
      .post("/api/enquiries")
      .set("Authorization", `Bearer ${salesToken}`)
      .send({
        customerId: customer.id,
        enquiryDate: "2026-06-01",
        requiredDate: "2026-06-20",
        items: [{ productId: productAId, quantity: 0 }],
      });

    const negative = await request(app)
      .post("/api/enquiries")
      .set("Authorization", `Bearer ${salesToken}`)
      .send({
        customerId: customer.id,
        enquiryDate: "2026-06-01",
        requiredDate: "2026-06-20",
        items: [{ productId: productAId, quantity: -2 }],
      });

    expect(zero.status).toBe(400);
    expect(negative.status).toBe(400);
  });

  it("Empty items array is rejected", async () => {
    const customer = await prisma.customer.create({
      data: {
        companyName: "Empty Items Co",
        contactPerson: "Empty",
        mobile: "9000077777",
        email: "empty.items@example.com",
        city: "Surat",
      },
    });

    const res = await request(app)
      .post("/api/enquiries")
      .set("Authorization", `Bearer ${salesToken}`)
      .send({
        customerId: customer.id,
        enquiryDate: "2026-06-01",
        requiredDate: "2026-06-20",
        items: [],
      });

    expect(res.status).toBe(400);
  });

  it("Duplicate product lines are rejected", async () => {
    const customer = await prisma.customer.create({
      data: {
        companyName: "Dup Line Co",
        contactPerson: "Dup",
        mobile: "9000088888",
        email: "dup.line@example.com",
        city: "Nagpur",
      },
    });

    const res = await request(app)
      .post("/api/enquiries")
      .set("Authorization", `Bearer ${salesToken}`)
      .send({
        customerId: customer.id,
        enquiryDate: "2026-06-01",
        requiredDate: "2026-06-20",
        items: [
          { productId: productAId, quantity: 1 },
          { productId: productAId, quantity: 2 },
        ],
      });

    expect(res.status).toBe(400);
  });

  it("Failed enquiry creation does not leave partial records", async () => {
    const customer = await prisma.customer.create({
      data: {
        companyName: "Atomic Co",
        contactPerson: "Atomic",
        mobile: "9000099999",
        email: "atomic.co@example.com",
        city: "Indore",
      },
    });

    const beforeCount = await prisma.enquiry.count({
      where: { customerId: customer.id },
    });

    const res = await request(app)
      .post("/api/enquiries")
      .set("Authorization", `Bearer ${salesToken}`)
      .send({
        customerId: customer.id,
        enquiryDate: "2026-06-01",
        requiredDate: "2026-06-20",
        items: [
          { productId: productAId, quantity: 1 },
          { productId: "missing-product-id", quantity: 2 },
        ],
      });

    expect(res.status).toBe(404);

    const afterCount = await prisma.enquiry.count({
      where: { customerId: customer.id },
    });
    expect(afterCount).toBe(beforeCount);
  });

  it("GET enquiries returns customer and item/product information", async () => {
    const res = await request(app)
      .get("/api/enquiries")
      .set("Authorization", `Bearer ${salesToken}`);

    expect(res.status).toBe(200);
    const first = res.body.data[0];
    expect(first.customer.companyName).toEqual(expect.any(String));
    expect(first.items[0].product.productCode).toEqual(expect.any(String));
    expect(first.items[0].quantity).toEqual(expect.any(Number));
  });

  it("Nonexistent enquiry returns 404", async () => {
    const res = await request(app)
      .get("/api/enquiries/does-not-exist")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });
});
