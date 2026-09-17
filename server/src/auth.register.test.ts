import express from "express";
import request from "supertest";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";
import apiRouter from "./routes";
import { notFoundHandler } from "./middleware/notFound";
import { errorHandler } from "./middleware/errorHandler";
import { prisma } from "./config/prisma";
import * as googleAuth from "./services/googleAuth.service";
import { authenticateWithGoogleProfile } from "./services/auth.service";

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/api", apiRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

const app = createTestApp();

describe("Auth registration", () => {
  const email = `signup.${Date.now()}@pern-erp.local`;
  const password = "Signup@12345";

  it("registers a new SALES_USER and returns JWT", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "New Sales Person",
      email,
      password,
      confirmPassword: password,
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toEqual(expect.any(String));
    expect(res.body.data.user.email).toBe(email.toLowerCase());
    expect(res.body.data.user.role).toBe("SALES_USER");
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");

    const me = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${res.body.data.token}`);

    expect(me.status).toBe(200);
    expect(me.body.data.role).toBe("SALES_USER");
  });

  it("login works after signup", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email,
      password,
    });

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(email.toLowerCase());
  });

  it("duplicate email returns 409", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "Duplicate",
      email,
      password,
      confirmPassword: password,
    });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already exists/i);
  });

  it("invalid email returns 400", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "Bad Email",
      email: "not-an-email",
      password,
      confirmPassword: password,
    });

    expect(res.status).toBe(400);
  });

  it("weak password returns 400", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "Weak Pass",
      email: `weak.${Date.now()}@pern-erp.local`,
      password: "weak",
      confirmPassword: "weak",
    });

    expect(res.status).toBe(400);
  });

  it("password mismatch returns 400", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "Mismatch",
      email: `mismatch.${Date.now()}@pern-erp.local`,
      password,
      confirmPassword: "Different@12345",
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/do not match/i);
  });

  it("public signup cannot create ADMIN", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "Would Be Admin",
      email: `notadmin.${Date.now()}@pern-erp.local`,
      password,
      confirmPassword: password,
      role: "ADMIN",
    });

    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe("SALES_USER");

    const dbUser = await prisma.user.findUnique({
      where: { email: res.body.data.user.email },
    });
    expect(dbUser?.role).toBe(Role.SALES_USER);
  });
});

describe("Google authentication", () => {
  beforeAll(() => {
    process.env.GOOGLE_CLIENT_ID = "test-google-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-google-client-secret";
    process.env.GOOGLE_CALLBACK_URL =
      "http://localhost:5000/api/auth/google/callback";
  });

  it("new Google profile creates SALES_USER without password", async () => {
    const email = `google.new.${Date.now()}@example.com`;
    const result = await authenticateWithGoogleProfile({
      googleId: `gid-new-${Date.now()}`,
      email,
      name: "Google New User",
    });

    expect(result.user.role).toBe("SALES_USER");
    expect(result.token).toEqual(expect.any(String));

    const dbUser = await prisma.user.findUnique({ where: { email } });
    expect(dbUser?.passwordHash).toBeNull();
    expect(dbUser?.googleId).toBeTruthy();
    expect(dbUser?.role).toBe(Role.SALES_USER);
  });

  it("existing password user keeps role when linking Google", async () => {
    const email = `google.link.${Date.now()}@pern-erp.local`;
    await prisma.user.create({
      data: {
        name: "Existing Admin Link",
        email,
        passwordHash: "$2a$10$abcdefghijklmnopqrstuu",
        role: Role.ADMIN,
      },
    });

    const result = await authenticateWithGoogleProfile({
      googleId: `gid-link-${Date.now()}`,
      email,
      name: "Existing Admin Link",
    });

    expect(result.user.role).toBe("ADMIN");
    const dbUser = await prisma.user.findUnique({ where: { email } });
    expect(dbUser?.role).toBe(Role.ADMIN);
    expect(dbUser?.googleId).toBeTruthy();
  });

  it("Google OAuth start redirects when configured", async () => {
    vi.spyOn(googleAuth, "isGoogleOAuthConfigured").mockReturnValue(true);
    vi.spyOn(googleAuth, "createOAuthState").mockReturnValue("test.state");
    vi.spyOn(googleAuth, "buildGoogleAuthUrl").mockReturnValue(
      "https://accounts.google.com/o/oauth2/v2/auth?mock=1"
    );

    const res = await request(app).get("/api/auth/google");
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain("accounts.google.com");

    vi.restoreAllMocks();
  });

  it("Google OAuth failure redirects to login with error", async () => {
    vi.spyOn(googleAuth, "isGoogleOAuthConfigured").mockReturnValue(true);
    vi.spyOn(googleAuth, "verifyOAuthState").mockReturnValue(false);

    const res = await request(app).get(
      "/api/auth/google/callback?code=bad&state=bad"
    );

    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(/\/login\?.*error=google_failed/);

    vi.restoreAllMocks();
  });

  it("Google cancellation redirects with google_cancelled", async () => {
    const res = await request(app).get(
      "/api/auth/google/callback?error=access_denied"
    );

    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(/error=google_cancelled/);
  });

  it("successful Google callback issues app JWT redirect", async () => {
    const email = `google.cb.${Date.now()}@example.com`;
    const googleId = `gid-cb-${Date.now()}`;

    vi.spyOn(googleAuth, "isGoogleOAuthConfigured").mockReturnValue(true);
    vi.spyOn(googleAuth, "verifyOAuthState").mockReturnValue(true);
    vi.spyOn(googleAuth, "exchangeGoogleCode").mockResolvedValue({
      googleId,
      email,
      name: "Callback User",
    });

    const res = await request(app).get(
      "/api/auth/google/callback?code=valid-code&state=valid-state"
    );

    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(/\/auth\/google\/callback\?token=/);

    const dbUser = await prisma.user.findUnique({ where: { email } });
    expect(dbUser?.role).toBe(Role.SALES_USER);
    expect(dbUser?.googleId).toBe(googleId);

    vi.restoreAllMocks();
  });
});
