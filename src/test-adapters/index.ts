/**
 * Test adapters for @backlog-md/core
 *
 * Provides in-memory and mock implementations of adapters for testing.
 */

// Re-export InMemoryFileSystemAdapter from repository-abstraction
export { InMemoryFileSystemAdapter } from "@principal-ai/repository-abstraction";

// Backlog-specific mock adapters
export { MockGitAdapter } from "./MockGitAdapter";

// Re-export adapter types for convenience
export type {
  FileSystemAdapter,
  GlobAdapter,
  GlobOptions,
} from "@principal-ai/repository-abstraction";

export type { GitAdapter, GitExecResult } from "../abstractions";

/**
 * Create a complete set of test adapters
 */
export function createTestAdapters() {
  const { InMemoryFileSystemAdapter } = require("@principal-ai/repository-abstraction");
  const { MockGitAdapter } = require("./MockGitAdapter");

  return {
    fs: new InMemoryFileSystemAdapter(),
    git: new MockGitAdapter(),
  };
}
