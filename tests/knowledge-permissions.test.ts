import { describe, expect, it, vi } from "vitest";

const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock("../src/server/db.js", () => ({
  prisma: { session: { findUnique } }
}));

import { requirePermission } from "../src/server/security/auth";

function replyRecorder() {
  return {
    statusCode: 200,
    code(statusCode: number) {
      this.statusCode = statusCode;
      return this;
    }
  };
}

describe("Knowledge Library server authorization", () => {
  it("rejects unauthenticated knowledge requests with 401", async () => {
    const reply = replyRecorder();
    await expect(requirePermission("knowledge.read")({ cookies: {} } as never, reply as never)).rejects.toThrow("Authentication required");
    expect(reply.statusCode).toBe(401);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("rejects an authenticated role missing the requested permission with 403", async () => {
    findUnique.mockResolvedValueOnce({
      status: "ACTIVE",
      expiresAt: new Date(Date.now() + 60_000),
      user: {
        id: "user-1",
        status: "ACTIVE",
        roles: [{ role: { key: "AUTOMATION_MAINTAINER" } }]
      }
    });
    const reply = replyRecorder();
    await expect(requirePermission("knowledge.read")({ cookies: { ff_admin_session: "test-session" } } as never, reply as never)).rejects.toThrow("Permission denied");
    expect(reply.statusCode).toBe(403);
  });
});
