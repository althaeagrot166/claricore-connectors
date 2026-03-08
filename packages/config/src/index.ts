import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  WEBHOOK_PORT: z.coerce.number().default(4100),
  WORKER_HEALTH_PORT: z.coerce.number().default(4200),
  SCHEDULER_HEALTH_PORT: z.coerce.number().default(4300),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  QUEUE_NAME: z.string().min(1).default("sync-jobs"),
  LOG_LEVEL: z.string().default("info"),
  ENCRYPTION_KEY: z.string().length(64),
  WEBHOOK_SIGNATURE_SECRET: z.string().default("dev-webhook-secret"),
  API_KEY: z.string().default("dev-api-key"),
  LOADER_TYPE: z.enum(["http", "jsonl", "postgres"]).default("http"),
  LOADER_BATCH_SIZE: z.coerce.number().default(100),
  CLARICORE_INGESTION_BASE_URL: z.string().default("http://localhost:8080"),
  CLARICORE_INGESTION_TOKEN: z.string().default("dev-token"),
  JSONL_OUTPUT_PATH: z.string().default("./tmp/claricore-output.jsonl"),
  OTEL_SERVICE_NAME: z.string().default("claricore"),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
  OTEL_EXPORTER_OTLP_HEADERS: z.string().optional()
});

export function getConfig() {
  const env = envSchema.parse(process.env);

  return {
    port: env.PORT,
    webhookPort: env.WEBHOOK_PORT,
    workerHealthPort: env.WORKER_HEALTH_PORT,
    schedulerHealthPort: env.SCHEDULER_HEALTH_PORT,
    databaseUrl: env.DATABASE_URL,
    redisUrl: env.REDIS_URL,
    queueName: env.QUEUE_NAME,
    logLevel: env.LOG_LEVEL,
    encryptionKey: env.ENCRYPTION_KEY,
    webhookSignatureSecret: env.WEBHOOK_SIGNATURE_SECRET,
    apiKey: env.API_KEY,
    loaderType: env.LOADER_TYPE,
    loaderBatchSize: env.LOADER_BATCH_SIZE,
    claricoreIngestionBaseUrl: env.CLARICORE_INGESTION_BASE_URL,
    claricoreIngestionToken: env.CLARICORE_INGESTION_TOKEN,
    jsonlOutputPath: env.JSONL_OUTPUT_PATH,
    otelServiceName: env.OTEL_SERVICE_NAME,
    otelEndpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT,
    otelHeaders: env.OTEL_EXPORTER_OTLP_HEADERS
  };
}
