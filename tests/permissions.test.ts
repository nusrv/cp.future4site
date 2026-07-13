import { describe, expect, it } from "vitest";
import { rolePermissions } from "../src/shared/permissions";

describe("role permissions", () => {
  it("keeps owner administrators fully privileged", () => {
    expect(rolePermissions.OWNER_ADMIN).toContain("admin.users.manage");
    expect(rolePermissions.OWNER_ADMIN).toContain("publishing.execute");
    expect(rolePermissions.OWNER_ADMIN).toContain("suppliers.readRestricted");
  });

  it("does not allow marketing users to read restricted supplier data", () => {
    expect(rolePermissions.MARKETING).not.toContain("suppliers.readRestricted");
    expect(rolePermissions.MARKETING).toEqual(expect.arrayContaining(["knowledge.read", "knowledge.upload", "knowledge.edit"]));
    expect(rolePermissions.MARKETING).not.toContain("knowledge.archive");
  });

  it("keeps read-only users away from write operations", () => {
    expect(rolePermissions.READ_ONLY_MANAGEMENT).toContain("dashboard.read");
    expect(rolePermissions.READ_ONLY_MANAGEMENT).not.toContain("content.write");
    expect(rolePermissions.READ_ONLY_MANAGEMENT).not.toContain("publishing.execute");
    expect(rolePermissions.READ_ONLY_MANAGEMENT).toContain("knowledge.read");
    expect(rolePermissions.READ_ONLY_MANAGEMENT).not.toContain("knowledge.upload");
  });

  it("maps Phase 1A knowledge permissions to the approved roles", () => {
    expect(rolePermissions.OWNER_ADMIN).toEqual(expect.arrayContaining([
      "knowledge.read",
      "knowledge.upload",
      "knowledge.edit",
      "knowledge.archive"
    ]));
    expect(rolePermissions.CONTENT_REVIEWER).toContain("knowledge.read");
    expect(rolePermissions.CONTENT_REVIEWER).not.toContain("knowledge.upload");
    expect(rolePermissions.AUTOMATION_MAINTAINER).not.toContain("knowledge.read");
  });
});
