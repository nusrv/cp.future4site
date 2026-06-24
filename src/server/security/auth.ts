import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../db.js";
import { sha256 } from "./crypto.js";
import { rolePermissions, type PermissionKey, type RoleKey } from "../../shared/permissions.js";

export const sessionCookie = "ff_admin_session";

export async function getCurrentUser(request: FastifyRequest) {
  const token = request.cookies[sessionCookie];
  if (!token) return null;
  const tokenHash = sha256(token);
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: {
      user: {
        include: {
          roles: { include: { role: true } }
        }
      }
    }
  });
  if (!session || session.status !== "ACTIVE" || session.expiresAt < new Date()) return null;
  if (session.user.status !== "ACTIVE") return null;
  const roles = session.user.roles.map((r) => r.role.key as RoleKey);
  const permissions = new Set<PermissionKey>();
  roles.forEach((role) => rolePermissions[role]?.forEach((permission) => permissions.add(permission)));
  return { session, user: session.user, roles, permissions };
}

export async function requireUser(request: FastifyRequest, reply: FastifyReply) {
  const current = await getCurrentUser(request);
  if (!current) {
    reply.code(401);
    throw new Error("Authentication required");
  }
  request.currentUser = current;
  return current;
}

export function requirePermission(permission: PermissionKey) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const current = await requireUser(request, reply);
    if (!current.permissions.has(permission)) {
      reply.code(403);
      throw new Error("Permission denied");
    }
  };
}

declare module "fastify" {
  interface FastifyRequest {
    currentUser?: Awaited<ReturnType<typeof getCurrentUser>>;
  }
}
