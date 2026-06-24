import path from "node:path";
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import { config } from "./config.js";
import { prisma } from "./db.js";
import { authRoutes } from "./routes/auth.js";
import { automationRoutes } from "./routes/automation.js";
import { contentRoutes } from "./routes/content.js";
import { operationsRoutes } from "./routes/operations.js";

export async function buildServer() {
  const app = Fastify({ logger: { level: config.LOG_LEVEL, redact: ["req.headers.authorization", "req.headers.cookie"] } });
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cookie, { secret: config.SESSION_SECRET });
  await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });
  await app.register(multipart, { limits: { fileSize: config.MAX_UPLOAD_MB * 1024 * 1024 } });

  app.setErrorHandler((error, _request, reply) => {
    const errorStatus = "statusCode" in error && typeof error.statusCode === "number" ? error.statusCode : undefined;
    const status = reply.statusCode >= 400 ? reply.statusCode : errorStatus ?? 500;
    if (status >= 500) app.log.error(error);
    const safeMessage = errorStatus ? error.message : "Internal server error";
    reply.code(status).send({ error: status >= 500 ? safeMessage : error.message });
  });

  app.get("/health", async () => {
    let database = "unknown";
    try {
      await prisma.$queryRaw`SELECT 1`;
      database = "ok";
    } catch {
      database = "error";
    }
    return {
      application: "ok",
      database,
      storage: config.FILE_STORAGE_DRIVER,
      integrationMode: config.INTEGRATION_MODE,
      n8nConfigured: Boolean(config.N8N_BASE_URL && config.N8N_WEBHOOK_SECRET),
      metaPublishingEnabled: config.META_PUBLISHING_ENABLED
    };
  });

  await authRoutes(app);
  await automationRoutes(app);
  await contentRoutes(app);
  await operationsRoutes(app);

  const clientRoot = path.resolve("dist-client");
  await app.register(fastifyStatic, { root: clientRoot, prefix: "/" });
  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith("/api/")) return reply.code(404).send({ error: "Not found" });
    return reply.sendFile("index.html");
  });
  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const app = await buildServer();
  await app.listen({ port: config.PORT, host: "0.0.0.0" });
}
