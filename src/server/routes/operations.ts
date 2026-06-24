import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { requirePermission } from "../security/auth.js";
import { audit } from "../services/audit.js";

export async function operationsRoutes(app: FastifyInstance) {
  app.get("/api/dashboard", { preHandler: requirePermission("dashboard.read") }, async () => {
    const [leads, overdueTasks, contentReview, failedJobs, publishing] = await Promise.all([
      prisma.lead.count({ where: { status: "new" } }),
      prisma.task.count({ where: { status: "open", dueAt: { lt: new Date() } } }),
      prisma.contentRequest.count({ where: { status: "AWAITING_REVIEW" } }),
      prisma.automationJob.count({ where: { currentStatus: "FAILED" } }),
      prisma.publishingRecord.count()
    ]);
    return { metrics: { newLeads: leads, overdueTasks, contentAwaitingReview: contentReview, failedJobs, publishingRecords: publishing } };
  });

  app.get("/api/organizations", { preHandler: requirePermission("organizations.read") }, async () => {
    const organizations = await prisma.organization.findMany({ include: { roles: true, contacts: true }, orderBy: { createdAt: "desc" }, take: 100 });
    return { organizations };
  });

  app.post("/api/organizations", { preHandler: requirePermission("organizations.write") }, async (request) => {
    const current = request.currentUser!;
    const input = z.object({
      legalName: z.string().min(2),
      displayName: z.string().optional(),
      country: z.string().optional(),
      roles: z.array(z.string()).default([])
    }).parse(request.body);
    const organization = await prisma.organization.create({
      data: {
        legalName: input.legalName,
        displayName: input.displayName,
        country: input.country,
        roles: { create: input.roles.map((role) => ({ role })) }
      },
      include: { roles: true }
    });
    await audit({ actorUserId: current.user.id, action: "organization.created", entityType: "organization", entityId: organization.id, summary: `Created organization ${organization.legalName}` });
    return { organization };
  });

  app.get("/api/leads", { preHandler: requirePermission("leads.read") }, async () => {
    const leads = await prisma.lead.findMany({ include: { organization: true, contact: true, inquiries: true }, orderBy: { createdAt: "desc" }, take: 100 });
    return { leads };
  });

  app.post("/api/leads", { preHandler: requirePermission("leads.write") }, async (request) => {
    const current = request.currentUser!;
    const input = z.object({
      organizationName: z.string().min(2),
      contactName: z.string().min(2),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      leadType: z.string().default("buyer_importer"),
      product: z.string().optional(),
      message: z.string().optional()
    }).parse(request.body);
    const organization = await prisma.organization.create({ data: { legalName: input.organizationName, synthetic: true, roles: { create: { role: input.leadType.includes("supplier") ? "supplier" : "buyer" } } } });
    const contact = await prisma.contact.create({ data: { fullName: input.contactName, email: input.email, phone: input.phone, organizationId: organization.id, synthetic: true } });
    const lead = await prisma.lead.create({
      data: {
        organizationId: organization.id,
        contactId: contact.id,
        leadType: input.leadType,
        source: "manual",
        firstTouchDueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        synthetic: true,
        inquiries: { create: { inquiryType: "quote_request", product: input.product, message: input.message, organizationId: organization.id, synthetic: true } }
      },
      include: { organization: true, contact: true, inquiries: true }
    });
    await audit({ actorUserId: current.user.id, action: "lead.created", entityType: "lead", entityId: lead.id, summary: "Synthetic/manual lead created" });
    return { lead };
  });

  app.get("/api/suppliers", { preHandler: requirePermission("suppliers.readRestricted") }, async () => {
    const suppliers = await prisma.supplierProfile.findMany({ include: { organization: true }, orderBy: { id: "desc" } });
    return { suppliers };
  });

  app.get("/api/deals", { preHandler: requirePermission("deals.read") }, async () => {
    const deals = await prisma.deal.findMany({ include: { organization: true, lineItems: true, stageHistory: true }, orderBy: { createdAt: "desc" }, take: 100 });
    return { deals };
  });

  app.get("/api/audit", { preHandler: requirePermission("audit.read") }, async () => {
    const events = await prisma.auditEvent.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
    return { events };
  });
}

