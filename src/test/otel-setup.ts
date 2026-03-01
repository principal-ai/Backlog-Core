/**
 * OpenTelemetry test setup for Backlog-Core
 *
 * This module configures a tracer provider that sends telemetry to a local
 * OpenTelemetry collector. Use this in integration tests to capture real
 * telemetry data.
 *
 * Usage:
 * ```typescript
 * import { setupOTEL, shutdownOTEL } from './test/otel-setup';
 *
 * beforeAll(async () => {
 *   await setupOTEL();
 * });
 *
 * afterAll(async () => {
 *   await shutdownOTEL();
 * });
 * ```
 */

import { trace } from "@opentelemetry/api";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";
import { TRACER_NAME, TRACER_VERSION } from "../telemetry";

let tracerProvider: NodeTracerProvider | null = null;

export interface OTELSetupOptions {
  /**
   * OTLP collector endpoint
   * @default 'http://localhost:4318/v1/traces'
   */
  endpoint?: string;

  /**
   * Service name for telemetry
   * @default '@backlog-md/core-test'
   */
  serviceName?: string;
}

/**
 * Set up OpenTelemetry with OTLP HTTP exporter
 *
 * This registers a global tracer provider that sends spans to the configured
 * OTLP collector endpoint. Call this in beforeAll() of your test suite.
 */
export async function setupOTEL(options: OTELSetupOptions = {}): Promise<void> {
  const endpoint = options.endpoint ?? "http://localhost:4318/v1/traces";
  const serviceName = options.serviceName ?? "@backlog-md/core-test";

  // Create OTLP exporter
  const exporter = new OTLPTraceExporter({
    url: endpoint,
  });

  // Create resource with service info
  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: serviceName,
    [ATTR_SERVICE_VERSION]: TRACER_VERSION,
    "library.name": TRACER_NAME,
    "library.version": TRACER_VERSION,
    "test.framework": "bun",
  });

  // Create and register tracer provider
  tracerProvider = new NodeTracerProvider({
    resource,
    spanProcessors: [new SimpleSpanProcessor(exporter)],
  });

  // Register globally so getTracer() returns a real tracer
  tracerProvider.register();

  console.log(`[OTEL] Initialized tracer provider, exporting to ${endpoint}`);
}

/**
 * Shutdown OpenTelemetry and flush pending spans
 *
 * Call this in afterAll() to ensure all spans are exported before tests end.
 */
export async function shutdownOTEL(): Promise<void> {
  if (tracerProvider) {
    await tracerProvider.shutdown();
    tracerProvider = null;
    trace.disable();
    console.log("[OTEL] Tracer provider shut down");
  }
}

/**
 * Force flush pending spans without shutting down
 *
 * Useful for ensuring spans are exported mid-test.
 */
export async function flushOTEL(): Promise<void> {
  if (tracerProvider) {
    await tracerProvider.forceFlush();
  }
}
