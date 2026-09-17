import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { beforeAll, describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import apiRouter from "./routes";
import { authenticate } from "./middleware/authenticate";
import { requireRole } from "./middleware/requireRole";
import { notFoundHandler } from "./middleware/notFound";
import { errorHandler } from "./middleware/errorHandler";
import { prisma } from "./config/prisma";
import { env } from "./config/env";
import { hashPassword } from "./utils/password";

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/api", apiRouter);

  // Temporary route used only to exercise RBAC middleware in tests.
  app.get(
    "/api/rbac/admin",
    authenticate,
    requireRole(Role.ADMIN),
    (_req, res) => {
      res.status(200).json({ success: true, data: { allowed: true } });
    }
  );

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

const app = createTestApp();

const ADMIN_EMAIL = "admin.phase3.test@pern-erp.local";
const SALES_EMAIL = "sales.phase3.test@pern-erp.local";
const ADMIN_PASSWORD = "AdminTest@123456";
const SALES_PASSWORD = "SalesTest@123456";

describe("Phase 3 authentication", () => {
  beforeAll(async () => {
    const [adminHash, salesHash] = await Promise.all([
      hashPassword(ADMIN_PASSWORD),
      hashPassword(SALES_PASSWORD),
    ]);

    await prisma.user.upsert({
      where: { email: ADMIN_EMAIL },
      update: {
        name: "Phase3 Admin",
        passwordHash: adminHash,
        role: Role.ADMIN,
      },
      create: {
        name: "Phase3 Admin",
        email: ADMIN_EMAIL,
        passwordHash: adminHash,
        role: Role.ADMIN,
      },
    });

    await prisma.user.upsert({
      where: { email: SALES_EMAIL },
      update: {
        name: "Phase3 Sales",
        passwordHash: salesHash,
        role: Role.SALES_USER,
      },
      create: {
        name: "Phase3 Sales",
        email: SALES_EMAIL,
        passwordHash: salesHash,
        role: Role.SALES_USER,
      },
    });
  });

  it("valid login succeeds", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toEqual(expect.any(String));
    expect(res.body.data.user.email).toBe(ADMIN_EMAIL);
    expect(res.body.data.user.role).toBe("ADMIN");
    expect(res.body.data.user.passwordHash).toBeUndefined();
  });

  it("invalid password returns 401", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: ADMIN_EMAIL,
      password: "WrongPassword!999",
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Invalid email or password");
  });

  it("unknown user returns 401", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "missing.user@pern-erp.local",
      password: ADMIN_PASSWORD,
    });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid email or password");
  });

  it("missing JWT on protected endpoint returns 401", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("invalid JWT returns 401", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer not-a-valid-token");

    expect(res.status).toBe(401);
  });

  it("expired JWT returns 401", async () => {
    const expiredToken = jwt.sign(
      {
        sub: "user-id",
        email: ADMIN_EMAIL,
        role: Role.ADMIN,
        exp: Math.floor(Date.now() / 1000) - 60,
      },
      env.JWT_SECRET
    );

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${expiredToken}`);

    expect(res.status).toBe(401);
  });

  it("authenticated user can access /api/auth/me", async () => {
    const login = await request(app).post("/api/auth/login").send({
      email: SALES_EMAIL,
      password: SALES_PASSWORD,
    });

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${login.body.data.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(SALES_EMAIL);
    expect(res.body.data.role).toBe("SALES_USER");
  });

  it("/api/auth/me never returns passwordHash", async () => {
    const login = await request(app).post("/api/auth/login").send({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${login.body.data.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).not.toHaveProperty("passwordHash");
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");
  });

  it("authenticated user with insufficient role receives 403", async () => {
    const login = await request(app).post("/api/auth/login").send({
      email: SALES_EMAIL,
      password: SALES_PASSWORD,
    });

    const res = await request(app)
      .get("/api/rbac/admin")
      .set("Authorization", `Bearer ${login.body.data.token}`);

    expect(res.status).toBe(403);
  });

  it("correct role passes authorization middleware", async () => {
    const login = await request(app).post("/api/auth/login").send({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });

    const res = await request(app)
      .get("/api/rbac/admin")
      .set("Authorization", `Bearer ${login.body.data.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.allowed).toBe(true);
  });

  it("seeded users have bcrypt password hashes rather than plaintext", async () => {
    const users = await prisma.user.findMany({
      where: {
        email: { in: [ADMIN_EMAIL, SALES_EMAIL] },
      },
      select: { email: true, passwordHash: true },
    });

    expect(users).toHaveLength(2);

    for (const user of users) {
      expect(user.passwordHash).toBeTruthy();
      expect(user.passwordHash!.startsWith("$2")).toBe(true);
      expect(user.passwordHash).not.toBe(ADMIN_PASSWORD);
      expect(user.passwordHash).not.toBe(SALES_PASSWORD);
      expect(bcrypt.getRounds(user.passwordHash!)).toBeGreaterThanOrEqual(10);
    }
  });
});
