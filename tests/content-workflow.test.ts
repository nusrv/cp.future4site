import { describe, expect, it } from "vitest";
import { deriveStage, needsMedia, type ContentRequest } from "../src/client/src/contentWorkflow";

function request(overrides: Partial<ContentRequest> = {}): ContentRequest {
  return {
    id: "request_1",
    topic: "Importer post",
    brand: "Future Oils",
    businessLine: "Edible Oils",
    format: "text_image",
    status: "DRAFT",
    createdAt: "2026-06-28T00:00:00.000Z",
    items: [],
    assets: [],
    jobs: [],
    ...overrides
  };
}

describe("content workflow stages", () => {
  it("sends text-only content directly to publication readiness", () => {
    expect(needsMedia("text")).toBe(false);
    expect(deriveStage(request({ format: "text", status: "APPROVED_PUBLICATION" }))).toBe("ready");
  });

  it("keeps media content in generation while the creative job runs", () => {
    expect(deriveStage(request({
      status: "APPROVED_INTERNAL",
      items: [{ id: "item_1", caption: "Approved copy" }],
      jobs: [{ id: "job_1", jobType: "creative_image_generation", currentStatus: "WAITING_FOR_CALLBACK", createdAt: "2026-06-28T00:00:00.000Z" }]
    }))).toBe("generating_media");
  });

  it("requires review when a creative asset arrives", () => {
    expect(deriveStage(request({
      status: "APPROVED_INTERNAL",
      items: [{ id: "item_1", caption: "Approved copy" }],
      assets: [{ id: "asset_1", assetType: "image", status: "ready_for_review", approvalStatus: "not_approved" }]
    }))).toBe("review_media");
  });

  it("moves a failed media request back to review when an image is uploaded", () => {
    expect(deriveStage(request({
      status: "APPROVED_INTERNAL",
      items: [{ id: "item_1", caption: "Approved copy" }],
      assets: [{ id: "asset_upload", fileId: "file_1", sourceTool: "manual_upload", assetType: "image", status: "ready_for_review", approvalStatus: "not_approved" }],
      jobs: [{ id: "job_1", jobType: "creative_image_generation", currentStatus: "FAILED", errorMessage: "Provider timeout", createdAt: "2026-06-28T00:00:00.000Z" }]
    }))).toBe("review_media");
  });
  it("surfaces failed media generation without losing the copy", () => {
    expect(deriveStage(request({
      status: "FAILED",
      items: [{ id: "item_1", caption: "Approved copy" }],
      jobs: [{ id: "job_1", jobType: "creative_video_generation", currentStatus: "FAILED", errorMessage: "Provider timeout", createdAt: "2026-06-28T00:00:00.000Z" }]
    }))).toBe("media_failed");
  });
});
