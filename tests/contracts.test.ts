import { describe, expect, it } from "vitest";
import { automationCallbackSchema, contentRequestSchema } from "../src/shared/contracts";

describe("shared contracts", () => {
  it("accepts a valid content request", () => {
    const parsed = contentRequestSchema.parse({
      topic: "Importer introduction",
      brand: "Future Oils",
      businessLine: "Edible Oils",
      channel: "instagram",
      format: "text_image",
      requestedPublishingChannels: ["instagram", "facebook"]
    });
    expect(parsed.brand).toBe("Future Oils");
  });

  it("rejects unsupported content formats", () => {
    expect(() => contentRequestSchema.parse({
      topic: "Bad format",
      channel: "instagram",
      format: "unsupported"
    })).toThrow();
  });

  it("accepts signed callback payload shape without secrets", () => {
    const parsed = automationCallbackSchema.parse({
      job_id: "job_123",
      correlation_id: "corr_123",
      workflow_type: "content_generation",
      status: "completed",
      nonce: "nonce_123",
      signature_timestamp: "2026-06-24T00:00:00.000Z",
      signature: "abcdef",
      outputs: { caption: "Draft only" },
      files: [{ path: "storage/generated/example.png", kind: "image" }]
    });
    expect(parsed.files?.[0].kind).toBe("image");
  });
});
