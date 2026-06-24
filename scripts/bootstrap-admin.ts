import { prisma } from "../src/server/db.js";
import { hashPassword } from "../src/server/security/crypto.js";
import { roles } from "../src/shared/permissions.js";

async function main() {
  const username = process.env.INITIAL_ADMIN_USERNAME;
  const password = process.env.INITIAL_ADMIN_PASSWORD;
  if (!username || !password) throw new Error("INITIAL_ADMIN_USERNAME and INITIAL_ADMIN_PASSWORD are required");
  if (password.length < 12) throw new Error("INITIAL_ADMIN_PASSWORD must be at least 12 characters");

  await seedRoles();
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { key: "OWNER_ADMIN" } });
  const existing = await prisma.user.findFirst({
    where: { status: "ACTIVE", roles: { some: { role: { key: "OWNER_ADMIN" } } } }
  });
  if (existing) {
    console.log("Active administrator already exists. No bootstrap user created.");
    return;
  }
  const user = await prisma.user.create({
    data: {
      username,
      displayName: "Initial Owner Administrator",
      passwordHash: await hashPassword(password),
      mustChangePassword: true,
      roles: { create: { roleId: adminRole.id } }
    }
  });
  await prisma.auditEvent.create({
    data: {
      actorUserId: user.id,
      action: "admin.bootstrap",
      entityType: "user",
      entityId: user.id,
      summary: "Initial administrator bootstrapped. Remove bootstrap environment variables after first login."
    }
  });
  console.log(`Initial administrator created: ${username}. Remove bootstrap environment variables after use.`);
}

async function seedRoles() {
  for (const key of roles) {
    await prisma.role.upsert({
      where: { key },
      update: {},
      create: { key, name: key.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase()) }
    });
  }
}

main().finally(async () => prisma.$disconnect());

