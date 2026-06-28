export type AutomationJob = {
  id: string;
  jobType: string;
  currentStatus: string;
  currentStep?: string | null;
  errorMessage?: string | null;
  createdAt: string;
};

export type CreativeAsset = {
  id: string;
  assetType: string;
  status: string;
  approvalStatus: string;
  metadata?: { file?: Record<string, unknown>; url?: string } | null;
};

export type PublishingRecord = {
  id: string;
  platform: "FACEBOOK" | "INSTAGRAM";
  status: string;
  mode: string;
  platformUrl?: string | null;
};

export type ContentItem = {
  id: string;
  headline?: string | null;
  caption?: string | null;
  cta?: string | null;
  hashtags?: string | null;
  publishingRecords?: PublishingRecord[];
};

export type ContentRequest = {
  id: string;
  topic: string;
  brand: string;
  businessLine: string;
  product?: string | null;
  market?: string | null;
  audience?: string | null;
  format: "text" | "text_image" | "text_video" | "carousel";
  status: string;
  createdAt: string;
  items: ContentItem[];
  assets: CreativeAsset[];
  jobs: AutomationJob[];
};

export type WorkflowStage = "draft" | "generating_copy" | "copy_failed" | "review_copy" | "generating_media" | "media_failed" | "review_media" | "ready" | "rejected" | "archived";

const runningStatuses = new Set(["QUEUED", "SUBMITTED", "RUNNING", "WAITING_FOR_EXTERNAL_SERVICE", "WAITING_FOR_CALLBACK", "RETRY_SCHEDULED"]);

export function needsMedia(format: ContentRequest["format"]) {
  return format !== "text";
}

export function formatLabel(format: ContentRequest["format"]) {
  return ({ text: "Text only", text_image: "Text and image", text_video: "Text and video", carousel: "Carousel" } as const)[format];
}

export function deriveStage(request: ContentRequest): WorkflowStage {
  if (request.status === "REJECTED") return "rejected";
  if (request.status === "ARCHIVED") return "archived";
  if (request.status === "APPROVED_PUBLICATION") return "ready";
  const creativeJob = request.jobs.find((job) => job.jobType === "creative_image_generation" || job.jobType === "creative_video_generation");
  if (creativeJob?.currentStatus === "FAILED") return "media_failed";
  if (creativeJob && runningStatuses.has(creativeJob.currentStatus)) return "generating_media";
  if (request.assets.some((asset) => asset.status === "ready_for_review" && asset.approvalStatus !== "approved")) return "review_media";
  if (request.status === "APPROVED_INTERNAL" && needsMedia(request.format)) return "generating_media";
  const copyJob = request.jobs.find((job) => job.jobType === "content_generation");
  if (copyJob?.currentStatus === "FAILED" && request.items.length === 0) return "copy_failed";
  if (copyJob && runningStatuses.has(copyJob.currentStatus)) return "generating_copy";
  if (request.items[0] && ["AWAITING_REVIEW", "REVISION_REQUESTED", "GENERATION_COMPLETED"].includes(request.status)) return "review_copy";
  return "draft";
}

export function stageLabel(stage: WorkflowStage) {
  return {
    draft: "Draft", generating_copy: "Generating copy", copy_failed: "Copy failed", review_copy: "Needs copy review",
    generating_media: "Creating media", media_failed: "Media failed", review_media: "Needs media review",
    ready: "Ready to publish", rejected: "Rejected", archived: "Archived"
  }[stage];
}

export function isProcessing(request: ContentRequest) {
  return request.jobs.some((job) => runningStatuses.has(job.currentStatus));
}

export function assetUrl(asset?: CreativeAsset) {
  const file = asset?.metadata?.file;
  const value = asset?.metadata?.url ?? file?.url ?? file?.public_url ?? file?.path;
  return typeof value === "string" && /^https?:\/\//.test(value) ? value : null;
}
