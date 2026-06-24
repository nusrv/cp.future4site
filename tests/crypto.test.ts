import { describe, expect, it } from "vitest";
import { signPayload, timingSafeEqual } from "../src/server/security/crypto";

describe("webhook signatures", () => {
  it("verifies exact payload signatures", () => {
    const payload = JSON.stringify({ jobId: "job_1", status: "completed" });
    const signature = signPayload("test-secret", "2026-06-24T00:00:00.000Z", "nonce_1", payload);
    const repeat = signPayload("test-secret", "2026-06-24T00:00:00.000Z", "nonce_1", payload);
    expect(timingSafeEqual(signature, repeat)).toBe(true);
  });

  it("rejects modified payloads", () => {
    const signature = signPayload("test-secret", "2026-06-24T00:00:00.000Z", "nonce_1", JSON.stringify({ jobId: "job_1" }));
    const changed = signPayload("test-secret", "2026-06-24T00:00:00.000Z", "nonce_1", JSON.stringify({ jobId: "job_2" }));
    expect(timingSafeEqual(signature, changed)).toBe(false);
  });
});
