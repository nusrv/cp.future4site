import { z } from "zod";
import { integrationModeSchema } from "../shared/contracts.js";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  COOKIE_SECURE: z.coerce.boolean().default(false),
  INTEGRATION_MODE: integrationModeSchema.default("mock"),
  N8N_LIVE_ENABLED: z.coerce.boolean().default(false),
  N8N_BASE_URL: z.string().optional().default(""),
  N8N_WEBHOOK_BASE_PATH: z.string().optional().default("webhook"),
  N8N_CONTENT_WEBHOOK_PATH: z.string().optional().default("future-foresight/content-generation"),
  N8N_CREATIVE_IMAGE_WEBHOOK_PATH: z.string().optional().default("future-foresight/creative-image-generation"),
  N8N_CREATIVE_VIDEO_WEBHOOK_PATH: z.string().optional().default("future-foresight/creative-video-generation"),
  N8N_PUBLISH_WEBHOOK_PATH: z.string().optional().default("future-foresight/facebook-publishing"),
  N8N_WEBHOOK_SECRET: z.string().optional().default(""),
  N8N_API_KEY: z.string().optional().default(""),
  PLATFORM_CALLBACK_SECRET: z.string().min(32),
  META_PUBLISHING_ENABLED: z.coerce.boolean().default(false),
  SMTP_ENABLED: z.coerce.boolean().default(false),
  FILE_STORAGE_DRIVER: z.enum(["local", "mock", "s3"]).default("local"),
  FILE_STORAGE_PATH: z.string().default("./storage"),
  PUBLIC_ASSET_BASE_URL: z.string().optional().default(""),
  MAX_UPLOAD_MB: z.coerce.number().int().positive().default(25),
  KNOWLEDGE_EXTRACTION_ENABLED: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  KNOWLEDGE_PDFTOTEXT_PATH: z.string().trim().min(1).default("pdftotext"),
  KNOWLEDGE_EXTRACTION_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(30000),
  KNOWLEDGE_EXTRACTION_MAX_CHARS: z.coerce.number().int().min(1000).max(10000000).default(2000000),
  LOG_LEVEL: z.string().default("info")
});

export const config = envSchema.parse(process.env);

export type AppConfig = typeof config;
