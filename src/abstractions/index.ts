/**
 * Adapter abstractions for @backlog-md/core
 *
 * Re-exports common adapters from @principal-ai/repository-abstraction
 * and adds backlog-specific adapters (GitAdapter).
 */

// Re-export filesystem and glob adapters from repository-abstraction
export type {
  FileSystemAdapter,
  FileStats,
  GlobAdapter,
  GlobOptions,
} from "@principal-ai/repository-abstraction";

// Backlog-specific git adapter
export type {
  GitAdapter,
  GitExecResult,
  GitExecOptions,
  GitOperationsInterface,
} from "./GitAdapter";
