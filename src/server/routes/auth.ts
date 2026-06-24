import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { audit } from "../services/audit.js";
import { createToken, hashPassword, sha256, verifyPassword } from "../security/crypto.js";
import { getCurrentUser, requirePermission, requireUser, sessionCookie } from "../security/auth.js";

const loginSchema = z.object({ username: z.string().min(2), password: z.string().min(1) });

export async function authRoutes(app: FastifyInstance) {
  app.post("/api/auth/login", async (request, reply) => {
    const input = loginSchema.parse(request.body);
    const user = await prisma.user.findUnique({ where: { username: input.username }, include: { roles: { include: { role: true } } } });
    if (!user || user.status !== "ACTIVE") {
      reply.code(401);
      return { error: "Invalid username or password" };
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      reply.code(429);
      return { error: "Login temporarily locked" };
    }
    const ok = await verifyPassword(user.passwordHash, input.password);
    if (!ok) {
      const failedLoginCount = user.failedLoginCount + 1;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount,
          lockedUntil: failedLoginCount >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null
        }
      });
      await audit({ actorUserId: user.id, action: "auth.login_failed", entityType: "user", entityId: user.id, summary: "Failed login attempt", ipAddress: request.ip });
      reply.code(401);
      return { error: "Invalid username or password" };
    }
    const token = createToken();
    await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"]
      }
    });
    await prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() } });
    reply.setCookie(sessionCookie, token, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.COOKIE_SECURE === "true",
      path: "/",
      maxAge: 8 * 60 * 60
    });
    await audit({ actorUserId: user.id, action: "auth.login", entityType: "user", entityId: user.id, summary: "User logged in", ipAddress: request.ip });
    return { user: serializeUser(user) };
  });

  app.post("/api/auth/logout", async (request, reply) => {
    const token = request.cookies[sessionCookie];
    if (token) await prisma.session.updateMany({ where: { tokenHash: sha256(token) }, data: { status: "REVOKED", revokedAt: new Date() } });
    reply.clearCookie(sessionCookie, { path: "/" });
    return { ok: true };
  });

  app.get("/api/auth/me", async (request) => {
    const current = await getCurrentUser(request);
    return { user: current ? serializeUser(current.user, current.roles, Array.from(current.permissions)) : null };
  });

  app.post("/api/auth/change-password", { preHandler: requireUser }, async (request) => {
    const current = request.currentUser!;
    const input = z.object({ currentPassword: z.string(), newPassword: z.string().min(12) }).parse(request.body);
    const ok = await verifyPassword(current.user.passwordHash, input.currentPassword);
    if (!ok) throw new Error("Current password is incorrect");
    await prisma.user.update({ where: { id: current.user.id }, data: { passwordHash: await hashPassword(input.newPassword), mustChangePassword: false } });
    await audit({ actorUserId: current.user.id, action: "auth.password_changed", entityType: "user", entityId: current.user.id, summary: "User changed password" });
    return { ok: true };
  });

  app.get("/api/admin/users", { preHandler: requirePermission("admin.users.manage") }, async () => {
    const users = await prisma.user.findMany({ include: { roles: { include: { role: true } } }, orderBy: { createdAt: "desc" } });
    return { users: users.map((u) => serializeUser(u, u.roles.map((r) => r.role.key))) };
  });

  app.post("/api/admin/users", { preHandler: requirePermission("admin.users.manage") }, async (request) => {
    const current = request.currentUser!;
    const input = z.object({
      username: z.string().min(2).max(60).regex(/^[a-zA-Z0-9._-]+$/),
      displayName: z.string().min(2).max(120),
      email: z.string().email().optional().or(z.literal("")),
      temporaryPassword: z.string().min(12),
      roleKeys: z.array(z.string()).min(1)
    }).parse(request.body);
    const user = await prisma.user.create({
      data: {
        username: input.username,
        displayName: input.displayName,
        email: input.email || null,
        passwordHash: await hashPassword(input.temporaryPassword),
        mustChangePassword: true,
        roles: { create: input.roleKeys.map((key) => ({ role: { connect: { key } } })) }
      }
    });
    await audit({ actorUserId: current.user.id, action: "admin.user_created", entityType: "user", entityId: user.id, summary: `Created user ${user.username}` });
    return { user };
  });

  app.patch("/api/admin/users/:id", { preHandler: requirePermission("admin.users.manage") }, async (request) => {
    const current = request.currentUser!;
    const params = z.object({ id: z.string() }).parse(request.params);
    const input = z.object({
      displayName: z.string().min(2).optional(),
      email: z.string().email().optional().nullable(),
      status: z.enum(["ACTIVE", "DISABLED"]).optional(),
      roleKeys: z.array(z.string()).optional()
    }).parse(request.body);
    const user = await prisma.user.update({
      where: { id: params.id },
      data: {
        displayName: input.displayName,
        email: input.email,
        status: input.status,
        roles: input.roleKeys
          ? { deleteMany: {}, create: input.roleKeys.map((key) => ({ role: { connect: { key } } })) }
          : undefined
      },
      include: { roles: { include: { role: true } } }
    });
    await audit({ actorUserId: current.user.id, action: "admin.user_updated", entityType: "user", entityId: user.id, summary: `Updated user ${user.username}` });
    return { user: serializeUser(user, user.roles.map((r) => r.role.key)) };
  });

  app.post("/api/admin/users/:id/reset-password", { preHandler: requirePermission("admin.users.manage") }, async (request) => {
    const current = request.currentUser!;
    const params = z.object({ id: z.string() }).parse(request.params);
    const input = z.object({ temporaryPassword: z.string().min(12) }).parse(request.body);
    await prisma.user.update({ where: { id: params.id }, data: { passwordHash: await hashPassword(input.temporaryPassword), mustChangePassword: true } });
    await prisma.session.updateMany({ where: { userId: params.id }, data: { status: "REVOKED", revokedAt: new Date() } });
    await audit({ actorUserId: current.user.id, action: "admin.password_reset", entityType: "user", entityId: params.id, summary: "Administrator reset user password" });
    return { ok: true };
  });
}

function serializeUser(user: any, roleKeys?: string[], permissions?: string[]) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    email: user.email,
    status: user.status,
    mustChangePassword: user.mustChangePassword,
    lastLoginAt: user.lastLoginAt,
    roles: roleKeys ?? user.roles?.map((r: any) => r.role.key) ?? [],
    permissions
  };
}

