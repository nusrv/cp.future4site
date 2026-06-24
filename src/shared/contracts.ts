import { z } from "zod";

export const integrationModeSchema = z.enum(["mock", "dry-run", "live"]);
export type IntegrationMode = z.infer<typeof integrationModeSchema>;

export const jobStatusSchema = z.enum([
  "draft",
  "queued",
  "submitted",
  "running",
  "waiting_for_external_service",
  "waiting_for_callback",
  "completed",
  "completed_with_warnings",
  "failed",
  "retry_scheduled",
  "awaiting_human_review",
  "revision_requested",
  "approved_internal",
  "approved_for_publication",
  "rejected",
  "cancel_requested",
  "cancelled",
  "archived"
]);
export type JobStatus = z.infer<typeof jobStatusSchema>;

export const contentStatusSchema = z.enum([
  "draft",
  "submitted",
  "generating",
  "waiting_for_external_service",
  "generation_completed",
  "awaiting_review",
  "revision_requested",
  "approved_internal",
  "approved_publication",
  "rejected",
  "archived",
  "failed"
]);
export type ContentStatus = z.infer<typeof contentStatusSchema>;

export const contentRequestSchema = z.object({
  topic: z.string().min(3).max(500),
  brand: z.string().min(1).max(120),
  businessLine: z.string().min(1).max(120),
  product: z.string().max(160).optional().default(""),
  market: z.string().max(160).optional().default(""),
  audience: z.string().max(240).optional().default(""),
  objective: z.string().max(500).optional().default(""),
  channel: z.string().max(120).optional().default("Facebook, Instagram"),
  format: z.enum(["text", "text_image", "text_video", "carousel"]),
  cta: z.string().max(180).optional().default(""),
  internalNotes: z.string().max(2000).optional().default(""),
  requestedPublishingChannels: z.array(z.enum(["facebook", "instagram"])).default([])
});
export type ContentRequestInput = z.infer<typeof contentRequestSchema>;

export const automationRequestSchema = z.object({
  job_id: z.string(),
  correlation_id: z.string(),
  idempotency_key: z.string(),
  workflow_type: z.string(),
  workflow_version: z.string(),
  requested_by_user_id: z.string(),
  created_at: z.string(),
  callback_url: z.string().url(),
  signature_timestamp: z.string(),
  nonce: z.string(),
  signature: z.string(),
  payload: z.record(z.unknown())
});

export const automationCallbackSchema = z.object({
  job_id: z.string(),
  correlation_id: z.string(),
  idempotency_key: z.string().optional(),
  workflow_type: z.string(),
  workflow_version: z.string().optional(),
  status: jobStatusSchema,
  current_step: z.string().optional(),
  nonce: z.string(),
  signature_timestamp: z.string(),
  signature: z.string(),
  progress: z.number().min(0).max(100).optional(),
  outputs: z.record(z.unknown()).optional(),
  files: z.array(z.record(z.unknown())).optional(),
  warnings: z.array(z.string()).optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    retryable: z.boolean().default(false)
  }).optional(),
  cost: z.object({
    credits: z.number().optional(),
    currency: z.string().optional(),
    amount: z.number().optional()
  }).optional()
});
export type AutomationCallback = z.infer<typeof automationCallbackSchema>;

export const publishPlatformSchema = z.enum(["facebook", "instagram"]);
export type PublishPlatform = z.infer<typeof publishPlatformSchema>;

