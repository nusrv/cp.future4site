import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { requirePermission } from "../security/auth.js";
import { resolveApprovedKnowledge } from "../services/knowledgeResolver.js";

const resolverInput = z.object({
  locale: z.string().trim().min(2).max(20),
  brandId: z.string().nullable().optional(),
  productId: z.string().nullable().optional(),
  packagingFormatId: z.string().nullable().optional(),
  market: z.string().trim().min(1).max(120).nullable().optional(),
  audience: z.string().trim().min(1).max(120).nullable().optional(),
  objective: z.string().trim().min(1).max(120).nullable().optional(),
  at: z.coerce.date().optional()
}).strict();

export async function knowledgeResolverRoutes(app: FastifyInstance) {
  app.post("/api/knowledge/resolve", { preHandler: requirePermission("knowledge.resolve") }, async (request) => {
    const current = request.currentUser!;
    const input = resolverInput.parse(request.body);
    const result = await resolveApprovedKnowledge(input);
    await prisma.auditEvent.create({ data: {
      actorUserId: current.user.id,
      action: "knowledge.resolved",
      entityType: "knowledge_resolution",
      entityId: result.resolutionId,
      summary: "Approved knowledge resolved for an exact context",
      metadata: {
        locale: result.context.locale,
        brandId: result.context.brandId,
        productId: result.context.productId,
        packagingFormatId: result.context.packagingFormatId,
        market: result.context.market,
        audience: result.context.audience,
        objective: result.context.objective,
        claimIds: result.claims.map((claim) => claim.claimId),
        conflictCount: result.diagnostics.conflicts.length,
        truncated: result.diagnostics.truncated
      }
    } });
    return result;
  });
}
