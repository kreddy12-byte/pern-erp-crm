import { PrismaClient, Prisma, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const prisma = new PrismaClient();

const SEED_ADMIN_EMAIL = (
  process.env.SEED_ADMIN_EMAIL ?? "admin@pern-erp.local"
).toLowerCase();
const SEED_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "Admin@123456";
const SEED_SALES_EMAIL = (
  process.env.SEED_SALES_EMAIL ?? "sales@pern-erp.local"
).toLowerCase();
const SEED_SALES_PASSWORD = process.env.SEED_SALES_PASSWORD ?? "Sales@123456";

/**
 * Seed strategy:
 * - Phase 2 master/sample relational data (products, inventory, customers, enquiry).
 * - Phase 3 development users with bcrypt-hashed passwords (idempotent upsert by email).
 */
async function seedUsers(): Promise<void> {
  const [adminHash, salesHash] = await Promise.all([
    bcrypt.hash(SEED_ADMIN_PASSWORD, 12),
    bcrypt.hash(SEED_SALES_PASSWORD, 12),
  ]);

  await prisma.user.upsert({
    where: { email: SEED_ADMIN_EMAIL },
    update: {
      name: "System Admin",
      passwordHash: adminHash,
      role: Role.ADMIN,
    },
    create: {
      name: "System Admin",
      email: SEED_ADMIN_EMAIL,
      passwordHash: adminHash,
      role: Role.ADMIN,
    },
  });

  await prisma.user.upsert({
    where: { email: SEED_SALES_EMAIL },
    update: {
      name: "Sales User",
      passwordHash: salesHash,
      role: Role.SALES_USER,
    },
    create: {
      name: "Sales User",
      email: SEED_SALES_EMAIL,
      passwordHash: salesHash,
      role: Role.SALES_USER,
    },
  });
}

async function seedCatalogAndSample(): Promise<void> {
  // Idempotent cleanup of seed-owned business rows (safe for local re-runs).
  await prisma.dispatch.deleteMany();
  await prisma.salesOrderItem.deleteMany();
  await prisma.salesOrder.deleteMany();
  await prisma.quotationItem.deleteMany();
  await prisma.quotation.deleteMany();
  await prisma.enquiryItem.deleteMany();
  await prisma.enquiry.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.product.deleteMany();
  await prisma.customer.deleteMany();

  const products = await Promise.all([
    prisma.product.create({
      data: {
        productCode: "BRG-6205-ZZ",
        productName: "Deep Groove Ball Bearing 6205-ZZ",
        category: "Bearings",
        unit: "PCS",
        basePrice: new Prisma.Decimal("185.00"),
        inventory: {
          create: {
            physicalQuantity: 500,
            reservedQuantity: 40,
          },
        },
      },
    }),
    prisma.product.create({
      data: {
        productCode: "HYD-HOSE-1IN",
        productName: "Hydraulic Hose 1 Inch SAE 100R2",
        category: "Hydraulics",
        unit: "MTR",
        basePrice: new Prisma.Decimal("420.50"),
        inventory: {
          create: {
            physicalQuantity: 1200,
            reservedQuantity: 150,
          },
        },
      },
    }),
    prisma.product.create({
      data: {
        productCode: "MTR-3PH-5HP",
        productName: "3-Phase Induction Motor 5 HP",
        category: "Motors",
        unit: "PCS",
        basePrice: new Prisma.Decimal("18500.00"),
        inventory: {
          create: {
            physicalQuantity: 45,
            reservedQuantity: 5,
          },
        },
      },
    }),
    prisma.product.create({
      data: {
        productCode: "VLV-GLOBE-50",
        productName: "Cast Steel Globe Valve DN50",
        category: "Valves",
        unit: "PCS",
        basePrice: new Prisma.Decimal("2750.00"),
        inventory: {
          create: {
            physicalQuantity: 180,
            reservedQuantity: 20,
          },
        },
      },
    }),
    prisma.product.create({
      data: {
        productCode: "CNV-BELT-B85",
        productName: "Industrial V-Belt B85",
        category: "Power Transmission",
        unit: "PCS",
        basePrice: new Prisma.Decimal("340.00"),
        inventory: {
          create: {
            physicalQuantity: 800,
            reservedQuantity: 0,
          },
        },
      },
    }),
    prisma.product.create({
      data: {
        productCode: "LUB-GRS-EP2",
        productName: "Lithium EP2 Grease Cartridge",
        category: "Lubricants",
        unit: "PCS",
        basePrice: new Prisma.Decimal("95.00"),
        inventory: {
          create: {
            physicalQuantity: 2000,
            reservedQuantity: 100,
          },
        },
      },
    }),
  ]);

  const customers = await Promise.all([
    prisma.customer.create({
      data: {
        companyName: "Apex Manufacturing Pvt Ltd",
        contactPerson: "Rahul Mehta",
        mobile: "9876543210",
        email: "rahul.mehta@apexmfg.example",
        city: "Pune",
      },
    }),
    prisma.customer.create({
      data: {
        companyName: "Coastal Engineering Works",
        contactPerson: "Anita D'Souza",
        mobile: "9822012345",
        email: "anita@coastaleng.example",
        city: "Mumbai",
      },
    }),
  ]);

  await prisma.enquiry.create({
    data: {
      enquiryNumber: "ENQ-2026-0001",
      customerId: customers[0].id,
      enquiryDate: new Date("2026-03-01"),
      requiredDate: new Date("2026-03-20"),
      notes: "Urgent requirement for plant maintenance shutdown.",
      status: "NEW",
      items: {
        create: [
          {
            productId: products[0].id,
            quantity: 50,
          },
          {
            productId: products[3].id,
            quantity: 10,
          },
        ],
      },
    },
  });

  console.log(`  Products: ${products.length}`);
  console.log(`  Customers: ${customers.length}`);
  console.log("  Enquiries: 1 (with 2 line items)");
}

async function main(): Promise<void> {
  console.log("Seeding development data...");

  await seedUsers();
  console.log("  Users: ADMIN + SALES_USER upserted (passwords hashed)");

  await seedCatalogAndSample();

  console.log("Seed complete.");
}

main()
  .catch((error: unknown) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
