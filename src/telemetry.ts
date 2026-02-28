/**
 * OpenTelemetry utilities for Backlog-Core
 *
 * This library follows the OpenTelemetry library instrumentation pattern:
 * - Uses only @opentelemetry/api (platform-agnostic)
 * - Does NOT create its own provider/exporters
 * - Gets tracer from the global provider set up by the application
 * - Returns no-op tracer if no provider is registered (safe, does nothing)
 *
 * The application using this library is responsible for:
 * - Setting up the tracer provider (WebTracerProvider for browser, NodeSDK for Node.js)
 * - Configuring exporters and span processors
 * - Registering the provider globally
 */

import { type Tracer, trace } from "@opentelemetry/api";
import packageJson from "../package.json";

export const TRACER_NAME = "@backlog-md/core";
export const TRACER_VERSION = packageJson.version;

/**
 * Get a tracer instance for instrumenting backlog-core operations
 *
 * This function retrieves a tracer from the global OpenTelemetry provider
 * that was set up by the application. If no provider is registered, it
 * returns a no-op tracer that safely does nothing.
 *
 * The tracer is tagged with the library name and version, allowing you to
 * identify and filter spans by instrumentation library in your observability tools.
 *
 * @returns Tracer instance (real tracer if provider is registered, no-op tracer otherwise)
 *
 * @example
 * ```typescript
 * import { getTracer } from '@backlog-md/core';
 *
 * const tracer = getTracer();
 * const span = tracer.startSpan('core.init');
 * try {
 *   // ... do work ...
 * } finally {
 *   span.end();
 * }
 * ```
 */
export function getTracer(): Tracer {
  return trace.getTracer(TRACER_NAME, TRACER_VERSION);
}
