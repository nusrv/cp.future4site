export const roles = [
  "OWNER_ADMIN",
  "MARKETING",
  "CONTENT_REVIEWER",
  "AUTOMATION_MAINTAINER",
  "COMMERCIAL_SALES",
  "OPERATIONS",
  "SUPPLIER_MANAGEMENT",
  "READ_ONLY_MANAGEMENT"
] as const;

export type RoleKey = (typeof roles)[number];

export const permissions = [
  "admin.users.manage",
  "admin.settings.manage",
  "audit.read",
  "dashboard.read",
  "leads.read",
  "leads.write",
  "leads.rawPayload.read",
  "organizations.read",
  "organizations.write",
  "suppliers.readRestricted",
  "suppliers.writeRestricted",
  "deals.read",
  "deals.write",
  "content.read",
  "content.write",
  "content.review",
  "content.approvePublication",
  "publishing.request",
  "publishing.execute",
  "automation.read",
  "automation.retry",
  "automation.manage",
  "files.readSensitive"
] as const;

export type PermissionKey = (typeof permissions)[number];

export const rolePermissions: Record<RoleKey, PermissionKey[]> = {
  OWNER_ADMIN: [...permissions],
  MARKETING: [
    "dashboard.read",
    "content.read",
    "content.write",
    "publishing.request",
    "automation.read",
    "organizations.read"
  ],
  CONTENT_REVIEWER: [
    "dashboard.read",
    "content.read",
    "content.review",
    "content.approvePublication",
    "automation.read"
  ],
  AUTOMATION_MAINTAINER: [
    "dashboard.read",
    "automation.read",
    "automation.retry",
    "automation.manage",
    "content.read"
  ],
  COMMERCIAL_SALES: [
    "dashboard.read",
    "leads.read",
    "leads.write",
    "leads.rawPayload.read",
    "organizations.read",
    "organizations.write",
    "deals.read",
    "deals.write"
  ],
  OPERATIONS: [
    "dashboard.read",
    "organizations.read",
    "deals.read",
    "deals.write",
    "files.readSensitive"
  ],
  SUPPLIER_MANAGEMENT: [
    "dashboard.read",
    "organizations.read",
    "organizations.write",
    "suppliers.readRestricted",
    "suppliers.writeRestricted",
    "files.readSensitive"
  ],
  READ_ONLY_MANAGEMENT: [
    "dashboard.read",
    "leads.read",
    "organizations.read",
    "deals.read",
    "content.read",
    "automation.read",
    "audit.read"
  ]
};

