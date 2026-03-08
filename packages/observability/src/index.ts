import { context, trace, metrics as otelMetrics } from "@opentelemetry/api";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { NodeSDK } from "@opentelemetry/sdk-node";

export type LogLevel = "info" | "error";
export interface LogContext { service?: string; correlationId?: string; jobId?: string; [key: string]: unknown; }
let sdk: NodeSDK | null = null;

export async function setupTelemetry(serviceName: string, endpoint?: string, headers?: string): Promise<void> {
  if (!endpoint || sdk) return;
  sdk = new NodeSDK({
    serviceName,
    traceExporter: new OTLPTraceExporter({ url: `${endpoint.replace(/\/$/, "")}/v1/traces`, headers: headers ? JSON.parse(headers) : undefined }),
    instrumentations: [getNodeAutoInstrumentations()]
  });
  await sdk.start();
}

export async function shutdownTelemetry(): Promise<void> { if (sdk) await sdk.shutdown(); }

function emit(level: LogLevel, message: string, meta?: LogContext): void {
  const payload = { level, message, timestamp: new Date().toISOString(), traceId: trace.getSpan(context.active())?.spanContext().traceId, ...meta };
  (level === "error" ? console.error : console.log)(JSON.stringify(payload));
}

export function createLogger(defaultContext: LogContext) {
  return { info: (m: string, meta?: LogContext) => emit("info", m, { ...defaultContext, ...meta }), error: (m: string, meta?: LogContext) => emit("error", m, { ...defaultContext, ...meta }) };
}

export function logInfo(message: string, meta?: Record<string, unknown>): void { emit("info", message, meta); }
export function logError(message: string, meta?: Record<string, unknown>): void { emit("error", message, meta); }

const meter = otelMetrics.getMeter("claricore");
const counters = new Map<string, ReturnType<typeof meter.createCounter>>();
const histos = new Map<string, ReturnType<typeof meter.createHistogram>>();

export class Metrics {
  increment(name: string, value = 1, tags?: Record<string, string>): void {
    if (!counters.has(name)) counters.set(name, meter.createCounter(name));
    counters.get(name)?.add(value, tags);
    logInfo("metric.increment", { metric: name, value, tags });
  }
  timing(name: string, ms: number, tags?: Record<string, string>): void {
    if (!histos.has(name)) histos.set(name, meter.createHistogram(name));
    histos.get(name)?.record(ms, tags);
    logInfo("metric.timing", { metric: name, ms, tags });
  }
}
export const metrics = new Metrics();

export function startSpan(name: string, attrs?: Record<string, string>) {
  const tracer = trace.getTracer("claricore");
  const span = tracer.startSpan(name, { attributes: attrs });
  const started = Date.now();
  return { end: () => { span.end(); logInfo("span.completed", { span: name, durationMs: Date.now() - started, ...attrs }); } };
}
