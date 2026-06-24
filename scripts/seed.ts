import { prisma } from "../src/server/db.js";
import { hashPassword } from "../src/server/security/crypto.js";
import { permissions, roles } from "../src/shared/permissions.js";

async function main() {
  for (const key of permissions) {
    await prisma.permission.upsert({
      where: { key },
      update: {},
      create: { key, description: `Permission ${key}` }
    });
  }
  for (const key of roles) {
    await prisma.role.upsert({
      where: { key },
      update: {},
      create: { key, name: key.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase()) }
    });
  }
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { key: "OWNER_ADMIN" } });
  const marketingRole = await prisma.role.findUniqueOrThrow({ where: { key: "MARKETING" } });
  const supplierRole = await prisma.role.findUniqueOrThrow({ where: { key: "SUPPLIER_MANAGEMENT" } });

  await prisma.user.upsert({
    where: { username: "synthetic.owner" },
    update: {},
    create: {
      username: "synthetic.owner",
      displayName: "Synthetic Owner Admin",
      email: "owner@example.com",
      passwordHash: await hashPassword("SyntheticPass123!"),
      mustChangePassword: true,
      roles: { create: { roleId: adminRole.id } }
    }
  });
  await prisma.user.upsert({
    where: { username: "synthetic.marketing" },
    update: {},
    create: {
      username: "synthetic.marketing",
      displayName: "Synthetic Marketing User",
      email: "marketing@example.com",
      passwordHash: await hashPassword("SyntheticPass123!"),
      mustChangePassword: true,
      roles: { create: { roleId: marketingRole.id } }
    }
  });
  await prisma.user.upsert({
    where: { username: "synthetic.supplier" },
    update: {},
    create: {
      username: "synthetic.supplier",
      displayName: "Synthetic Supplier Manager",
      email: "supplier-manager@example.com",
      passwordHash: await hashPassword("SyntheticPass123!"),
      mustChangePassword: true,
      roles: { create: { roleId: supplierRole.id } }
    }
  });

  const org = await prisma.organization.create({
    data: {
      legalName: "Synthetic Gulf Foods Import LLC",
      country: "United Arab Emirates",
      synthetic: true,
      roles: { create: [{ role: "buyer" }, { role: "customer" }] },
      contacts: { create: { fullName: "Synthetic Buyer Contact", email: "buyer@example.com", phone: "+971500000000", synthetic: true } }
    },
    include: { contacts: true }
  });
  await prisma.lead.create({
    data: {
      sourceLeadId: "SYN-LEAD-001",
      organizationId: org.id,
      contactId: org.contacts[0]?.id,
      leadType: "buyer_importer",
      source: "synthetic",
      status: "new",
      quality: "unreviewed",
      firstTouchDueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      synthetic: true,
      rawPayload: { synthetic: true, note: "Safe synthetic payload" },
      inquiries: {
        create: {
          organizationId: org.id,
          inquiryType: "quote_request",
          product: "Refined Sunflower Oil",
          quantity: "1 FCL",
          packaging: "5L",
          destination: "Jebel Ali",
          incoterms: "CIF",
          message: "Synthetic inquiry for testing.",
          synthetic: true
        }
      }
    }
  });
  await prisma.task.create({
    data: {
      title: "Synthetic first-touch follow-up",
      relatedType: "lead",
      status: "open",
      dueAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
      synthetic: true
    }
  });
  const supplier = await prisma.organization.create({
    data: {
      legalName: "Synthetic Anatolia Oils Supplier Ltd",
      country: "Turkey",
      synthetic: true,
      roles: { create: { role: "supplier" } },
      supplierProfile: {
        create: {
          productOffered: "Refined Sunflower Oil",
          monthlyCapacityMt: "1000",
          originCountry: "Turkey",
          internalNotes: "Synthetic restricted supplier profile.",
          synthetic: true
        }
      }
    }
  });
  await prisma.deal.create({
    data: {
      organizationId: org.id,
      title: "Synthetic sunflower oil opportunity",
      synthetic: true,
      lineItems: { create: { description: "Refined Sunflower Oil", quantity: "1", unit: "FCL", packaging: "5L" } },
      stageHistory: { create: { stage: "lead_review", reason: "Synthetic seed" } }
    }
  });
  await prisma.product.createMany({
    data: [
      { name: "Refined Sunflower Oil", category: "Edible Oils", tdsStatus: "published", publicMarketingAllowed: true },
      { name: "Palm Olein CP10", category: "Edible Oils", tdsStatus: "published", publicMarketingAllowed: true }
    ],
    skipDuplicates: true
  });
  for (const label of ["1L", "2L", "4L", "5L", "10L", "18L", "20L", "Flexitank"]) {
    await prisma.packagingFormat.upsert({ where: { label }, update: {}, create: { label, status: "approved" } });
  }
  await prisma.knowledgeIndex.upsert({
    where: { claimId: "SYN-CLAIM-001" },
    update: {},
    create: {
      claimId: "SYN-CLAIM-001",
      approvedWording: "Synthetic public-safe company fact for demo use only.",
      sourceFile: "synthetic/demo",
      sourceSection: "Synthetic",
      contentHash: "synthetic",
      synthetic: true
    }
  });
  await prisma.contentRequest.create({
    data: {
      topic: "Synthetic corporate introduction post",
      brand: "Future Oils",
      businessLine: "Edible Oils",
      product: "Refined Sunflower Oil",
      audience: "Importers and distributors",
      objective: "Introduce the brand using safe synthetic data",
      channel: "Facebook, Instagram",
      format: "text_image",
      cta: "Request a Quote",
      requestedPublishingChannels: ["facebook", "instagram"],
      synthetic: true,
      items: {
        create: {
          version: 1,
          headline: "Synthetic Future Oils Draft",
          caption: "Synthetic draft copy for internal UI testing only.",
          cta: "Request a Quote",
          status: "AWAITING_REVIEW"
        }
      }
    }
  });
  console.log(`Synthetic seed complete. Supplier example: ${supplier.legalName}`);
}

main().finally(async () => prisma.$disconnect());

