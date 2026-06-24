import { prisma } from "../db.js";

type AuditInput = {
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  metadata?: unknown;
  ipAddress?: string;
};

export async function audit(input: AuditInput) {
  await prisma.auditEvent.create({
    data: {
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      summary: input.summary,
      metadata: input.metadata === undefined ? undefined : (input.metadata as object),
      ipAddress: input.ipAddress
    }
  });
}

